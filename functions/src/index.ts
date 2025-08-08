// functions/src/index.ts

import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { VertexAI } from "@google-cloud/vertexai";

setGlobalOptions({ region: "asia-southeast2" });

initializeApp();
const db = getFirestore();
const vertexAI = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: "asia-southeast1" });
const generativeModel = vertexAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});


interface Team { name: string; flag: string; code: string; }
interface PointRule { correctScore: number; correctOutcome: number; }
interface PointRules { groupStage: PointRule; round32?: PointRule; round16?: PointRule; quarterFinal?: PointRule; semiFinal?: PointRule; thirdPlaceMatch?: PointRule; final?: PointRule; championBonus?: number; }
type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";
interface Match { id: string; stage: MatchStage; team1: Team; team2: Team; team1Score?: number; team2Score?: number; }
interface Tournament { id: string; name: string; pointRules?: PointRules; matches?: Match[]; knockoutMatches?: Match[]; participants?: string[]; champion?: string; teams?: Team[]; }
interface MatchPrediction { team1Score: number; team2Score: number; }
interface UserPredictions { tournamentId: string; userId: string; championPrediction?: string; matchPredictions: Record<string, MatchPrediction>; }
interface UserProfile { uid: string; name: string; email: string; role: 'user' | 'admin' | 'superadmin'; }
interface LeaderboardEntry { userId: string; userName: string; totalPoints: number; rank: number; previousRank?: number | null; rankChange: "up" | "down" | "same"; aiSummary?: string; }

// --- AI CAPABILITIES ---

async function generateAiSummary(prompt: string): Promise<string> {
    try {
        const resp = await generativeModel.generateContent(prompt);
        const summary = resp.response.candidates?.[0]?.content?.parts?.[0]?.text;
        return summary || "";
    } catch (error) {
        logger.error("Error generating AI summary:", error);
        return "";
    }
}

const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage", "Round of 32": "round32", "Round of 16": "round16",
    "Quarter-final": "quarterFinal", "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch", "Final": "final",
};

async function recalculateLeaderboard(tournamentId: string) {
    logger.info(`Recalculating leaderboard for tournament: ${tournamentId}`);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();
    if (!tournamentDoc.exists) {
        logger.error(`Tournament ${tournamentId} not found.`);
        return;
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    if (!tournamentData.participants || tournamentData.participants.length === 0 || !tournamentData.pointRules) {
        logger.info("Tournament has no participants or point rules. Skipping.");
        return;
    }

    const predictionsPromises = tournamentData.participants.map(userId => db.collection("predictions").doc(`${tournamentId}_${userId}`).get());
    const usersPromises = tournamentData.participants.map(userId => db.collection("users").doc(userId).get());
    const [predictionsSnapshots, usersSnapshots] = await Promise.all([Promise.all(predictionsPromises), Promise.all(usersPromises)]);

    const userPredictionsMap = new Map(predictionsSnapshots.filter(s => s.exists).map(s => [s.data()!.userId, s.data() as UserPredictions]));
    const userProfilesMap = new Map(usersSnapshots.filter(s => s.exists).map(s => [s.data()!.uid, s.data() as UserProfile]));
    
    const allMatches = [...(tournamentData.matches || []), ...(tournamentData.knockoutMatches || [])];
    const completedMatches = allMatches.filter(m => typeof m.team1Score === 'number');
    const tournamentCompletion = Math.round((completedMatches.length / allMatches.length) * 100);
    const isGroupStageOver = !allMatches.some(m => m.stage === 'Group Stage' && typeof m.team1Score !== 'number');
    
    const leaderboardData: any[] = [];

    for (const userId of tournamentData.participants) {
        const predictions = userPredictionsMap.get(userId);
        const userProfile = userProfilesMap.get(userId);
        if (!userProfile || !predictions) continue;

        let totalPoints = 0;
        let bestPick = { points: 0, description: "N/A" };

        for (const match of allMatches) {
            if (typeof match.team1Score !== "number" || typeof match.team2Score !== "number") continue;
            const prediction = predictions.matchPredictions[match.id];
            if (!prediction || prediction.team1Score < 0) continue;

            const actualOutcome = Math.sign(match.team1Score - match.team2Score);
            const predictedOutcome = Math.sign(prediction.team1Score - prediction.team2Score);
            const stageKey = stageToRuleKeyMap[match.stage];
            const rules = ((stageKey && tournamentData.pointRules?.[stageKey]) ? tournamentData.pointRules[stageKey] : tournamentData.pointRules.groupStage) as PointRule;
            
            let matchPoints = 0;
            if (actualOutcome === predictedOutcome) {
                matchPoints += rules.correctOutcome;
                if (match.team1Score === prediction.team1Score && match.team2Score === prediction.team2Score) {
                    matchPoints += rules.correctScore;
                }
            }
            totalPoints += matchPoints;
            if (matchPoints > bestPick.points) {
                bestPick = { points: matchPoints, description: `${match.team1.name} vs ${match.team2.name}` };
            }
        }
        if (tournamentData.champion && tournamentData.champion === predictions.championPrediction) {
            totalPoints += tournamentData.pointRules.championBonus || 0;
        }
        leaderboardData.push({ userId, userName: userProfile.name, totalPoints, bestPick });
    }

    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldRanksMap = new Map<string, number>();
    if (oldLeaderboardSnap.exists) {
        (oldLeaderboardSnap.data()?.entries || []).forEach((e: LeaderboardEntry) => oldRanksMap.set(e.userId, e.rank));
    }
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    
    const newLeaderboardPromises = leaderboardData.map(async (data, index) => {
        const rank = index + 1;
        const previousRank = oldRanksMap.get(data.userId);
        let rankChange: "up" | "down" | "same" = "same";
        let rankChangeText = "unchanged";
        if (typeof previousRank === 'number') {
            if (rank < previousRank) { rankChange = "up"; rankChangeText = `up ${previousRank - rank} spots`; }
            else if (rank > previousRank) { rankChange = "down"; rankChangeText = `down ${rank - previousRank} spots`; }
        }

        const leaderPoints = leaderboardData[0].totalPoints;
        const pointDifference = leaderPoints - data.totalPoints;
        const isOutOfContention = tournamentCompletion > 85 && pointDifference > (allMatches.length - completedMatches.length) * 8; // Heuristic for being out of contention

        let contextSpecificInstruction = "";
        if (isOutOfContention) {
            contextSpecificInstruction = "The user is likely too far behind to win. Conclude by encouraging them to enjoy the remaining matches and the fun of prediction.";
        } else if (isGroupStageOver) {
            contextSpecificInstruction = "The group stage is over. Frame the summary with an eye towards the knockout rounds, where predictions can be changed and more points are at stake.";
        } else {
            contextSpecificInstruction = "The group stage is still in progress. Frame the summary based on their locked-in predictions and how they are performing so far.";
        }

        const prompt = `You are a supportive and enthusiastic sports commentator for the 'Udug Bets' prediction game. Write a detailed, engaging summary (3-4 sentences) for a user named '${data.userName}'.
        
        User Data:
        - Current Rank: ${rank} of ${leaderboardData.length}
        - Total Points: ${data.totalPoints}
        - Rank Change: ${rankChangeText}
        - Best Prediction: Earned ${data.bestPick.points} points on the ${data.bestPick.description} match.

        Instructions:
        - Start by acknowledging their current rank and performance.
        - Mention their best prediction as a highlight.
        - ${contextSpecificInstruction}
        - Maintain a supportive and fun tone throughout.`;
        
        const aiSummary = await generateAiSummary(prompt);

        return { userId: data.userId, userName: data.userName, totalPoints: data.totalPoints, rank, previousRank: previousRank ?? null, rankChange, aiSummary };
    });

    const newLeaderboard = await Promise.all(newLeaderboardPromises);

    let adminSummary = "";
    if (newLeaderboard.length > 1) {
        const leader = newLeaderboard[0];
        const secondPlace = newLeaderboard[1];
        const thirdPlace = newLeaderboard[2];

        const biggestMover = newLeaderboard.reduce((prev, curr) => {
            const prevChange = prev.previousRank ? prev.previousRank - prev.rank : 0;
            const currChange = curr.previousRank ? curr.previousRank - curr.rank : 0;
            return (currChange > prevChange) ? curr : prev;
        });
        const biggestMoverClimb = biggestMover.previousRank ? biggestMover.previousRank - biggestMover.rank : 0;

        const biggestDropper = newLeaderboard.reduce((prev, curr) => {
            const prevChange = prev.previousRank ? prev.rank - prev.previousRank : 0;
            const currChange = curr.previousRank ? curr.rank - curr.previousRank : 0;
            return (currChange > prevChange) ? curr : prev;
        });
        const biggestDrop = biggestDropper.previousRank ? biggestDropper.rank - biggestDropper.previousRank : 0;

        const midRankIndex = Math.floor(newLeaderboard.length / 2);
        const midRankUser = newLeaderboard[midRankIndex];
        
        const bottomRankUser = newLeaderboard[newLeaderboard.length - 1];

        const adminPrompt = `You are a sports journalist providing a detailed, analytical summary (5-6 sentences) of a tournament leaderboard for an administrator.
        
        Data:
        - Tournament Completion: ${tournamentCompletion}%
        - Top 3: 1st ${leader.userName} (${leader.totalPoints} pts), 2nd ${secondPlace.userName} (${secondPlace.totalPoints} pts), 3rd ${thirdPlace.userName} (${thirdPlace.totalPoints} pts).
        - Mid-table user: ${midRankUser.userName} is at rank ${midRankUser.rank}.
        - Bottom-table user: ${bottomRankUser.userName} is at rank ${bottomRankUser.rank}.
        - Biggest Mover: ${biggestMover.userName}, who jumped ${biggestMoverClimb} spots.
        - Biggest Drop: ${biggestDropper.userName}, who fell ${biggestDrop} spots.

        Instructions:
        - Start with the tournament completion percentage.
        - Analyze the top 3, mentioning the leader's performance and the race for the podium.
        - Describe the situation in the middle of the pack, using the mid-table user as an example.
        - Comment on the bottom of the leaderboard, highlighting the biggest drop.
        - Conclude with an analytical look ahead, considering the current stage of the tournament and how the dynamics might change.
        - Maintain an insightful and professional tone.`;
        adminSummary = await generateAiSummary(adminPrompt);
    }

    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        tournamentAiSummary: adminSummary,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated with AI summaries.`);
}

// --- OTHER CLOUD FUNCTION TRIGGERS & CALLABLES ---

export const onTournamentUpdate = onDocumentUpdated("tournaments/{tournamentId}", async (event) => {
    const beforeData = event.data?.before.data() as Tournament | undefined;
    const afterData = event.data?.after.data() as Tournament | undefined;
    if (!beforeData || !afterData) return;
    const scoresChanged = JSON.stringify(beforeData.matches) !== JSON.stringify(afterData.matches) ||
                          JSON.stringify(beforeData.knockoutMatches) !== JSON.stringify(afterData.knockoutMatches);
    const championChanged = beforeData.champion !== afterData.champion;
    const participantsChanged = JSON.stringify(beforeData.participants) !== JSON.stringify(afterData.participants);
    if (scoresChanged || championChanged || participantsChanged) {
        await recalculateLeaderboard(event.params.tournamentId);
    }
});

export const onPredictionWrite = onDocumentWritten("predictions/{predictionId}", async (event) => {
    const predictionData = event.data?.after.data() as UserPredictions | undefined;
    const oldPredictionData = event.data?.before.data() as UserPredictions | undefined;
    const tournamentId = predictionData?.tournamentId || oldPredictionData?.tournamentId;
    if (tournamentId) {
        await recalculateLeaderboard(tournamentId);
    } else {
        logger.warn(`Could not find tournamentId for prediction document ${event.params.predictionId}`);
    }
});

export const deleteTournamentAndData = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }
  
    const { tournamentId } = request.data;
    if (!tournamentId) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'tournamentId'.");
    }
  
    const userDoc = await db.collection("users").doc(uid).get();
    const userProfile = userDoc.data();
  
    if (!userProfile || !['admin', 'superadmin'].includes(userProfile.role)) {
      throw new HttpsError("permission-denied", "You do not have permission to delete tournaments.");
    }
  
    logger.info(`Admin user ${uid} initiated deletion for tournament ${tournamentId}`);
  
    try {
      const predictionsRef = db.collection("predictions");
      const predictionsQuery = predictionsRef.where("tournamentId", "==", tournamentId);
      const predictionsSnapshot = await predictionsQuery.get();
  
      const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
      let currentBatchIndex = 0;
      let operationCount = 0;
  
      predictionsSnapshot.forEach((doc) => {
        batches[currentBatchIndex].delete(doc.ref);
        operationCount++;
        if (operationCount === 499) {
          batches.push(db.batch());
          currentBatchIndex++;
          operationCount = 0;
        }
      });
  
      const tournamentRef = db.collection("tournaments").doc(tournamentId);
      const leaderboardRef = db.collection("leaderboards").doc(tournamentId);
  
      batches[currentBatchIndex].delete(tournamentRef);
      batches[currentBatchIndex].delete(leaderboardRef);
  
      await Promise.all(batches.map((batch) => batch.commit()));
  
      logger.info(`Successfully deleted tournament ${tournamentId} and ${predictionsSnapshot.size} associated predictions.`);
      return { success: true, message: "Tournament and all associated data deleted successfully." };
  
    } catch (error) {
      logger.error(`Error during tournament deletion for ${tournamentId}:`, error);
      throw new HttpsError("internal", "An unexpected error occurred while deleting the tournament.");
    }
});

export const getTournamentParticipants = onCall(async (request) => {
    const { tournamentId } = request.data;
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'You must be logged in to view participants.');
    }
    if (!tournamentId) {
        throw new HttpsError('invalid-argument', 'The function must be called with a "tournamentId" argument.');
    }
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();
    if (!tournamentDoc.exists) {
        throw new HttpsError('not-found', 'Tournament not found.');
    }
    const tournament = tournamentDoc.data() as Tournament;
    const participants = tournament.participants || [];
    const userProfileDoc = await db.collection('users').doc(uid).get();
    const userProfile = userProfileDoc.data() as UserProfile;
    const isAdmin = userProfile.role === 'admin' || userProfile.role === 'superadmin';
    if (!participants.includes(uid) && !isAdmin) {
        throw new HttpsError('permission-denied', 'You are not a participant of this tournament.');
    }
    if (participants.length === 0) {
        return [];
    }
    
    const participantProfiles: UserProfile[] = [];
    const usersCollection = db.collection('users');

    for (let i = 0; i < participants.length; i += 30) {
        const chunk = participants.slice(i, i + 30);
        const usersQuery = usersCollection.where('uid', 'in', chunk);
        const usersSnap = await usersQuery.get();
        usersSnap.forEach(doc => {
            participantProfiles.push(doc.data() as UserProfile);
        });
    }

    return participantProfiles;
});
