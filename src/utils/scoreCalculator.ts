import type { Match, MatchStage, PointRules, Tournament } from '../types';

export const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage", "Round of 32": "round32", "Round of 16": "round16",
    "Quarter-final": "quarterFinal", "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch", "Final": "final",
};

export function getEffectiveScores(match: Match, tournament: Tournament): { team1: number, team2: number } {
    if (typeof match.team1Score !== 'number' || typeof match.team2Score !== 'number') {
        return { team1: 0, team2: 0 };
    }

    let effectiveTeam1Score = match.team1Score;
    let effectiveTeam2Score = match.team2Score;
    
    const stageKey = match.stage ? stageToRuleKeyMap[match.stage] : undefined;

    if (match.stage !== 'Group Stage' && tournament.knockoutPointCalculationRules && stageKey) {
        const calcRule = tournament.knockoutPointCalculationRules[stageKey] || '90m';
        if (match.tiebreakerType) {
            if (match.tiebreakerType === 'Extra Time') {
                if (calcRule === '120m' || calcRule === '120m_pen') {
                    effectiveTeam1Score += (match.team1TiebreakerScore || 0);
                    effectiveTeam2Score += (match.team2TiebreakerScore || 0);
                }
            } else if (match.tiebreakerType === 'Penalty Shootout') {
                if (calcRule === '120m' || calcRule === '120m_pen') {
                    effectiveTeam1Score += (match.team1ExtraTimeScore || 0);
                    effectiveTeam2Score += (match.team2ExtraTimeScore || 0);
                }
                if (calcRule === '120m_pen') {
                    effectiveTeam1Score += (match.team1TiebreakerScore || 0);
                    effectiveTeam2Score += (match.team2TiebreakerScore || 0);
                }
            }
        }
    }

    return { team1: effectiveTeam1Score, team2: effectiveTeam2Score };
}
