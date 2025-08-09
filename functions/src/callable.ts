// functions/src/callable.ts

import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db, Tournament, UserProfile } from "./common";

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
