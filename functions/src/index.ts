// functions/src/index.ts

import * as logger from "firebase-functions/logger";
// Import setGlobalOptions to define the deployment region
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// **CHANGE**: Set the deployment region for all functions in this file to Jakarta
setGlobalOptions({ region: "asia-southeast2" });

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

// --- TYPE DEFINITIONS (from your file) ---
interface Team { name: string; flag: string; code: string; }
interface PointRule { correctScore: number; correctOutcome: number; }
interface PointRules { groupStage: PointRule; round32?: PointRule; round16?: PointRule; quarterFinal?: PointRule; semiFinal?: PointRule; thirdPlaceMatch?: PointRule; final?: PointRule; championBonus?: number; }
type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";
interface Match { id: string; stage: MatchStage; team1: Team; team2: Team; team1Score?: number; team2Score?: number; }
interface Tournament { id: string; name: string; pointRules?: PointRules; matches?: Match[]; knockoutMatches?: Match[]; participants?: string[]; champion?: string; }
interface MatchPrediction { team1Score: number; team2Score: number; }
interface UserPredictions { tournamentId: string; userId: string; championPrediction?: string; matchPredictions: Record<string, MatchPrediction>; }
interface UserProfile { uid: string; name: string; email: string; role: 'user' | 'admin' | 'superadmin'; }
interface LeaderboardEntry { userId: string; userName: string; totalPoints: number; rank: number; previousRank?: number | null; rankChange: "up" | "down" | "same"; }


// --- REUSABLE LEADERBOARD CALCULATION LOGIC (from your file) ---
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
        logger.error(`Tournament ${tournamentId} not found for recalculation.`);
        return;
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    if (!tournamentData.participants || tournamentData.participants.length === 0 || !tournamentData.pointRules) {
        logger.info("Tournament has no participants or point rules. Skipping.");
        return;
    }
    const predictionsPromises = tournamentData.participants.map(userId =>
        db.collection("predictions").doc(`${tournamentId}_${userId}`).get()
    );
    const usersPromises = tournamentData.participants.map(userId =>
        db.collection("users").doc(userId).get()
    );
    const [predictionsSnapshots, usersSnapshots] = await Promise.all([
        Promise.all(predictionsPromises),
        Promise.all(usersPromises),
    ]);
    const userPredictionsMap = new Map<string, UserPredictions>();
    predictionsSnapshots.forEach(snap => {
        if (snap.exists) {
            const data = snap.data() as UserPredictions;
            userPredictionsMap.set(data.userId, data);
        }
    });
    const userProfilesMap = new Map<string, UserProfile>();
    usersSnapshots.forEach(snap => {
        if (snap.exists) {
            const data = snap.data() as UserProfile;
            userProfilesMap.set(data.uid, data);
        }
    });
    const allMatches = [...(tournamentData.matches || []), ...(tournamentData.knockoutMatches || [])];
    const leaderboardData: Omit<LeaderboardEntry, 'rank' | 'previousRank' | 'rankChange'>[] = [];
    for (const userId of tournamentData.participants) {
        const predictions = userPredictionsMap.get(userId) || {
            tournamentId: tournamentId,
            userId: userId,
            matchPredictions: {},
        };
        const userProfile = userProfilesMap.get(userId);
        if (!userProfile) continue;
        let totalPoints = 0;
        for (const match of allMatches) {
            if (typeof match.team1Score !== "number" || typeof match.team2Score !== "number") continue;
            const prediction = predictions.matchPredictions[match.id];
            if (!prediction || prediction.team1Score < 0 || prediction.team2Score < 0) continue;
            const actualOutcome = Math.sign(match.team1Score - match.team2Score);
            const predictedOutcome = Math.sign(prediction.team1Score - prediction.team2Score);
            const stageKey = stageToRuleKeyMap[match.stage];
            const rules = (stageKey && tournamentData.pointRules?.[stageKey]) ? (tournamentData.pointRules[stageKey] as PointRule) : tournamentData.pointRules.groupStage;
            if (actualOutcome === predictedOutcome) {
                totalPoints += rules.correctOutcome;
                if (match.team1Score === prediction.team1Score && match.team2Score === prediction.team2Score) {
                    totalPoints += rules.correctScore;
                }
            }
        }
        if (tournamentData.champion && tournamentData.champion === predictions.championPrediction) {
            totalPoints += tournamentData.pointRules.championBonus || 0;
        }
        leaderboardData.push({ userId, userName: userProfile.name, totalPoints });
    }
    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldLeaderboardEntries: LeaderboardEntry[] = oldLeaderboardSnap.exists ? oldLeaderboardSnap.data()?.entries || [] : [];
    const oldRanksMap = new Map<string, number>();
    oldLeaderboardEntries.forEach(entry => oldRanksMap.set(entry.userId, entry.rank));
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    const newLeaderboard: LeaderboardEntry[] = leaderboardData.map((data, index) => {
        const rank = index + 1;
        const previousRank = oldRanksMap.get(data.userId);
        let rankChange: "up" | "down" | "same" = "same";
        if (typeof previousRank === 'number') {
            if (rank < previousRank) rankChange = "up";
            else if (rank > previousRank) rankChange = "down";
        }
        return { ...data, rank, previousRank: previousRank ?? null, rankChange };
    });
    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated.`);
}


// --- CLOUD FUNCTION TRIGGERS ---

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


// --- CALLABLE FUNCTIONS ---

/**
 * Deletes a tournament and all of its associated data.
 * This is the secure and robust replacement for the onTournamentDelete trigger.
 */
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

/**
 * Fetches all participant profiles for a given tournament.
 * This function now handles more than 30 participants by batching queries.
 */
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

    // Process participants in chunks of 30 (the limit for 'in' queries)
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
