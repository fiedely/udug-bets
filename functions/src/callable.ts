// functions/src/callable.ts

import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db, Tournament, UserProfile } from "./common";

setGlobalOptions({ region: "asia-southeast2" });

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * NEW: Callable function to generate random predictions for a specific stage of a tournament.
 */
export const generateStagePredictions = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const userDoc = await db.collection("users").doc(uid).get();
    const userProfile = userDoc.data() as UserProfile | undefined;

    if (userProfile?.role !== 'superadmin') {
        throw new HttpsError("permission-denied", "You must be a superadmin to perform this action.");
    }

    const { tournamentId, stage } = request.data;
    if (!tournamentId || !stage) {
        throw new HttpsError("invalid-argument", "Missing 'tournamentId' or 'stage'.");
    }

    logger.info(`Superadmin ${uid} initiated prediction seeding for stage '${stage}' in tournament ${tournamentId}`);

    try {
        const tournamentRef = db.collection("tournaments").doc(tournamentId);
        const tournamentSnap = await tournamentRef.get();
        if (!tournamentSnap.exists) {
            throw new HttpsError("not-found", "Tournament not found.");
        }
        const tournament = tournamentSnap.data() as Tournament;

        const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
        const stageMatches = allMatches.filter(m => m.stage === stage);

        if (stageMatches.length === 0) {
            return { success: false, message: `No matches found for stage '${stage}'.` };
        }

        const participants = tournament.participants || [];
        if (participants.length === 0) {
            return { success: false, message: "Tournament has no participants." };
        }

        const batch = db.batch();
        const predictionsCollection = db.collection("predictions");

        for (const userId of participants) {
            const predictionRef = predictionsCollection.doc(`${tournamentId}_${userId}`);
            const matchPredictionsUpdate: { [key: string]: any } = {};

            stageMatches.forEach(match => {
                const predictionPath = `matchPredictions.${match.id}`;
                matchPredictionsUpdate[predictionPath] = {
                    team1Score: getRandomInt(0, 4),
                    team2Score: getRandomInt(0, 4),
                };
            });

            batch.update(predictionRef, matchPredictionsUpdate);
        }

        await batch.commit();

        const message = `Successfully generated predictions for ${stageMatches.length} matches in stage '${stage}' for ${participants.length} participants.`;
        logger.info(message);
        return { success: true, message };

    } catch (error) {
        logger.error("Error during stage prediction seeding:", error);
        throw new HttpsError("internal", "An unexpected error occurred during seeding.");
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
    const userProfile = userDoc.data() as UserProfile | undefined;
  
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
