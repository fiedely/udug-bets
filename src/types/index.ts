// src/types/index.ts

export type View = 'My Tournaments' | 'Join Tournament' | 'Leaderboard' | 'Create Tournament' | 'Manage Users' | 'List Tournaments' | 'Edit Tournament' | 'Manage Scores';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
}

export interface Team {
  name: string;
  flag: string;
  code: string;
}

export interface PointRules {
    groupStage: { correctScore: number; correctOutcome: number; };
    round32?: { correctScore: number; correctOutcome: number; };
    round16?: { correctScore: number; correctOutcome: number; };
    quarterFinal?: { correctScore: number; correctOutcome: number; };
    semiFinal?: { correctScore: number; correctOutcome: number; };
    thirdPlaceMatch?: { correctScore: number; correctOutcome: number; };
    final?: { correctScore: number; correctOutcome: number; };
    championBonus?: number;
}

export interface Stadium {
    name: string;
    city: string;
}

export type MatchStage = 'Group Stage' | 'Round of 32' | 'Round of 16' | 'Quarter-final' | 'Semi-final' | 'Third Place Match' | 'Final';

export interface Match {
    id: string;
    stage: MatchStage; 
    group: string; 
    matchNumber: number;
    team1: Team;
    team2: Team;
    date: string; 
    stadium: Stadium;
    team1Score?: number;
    team2Score?: number;
}

export interface PredictionStatus {
    allowChampion: boolean;
    allowGroupStage: boolean;
    allowRoundOf32: boolean;
    allowRoundOf16: boolean;
    allowQuarterFinal: boolean;
    allowSemiFinal: boolean;
    allowFinals: boolean;
}

export type KnockoutStartStage = 'Final' | 'Semi-final' | 'Quarter-final' | 'Round of 16' | 'Round of 32';

export interface Tournament {
    id: string;
    name: string;
    description?: string;
    pointRules?: PointRules;
    startDate?: Date;
    endDate?: Date;
    creatorId: string;
    status: 'draft' | 'active' | 'completed';
    ticket?: string;
    teams?: Team[];
    groups?: Record<string, Team[]>;
    matches?: Match[];
    knockoutMatches?: Match[];
    participants?: string[];
    predictionStatus?: PredictionStatus; 
    knockoutStartStage?: KnockoutStartStage; 
    hasThirdPlaceMatch?: boolean;
    champion?: string;
}

export interface MatchPrediction {
    team1Score: number;
    team2Score: number;
}

export interface UserPredictions {
    id?: string;
    tournamentId: string;
    userId: string;
    championPrediction?: string;
    matchPredictions: Record<string, MatchPrediction>;
}
