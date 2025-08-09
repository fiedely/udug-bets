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
                    if (match.team1Score > match.team2Score) eliminatedTeamCodes.add(match.team2.code);
                    else if (match.team2Score > match.team1Score) eliminatedTeamCodes.add(match.team1.code);
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
    const oldRanksMap = new Map<string, number>();
    if (oldLeaderboardSnap.exists) {
        (oldLeaderboardSnap.data()?.entries || []).forEach((e: LeaderboardEntry) => oldRanksMap.set(e.userId, e.rank));
    }
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    const leaderPoints = leaderboardData.length > 0 ? leaderboardData[0].totalPoints : 0;
    
    const newLeaderboardPromises = leaderboardData.map(async (data, index) => {
        const rank = index + 1;
        const previousRank = oldRanksMap.get(data.userId);
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

        const pointDifferenceToLeader = leaderPoints - data.totalPoints;
        const isMathematicallyPossibleToWin = data.totalPoints + data.userRemainingPoints >= leaderPoints;

        let contextSpecificInstruction = "";
        if (isFinalConcluded) {
            contextSpecificInstruction = `The tournament is over! The final scores are in, including the crucial champion prediction points. Summarize their final standing and whether their champion pick paid off.`;
        } else if (!isMathematicallyPossibleToWin) {
            contextSpecificInstruction = `The user is now mathematically eliminated from winning first place. Gently break the news and encourage them to focus on achieving the highest possible rank or just enjoying the remaining matches.`;
        } else {
            contextSpecificInstruction = `The user can still win. Analyze their chances based on the '${currentTournamentStage}' stage. Mention the point gap to the leader and what they need to do to close it, considering the remaining points available.`;
        }

        const prompt = `You are a supportive and enthusiastic sport journalist specialized in soccer. Write a detailed, analytical, and slightly humorous summary (3-4 sentences) for a user named '**${data.userName}**'.

        User Data:
        - Current Rank: ${rank} of ${leaderboardData.length}
        - Total Points: ${data.totalPoints}
        - Points Behind Leader: ${pointDifferenceToLeader}
        - Max Possible Remaining Points for User: ${data.userRemainingPoints}
        - Can mathematically win 1st place: ${isMathematicallyPossibleToWin ? 'Yes' : 'No'}
        - Rank Change: ${rankChangePromptText}

        Instructions:
        - ${contextSpecificInstruction}
        - Maintain your persona. Ensure the user's name is bolded using markdown.`;
        
        const aiSummary = await generateAiSummary(prompt);

        return { userId: data.userId, userName: data.userName, totalPoints: data.totalPoints, rank, previousRank: previousRank ?? null, rankChange, aiSummary };
    });

    const newLeaderboard = await Promise.all(newLeaderboardPromises);

    let adminSummary = "";
    let championUserSummary = "";
    let championAdminSummary = "";

    if (newLeaderboard.length > 2) {
        const leader = newLeaderboard[0];
        const secondPlace = newLeaderboard[1];
        const thirdPlace = newLeaderboard[2];

        const biggestMover = newLeaderboard.reduce((prev, curr) => {
            const prevChange = prev.previousRank ? prev.previousRank - prev.rank : 0;
            const currChange = curr.previousRank ? curr.previousRank - curr.rank : 0;
            return (currChange > prevChange) ? curr : prev;
        });
        const biggestMoverClimb = biggestMover.previousRank ? biggestMover.previousRank - biggestMover.rank : 0;

        const biggestDropper = newLeaderboard.reduce((prev, curr) => {
            const prevChange = prev.previousRank ? prev.rank - prev.previousRank : 0;
            const currChange = curr.previousRank ? curr.rank - curr.previousRank : 0;
            return (currChange > prevChange) ? curr : prev;
        });
        const biggestDrop = biggestDropper.previousRank ? biggestDropper.rank - biggestDropper.previousRank : 0;

        const midRankIndex = Math.floor(newLeaderboard.length / 2);
        const midRankUser = newLeaderboard[midRankIndex];
        
        const bottomRankUser = newLeaderboard[newLeaderboard.length - 1];

        const adminPrompt = `You are a supportive and enthusiastic sport journalist specialized in soccer providing a detailed, analytical summary (3-4 sentences) of a tournament leaderboard for an administrator.
        
        Data:
        - Tournament Completion: ${tournamentCompletion}%
        - Current Stage: ${currentTournamentStage}
        - Top 3: 1st **${leader.userName}** (${leader.totalPoints} pts), 2nd **${secondPlace.userName}** (${secondPlace.totalPoints} pts), 3rd **${thirdPlace.userName}** (${thirdPlace.totalPoints} pts).
        - Mid-table user: **${midRankUser.userName}** is at rank ${midRankUser.rank}.
        - Bottom-table user: **${bottomRankUser.userName}** is at rank ${bottomRankUser.rank}.
        - Biggest Mover: **${biggestMover.userName}**, who jumped ${biggestMoverClimb} spots.
        - Biggest Drop: **${biggestDropper.userName}**, who fell ${biggestDrop} spots.

        Instructions:
        - Start with the tournament completion and current stage.
        - Analyze the top 3, mentioning the leader's performance.
        - Describe the mid-table and bottom of the leaderboard, highlighting the biggest movers.
        - Conclude with an analytical look ahead based on the current stage.
        - Maintain an insightful, slightly humorous, and professional tone. Ensure all user names are bolded using markdown.`;
        adminSummary = await generateAiSummary(adminPrompt);
    }
    
    const championPicks = Array.from(userPredictionsMap.values()).map(p => p.championPrediction).filter(Boolean) as string[];
    if (championPicks.length > 0) {
        const pickCounts = championPicks.reduce((acc, code) => {
            acc[code] = (acc[code] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const activePicks = Object.entries(pickCounts).filter(([code]) => !eliminatedTeamCodes.has(code));
        const eliminatedPicks = Object.entries(pickCounts).filter(([code]) => eliminatedTeamCodes.has(code));

        const sortedActivePicks = activePicks.sort(([, a], [, b]) => b - a).map(([code, count]) => ({ code, count }));
        
        const oldLeaderboardData = oldLeaderboardSnap.data() as Leaderboard | undefined;
        const previouslyEliminated = new Set(oldLeaderboardData?.eliminatedTeamCodes || []);
        const newlyEliminatedPicks = eliminatedPicks.filter(([code]) => !previouslyEliminated.has(code));
        newlyEliminatedPicks.sort(([,a], [,b]) => b-a);

        let eliminatedMention = "";
        if (newlyEliminatedPicks.length > 0) {
            const mostVotedEliminated = newlyEliminatedPicks[0];
            const teamName = tournamentData.teams?.find(t => t.code === mostVotedEliminated[0])?.name;
            eliminatedMention = `A major upset! **${teamName}**, a fan favorite with ${mostVotedEliminated[1]} votes, has been knocked out of the tournament, shaking up the predictions!`;
        }

        let topPickAnalysis = "The field is wide open!";
        if(sortedActivePicks.length > 0) {
            const topPick = sortedActivePicks[0];
            const topPickTeam = tournamentData.teams?.find(t => t.code === topPick.code)?.name;
            const topPickPercent = Math.round((topPick.count / championPicks.length) * 100);
            topPickAnalysis = `The current favorite is **${topPickTeam}**, backed by ${topPickPercent}% of participants.`;
            if (sortedActivePicks.length > 1) {
                const secondPick = sortedActivePicks[1];
                const secondPickTeam = tournamentData.teams?.find(t => t.code === secondPick.code)?.name;
                topPickAnalysis += ` They are followed by **${secondPickTeam}** as a strong contender.`
            }
        }

        const champContext = isFinalConcluded ? `The final is over and the official champion was **${tournamentData.champion ? tournamentData.teams?.find(t=>t.code === tournamentData.champion)?.name : 'TBD'}**! Let's see how the final predictions panned out.` : `The tournament is in the '${currentTournamentStage}' stage. Here's the latest on who the community thinks will win.`;

        const userChampPrompt = `You are a supportive and enthusiastic sport journalist specialized in soccer. Summarize the champion predictions for a user in 3-4 sentences.
        Context: ${champContext}
        Analysis: ${eliminatedMention} ${topPickAnalysis}
        Instruction: Combine the context and analysis into a cohesive, engaging summary. Maintain an enthusiastic and slightly humorous tone. Ensure all team names are bolded using markdown.`;
        championUserSummary = await generateAiSummary(userChampPrompt);

        const adminChampPrompt = `You are a supportive and enthusiastic sport journalist specialized in soccer. Summarize the champion predictions for an admin in 3-4 sentences.
        Context: ${champContext}
        Analysis: ${eliminatedMention} ${topPickAnalysis}
        Instruction: Combine the context and analysis into a cohesive summary. Be more analytical about what these trends mean for the overall leaderboard. Maintain an enthusiastic and slightly humorous tone. Ensure all team names are bolded using markdown.`;
        championAdminSummary = await generateAiSummary(adminChampPrompt);
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
