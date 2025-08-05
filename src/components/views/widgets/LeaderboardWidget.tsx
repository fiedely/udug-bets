// src/components/views/widgets/LeaderboardWidget.tsx

import { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import type { UserProfile, Tournament } from '../../../types';

// Define the type for a single entry in the leaderboard
interface LeaderboardEntry {
    userId: string;
    userName: string;
    totalPoints: number;
    rank: number;
    rankChange: 'up' | 'down' | 'same';
}

interface LeaderboardWidgetProps {
    userProfile: UserProfile;
}

const RankChangeIndicator = ({ change }: { change: 'up' | 'down' | 'same' }) => {
    switch (change) {
        case 'up': return <span className="text-green-500" title="Rank Up">▲</span>;
        case 'down': return <span className="text-red-500" title="Rank Down">▼</span>;
        case 'same':
        default: return <span className="text-slate-500" title="Rank Unchanged">=</span>;
    }
};

const LeaderboardWidget = ({ userProfile }: LeaderboardWidgetProps) => {
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all tournaments the user has joined to populate the dropdown
    useEffect(() => {
        const fetchTournaments = async () => {
            const tournamentsRef = collection(db, 'tournaments');
            const q = query(tournamentsRef, 
                where('participants', 'array-contains', userProfile.uid),
                where('status', '==', 'active')
            );
            const tourneySnapshot = await getDocs(q);
            const tournamentsList = tourneySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
            setJoinedTournaments(tournamentsList);
            // Default to selecting the first tournament in the list
            if (tournamentsList.length > 0) {
                setSelectedTournamentId(tournamentsList[0].id);
            } else {
                setIsLoading(false);
            }
        };
        fetchTournaments();
    }, [userProfile.uid]);

    // Set up a real-time listener for the selected tournament's leaderboard
    useEffect(() => {
        if (!selectedTournamentId) return;

        setIsLoading(true);
        const leaderboardRef = doc(db, "leaderboards", selectedTournamentId);
        const unsubscribe = onSnapshot(leaderboardRef, (docSnap) => {
            if (docSnap.exists()) {
                setLeaderboard(docSnap.data().entries || []);
            } else {
                setLeaderboard([]);
            }
            setIsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [selectedTournamentId]);

    const userRank = leaderboard.find(entry => entry.userId === userProfile.uid);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white">Leaderboard</h3>
                <select
                    value={selectedTournamentId}
                    onChange={(e) => setSelectedTournamentId(e.target.value)}
                    className="bg-slate-700 text-xs text-white p-1 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {joinedTournaments.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex-grow overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400">Loading...</p>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 text-sm text-center">No leaderboard data available for this tournament yet.</p>
                    </div>
                ) : (
                    <table className="w-full text-xs">
                        <tbody>
                            {leaderboard.slice(0, 10).map((entry) => ( // Show top 10
                                <tr key={entry.userId} className={`border-b border-slate-700 ${entry.userId === userProfile.uid ? 'bg-blue-900/50' : ''}`}>
                                    <td className="p-2 text-center w-10">
                                        <div className="flex items-center justify-center gap-2">
                                            <RankChangeIndicator change={entry.rankChange} />
                                            <span>{entry.rank}</span>
                                        </div>
                                    </td>
                                    <td className="p-2">{entry.userName}</td>
                                    <td className="p-2 text-right font-mono">{entry.totalPoints}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
             {userRank && (
                <div className="border-t-2 border-blue-500 bg-slate-900 p-2 mt-2 text-xs">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <RankChangeIndicator change={userRank.rankChange} />
                            <span className="font-bold">{userRank.rank}</span>
                            <span>{userRank.userName} (You)</span>
                        </div>
                        <span className="font-mono font-bold">{userRank.totalPoints} pts</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaderboardWidget;