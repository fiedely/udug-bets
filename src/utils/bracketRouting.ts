// src/utils/bracketRouting.ts

export type TournamentFormat = 'world_cup' | 'euro' | 'generic';

/**
 * Maps the chronological match number to the match number it feeds into.
 * For example, if Match 73 feeds into Match 90, map[73] = 90.
 */
export const BRACKET_ROUTING_MAPS: Record<TournamentFormat, Record<number, number>> = {
    // FIFA World Cup 2026 (104 Matches total, Round of 32 starts at Match 73)
    world_cup: {
        // Round of 32 -> Round of 16
        74: 89, 77: 89, // Match 89 is Winner 74 vs Winner 77
        73: 90, 75: 90, // Match 90 is Winner 73 vs Winner 75
        83: 93, 84: 93, // Match 93 is Winner 83 vs Winner 84
        81: 94, 82: 94, // Match 94 is Winner 81 vs Winner 82
        76: 91, 78: 91, // Match 91 is Winner 76 vs Winner 78
        79: 92, 80: 92, // Match 92 is Winner 79 vs Winner 80
        86: 95, 88: 95, // Match 95 is Winner 86 vs Winner 88
        85: 96, 87: 96, // Match 96 is Winner 85 vs Winner 87

        // Round of 16 -> Quarter-finals
        89: 97, 90: 97, // Match 97 is Winner 89 vs Winner 90
        93: 98, 94: 98, // Match 98 is Winner 93 vs Winner 94
        91: 99, 92: 99, // Match 99 is Winner 91 vs Winner 92
        95: 100, 96: 100, // Match 100 is Winner 95 vs Winner 96

        // Quarter-finals -> Semi-finals
        97: 101, 98: 101, // Match 101 is Winner 97 vs Winner 98
        99: 102, 100: 102, // Match 102 is Winner 99 vs Winner 100

        // Semi-finals -> Final
        101: 104, 102: 104, // Match 104 is Final
        
        // Match 103 is Third Place, does not feed anywhere.
    },
    // UEFA Euro 2024 format (51 matches total, Round of 16 starts at Match 37)
    euro: {
        // Round of 16 -> Quarter-finals
        39: 45, 37: 45, // Match 45 is Winner 39 vs Winner 37
        41: 46, 42: 46, // Match 46 is Winner 41 vs Winner 42
        43: 47, 44: 47, // Match 47 is Winner 43 vs Winner 44
        40: 48, 38: 48, // Match 48 is Winner 40 vs Winner 38

        // Quarter-finals -> Semi-finals
        45: 49, 46: 49,
        47: 50, 48: 50,

        // Semi-finals -> Final
        49: 51, 50: 51
    },
    generic: {} // Fallback to sequential binary tree, handled algorithmically
};

export const STAGE_MATCH_NUMBERS: Record<TournamentFormat, Record<string, number[]>> = {
    world_cup: {
        'Round of 32': [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
        'Round of 16': [89, 90, 91, 92, 93, 94, 95, 96],
        'Quarter-final': [97, 98, 99, 100],
        'Semi-final': [101, 102],
        'Final': [104],
        'Third Place Match': [103]
    },
    euro: {
        'Round of 16': [37, 38, 39, 40, 41, 42, 43, 44],
        'Quarter-final': [45, 46, 47, 48],
        'Semi-final': [49, 50],
        'Final': [51]
    },
    generic: {}
};

/**
 * Helper to get the ID format used by the skeleton generator.
 */
export const getNextMatchId = (
    currentMatchNumber: number, 
    format: TournamentFormat = 'generic'
): string | undefined => {
    const map = BRACKET_ROUTING_MAPS[format];
    const nextNum = map[currentMatchNumber];
    
    // The skeleton generator assigns IDs like `skel-Round of 16-0`.
    // However, the recursive sorter uses the `nextMatchId` to find the exact Match object.
    // If we just store the `nextMatchNumber` instead, we can easily find it by `match.matchNumber`.
    // Actually, setting `nextMatchId` as a string ID is tricky before matches are saved, 
    // but setting it as the `matchNumber` of the next match (e.g. "90") is much more stable!
    
    if (nextNum) return nextNum.toString();
    
    return undefined;
};
