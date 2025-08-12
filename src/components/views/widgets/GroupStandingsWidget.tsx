// src/components/views/widgets/GroupStandingsWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Leaderboard, TeamStanding } from '../../../types';

interface GroupStandingsWidgetProps {
    tournamentId?: string;
    setRefreshFunc: (func: () => void) => void;
}

const GroupStandingsWidget = ({ tournamentId, setRefreshFunc }: GroupStandingsWidgetProps) => {
    const [standings, setStandings] = useState<Record<string, TeamStanding[]> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!tournamentId) {
            setIsLoading(false);
            setStandings(null);
            return;
        }
        setIsLoading(true);
        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const docSnap = await getDoc(leaderboardRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as Leaderboard;
            setStandings(data.groupStandings || null);
        } else {
            setStandings(null);
        }
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading Standings...</p></div>;
    }
    if (!tournamentId) {
        return <div className="h-full flex items-center justify-center p-4"><p className="text-slate-400 text-sm text-center">Please join a tournament or select one in the widget settings.</p></div>;
    }
    if (!standings || Object.keys(standings).length === 0) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">Group standings are not available yet.</p></div>;
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {Object.keys(standings).sort().map(groupName => (
                    <div key={groupName} className="bg-slate-900/50 p-2">
                        <h4 className="font-bold text-blue-400 text-center mb-2">{groupName}</h4>
                        <table className="w-full text-xs text-slate-300">
                            <thead>
                                <tr className="text-slate-500">
                                    <th className="text-left font-medium py-1 px-1">Team</th>
                                    <th title="Matches Played" className="w-6 font-medium py-1">MP</th>
                                    <th title="Wins" className="w-6 font-medium py-1">W</th>
                                    <th title="Draws" className="w-6 font-medium py-1">D</th>
                                    <th title="Losses" className="w-6 font-medium py-1">L</th>
                                    <th title="Goal Difference" className="w-6 font-medium py-1">GD</th>
                                    <th title="Points" className="w-6 font-medium py-1">Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings[groupName].map((s, index) => (
                                    <tr key={s.team.code} className="border-t border-slate-700">
                                        <td className="py-1 px-1 flex items-center gap-2">
                                            <span className="w-4 text-center">{index + 1}</span>
                                            <span>{s.team.flag}</span>
                                            <span className="truncate">{s.team.name}</span>
                                        </td>
                                        <td className="text-center font-mono">{s.mp}</td>
                                        <td className="text-center font-mono">{s.w}</td>
                                        <td className="text-center font-mono">{s.d}</td>
                                        <td className="text-center font-mono">{s.l}</td>
                                        <td className="text-center font-mono">{s.gd}</td>
                                        <td className="text-center font-mono font-bold text-white">{s.pts}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupStandingsWidget;
