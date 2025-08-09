// functions/src/leaderboard.ts

import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, generateAiSummary, Leaderboard, LeaderboardEntry, MatchStage, PointRule, PointRules, Tournament, UserPredictions, UserProfile } from "./common";


const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage", "Round of 32": "round32", "Round of 16": "round16",
    "Quarter-final": "quarterFinal", "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch", "Final": "final",
};

export async function recalculateLeaderboard(tournamentId: string) {
    logger.info(`Recalculating leaderboard for tournament: ${tournamentId}`);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();
    if (!tournamentDoc.exists) {
        logger.error(`Tournament ${tournamentId} not found.`);
        return;
    }
    const tournamentData = tournamentDoc.data() as Tournament;
    if (!tournamentData.participants || tournamentData.participants.length === 0 || !tournamentData.pointRules) {
        logger.info("Tournament has no participants or point rules. Skipping.");
        return;
    }

    const predictionsPromises = tournamentData.participants.map(userId => db.collection("predictions").doc(`${tournamentId}_${userId}`).get());
    const usersPromises = tournamentData.participants.map(userId => db.collection("users").doc(userId).get());
    const [predictionsSnapshots, usersSnapshots] = await Promise.all([Promise.all(predictionsPromises), Promise.all(usersPromises)]);

    const userPredictionsMap = new Map(predictionsSnapshots.filter(s => s.exists).map(s => [s.data()!.userId, s.data() as UserPredictions]));
    const userProfilesMap = new Map(usersSnapshots.filter(s => s.exists).map(s => [s.data()!.uid, s.data() as UserProfile]));
    
    const allMatches = [...(tournamentData.matches || []), ...(tournamentData.knockoutMatches || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const completedMatches = allMatches.filter(m => typeof m.team1Score === 'number');
    
    const tournamentCompletion = allMatches.length > 0 ? Math.round((completedMatches.length / allMatches.length) * 100) : 0;
    const latestCompletedMatch = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;
    let currentTournamentStage: Leaderboard['currentTournamentStage'] = latestCompletedMatch ? latestCompletedMatch.stage : "Not Started";
    if (tournamentCompletion === 100) {
        currentTournamentStage = "Completed";
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
            const rules = ((stageKey && tournamentData.pointRules?.[stageKey]) ? tournamentData.pointRules[stageKey] : tournamentData.pointRules.groupStage) as PointRule;
            
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
        if (tournamentData.champion && tournamentData.champion === predictions.championPrediction) {
            totalPoints += tournamentData.pointRules.championBonus || 0;
        }
        leaderboardData.push({ userId, userName: userProfile.name, totalPoints, bestPick });
    }

    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldRanksMap = new Map<string, number>();
    if (oldLeaderboardSnap.exists) {
        (oldLeaderboardSnap.data()?.entries || []).forEach((e: LeaderboardEntry) => oldRanksMap.set(e.userId, e.rank));
    }
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);
    
    const newLeaderboardPromises = leaderboardData.map(async (data, index) => {
        const rank = index + 1;
        const previousRank = oldRanksMap.get(data.userId);
        let rankChange: "up" | "down" | "same" = "same";
        let rankChangeText = "unchanged";
        if (typeof previousRank === 'number') {
            if (rank < previousRank) { rankChange = "up"; rankChangeText = `up ${previousRank - rank} spots`; }
            else if (rank > previousRank) { rankChange = "down"; rankChangeText = `down ${rank - previousRank} spots`; }
        }

        const leaderPoints = leaderboardData.length > 0 ? leaderboardData[0].totalPoints : 0;
        const pointDifference = leaderPoints - data.totalPoints;
        const isOutOfContention = tournamentCompletion > 85 && pointDifference > (allMatches.length - completedMatches.length) * 8;

        let contextSpecificInstruction = "";
        if (isOutOfContention) {
            contextSpecificInstruction = `The tournament is in its final stages (${currentTournamentStage}). The user is likely too far behind to win. Conclude by encouraging them to enjoy the remaining matches and the fun of prediction.`;
        } else if (isGroupStageOver) {
            contextSpecificInstruction = `The tournament has now entered the tense '${currentTournamentStage}' stage. Frame the summary with an eye towards the high-stakes knockout rounds where predictions can be changed.`;
        } else {
            contextSpecificInstruction = "The group stage is still in progress. Frame the summary based on their locked-in predictions and how they are performing so far.";
        }

        const prompt = `You are a supportive sports journalist for the 'Udug Bets' prediction game. Write a detailed, engaging summary (4-5 sentences) for a user named '**${data.userName}**'.
        
        User Data:
        - Current Rank: ${rank} of ${leaderboardData.length}
        - Total Points: ${data.totalPoints}
        - Rank Change: ${rankChangeText}
        - Best Prediction: Earned ${data.bestPick.points} points on the ${data.bestPick.description} match.

        Instructions:
        - Start by acknowledging their current rank and performance.
        - Mention their best prediction as a highlight.
        - ${contextSpecificInstruction}
        - Maintain a supportive and fun tone throughout. A bit humour is ok. Ensure the user's name is bolded using markdown.`;
        
        const aiSummary = await generateAiSummary(prompt);

        return { userId: data.userId, userName: data.userName, totalPoints: data.totalPoints, rank, previousRank: previousRank ?? null, rankChange, aiSummary };
    });

    const newLeaderboard = await Promise.all(newLeaderboardPromises);

    let adminSummary = "";
    let championAiSummary = "";

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

        const adminPrompt = `You are a sports journalist providing a detailed, analytical summary (4-5 sentences) of a tournament leaderboard for an administrator.
        
        Data:
        - Tournament Completion: ${tournamentCompletion}%
        - Current Stage: ${currentTournamentStage}
        - Top 3: 1st **${leader.userName}** (${leader.totalPoints} pts), 2nd **${secondPlace.userName}** (${secondPlace.totalPoints} pts), 3rd **${thirdPlace.userName}** (${thirdPlace.totalPoints} pts).
        - Mid-table user: **${midRankUser.userName}** is at rank ${midRankUser.rank}.
        - Bottom-table user: **${bottomRankUser.userName}** is at rank ${bottomRankUser.rank}.
        - Biggest Mover: **${biggestMover.userName}**, who jumped ${biggestMoverClimb} spots.
        - Biggest Drop: **${biggestDropper.userName}**, who fell ${biggestDrop} spots.

        Instructions:
        - Start with the tournament completion percentage and current stage.
        - Analyze the top 3, mentioning the leader's performance and the race for the podium.
        - Describe the situation in the middle of the pack, using the mid-table user as an example.
        - Comment on the bottom of the leaderboard, highlighting the biggest drop.
        - Conclude with an analytical look ahead, considering the current stage of the tournament and how the dynamics might change.
        - Maintain an insightful and professional tone. A bit humour is ok. Ensure all user names are bolded using markdown.`;
        adminSummary = await generateAiSummary(adminPrompt);
    }
    
    const championPicks = Array.from(userPredictionsMap.values()).map(p => p.championPrediction).filter(Boolean) as string[];
    if (championPicks.length > 0) {
        const pickCounts = championPicks.reduce((acc, code) => {
            acc[code] = (acc[code] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const sortedPicks = Object.entries(pickCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([code, count]) => ({ code, count }));

        const topPick = sortedPicks[0];
        const secondPick = sortedPicks.length > 1 ? sortedPicks[1] : null;
        const darkHorse = sortedPicks.find(p => p.code !== topPick.code && p.code !== secondPick?.code);
        const eliminatedFavorites = sortedPicks.filter(p => eliminatedTeamCodes.has(p.code)).slice(0, 2);

        const topPickTeam = tournamentData.teams?.find(t => t.code === topPick.code)?.name;

        const champPrompt = `You are a sports journalist summarizing fan sentiment for a prediction tournament's champion picks.
        
        Data:
        - Total Predictions: ${championPicks.length}
        - Top Pick: **${topPickTeam}** (${Math.round((topPick.count / championPicks.length) * 100)}% of votes)
        - Dark Horse Pick: ${darkHorse ? tournamentData.teams?.find(t => t.code === darkHorse.code)?.name : 'None'}
        - Notable Eliminated Picks: ${eliminatedFavorites.length > 0 ? eliminatedFavorites.map(p => `${tournamentData.teams?.find(t => t.code === p.code)?.name} (${p.count} votes)`).join(', ') : 'None'}

        Instructions:
        - Write a short, insightful paragraph (4-5 sentences).
        - Announce the most popular champion pick.
        - Mention a "dark horse" if one exists.
        - If any popular picks have been eliminated, mention the impact on the users who picked them.
        - Maintain an analytical and engaging tone. A bit humour is ok. Ensure the top pick team name is bolded using markdown.`;
        
        championAiSummary = await generateAiSummary(champPrompt);
    }

    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        tournamentAiSummary: adminSummary,
        championAiSummary: championAiSummary,
        eliminatedTeamCodes: Array.from(eliminatedTeamCodes),
        currentTournamentStage: currentTournamentStage,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated with AI summaries.`);
}
