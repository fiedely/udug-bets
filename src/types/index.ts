// src/types/index.ts

export interface Widget {
  i: string;
  type: WidgetType;
  title?: string;
  headerColor?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  props?: {
    tournamentId?: string;
    currentMatchIndex?: number;
    selectedUserId?: string;
  };
}

export type WidgetType = 'leaderboard' | 'predictionChart' | 'myPredictionsChart' | 'championPredictionChart';

export type View = 'User Dashboard' | 'My Tournaments' | 'Join Tournament' | 'Leaderboard' | 'Create Tournament' | 'Manage Users' | 'List Tournaments' | 'Edit Tournament' | 'Manage Scores' | 'Debug';

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

export interface PointRule {
  correctScore: number;
  correctOutcome: number;
}

export interface PointRules {
    groupStage: PointRule;
    round32?: PointRule;
    round16?: PointRule;
    quarterFinal?: PointRule;
    semiFinal?: PointRule;
    thirdPlaceMatch?: PointRule;
    final?: PointRule;
    championBonus?: number;
}

export interface Stadium {
    name: string;
    city: string;
}

export type MatchStage = "Group Stage" | "Round of 32" | "Round of 16" | "Quarter-final" | "Semi-final" | "Third Place Match" | "Final";

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
    tournamentId: string;
    userId: string;
    championPrediction?: string;
    matchPredictions: Record<string, MatchPrediction>;
}

export interface Leaderboard {
    entries: LeaderboardEntry[];
    lastUpdated: Date;
    tournamentAiSummary?: string;
    championUserSummary?: string;   // For regular users
    championAdminSummary?: string;  // For admins
    eliminatedTeamCodes?: string[];
    currentTournamentStage?: MatchStage | "Not Started" | "Completed";
}

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    totalPoints: number;
    rank: number;
    previousRank?: number | null;
    rankChange: "up" | "down" | "same";
    aiSummary?: string;
}
