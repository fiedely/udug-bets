// src/components/admin/TournamentLeaderboard.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Tournament } from '../../types';

// Define the type for a single entry in the leaderboard
interface LeaderboardEntry {
    userId: string;
    userName: string;
    totalPoints: number;
    rank: number;
    previousRank?: number;
    rankChange: 'up' | 'down' | 'same';
}

// Props for our component
interface TournamentLeaderboardProps {
    tournament: Tournament;
    onBack: () => void;
}

// A small component to render the rank change indicator
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

    useEffect(() => {
        // Set up a real-time listener on the leaderboard document
        const leaderboardRef = doc(db, "leaderboards", tournament.id);
        
        const unsubscribe = onSnapshot(leaderboardRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLeaderboard(data.entries || []);
                if (data.lastUpdated) {
                    setLastUpdated(data.lastUpdated.toDate());
                }
            } else {
                // If the document doesn't exist yet, it means no scores have been saved
                setLeaderboard([]);
            }
            setIsLoading(false);
        });

        // Clean up the listener when the component unmounts
        return () => unsubscribe();
    }, [tournament.id]);

    return (
        <div className="bg-slate-800 border border-slate-700 p-6 md:p-8">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">{tournament.name}</h2>
                    <p className="text-blue-400">Live Leaderboard</p>
                </div>
                <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300 flex items-center whitespace-nowrap">
                    &larr; Back to Tournaments List
                </button>
            </div>
            
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
                <div className="overflow-x-auto">
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
                                <tr key={entry.userId} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-medium text-white text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <RankChangeIndicator change={entry.rankChange} />
                                            <span>{entry.rank}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        {entry.userName}
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
        </div>
    );
};

export default TournamentLeaderboard;
