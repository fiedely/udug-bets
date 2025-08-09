// functions/src/common.ts

import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { VertexAI } from "@google-cloud/vertexai";

// --- INITIALIZATION ---
// Initialize services once and export them for use in other files.
initializeApp();
export const db = getFirestore();
const vertexAI = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: "asia-southeast1" });
const generativeModel = vertexAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});


// --- SHARED TYPE DEFINITIONS ---
export interface Team { name: string; flag: string; code: string; }
export interface PointRule { correctScore: number; correctOutcome: number; }
export interface PointRules { groupStage: PointRule; round32?: PointRule; round16?: PointRule; quarterFinal?: PointRule; semiFinal?: PointRule; thirdPlaceMatch?: PointRule; final?: PointRule; championBonus?: number; }
export type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";
export interface Match { id: string; stage: MatchStage; team1: Team; team2: Team; team1Score?: number; team2Score?: number; }
export interface Tournament { id: string; name: string; pointRules?: PointRules; matches?: Match[]; knockoutMatches?: Match[]; participants?: string[]; champion?: string; teams?: Team[]; knockoutStartStage?: MatchStage; }
export interface MatchPrediction { team1Score: number; team2Score: number; }
export interface UserPredictions { tournamentId: string; userId: string; championPrediction?: string; matchPredictions: Record<string, MatchPrediction>; }
export interface UserProfile { uid: string; name: string; email: string; role: 'user' | 'admin' | 'superadmin'; }
export interface LeaderboardEntry { userId: string; userName: string; totalPoints: number; rank: number; previousRank?: number | null; rankChange: "up" | "down" | "same"; aiSummary?: string; }


// --- SHARED AI HELPER FUNCTION ---
export async function generateAiSummary(prompt: string): Promise<string> {
    try {
        const resp = await generativeModel.generateContent(prompt);
        const summary = resp.response.candidates?.[0]?.content?.parts?.[0]?.text;
        return summary || "";
    } catch (error) {
        logger.error("Error generating AI summary:", error);
        return "";
    }
}
