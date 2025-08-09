// functions/src/index.ts

import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";

// Import the modularized logic
import { recalculateLeaderboard } from "./leaderboard";
import { deleteTournamentAndData, getTournamentParticipants, generateStagePredictions } from "./callable";
import { Tournament, UserPredictions } from "./common";

// --- INITIALIZATION ---
setGlobalOptions({ region: "asia-southeast2" });


// --- DATABASE TRIGGERS ---

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
    }
});


// --- CALLABLE FUNCTIONS ---

export { deleteTournamentAndData, getTournamentParticipants, generateStagePredictions };
