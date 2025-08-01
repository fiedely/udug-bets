// src/types/index.ts

export type View = 'Dashboard' | 'Matches' | 'Leaderboard' | 'Create Tournament' | 'Manage Users' | 'List Tournaments' | 'Edit Tournament';

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
    round16?: { correctScore: number; correctOutcome: number; };
    quarterFinal?: { correctScore: number; correctOutcome: number; };
    semiFinal?: { correctScore: number; correctOutcome: number; };
    final?: { correctScore: number; correctOutcome: number; };
    championBonus?: number;
}

export interface Stadium {
    name: string;
    city: string;
}

export type MatchStage = 'Group Stage' | 'Round of 16' | 'Quarter-final' | 'Semi-final' | 'Third Place Match' | 'Final';

export interface Match {
    id: string;
    stage: MatchStage; // NEW: To identify the stage
    group: string; // For group stage, or e.g., "Knockout"
    matchNumber: number;
    team1: Team;
    team2: Team;
    date: string; 
    stadium: Stadium;
}

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
    allowGuesses: boolean;
    matches?: Match[]; // Group stage matches
    knockoutMatches?: Match[]; // NEW: For knockout rounds
}
