// src/components/views/widgets/LeaderboardWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile, Leaderboard } from '../../../types';
import AiSummary from './AiSummary';

interface LeaderboardWidgetProps {
    userProfile: UserProfile;
    tournamentId?: string;
    setRefreshFunc: (func: () => void) => void;
}

const RankChangeIndicator = ({ change }: { change: 'up' | 'down' | 'same' }) => {
    switch (change) {
        case 'up': return <span className="text-green-500" title="Rank Up">▲</span>;
        case 'down': return <span className="text-red-500" title="Rank Down">▼</span>;
        default: return <span className="text-slate-500" title="Rank Unchanged">=</span>;
    }
};

const LeaderboardWidget = ({ userProfile, tournamentId, setRefreshFunc }: LeaderboardWidgetProps) => {
    const [leaderboardData, setLeaderboardData] = useState<Leaderboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tournamentNotFound, setTournamentNotFound] = useState(false); // State to track if the tournament is deleted

    const fetchData = useCallback(async () => {
        // Reset error state on new fetch
        setTournamentNotFound(false);
        if (!tournamentId) {
            setIsLoading(false);
            setLeaderboardData(null);
            return;
        }
        setIsLoading(true);
        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const docSnap = await getDoc(leaderboardRef);

        // Check if the underlying leaderboard document exists.
        // It might not exist if the tournament was deleted.
        if (docSnap.exists()) {
            setLeaderboardData(docSnap.data() as Leaderboard);
        } else {
            // Check if the tournament itself exists to differentiate between no data and a deleted tournament
            const tourneyRef = doc(db, "tournaments", tournamentId);
            const tourneySnap = await getDoc(tourneyRef);
            if (!tourneySnap.exists()) {
                setTournamentNotFound(true);
            }
            setLeaderboardData(null);
        }
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);

    if (tournamentNotFound) {
        return (
            <div className="h-full flex items-center justify-center p-4 text-center">
                <p className="text-yellow-400 text-sm">
                    The tournament associated with this widget could not be found. It may have been deleted. Please edit the widget to select a new tournament.
                </p>
            </div>
        );
    }
    
    if (!tournamentId) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <p className="text-slate-400 text-sm text-center">Please join a tournament or select one in the widget settings.</p>
            </div>
        );
    }

    const userRank = leaderboardData?.entries.find(entry => entry.userId === userProfile.uid);
    const entries = leaderboardData?.entries || [];

    return (
        <div className="h-full flex flex-col">
            {leaderboardData?.tournamentAiSummary ? (
                <AiSummary title="Tournament Overview" text={leaderboardData.tournamentAiSummary} colorClass="border-slate-600 text-blue-400" />
            ) : null}

            <div className="flex-grow overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading...</p></div>
                ) : entries.length === 0 ? (
                    <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No data available.</p></div>
                ) : (
                    <table className="w-full text-xs">
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.userId} className={`border-b border-slate-700 ${entry.userId === userProfile.uid ? 'bg-blue-900/50' : ''}`}>
                                    <td className="p-2 text-center w-10 text-slate-300">
                                        <div className="flex items-center justify-center gap-2">
                                            <RankChangeIndicator change={entry.rankChange} />
                                            <span>{entry.rank}</span>
                                        </div>
                                    </td>
                                    <td className="p-2 truncate text-slate-300">{entry.userName}</td>
                                    <td className="p-2 text-right font-mono text-slate-300">{entry.totalPoints}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
             {userRank && (
                <div className="flex-shrink-0 border-t-2 border-blue-500 bg-slate-900 p-2 mt-2 text-xs">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <RankChangeIndicator change={userRank.rankChange} />
                            <span className="font-bold">{userRank.rank}</span>
                            <span className="truncate">{userRank.userName} (You)</span>
                        </div>
                        <span className="font-mono font-bold">{userRank.totalPoints} pts</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaderboardWidget;
