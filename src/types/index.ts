// src/types/index.ts

// --- Type Definitions ---
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
}

export interface PointRules {
    groupStage: { correctScore: number; correctOutcome: number; };
    round16?: { correctScore: number; correctOutcome: number; };
    quarterFinal?: { correctScore: number; correctOutcome: number; };
    semiFinal?: { correctScore: number; correctOutcome: number; };
    final?: { correctScore: number; correctOutcome: number; };
}

export interface Tournament {
    id: string;
    name: string;
    description?: string;
    pointRules?: PointRules;
    // We keep Date here as the desired format, but we'll handle Firestore Timestamp conversion in the components
    startDate?: Date;
    endDate?: Date;
    creatorId: string;
    status: 'draft' | 'active' | 'completed';
    ticket?: string;
    teams?: Team[];
    groups?: Record<string, Team[]>;
}