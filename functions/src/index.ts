import * as logger from "firebase-functions/logger";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp }from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

// --- TYPE DEFINITIONS ---
interface Team {
  name: string;
  flag: string;
  code: string;
}

interface PointRule {
    correctScore: number;
    correctOutcome: number;
}

interface PointRules {
    groupStage: PointRule;
    round32?: PointRule;
    round16?: PointRule;
    quarterFinal?: PointRule;
    semiFinal?: PointRule;
    thirdPlaceMatch?: PointRule;
    final?: PointRule;
    championBonus?: number;
}

type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";

interface Match {
    id: string;
    stage: MatchStage;
    team1: Team;
    team2: Team;
    team1Score?: number;
    team2Score?: number;
}

interface Tournament {
    id: string;
    name: string;
    pointRules?: PointRules;
    matches?: Match[];
    knockoutMatches?: Match[];
    participants?: string[];
    champion?: string;
}

interface MatchPrediction {
    team1Score: number;
    team2Score: number;
}

interface UserPredictions {
    tournamentId: string;
    userId: string;
    championPrediction?: string;
    matchPredictions: Record<string, MatchPrediction>;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
}

interface LeaderboardEntry {
    userId: string;
    userName: string;
    totalPoints: number;
    rank: number;
    previousRank?: number | null;
    rankChange: "up" | "down" | "same";
}


// --- REUSABLE LEADERBOARD CALCULATION LOGIC ---
const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage",
    "Round of 32": "round32",
    "Round of 16": "round16",
    "Quarter-final": "quarterFinal",
    "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch",
    "Final": "final",
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

/**
 * Triggered when an admin updates a tournament's scores, champion, or participants.
 */
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

/**
 * Triggered when a user creates, updates, or deletes their predictions.
 */
export const onPredictionWrite = onDocumentWritten("predictions/{predictionId}", async (event) => {
    // A prediction document was either created, updated, or deleted.
    // We need to get the tournamentId from the data to trigger the right leaderboard recalc.
    const predictionData = event.data?.after.data() as UserPredictions | undefined;
    
    // If the document was deleted, the data will be on `event.data.before`
    const oldPredictionData = event.data?.before.data() as UserPredictions | undefined;

    const tournamentId = predictionData?.tournamentId || oldPredictionData?.tournamentId;

    if (tournamentId) {
        await recalculateLeaderboard(tournamentId);
    } else {
        logger.warn(`Could not find tournamentId for prediction document ${event.params.predictionId}`);
    }
});
