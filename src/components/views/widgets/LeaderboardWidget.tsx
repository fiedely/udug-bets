// src/components/views/widgets/LeaderboardWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile, LeaderboardEntry } from '../../../types'; // Use the updated LeaderboardEntry type

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
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [tournamentSummary, setTournamentSummary] = useState<string | null>(null); // State for admin summary
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!tournamentId) {
            setIsLoading(false);
            setLeaderboard([]);
            return;
        }
        setIsLoading(true);
        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const docSnap = await getDoc(leaderboardRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setLeaderboard(data.entries || []);
            setTournamentSummary(data.tournamentAiSummary || null); // Fetch the admin summary
        } else {
            setLeaderboard([]);
            setTournamentSummary(null);
        }
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        setRefreshFunc(fetchData); // Correctly pass the function reference
    }, [fetchData, setRefreshFunc]);

    if (!tournamentId) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <p className="text-slate-400 text-sm text-center">Please configure this widget to select a tournament.</p>
            </div>
        );
    }

    const isAdmin = userProfile.role === 'admin' || userProfile.role === 'superadmin';
    const userRank = leaderboard.find(entry => entry.userId === userProfile.uid);

    return (
        <div className="h-full flex flex-col">
            {/* --- NEW: AI Summary Section --- */}
            {isAdmin && tournamentSummary ? (
                <div className="p-3 mb-2 bg-slate-700/50 border border-green-500 text-sm text-slate-300">
                    <h4 className="font-bold text-green-400 mb-1">AI Tournament Overview</h4>
                    <p>{tournamentSummary}</p>
                </div>
            ) : userRank && userRank.aiSummary ? (
                <div className="p-3 mb-2 bg-slate-700/50 border border-blue-500 text-sm text-slate-300">
                    <h4 className="font-bold text-blue-400 mb-1">Your AI Analyst Report</h4>
                    <p>{userRank.aiSummary}</p>
                </div>
            ) : null}

            <div className="flex-grow overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading...</p></div>
                ) : leaderboard.length === 0 ? (
                    <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No data available.</p></div>
                ) : (
                    <table className="w-full text-xs">
                        <tbody>
                            {leaderboard.map((entry) => (
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
