// src/components/views/widgets/ChampionPredictionWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, Team, UserProfile, Leaderboard } from '../../../types';
import AiSummary from './AiSummary';
import { FIFA_COUNTRIES } from '../../../data/countries';

interface ChampionPredictionWidgetProps {
    userProfile: UserProfile;
    tournamentId?: string;
    setRefreshFunc: (func: () => void) => void;
}

interface ChampionPick {
    team: Team;
    count: number;
    isEliminated: boolean;
}

const fifaCountriesMap = new Map(FIFA_COUNTRIES.map(c => [c.code, c]));

const ChampionPredictionWidget = ({ userProfile, tournamentId, setRefreshFunc }: ChampionPredictionWidgetProps) => {
    const [picks, setPicks] = useState<ChampionPick[]>([]);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [totalPredictions, setTotalPredictions] = useState(0);
    const [myChampionPick, setMyChampionPick] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!tournamentId) { 
            setIsLoading(false); 
            setPicks([]);
            return; 
        }
        setIsLoading(true);

        const tourneyRef = doc(db, "tournaments", tournamentId);
        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const [tourneySnap, leaderboardSnap] = await Promise.all([getDoc(tourneyRef), getDoc(leaderboardRef)]);

        if (!tourneySnap.exists()) { 
            setIsLoading(false); 
            setPicks([]);
            return; 
        }
        
        const tournament = tourneySnap.data() as Tournament;
        const leaderboardData = leaderboardSnap.data() as Leaderboard | undefined;
        
        const teamsMap = new Map(tournament.teams?.map(t => [t.code, t]));
        const participants = tournament.participants || [];
        const eliminatedCodes = new Set(leaderboardData?.eliminatedTeamCodes || []);
        
        setAiSummary(leaderboardData?.championAiSummary || null);

        if (participants.length === 0) {
            setPicks([]);
            setTotalPredictions(0);
            setIsLoading(false);
            return;
        }

        const predictionPromises = participants.map(userId => getDoc(doc(db, "predictions", `${tournamentId}_${userId}`)));
        const predictionSnapshots = await Promise.all(predictionPromises);
        const predictions = predictionSnapshots.filter(snap => snap.exists()).map(snap => snap.data() as UserPredictions);

        setTotalPredictions(predictions.length);

        if (userProfile.role === 'user') {
            const myPred = predictions.find(p => p.userId === userProfile.uid);
            setMyChampionPick(myPred?.championPrediction || null);
        }

        const counts = new Map<string, number>();
        predictions.forEach(p => {
            if (p.championPrediction) {
                counts.set(p.championPrediction, (counts.get(p.championPrediction) || 0) + 1);
            }
        });

        const formattedPicks: ChampionPick[] = Array.from(counts.entries()).map(([teamCode, count]) => {
            const team = teamsMap.get(teamCode) 
                         || fifaCountriesMap.get(teamCode) 
                         || { name: 'Unknown', code: teamCode, flag: '❓' };

            return {
                team,
                count,
                isEliminated: eliminatedCodes.has(teamCode),
            };
        });

        formattedPicks.sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name));
        
        setPicks(formattedPicks);
        setIsLoading(false);
    }, [tournamentId, userProfile.uid, userProfile.role]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading...</p></div>;
    }
    if (!tournamentId) {
        return <div className="h-full flex items-center justify-center p-4"><p className="text-slate-400 text-sm text-center">Please join a tournament or select one in the widget settings.</p></div>;
    }
    if (picks.length === 0) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No champion predictions have been made yet.</p></div>;
    }

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            {aiSummary && <AiSummary title="Community Sentiment" text={aiSummary} colorClass="border-slate-600 text-blue-400" />}
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-xs">
                    <tbody>
                        {picks.map((pick, index) => (
                            <tr 
                                key={pick.team.code} 
                                className={`border-b border-slate-700 ${myChampionPick === pick.team.code ? 'bg-blue-900/50' : ''}`}
                            >
                                <td className="p-2 text-center w-10">{index + 1}</td>
                                <td className="p-2 truncate flex items-center gap-2">
                                    <span className="w-5 h-auto">{pick.team.flag}</span>
                                    <span className={pick.isEliminated ? 'text-slate-500 line-through' : ''}>
                                        {pick.team.name}
                                    </span>
                                </td>
                                <td className={`p-2 text-right font-mono ${pick.isEliminated ? 'text-slate-500' : ''}`}>
                                    {pick.count} vote(s)
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex-shrink-0 border-t-2 border-slate-600 p-2 mt-2 text-xs text-slate-400 text-center">
                {totalPredictions} total predictions submitted.
            </div>
        </div>
    );
};

export default ChampionPredictionWidget;
