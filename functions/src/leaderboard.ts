// functions/src/leaderboard.ts

import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, generateAiSummary, Leaderboard, LeaderboardEntry, Match, MatchStage, PointRule, PointRules, Tournament, UserPredictions, UserProfile } from "./common";


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
            championUserSummary: "Welcome to the tournament! Who will you pick as the champion? Make your prediction to see how your choice stacks up against the community.",
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

    if (completedMatches.length === 0) {
        await db.collection("leaderboards").doc(tournamentId).set({
            entries: [],
            tournamentAiSummary: "The stage is set and predictions are rolling in! The leaderboard is currently empty, but it will update as soon as the first match results are posted. Good luck to all participants!",
            championUserSummary: "You've made your champion pick! Now, let the games begin. Check back here after the first matches to see how the community's predictions are shaping up.",
            currentTournamentStage: "Not Started",
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

    const maxPossibleRemainingPoints = calculateRemainingMatchPoints(allMatches, pointRules);

    const leaderboardData: any[] = [];
    for (const userId of tournamentData.participants) {
        const predictions = userPredictionsMap.get(userId);
        const userProfile = userProfilesMap.get(userId);
        if (!userProfile || !predictions) continue;

        let totalPoints = 0;
        let bestPick = { points: 0, description: "N/A" };

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
            if (matchPoints > bestPick.points) {
                bestPick = { points: matchPoints, description: `${match.team1.name} vs ${match.team2.name}` };
            }
        }
        
        let userRemainingPoints = maxPossibleRemainingPoints;
        const championPick = predictions?.championPrediction;
        if (championPick) {
            const isChampionEliminated = eliminatedTeamCodes.has(championPick);
            if (isFinalConcluded && tournamentData.champion === championPick) {
                totalPoints += pointRules.championBonus || 0;
            } else if (!isChampionEliminated && !isFinalConcluded) {
                userRemainingPoints += pointRules.championBonus || 0;
            }
        }
        leaderboardData.push({ userId, userName: userProfile.name, totalPoints, userRemainingPoints, bestPick });
    }

    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldLeaderboardData = oldLeaderboardSnap.exists ? oldLeaderboardSnap.data() as Leaderboard : null;
    const oldEntriesMap = new Map<string, LeaderboardEntry>(oldLeaderboardData?.entries.map(e => [e.userId, e]) || []);
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    const leaderPoints = leaderboardData.length > 0 ? leaderboardData[0].totalPoints : 0;
    
    const newLeaderboardPromises = leaderboardData.map(async (data, index) => {
        const rank = index + 1;
        const oldEntry = oldEntriesMap.get(data.userId);
        const previousRank = oldEntry?.rank;
        let rankChange: "up" | "down" | "same" = "same";
        
        let rankChangePromptText = "unchanged";
        if (typeof previousRank === 'number') {
            if (rank < previousRank) {
                rankChange = "up";
                rankChangePromptText = `up ${previousRank - rank} spots`;
            } else if (rank > previousRank) {
                rankChange = "down";
                rankChangePromptText = `down ${rank - previousRank} spots`;
            }
        }

        // --- EFFICIENCY LOGIC ---
        // Only generate a new AI summary if the user's rank or points have changed.
        let aiSummary = oldEntry?.aiSummary || "";
        const hasChanged = !oldEntry || oldEntry.rank !== rank || oldEntry.totalPoints !== data.totalPoints;

        if (hasChanged) {
            const pointDifferenceToLeader = leaderPoints - data.totalPoints;
            const isMathematicallyPossibleToWin = data.totalPoints + data.userRemainingPoints >= leaderPoints;

            let contextSpecificInstruction = "";
            if (isFinalConcluded) {
                contextSpecificInstruction = `The tournament is over! Summarize their final standing.`;
            } else if (!isMathematicallyPossibleToWin) {
                contextSpecificInstruction = `The user is mathematically eliminated from winning. Encourage them to focus on achieving their best possible rank.`;
            } else {
                contextSpecificInstruction = `The user can still win. Analyze their chances based on the '${currentTournamentStage}' stage and the point gap to the leader.`;
            }

            // --- CONCISE PROMPT ---
            const prompt = `You are a supportive sport journalist. Write a concise, supportive, and slightly humorous summary (2-3 sentences) for a user named '**${data.userName}**'.

            User Data:
            - Rank: ${rank} of ${leaderboardData.length}
            - Points: ${data.totalPoints}
            - Points Behind Leader: ${pointDifferenceToLeader}
            - Rank Change: ${rankChangePromptText}

            Instructions:
            - ${contextSpecificInstruction}
            - Maintain your persona. Ensure the user's name is bolded using markdown.`;
            
            aiSummary = await generateAiSummary(prompt);
        }

        return { userId: data.userId, userName: data.userName, totalPoints: data.totalPoints, rank, previousRank: previousRank ?? null, rankChange, aiSummary };
    });

    const newLeaderboard = await Promise.all(newLeaderboardPromises);

    let adminSummary = oldLeaderboardData?.tournamentAiSummary || "";
    let championUserSummary = oldLeaderboardData?.championUserSummary || "";
    let championAdminSummary = oldLeaderboardData?.championAdminSummary || "";

    if (newLeaderboard.length > 2) {
        const leader = newLeaderboard[0];
        const secondPlace = newLeaderboard[1];
        const thirdPlace = newLeaderboard[2];
        
        const adminPrompt = `You are a sport journalist providing a concise, analytical summary (2-3 sentences) of a tournament leaderboard for an administrator.
        
        Data:
        - Tournament Completion: ${tournamentCompletion}%
        - Current Stage: ${currentTournamentStage}
        - Top 3: 1st **${leader.userName}** (${leader.totalPoints} pts), 2nd **${secondPlace.userName}** (${secondPlace.totalPoints} pts), 3rd **${thirdPlace.userName}** (${thirdPlace.totalPoints} pts).

        Instructions:
        - Start with the tournament completion and current stage.
        - Analyze the top 3 and conclude with a look ahead.
        - Maintain an insightful, slightly humorous, and professional tone. Ensure all user names are bolded using markdown.`;
        adminSummary = await generateAiSummary(adminPrompt);
    }
    
    const championPicks = Array.from(userPredictionsMap.values()).map(p => p.championPrediction).filter(Boolean) as string[];
    if (championPicks.length > 0) {
        const pickCounts = championPicks.reduce((acc, code) => {
            acc[code] = (acc[code] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const eliminatedPicks = Object.entries(pickCounts).filter(([code]) => eliminatedTeamCodes.has(code));
        
        const previouslyEliminated = new Set(oldLeaderboardData?.eliminatedTeamCodes || []);
        const newlyEliminatedPicks = eliminatedPicks.filter(([code]) => !previouslyEliminated.has(code));
        
        // --- EFFICIENCY LOGIC FOR CHAMPION SUMMARY ---
        // Only generate a new summary if a new team was eliminated or if summaries don't exist yet.
        const shouldUpdateChampionSummary = newlyEliminatedPicks.length > 0 || !oldLeaderboardData?.championUserSummary || !oldLeaderboardData?.championAdminSummary;

        if (shouldUpdateChampionSummary) {
            const activePicks = Object.entries(pickCounts).filter(([code]) => !eliminatedTeamCodes.has(code));
            const sortedActivePicks = activePicks.sort(([, a], [, b]) => b - a).map(([code, count]) => ({ code, count }));
            newlyEliminatedPicks.sort(([,a], [,b]) => b-a);

            let eliminatedMention = "";
            if (newlyEliminatedPicks.length > 0) {
                const mostVotedEliminated = newlyEliminatedPicks[0];
                const teamName = tournamentData.teams?.find(t => t.code === mostVotedEliminated[0])?.name;
                eliminatedMention = `A major upset! **${teamName}**, a fan favorite with ${mostVotedEliminated[1]} votes, has been knocked out!`;
            }

            let topPickAnalysis = "The field is wide open!";
            if(sortedActivePicks.length > 0) {
                const topPick = sortedActivePicks[0];
                const topPickTeam = tournamentData.teams?.find(t => t.code === topPick.code)?.name;
                const topPickPercent = Math.round((topPick.count / championPicks.length) * 100);
                topPickAnalysis = `The current favorite is **${topPickTeam}**, backed by ${topPickPercent}% of participants.`;
            }

            const champContext = isFinalConcluded ? `The final is over! Let's see how the final predictions panned out.` : `The tournament is in the '${currentTournamentStage}' stage.`;

            const userChampPrompt = `You are a sport journalist. Summarize the champion predictions in a concise 2-3 sentences.
            Context: ${champContext}
            Analysis: ${eliminatedMention} ${topPickAnalysis}
            Instruction: Combine the context and analysis into a cohesive, engaging and slightly humorous summary. Ensure all team names are bolded using markdown.`;
            championUserSummary = await generateAiSummary(userChampPrompt);

            const adminChampPrompt = `You are a sport journalist. Summarize the champion predictions for an admin in a concise 2-3 sentences.
            Context: ${champContext}
            Analysis: ${eliminatedMention} ${topPickAnalysis}
            Instruction: Combine the context and analysis into a cohesive, engaging and slightly humorous summary. Be more analytical about what these trends mean for the overall leaderboard. Ensure all team names are bolded using markdown.`;
            championAdminSummary = await generateAiSummary(adminChampPrompt);
        }
    }

    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        tournamentAiSummary: adminSummary,
        championUserSummary: championUserSummary,
        championAdminSummary: championAdminSummary,
        eliminatedTeamCodes: Array.from(eliminatedTeamCodes),
        currentTournamentStage: currentTournamentStage,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated with AI summaries.`);
}
