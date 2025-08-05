import * as logger from "firebase-functions/logger";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
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


// --- CLOUD FUNCTION ---
// Helper map to safely convert match stage names to PointRules keys
const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage",
    "Round of 32": "round32",
    "Round of 16": "round16",
    "Quarter-final": "quarterFinal",
    "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch",
    "Final": "final",
};

export const updateLeaderboard = onDocumentUpdated("tournaments/{tournamentId}", async (event) => {
    const beforeData = event.data?.before.data() as Tournament | undefined;
    const afterData = event.data?.after.data() as Tournament | undefined;

    if (!beforeData || !afterData) {
        logger.info("No data found in event, skipping leaderboard update.");
        return;
    }

    // --- FIX: Check if score-relevant data has actually changed ---
    const scoresChanged = JSON.stringify(beforeData.matches) !== JSON.stringify(afterData.matches) ||
                          JSON.stringify(beforeData.knockoutMatches) !== JSON.stringify(afterData.knockoutMatches);
    const championChanged = beforeData.champion !== afterData.champion;
    const participantsChanged = JSON.stringify(beforeData.participants) !== JSON.stringify(afterData.participants);

    if (!scoresChanged && !championChanged && !participantsChanged) {
        logger.info(`Tournament '${afterData.name}' updated, but no score-relevant data changed. Skipping leaderboard recalculation.`);
        return; // Exit the function early if only metadata like 'name' changed
    }
    // --- END FIX ---

    logger.info(`Score-relevant data for tournament ${event.params.tournamentId} updated, recalculating leaderboard.`);
    
    const tournamentData = afterData;

    if (!tournamentData.participants || tournamentData.participants.length === 0 || !tournamentData.pointRules) {
        logger.info("Tournament has no participants or point rules. Skipping leaderboard update.");
        return;
    }

    // 1. Fetch all predictions and user profiles
    const predictionsPromises = tournamentData.participants.map(userId => 
        db.collection("predictions").doc(`${event.params.tournamentId}_${userId}`).get()
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

    // 2. Calculate points for each user
    const allMatches = [...(tournamentData.matches || []), ...(tournamentData.knockoutMatches || [])];
    const leaderboardData: Omit<LeaderboardEntry, 'rank' | 'previousRank' | 'rankChange'>[] = [];

    for (const userId of tournamentData.participants) {
        const predictions = userPredictionsMap.get(userId);
        const userProfile = userProfilesMap.get(userId);
        if (!predictions || !userProfile) continue;

        let totalPoints = 0;

        // Calculate match points
        for (const match of allMatches) {
            if (typeof match.team1Score !== "number" || typeof match.team2Score !== "number") {
                continue; // Skip matches without scores
            }
            const prediction = predictions.matchPredictions[match.id];
            if (!prediction || prediction.team1Score < 0 || prediction.team2Score < 0) {
                continue; // Skip un-predicted matches
            }

            const actualOutcome = Math.sign(match.team1Score - match.team2Score);
            const predictedOutcome = Math.sign(prediction.team1Score - prediction.team2Score);
            
            const stageKey = stageToRuleKeyMap[match.stage];
            const rules = (stageKey && tournamentData.pointRules?.[stageKey]) ? (tournamentData.pointRules[stageKey] as PointRule) : tournamentData.pointRules.groupStage;

            if (match.team1Score === prediction.team1Score && match.team2Score === prediction.team2Score) {
                totalPoints += rules.correctScore;
            } else if (actualOutcome === predictedOutcome) {
                totalPoints += rules.correctOutcome;
            }
        }

        // Calculate champion bonus points
        if (tournamentData.champion && tournamentData.champion === predictions.championPrediction) {
            totalPoints += tournamentData.pointRules.championBonus || 0;
        }

        leaderboardData.push({ userId, userName: userProfile.name, totalPoints });
    }

    // 3. Fetch old leaderboard to calculate rank changes
    const oldLeaderboardSnap = await db.collection("leaderboards").doc(event.params.tournamentId).get();
    const oldLeaderboardEntries: LeaderboardEntry[] = oldLeaderboardSnap.exists ? oldLeaderboardSnap.data()?.entries || [] : [];
    const oldRanksMap = new Map<string, number>();
    oldLeaderboardEntries.forEach(entry => oldRanksMap.set(entry.userId, entry.rank));

    // 4. Sort, rank, and determine rank changes
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

    const newLeaderboard: LeaderboardEntry[] = leaderboardData.map((data, index) => {
        const rank = index + 1;
        const previousRank = oldRanksMap.get(data.userId);
        let rankChange: "up" | "down" | "same" = "same";

        if (typeof previousRank === 'number') {
            if (rank < previousRank) rankChange = "up";
            else if (rank > previousRank) rankChange = "down";
        }

        return {
            ...data,
            rank,
            previousRank: previousRank ?? null,
            rankChange,
        };
    });

    // 5. Save the new leaderboard
    await db.collection("leaderboards").doc(event.params.tournamentId).set({
        entries: newLeaderboard,
        lastUpdated: Timestamp.now(),
    });

    logger.info(`Leaderboard for tournament ${event.params.tournamentId} successfully updated.`);
});
