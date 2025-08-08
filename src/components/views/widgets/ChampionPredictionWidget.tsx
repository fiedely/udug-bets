// src/components/views/widgets/ChampionPredictionWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, Team, UserProfile } from '../../../types';
import Flag from '../../common/Flag';

interface ChampionPredictionWidgetProps {
    userProfile: UserProfile;
    tournamentId?: string;
    setRefreshFunc: (func: () => void) => void;
}

interface ChampionPick {
    team: Team;
    count: number;
}

const ChampionPredictionWidget = ({ userProfile, tournamentId, setRefreshFunc }: ChampionPredictionWidgetProps) => {
    const [picks, setPicks] = useState<ChampionPick[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalPredictions, setTotalPredictions] = useState(0);
    const [myChampionPick, setMyChampionPick] = useState<string | null>(null);

    if (!userProfile) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading User...</p></div>;
    }

    const isAdmin = userProfile.role === 'admin' || userProfile.role === 'superadmin';

    const fetchData = useCallback(async () => {
        if (!tournamentId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const tourneyRef = doc(db, "tournaments", tournamentId);
        const tourneySnap = await getDoc(tourneyRef);
        if (!tourneySnap.exists()) {
            setIsLoading(false);
            return;
        }
        const tournament = tourneySnap.data() as Tournament;
        const teamsMap = new Map(tournament.teams?.map(t => [t.code, t]));
        const participants = tournament.participants || [];

        if (participants.length === 0) {
            setPicks([]);
            setTotalPredictions(0);
            setIsLoading(false);
            return;
        }

        const predictionPromises = participants.map(userId =>
            getDoc(doc(db, "predictions", `${tournamentId}_${userId}`))
        );
        const predictionSnapshots = await Promise.all(predictionPromises);
        const predictions = predictionSnapshots
            .filter(snap => snap.exists())
            .map(snap => snap.data() as UserPredictions);

        setTotalPredictions(predictions.length);

        if (!isAdmin) {
            const myPred = predictions.find(p => p.userId === userProfile.uid);
            setMyChampionPick(myPred?.championPrediction || null);
        }

        const counts = new Map<string, number>();
        predictions.forEach(p => {
            if (p.championPrediction) {
                counts.set(p.championPrediction, (counts.get(p.championPrediction) || 0) + 1);
            }
        });

        const formattedPicks: ChampionPick[] = Array.from(counts.entries()).map(([teamCode, count]) => ({
            team: teamsMap.get(teamCode) || { name: 'Unknown', code: teamCode, flag: '❓' },
            count,
        }));

        formattedPicks.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.team.name.localeCompare(b.team.name);
        });
        
        setPicks(formattedPicks);
        setIsLoading(false);
    }, [tournamentId, userProfile, isAdmin]);

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
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">Please configure this widget.</p></div>;
    }
    if (picks.length === 0) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No champion predictions have been made yet.</p></div>;
    }

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-xs">
                    <tbody>
                        {picks.map((pick, index) => (
                            <tr 
                                key={pick.team.code} 
                                className={`border-b border-slate-700 ${!isAdmin && myChampionPick === pick.team.code ? 'bg-blue-900/50' : ''}`}
                            >
                                <td className="p-2 text-center w-10">{index + 1}</td>
                                <td className="p-2 truncate flex items-center gap-2">
                                    <Flag code={pick.team.code} className="w-5 h-auto" />
                                    {pick.team.name}
                                </td>
                                <td className="p-2 text-right font-mono">{pick.count} vote(s)</td>
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
