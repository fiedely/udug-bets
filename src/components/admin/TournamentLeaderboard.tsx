import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Tournament } from '../../types';
import UserPointHistoryModal from './UserPointHistoryModal';

interface LeaderboardEntry {
    userId: string;
    userName: string;
    avatarUrl?: string | null;
    totalPoints: number;
    rank: number;
    previousRank?: number;
    rankChange: 'up' | 'down' | 'same';
}

interface TournamentLeaderboardProps {
    tournament: Tournament;
    onBack: () => void;
}

const RankChangeIndicator = ({ change }: { change: 'up' | 'down' | 'same' }) => {
    switch (change) {
        case 'up':
            return <span className="text-green-500 flex items-center" title="Rank Up">▲</span>;
        case 'down':
            return <span className="text-red-500 flex items-center" title="Rank Down">▼</span>;
        case 'same':
        default:
            return <span className="text-slate-500 flex items-center" title="Rank Unchanged">=</span>;
    }
};

const TournamentLeaderboard = ({ tournament, onBack }: TournamentLeaderboardProps) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedAuditUser, setSelectedAuditUser] = useState<{id: string, name: string} | null>(null);

    useEffect(() => {
        const leaderboardRef = doc(db, "leaderboards", tournament.id);
        
        const unsubscribe = onSnapshot(leaderboardRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLeaderboard(data.entries || []);
                if (data.lastUpdated) {
                    setLastUpdated(data.lastUpdated.toDate());
                }
            } else {
                setLeaderboard([]);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [tournament.id]);

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto w-full">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage: {tournament.name}</h2>
                        <p className="text-sm text-slate-400">Participant Point History: {tournament.name}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col max-w-6xl mx-auto w-full">
            
            {lastUpdated && (
                <p className="text-xs text-slate-400 mb-4">
                    Last updated: {lastUpdated.toLocaleString()}
                </p>
            )}

            {isLoading ? (
                <div className="text-center p-8">
                    <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="text-center p-8 bg-slate-900/50 border border-slate-700">
                    <p className="text-slate-300">The leaderboard is not yet available.</p>
                    <p className="text-slate-400 text-sm mt-1">It will be automatically generated after you save scores in the "Manage Scores" menu for the first time.</p>
                </div>
            ) : (
                <div className="overflow-x-auto overscroll-x-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-center w-16">Rank</th>
                                <th scope="col" className="px-6 py-3">User</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry) => (
                                <tr 
                                    key={entry.userId} 
                                    onClick={() => setSelectedAuditUser({ id: entry.userId, name: entry.userName })}
                                    className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/80 cursor-pointer transition-colors"
                                    title="Click to view point history"
                                >
                                    <td className="px-6 py-4 font-medium text-white text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <RankChangeIndicator change={entry.rankChange} />
                                            <span>{entry.rank}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        <div className="flex items-center gap-3">
                                            {entry.avatarUrl ? (
                                                <img loading="lazy" decoding="async" src={entry.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full transform-gpu object-cover border border-slate-500" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full transform-gpu bg-slate-600 flex items-center justify-center text-xs text-slate-300 border border-slate-500">
                                                    {entry.userName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span>{entry.userName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-lg">
                                        {entry.totalPoints}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedAuditUser && (
                <UserPointHistoryModal 
                    tournament={tournament}
                    userId={selectedAuditUser.id}
                    userName={selectedAuditUser.name}
                    onClose={() => setSelectedAuditUser(null)}
                />
            )}
        </div>
        </div>
    );
};

export default TournamentLeaderboard;
