// functions/src/leaderboard.ts

import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, generateAiSummary, Leaderboard, LeaderboardEntry, Match, MatchStage, PointRule, PointRules, Tournament, UserPredictions, UserProfile, TeamStanding, AiTopic } from "./common";

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

function calculateGroupStandings(tournament: Tournament): Record<string, TeamStanding[]> {
    const standings: Record<string, Record<string, TeamStanding>> = {};
    const groups = tournament.groups || {};
    const groupMatches = (tournament.matches || []).filter(m => m.stage === 'Group Stage');

    for (const groupName in groups) {
        standings[groupName] = {};
        for (const team of groups[groupName]) {
            standings[groupName][team.code] = { team, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
        }
    }

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
            tournamentAiSummary: "Turnamen sudah disiapkan! Bersiaplah untuk kompetisi yang seru. Papan peringkat akan hidup begitu peserta bergabung dan membuat prediksi mereka.",
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

    const groupStandings = calculateGroupStandings(tournamentData);

    if (completedMatches.length === 0) {
        await db.collection("leaderboards").doc(tournamentId).set({
            entries: [],
            tournamentAiSummary: "Panggung sudah disiapkan dan prediksi mulai masuk! Papan peringkat saat ini kosong, tetapi akan diperbarui segera setelah hasil pertandingan pertama diposting. Semoga berhasil untuk semua peserta!",
            currentTournamentStage: "Not Started",
            groupStandings: groupStandings,
            lastUpdated: Timestamp.now(),
        }, { merge: true });
        logger.info("No matches have been scored yet. Set pre-game summary.");
        return;
    }

    const groupStageMatches = allMatches.filter(m => m.stage === 'Group Stage');
    const isGroupStageOver = groupStageMatches.length > 0 && groupStageMatches.every(m => typeof m.team1Score === 'number');
    const knockoutSeeded = (tournamentData.knockoutMatches || []).some(m => m.team1.code.substring(0, 3) !== 'TBD' && m.team2.code.substring(0, 3) !== 'TBD');

    const eliminatedTeamCodes = new Set<string>();
    if (isGroupStageOver && knockoutSeeded) {
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
                    } else {
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
            if (!prediction || typeof prediction.team1Score !== 'number' || typeof prediction.team2Score !== 'number' || prediction.team1Score < 0 || prediction.team2Score < 0) continue;

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
        leaderboardData.push({ userId, userName: userProfile.name, avatarUrl: userProfile.avatarUrl || null, totalPoints });
    }

    const oldLeaderboardSnap = await db.collection("leaderboards").doc(tournamentId).get();
    const oldLeaderboardData = oldLeaderboardSnap.exists ? oldLeaderboardSnap.data() as Leaderboard : null;
    const oldEntriesMap = new Map<string, LeaderboardEntry>(oldLeaderboardData?.entries.map(e => [e.userId, e]) || []);
    
    leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints || a.userName.localeCompare(b.userName));
    
    let currentRank = 1;
    let prevPoints = -1;
    const newLeaderboard: LeaderboardEntry[] = leaderboardData.map((data, index) => {
        if (data.totalPoints !== prevPoints) {
            currentRank = index + 1;
            prevPoints = data.totalPoints;
        }
        const rank = currentRank;
        const oldEntry = oldEntriesMap.get(data.userId);
        const previousRank = oldEntry?.rank;
        const previousPoints = oldEntry?.totalPoints ?? null;
        let rankChange: "up" | "down" | "same" = "same";
        
        if (typeof previousRank === 'number') {
            if (rank < previousRank) {
                rankChange = "up";
            } else if (rank > previousRank) {
                rankChange = "down";
            }
        }
        return { userId: data.userId, userName: data.userName, avatarUrl: data.avatarUrl, totalPoints: data.totalPoints, previousPoints, rank, previousRank: previousRank ?? null, rankChange };
    });

    let tournamentAiSummary = oldLeaderboardData?.tournamentAiSummary || "";
    let aiSummaryHistory = oldLeaderboardData?.aiSummaryHistory || [];

    const oldPointsHash = oldLeaderboardData?.entries.map(e => `${e.userId}:${e.totalPoints}`).join(',');
    const newPointsHash = newLeaderboard.map(e => `${e.userId}:${e.totalPoints}`).join(',');
    
    const isFirstFill = (oldLeaderboardData?.entries.length === 0 && newLeaderboard.length > 0);
    
    // SAFE Match Detection
    let newMatchesCount = 0;
    if (oldLeaderboardData && oldLeaderboardData.completedMatchesCount !== undefined) {
        newMatchesCount = Math.max(0, completedMatches.length - oldLeaderboardData.completedMatchesCount);
    } else {
        newMatchesCount = completedMatches.length > 0 ? 1 : 0;
    }
    newMatchesCount = Math.min(newMatchesCount, 4);
    const hasNewMatches = newMatchesCount > 0;
    
    const shouldUpdateLeaderboardSummary = (oldPointsHash !== newPointsHash) || hasNewMatches || isFirstFill || !tournamentAiSummary;

    if (shouldUpdateLeaderboardSummary && newLeaderboard.length > 0) {
        const formatPlayer = (e: LeaderboardEntry) => `${e.userName} (Current: ${e.totalPoints} pts | Prev: ${e.previousPoints ?? 'N/A'} pts | Rank Change: ${e.rankChange === 'same' ? 'STUCK at ' + e.rank : (e.rankChange === 'up' ? 'UP to ' + e.rank : 'DOWN to ' + e.rank)})`;
        
        const topN = newLeaderboard.filter(e => e.rank <= 3).map(e => `Rank ${e.rank}: **${formatPlayer(e)}**`).join(', ');
        const bottomN = newLeaderboard.length > 3 ? newLeaderboard.slice(-2).map(e => `Rank ${e.rank}: **${formatPlayer(e)}**`).join(', ') : "";
        const climbers = newLeaderboard.filter(e => e.rankChange === 'up').slice(0, 2).map(e => `**${formatPlayer(e)}**`).join(', ');
        const tumblers = newLeaderboard.filter(e => e.rankChange === 'down').slice(0, 2).map(e => `**${formatPlayer(e)}**`).join(', ');
        
        const middlePack = newLeaderboard.length > 5 ? newLeaderboard.slice(3, -2) : [];
        let randomlySelectedMiddlePlayers = "";
        if (middlePack.length > 0) {
            const numToPick = Math.min(middlePack.length, Math.floor(Math.random() * 2) + 1);
            const shuffled = [...middlePack].sort(() => 0.5 - Math.random());
            const picked = shuffled.slice(0, numToPick);
            randomlySelectedMiddlePlayers = picked.map(e => `**${formatPlayer(e)}**`).join(', ');
        }
        
        const maxPossibleRemainingPoints = calculateRemainingMatchPoints(allMatches, pointRules);
        
        const newlyCompletedMatches = hasNewMatches ? completedMatches.slice(-newMatchesCount) : [];
        
        const formatMatch = (m: Match) => {
            let res = `${m.team1.name} ${m.team1Score} - ${m.team2Score} ${m.team2.name}`;
            if (m.team1Score === m.team2Score && m.winnerTeamCode) {
                const winnerName = m.winnerTeamCode === m.team1.code ? m.team1.name : m.team2.name;
                if (m.tiebreakerType === 'Extra Time') {
                    res += ` (Extra Time ${m.team1Score! + (m.team1TiebreakerScore || 0)} - ${m.team2Score! + (m.team2TiebreakerScore || 0)}, ${winnerName} menang)`;
                } else if (m.tiebreakerType === 'Penalty Shootout') {
                    res += ` (Penalti ${m.team1TiebreakerScore || 0} - ${m.team2TiebreakerScore || 0}, ${winnerName} menang)`;
                } else {
                    res += ` (${winnerName} menang adu penalti/tiebreaker)`;
                }
            }
            return res;
        };

        const newlyCompletedMatchesString = newlyCompletedMatches.length > 0 
            ? newlyCompletedMatches.map(formatMatch).join(' DAN ') 
            : 'Belum ada pertandingan baru';

        const currentStageMatches = allMatches.filter(m => m.stage === currentTournamentStage);
        const completedCurrentStageMatches = currentStageMatches.filter(m => typeof m.team1Score === 'number');
        const stageProgressString = currentStageMatches.length > 0 ? `${completedCurrentStageMatches.length} dari ${currentStageMatches.length} pertandingan diselesaikan` : 'N/A';
        const isLastMatchOfStage = currentStageMatches.length > 0 && completedCurrentStageMatches.length === currentStageMatches.length;

        const groupStatus = currentTournamentStage === "Group Stage" ? Object.keys(groupStandings).map(group => {
            const teams = groupStandings[group];
            if (teams.length === 0) return '';
            const leader = teams[0];
            const others = teams.slice(1).map(t => `${t.team.name} (${t.pts} pts)`).join(', ');
            return `Grup ${group}: Puncak ${leader.team.name} (${leader.pts} pts) | Tim lain: ${others}`;
        }).filter(Boolean).join('\n        - ') : 'Fase grup sudah selesai, turnamen sekarang berada di fase gugur (Knockout/Piala).';

        const systemInstruction = `You are a hilarious, highly insightful, and unhinged sports commentator chatting in a casual Indonesian group chat (menggunakan Bahasa Gaul, bahasa tongkrongan, santai, dan kocak).
        Your goal is to blend the real-world drama of the tournament with the fierce, often comical rivalry of our prediction leaderboard.
        CRITICAL INSTRUCTION: You MUST use a wide variety of sentence structures, metaphors, and jokes every single time. NEVER repeat the same tropes. Your tone should be unpredictable, chaotic, and fresh. DO NOT use formal/baku Indonesian. Gunakan bahasa santai sehari-hari. 
        FAMILY FRIENDLY CONSTRAINT: You MUST keep the language family-friendly (PG-13) as there are underage participants. Maintain the casual 'anak tongkrongan' vibe, but DO NOT use harsh words, mild profanity, or inappropriate slang (such as "anjir", "anjrit", "bangsat", "bego", "goblok", dll). You can be very funny, sarcastic, and unhinged without resorting to bad words.
        STRICT NEGATIVE CONSTRAINT: DO NOT EVER USE the words "lo", "gue", "gw", "lu", or any variations of them. NEVER use them.`;

        const inQueueTopicsSnap = await db.collection("tournaments").doc(tournamentId).collection("aiTopics")
            .where("status", "==", "in_queue")
            .orderBy("createdAt", "asc")
            .get();
        
        const allInQueueTopics = inQueueTopicsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AiTopic));
        
        const forcedTopics = allInQueueTopics.filter(t => t.usageMode === 'forced').slice(0, 1);
        const optionalTopics = allInQueueTopics.filter(t => t.usageMode !== 'forced').slice(0, 2);
        
        let topicsPrompt = "";
        if (forcedTopics.length > 0 || optionalTopics.length > 0) {
            topicsPrompt += "\n\nAvailable Inside Jokes / Real-World Topics:\n";
            if (forcedTopics.length > 0) {
                topicsPrompt += "MANDATORY TOPICS (You MUST weave these into your summary):\n" + forcedTopics.map(t => `- [ID: ${t.id}] Topic: ${t.topic}. Detail: ${t.details}`).join('\n') + "\n";
            }
            if (optionalTopics.length > 0) {
                topicsPrompt += "OPTIONAL INSIDE JOKES (Use these ONLY if they fit naturally with the leaderboard movement, e.g., if it relates to a specific participant being mentioned):\n" + optionalTopics.map(t => `- [ID: ${t.id}] Topic: ${t.topic}. Detail: ${t.details}`).join('\n') + "\n";
            }
            topicsPrompt += "\nYou MUST append a tag at the very end of your ENTIRE response exactly like this: ||USED_TOPICS: id1, id2|| for ANY topic you used (both mandatory and optional). If you didn't use any, do not append the tag.";
        }

        const participantContextDoc = await db.collection("tournaments").doc(tournamentId).collection("aiConfig").doc("participantContext").get();
        const participantContexts = participantContextDoc.exists ? participantContextDoc.data()?.contexts || {} : {};
        
        let participantContextPrompt = "";
        const contextEntries = Object.entries(participantContexts);
        if (contextEntries.length > 0) {
            participantContextPrompt += "\n\nPLAYER CONTEXT: Use the following information to personalize your roasts and praises. Use appropriate pronouns based on gender. RARELY incorporate their specific relationships if relevant to a joke, but do NOT overdo it. Keep relationship mentions sparse so it doesn't sound cheesy or repetitive. STRICT RULE: When mentioning relationships, NEVER use cheesy or dramatic adjectives like 'kesayangan', 'tercinta', 'tersayang', etc. (e.g., do not say 'mertua kesayangan' or 'sepupu tercinta'). Keep it casual, sarcastic, or purely factual.\n";
            for (const [userId, ctx] of contextEntries) {
                const userObj = newLeaderboard.find(e => e.userId === userId);
                if (userObj) {
                    const ctxData = ctx as any;
                    const genderStr = ctxData.gender === 'male' ? 'Male' : (ctxData.gender === 'female' ? 'Female' : 'Unknown/Neutral');
                    let connectionsStr = '';
                    if (ctxData.connections && Array.isArray(ctxData.connections) && ctxData.connections.length > 0) {
                        const rels = ctxData.connections.map((c: any) => `${c.type} of ${c.target}`).join(', ');
                        connectionsStr = ` - Connections: ${rels}`;
                    }
                    let notesStr = '';
                    if (ctxData.notes && typeof ctxData.notes === 'string' && ctxData.notes.trim() !== '') {
                        notesStr = ` - Personal Notes: ${ctxData.notes.trim()}`;
                    }
                    participantContextPrompt += `- ${userObj.userName} (${genderStr})${connectionsStr}${notesStr}\n`;
                }
            }
        }

        let playersGainedPoints = 0;
        newLeaderboard.forEach(newEntry => {
            const oldEntry = oldEntriesMap.get(newEntry.userId);
            if (!oldEntry || newEntry.totalPoints > oldEntry.totalPoints) {
                playersGainedPoints++;
            }
        });
        
        const totalPlayers = newLeaderboard.length;
        const gainedPercentage = totalPlayers > 0 ? (playersGainedPoints / totalPlayers) * 100 : 0;
        
        let movementContext = "";
        if (gainedPercentage === 0) {
            movementContext = "🚨 STATUS KHUSUS: Papan peringkat STAGNAN total! Tidak ada satupun pemain yang dapet poin tambahan di pertandingan ini.";
        } else if (gainedPercentage <= 30) {
            movementContext = "🚨 STATUS KHUSUS: Pergerakan sangat minim! Hanya segelintir orang yang berhasil curi poin.";
        } else {
            movementContext = "🚨 STATUS KHUSUS: Pergerakan masif! Banyak pemain yang panen poin dan merubah susunan klasemen.";
        }

        let historyPrompt = "Belum ada riwayat ringkasan.";
        if (aiSummaryHistory && aiSummaryHistory.length > 0) {
            historyPrompt = aiSummaryHistory.map((summary, index) => 
                `[Ringkasan ${index + 1} Pertandingan Lalu]: "${summary}"`
            ).join('\n\n');
        }

        const prompt = `Real-World Tournament Data:
        - Tournament Progress: ${tournamentCompletion}% complete
        - Current Stage: ${currentTournamentStage} (Progres babak ini: ${stageProgressString})
        ${isLastMatchOfStage ? `- STATUS SPESIAL: Ini adalah pertandingan TERAKHIR di babak ${currentTournamentStage}!` : ''}
        - Points Still Available: ${maxPossibleRemainingPoints}
        - Pertandingan yang BARU SAJA Selesai (SANGAT PENTING): ${newlyCompletedMatchesString}
        - Status Grup (Group Standings): 
        - ${groupStatus}
        
        Prediction Leaderboard Data:
        - Dinamika Pergerakan: ${movementContext}
        - Current Top 3: ${topN}
        - Current Bottom Players: ${bottomN || 'N/A'}
        - Notable Climbers (Ranking Up): ${climbers || 'N/A'}
        - Notable Drops (Ranking Down): ${tumblers || 'N/A'}
        - Pemain Papan Tengah (Middle Pack) yang bisa disorot (Opsional, puji atau roast jika menarik): ${randomlySelectedMiddlePlayers || 'N/A'}

        Previous Context (Riwayat Ringkasan Terakhirmu):
        ${historyPrompt}

        Platform Rules (CRITICAL):
        - PREDICTION LOCKS: Predictions are strictly LOCKED once the first match of a stage begins. Players CANNOT change their predictions mid-stage.
        - PREDICTION UNLOCKS: The prediction window only opens AFTER the last match of the current stage is finished, to let them predict the NEXT stage.
        - Therefore, DO NOT tell players to "panasin insting buat tebakan besok" or "ganti tebakan besok" if the stage is currently ongoing! Only hype them up for the NEXT stage if the current one is ending.
        - DO NOT BE REDUNDANT ABOUT LOCKS: While you need to know the lock rules to avoid making mistakes, DO NOT actually write "ingat ya tebakan sudah dikunci" or remind them about the lock status at the end of your summary unless it's the very first match of the stage. We don't want to sound like a broken record.
        - GROUP CONTEXT: In the Group Stage, teams only compete within their specific Group (Grup A, Grup B, dll). DO NOT compare teams from different groups as if they are directly fighting for the same spot. Also, do not heavily roast a team for having 0 points if their first match hasn't even started yet!
        - TIE BREAKER RULE (SUPER IMPORTANT): If multiple players have the exact SAME points, they are TIED and share the exact SAME Rank! Do NOT say one player overtook another if they both have the SAME points. If you see multiple people with the same points in the top 3, acknowledge the massive tie instead of inventing a gap between them!
        ${topicsPrompt}
        ${participantContextPrompt}

        Instructions:
        - Write a rich, engaging, and highly comedic summary using CASUAL INDONESIAN (Bahasa Gaul/tongkrongan, JANGAN BAKU!).
        - Analyze the flow of the Previous Context and the current Dinamika Pergerakan. If the leaderboard is stagnant or barely moved, point it out! If someone has been stuck in the same spot for multiple summaries, you can roast them for it.
        - STRUCTURAL RANDOMIZER (CRITICAL): You MUST change your paragraph structure and narrative flow in every single summary. Do NOT always start with the match recap. Sometimes start by roasting the last place, sometimes start with a huge rank climber, sometimes start with a general observation, or write it like a breaking news flash.
        - ANTI-REPETITION (CRITICAL): You are STRICTLY FORBIDDEN from using any joke, phrase, metaphor, or analogy if it has appeared in the 'Previous Context'. For example, if you see 'kerak bumi', 'gempa', 'tsunami', or 'bujug buneng' in the Previous Context, you CANNOT use those words again in this summary. Find entirely new ways to describe disaster, success, or failure.
        - PENTING SANGAT: Perhatikan "Current Stage". Jika turnamen berada di fase gugur (seperti Round of 16, Quarter-final, Semi-final, Final), JANGAN BAHAS poin grup lagi. Bahas tentang eliminasi, siapa yang gugur, siapa yang lolos, atau drama adu penalti jika skor seri.
        - DO NOT HALLUCINATE FACTS: You MUST strictly stick to the points, names, and match results provided in the prompt. You can be wild with your jokes and analogies, but NEVER invent fake scores, fake point totals, or fake matches.
        - Notice and comment on changes across the whole board—praise the top leaders, playfully roast or encourage the bottom players, highlight the climbers/drops, dan berikan shoutout ke pemain papan tengah!
        - COHERENT MONOLOGUE: Do not write disjointed, random roasts. You MUST write the summary as one continuous, flowing monologue like you are writing a story. Create and use transitions to connect the participants together smoothly and logically instead of just listing and roasting who went up or down.
        - You MUST keep the summary strictly between 10 to 15 sentences MAXIMUM. Make every sentence count!
        - Go all out on the comedy—use funny analogies, dramatic flair, dan casual roasts.
        - STRICT RULE: JANGAN PERNAH MENGGUNAKAN KATA "LO", "GUE", "GW", ATAU "LU".
        - Ensure all user/player names are bolded using markdown (e.g., **Nama**).
        - FORMATTING RULE: DO NOT use any HTML tags (like <i>, <b>, <br>) and DO NOT use markdown italics (*italic* or _italic_). Keep the text plain except for bolding names.`;
        tournamentAiSummary = await generateAiSummary(prompt, systemInstruction);
        
        const usedTopicsMatch = tournamentAiSummary.match(/\|\|\s*USED_TOPICS\s*:\s*([\s\S]*?)\s*\|\|/i);
        if (usedTopicsMatch) {
            const ids = usedTopicsMatch[1].split(',').map(s => s.trim().replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean);
            for (const id of ids) {
                if (allInQueueTopics.some(t => t.id === id)) {
                    await db.collection("tournaments").doc(tournamentId).collection("aiTopics").doc(id).update({ status: 'used' });
                }
            }
            tournamentAiSummary = tournamentAiSummary.replace(/\|\|\s*USED_TOPICS\s*:\s*([\s\S]*?)\s*\|\|/gi, '').trim();
        }
        
        if (tournamentAiSummary) {
            aiSummaryHistory.unshift(tournamentAiSummary);
            aiSummaryHistory = aiSummaryHistory.slice(0, 3);
        }
    }  
    
    if (!tournamentAiSummary) {
        tournamentAiSummary = "Turnamen sedang berlangsung! Terus buat prediksi untuk memanjat peringkat.";
    }
    
    await db.collection("leaderboards").doc(tournamentId).set({
        entries: newLeaderboard,
        tournamentAiSummary: tournamentAiSummary,
        aiSummaryHistory: aiSummaryHistory,
        eliminatedTeamCodes: Array.from(eliminatedTeamCodes),
        currentTournamentStage: currentTournamentStage,
        groupStandings: groupStandings,
        completedMatchesCount: completedMatches.length,
        lastUpdated: Timestamp.now(),
    });
    logger.info(`Leaderboard for tournament ${tournamentId} successfully updated.`);
}
