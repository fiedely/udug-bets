// functions/src/leaderboard.ts

import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, generateAiSummary, Leaderboard, LeaderboardEntry, Match, MatchStage, PointRule, PointRules, Tournament, UserPredictions, UserProfile, Team, TeamStanding } from "./common";
import { FIFA_COUNTRIES } from "./data/countries";

const fifaCountriesMap = new Map(FIFA_COUNTRIES.map((c: Team) => [c.code, c]));

const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage", "Round of 32": "round32", "Round of 16": "round16",
    "Quarter-final": "quarterFinal", "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch", "Final": "final",
};

function calculateRemainingMatchPoints(allMatches: Match[], pointRules: PointRules): number {
    const unplayedMatches = allMatches.filter(m => typeof m.team1Score !== 'number');
    let maxPoints = 0;
    unplayedMatches.forEach(match => {
        const stageKey = stageToRuleKeyMap[match.stage];
        const rules = ((stageKey && pointRules[stageKey]) ? pointRules[stageKey] : pointRules.groupStage) as PointRule;
        if (rules) {
            maxPoints += rules.correctOutcome + rules.correctScore;
        }
    });
    return maxPoints;
}

function determineCurrentStage(allMatches: Match[], tournament: Tournament): Leaderboard['currentTournamentStage'] {
    const completedMatches = allMatches.filter(m => typeof m.team1Score === 'number');
    
    if (completedMatches.length === 0) {
        return "Not Started";
    }
    if (completedMatches.length === allMatches.length && allMatches.length > 0) {
        return "Completed";
    }

    const stages: MatchStage[] = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place Match', 'Final'];
    const relevantStages = stages.filter(stage => {
        if (stage === 'Group Stage' && tournament.matches && tournament.matches.length > 0) return true;
        if (tournament.knockoutStartStage && stages.indexOf(stage) >= stages.indexOf(tournament.knockoutStartStage)) return true;
        return false;
    });

    for (const stage of relevantStages) {
        const stageMatches = allMatches.filter(m => m.stage === stage);
        if (stageMatches.length > 0 && stageMatches.some(m => typeof m.team1Score !== 'number')) {
            return stage;
        }
    }

    return "Completed";
}

// --- NEW: Function to calculate group standings ---
function calculateGroupStandings(tournament: Tournament): Record<string, TeamStanding[]> {
    const standings: Record<string, Record<string, TeamStanding>> = {};
    const groups = tournament.groups || {};
    const groupMatches = (tournament.matches || []).filter(m => m.stage === 'Group Stage');

    // Initialize standings for all teams in groups
    for (const groupName in groups) {
        standings[groupName] = {};
        for (const team of groups[groupName]) {
            standings[groupName][team.code] = { team, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
        }
    }

    // Process each group stage match
    for (const match of groupMatches) {
        if (typeof match.team1Score !== 'number' || typeof match.team2Score !== 'number') continue;

        const groupName = Object.keys(groups).find(gn => groups[gn].some(t => t.code === match.team1.code));
        if (!groupName) continue;

        const team1Stats = standings[groupName][match.team1.code];
        const team2Stats = standings[groupName][match.team2.code];

        team1Stats.mp++;
        team2Stats.mp++;
        team1Stats.gf += match.team1Score;
        team1Stats.ga += match.team2Score;
        team2Stats.gf += match.team2Score;
        team2Stats.ga += match.team1Score;
        team1Stats.gd = team1Stats.gf - team1Stats.ga;
        team2Stats.gd = team2Stats.gf - team2Stats.ga;

        if (match.team1Score > match.team2Score) {
            team1Stats.w++;
            team1Stats.pts += 3;
            team2Stats.l++;
        } else if (match.team2Score > match.team1Score) {
            team2Stats.w++;
            team2Stats.pts += 3;
            team1Stats.l++;
        } else {
            team1Stats.d++;
            team2Stats.d++;
            team1Stats.pts += 1;
            team2Stats.pts += 1;
        }
    }

    // Convert to sorted arrays
    const sortedStandings: Record<string, TeamStanding[]> = {};
    for (const groupName in standings) {
        sortedStandings[groupName] = Object.values(standings[groupName]).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            if (b.gf !== a.gf) return b.gf - a.gf;
            return a.team.name.localeCompare(b.team.name);
        });
    }

    return sortedStandings;
}


export async function recalculateLeaderboard(tournamentId: string) {
    logger.info(`Recalculating leaderboard for tournament: ${tournamentId}`);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();
    if (!tournamentDoc.exists) {
        logger.error(`Tournament ${tournamentId} not found.`);
        return;
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    const pointRules = tournamentData.pointRules;
    if (!tournamentData.participants || tournamentData.participants.length === 0 || !pointRules) {
        logger.info("Tournament has no participants or point rules. Skipping.");
        await db.collection("leaderboards").doc(tournamentId).set({
            entries: [],
            tournamentAiSummary: "The tournament is all set up! Get ready for an exciting competition. The leaderboard will come alive as soon as participants join and make their predictions.",
            championAiSummary: "Welcome to the tournament! Who will you pick as the champion? Make your prediction to see how your choice stacks up against the community.",
            lastUpdated: Timestamp.now(),
        }, { merge: true });
        return;
    }

    const predictionsPromises = tournamentData.participants.map(userId => db.collection("predictions").doc(`${tournamentId}_${userId}`).get());
    const usersPromises = tournamentData.participants.map(userId => db.collection("users").doc(userId).get());
    const [predictionsSnapshots, usersSnapshots] = await Promise.all([Promise.all(predictionsPromises), Promise.all(usersPromises)]);

    const userPredictionsMap = new Map(predictionsSnapshots.filter(s => s.exists).map(s => [s.data()!.userId, s.data() as UserPredictions]));
    const userProfilesMap = new Map(usersSnapshots.filter(s => s.exists).map(s => [s.data()!.uid, s.data() as UserProfile]));
    
    const allMatches = [...(tournamentData.matches || []), ...(tournamentData.knockoutMatches || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const currentTournamentStage = determineCurrentStage(allMatches, tournamentData);
    const completedMatches = allMatches.filter(m => typeof m.team1Score === 'number');
    const tournamentCompletion = allMatches.length > 0 ? Math.round((completedMatches.length / allMatches.length) * 100) : 0;
    const isFinalConcluded = currentTournamentStage === "Completed";

    // --- NEW: Calculate group standings ---
    const groupStandings = calculateGroupStandings(tournamentData);

    if (completedMatches.length === 0) {
        await db.collection("leaderboards").doc(tournamentId).set({
            entries: [],
            tournamentAiSummary: "The stage is set and predictions are rolling in! The leaderboard is currently empty, but it will update as soon as the first match results are posted. Good luck to all participants!",
            championAiSummary: "You've made your champion pick! Now, let the games begin. Check back here after the first matches to see how the community's predictions are shaping up.",
            currentTournamentStage: "Not Started",
            groupStandings: groupStandings,
            lastUpdated: Timestamp.now(),
        }, { merge: true });
        logger.info("No matches have been scored yet. Set pre-game summary.");
        return;
    }

    const groupStageMatches = allMatches.filter(m => m.stage === 'Group Stage');
    const isGroupStageOver = groupStageMatches.length > 0 && groupStageMatches.every(m => typeof m.team1Score === 'number');

    const eliminatedTeamCodes = new Set<string>();
    if (isGroupStageOver) {
        const teamsInKnockout = new Set<string>();
        if (tournamentData.knockoutMatches) {
            tournamentData.knockoutMatches.forEach(match => {
                if (match.team1.code.substring(0, 3) !== 'TBD') teamsInKnockout.add(match.team1.code);
                if (match.team2.code.substring(0, 3) !== 'TBD') teamsInKnockout.add(match.team2.code);

                if (typeof match.team1Score === 'number' && typeof match.team2Score === 'number') {
                    if (match.team1Score > match.team2Score) {
                        eliminatedTeamCodes.add(match.team2.code);
                    } else if (match.team2Score > match.team1Score) {
                        eliminatedTeamCodes.add(match.team1.code);
                    } else { // It's a draw, so check for the declared winner
                        if (match.winnerTeamCode === match.team1.code) {
                            eliminatedTeamCodes.add(match.team2.code);
                        } else if (match.winnerTeamCode === match.team2.code) {
                            eliminatedTeamCodes.add(match.team1.code);
                        }
                    }
                }
            });
        }
        if (tournamentData.teams) {
            tournamentData.teams.forEach(team => {
                if (!teamsInKnockout.has(team.code)) {
                    eliminatedTeamCodes.add(team.code);
                }
            });
        }
    }

    const leaderboardData: any[] = [];
    for (const userId of tournamentData.participants) {
        const predictions = userPredictionsMap.get(userId);
        const userProfile = userProfilesMap.get(userId);
        if (!userProfile || !predictions) continue;

        let totalPoints = 0;

        for (const match of completedMatches) {
            const prediction = predictions.matchPredictions[match.id];
            if (!prediction || prediction.team1Score < 0) continue;

            const actualOutcome = Math.sign(match.team1Score! - match.team2Score!);
            const predictedOutcome = Math.sign(prediction.team1Score - prediction.team2Score);
            const stageKey = stageToRuleKeyMap[match.stage];
            const rules = ((stageKey && pointRules?.[stageKey]) ? pointRules[stageKey] : pointRules.groupStage) as PointRule;
            
            let matchPoints = 0;
            if (actualOutcome === predictedOutcome) {
                matchPoints += rules.correctOutcome;
                if (match.team1Score === prediction.team1Score && match.team2Score === prediction.team2Score) {
                    matchPoints += rules.correctScore;
                }
            }
            totalPoints += matchPoints;
        }
        
        const championPick = predictions?.championPrediction;
        if (championPick) {
            if (isFinalConcluded && tournamentData.champion === championPick) {
                totalPoints += pointRules.championBonus || 0;
            }
        }
        leaderboardData.push({ userId, userName: userProfile.name, totalPoints });
    }

    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldLeaderboardData = oldLeaderboardSnap.exists ? oldLeaderboardSnap.data() as Leaderboard : null;
    const oldEntriesMap = new Map<string, LeaderboardEntry>(oldLeaderboardData?.entries.map(e => [e.userId, e]) || []);
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    
    const newLeaderboard: LeaderboardEntry[] = leaderboardData.map((data, index) => {
        const rank = index + 1;
        const oldEntry = oldEntriesMap.get(data.userId);
        const previousRank = oldEntry?.rank;
        let rankChange: "up" | "down" | "same" = "same";
        
        if (typeof previousRank === 'number') {
            if (rank < previousRank) {
                rankChange = "up";
            } else if (rank > previousRank) {
                rankChange = "down";
            }
        }
        return { userId: data.userId, userName: data.userName, totalPoints: data.totalPoints, rank, previousRank: previousRank ?? null, rankChange };
    });

    let tournamentAiSummary = oldLeaderboardData?.tournamentAiSummary || "";
    let championAiSummary = oldLeaderboardData?.championAiSummary || "";

    const oldTop3 = oldLeaderboardData?.entries.slice(0, 3).map(e => e.userId).join(',');
    const newTop3 = newLeaderboard.slice(0, 3).map(e => e.userId).join(',');
    const shouldUpdateLeaderboardSummary = (oldTop3 !== newTop3) || !tournamentAiSummary;

    if (shouldUpdateLeaderboardSummary && newLeaderboard.length > 2) {
        const leader = newLeaderboard[0];
        const secondPlace = newLeaderboard[1];
        const thirdPlace = newLeaderboard[2];
        const maxPossibleRemainingPoints = calculateRemainingMatchPoints(allMatches, pointRules);
        
        const prompt = `You are a sharp but humorous sports analyst. Write a concise, analytical summary (2-3 sentences) of a tournament leaderboard.

        Data:
        - Tournament Progress: ${tournamentCompletion}% complete
        - Current Stage: ${currentTournamentStage}
        - Points Still Available: ${maxPossibleRemainingPoints}
        - Top 3: 1st **${leader.userName}** (${leader.totalPoints} pts), 2nd **${secondPlace.userName}** (${secondPlace.totalPoints} pts), 3rd **${thirdPlace.userName}** (${thirdPlace.totalPoints} pts).

        Instructions:
        - Analyze the top 3 and the current stage to give a witty and insightful overview for all participants.
        - You can mention the points still available to add context about how the leaderboard could still change.
        - Ensure all user names are bolded using markdown.`;
        tournamentAiSummary = await generateAiSummary(prompt);
    }
    
    const championPicks = Array.from(userPredictionsMap.values()).map(p => p.championPrediction).filter(Boolean) as string[];
    if (championPicks.length > 0) {
        const previouslyEliminated = new Set(oldLeaderboardData?.eliminatedTeamCodes || []);
        const currentEliminated = new Set(eliminatedTeamCodes);
        const hasNewEliminations = ![...currentEliminated].every(code => previouslyEliminated.has(code));

        const shouldUpdateChampionSummary = hasNewEliminations || !championAiSummary;

        if (shouldUpdateChampionSummary) {
            const pickCounts = championPicks.reduce((acc, code) => {
                acc[code] = (acc[code] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const activePicks = Object.entries(pickCounts).filter(([code]) => !eliminatedTeamCodes.has(code));
            const sortedActivePicks = activePicks.sort(([, a], [, b]) => b - a).map(([code, count]) => ({ code, count }));
            
            let topPickAnalysis = "The field is wide open!";
            if(sortedActivePicks.length > 0) {
                const topPick = sortedActivePicks[0];
                const teamData = tournamentData.teams?.find(t => t.code === topPick.code) || fifaCountriesMap.get(topPick.code);
                const topPickTeam = teamData ? teamData.name : 'An unknown team';
                const topPickPercent = Math.round((topPick.count / championPicks.length) * 100);
                topPickAnalysis = `The community favorite is **${topPickTeam}**, backed by ${topPickPercent}% of participants.`;
            }

            const champContext = isFinalConcluded ? `The tournament is over!` : `We're in the '${currentTournamentStage}'.`;

            const prompt = `You are a sharp but humorous sports analyst. Write a concise summary (2-3 sentences) of the community's champion predictions.
            Context: ${champContext}
            Analysis: ${topPickAnalysis}
            Instruction: Combine the context and analysis into a witty, engaging summary for all participants. Ensure all team names are bolded using markdown.`;
            championAiSummary = await generateAiSummary(prompt);
        }
    }

    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        tournamentAiSummary: tournamentAiSummary,
        championAiSummary: championAiSummary,
        eliminatedTeamCodes: Array.from(eliminatedTeamCodes),
        currentTournamentStage: currentTournamentStage,
        groupStandings: groupStandings,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated.`);
}
