// functions/src/common.ts

import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "asia-southeast2" });

try {
    initializeApp();
} catch (e) {
    logger.info("Firebase app already initialized.");
}
export const db = getFirestore();
const ai = new GoogleGenAI({ vertexai: true, project: process.env.GCLOUD_PROJECT, location: "global" });


export interface Team { name: string; flag: string; code: string; }
export interface PointRule { correctScore: number; correctOutcome: number; }
export interface PointRules { groupStage: PointRule; round32?: PointRule; round16?: PointRule; quarterFinal?: PointRule; semiFinal?: PointRule; thirdPlaceMatch?: PointRule; final?: PointRule; championBonus?: number; }
export type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";
export interface Stadium { name: string; city: string; }
export interface Match { 
    id: string; 
    stage: MatchStage; 
    team1: Team; 
    team2: Team; 
    team1Score?: number; 
    team2Score?: number; 
    stadium: Stadium;
    date: string; 
    winnerTeamCode?: string;
    tiebreakerType?: 'Extra Time' | 'Penalty Shootout';
    team1TiebreakerScore?: number;
    team2TiebreakerScore?: number;
    team1ExtraTimeScore?: number;
    team2ExtraTimeScore?: number;
    nextMatchId?: string;
}
export interface Tournament { id: string; name: string; pointRules?: PointRules; matches?: Match[]; knockoutMatches?: Match[]; participants?: string[]; champion?: string; teams?: Team[]; knockoutStartStage?: MatchStage; groups?: Record<string, Team[]>; skipLeaderboardUpdate?: number; knockoutPointCalculationRules?: Record<string, '90m' | '120m' | '120m_pen'>; }
export interface MatchPrediction { team1Score: number; team2Score: number; }
export interface UserPredictions { tournamentId: string; userId: string; championPrediction?: string; matchPredictions: Record<string, MatchPrediction>; }
export interface UserProfile { uid: string; name: string; email: string; role: 'user' | 'admin' | 'superadmin'; avatarUrl?: string; }

export interface TeamStanding {
    team: Team;
    mp: number;
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
}

export interface Leaderboard {
    entries: LeaderboardEntry[];
    lastUpdated: Date;
    tournamentAiSummary?: string;
    aiSummaryHistory?: string[];
    eliminatedTeamCodes?: string[];
    currentTournamentStage?: MatchStage | "Not Started" | "Completed";
    groupStandings?: Record<string, TeamStanding[]>;
    completedMatchesCount?: number;
}

export interface LeaderboardEntry { 
    userId: string; 
    userName: string; 
    avatarUrl?: string;
    totalPoints: number;
    previousPoints?: number | null; 
    rank: number; 
    previousRank?: number | null; 
    rankChange: "up" | "down" | "same"; 
}

export interface Tournament {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'Upcoming' | 'Ongoing' | 'Completed';
    format?: 'world_cup' | 'euro' | 'generic';
    usageMode: 'forced' | 'optional';
    createdAt: any;
}

export interface AiTopic {
    id: string;
    topic: string;
    details: string;
    status: 'in_queue' | 'used' | 'not_active';
    usageMode: 'forced' | 'optional';
    createdAt: any;
}


export async function generateAiSummary(prompt: string, systemInstruction?: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction ? systemInstruction : undefined,
                temperature: 1.2
            }
        });
        return response.text || "";
    } catch (error) {
        logger.error("Error generating AI summary:", error);
        return "";
    }
}
