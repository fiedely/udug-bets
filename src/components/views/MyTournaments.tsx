// src/components/views/MyTournaments.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Tournament, UserProfile } from '../../types';
import TournamentDetails from './TournamentDetails'; // Import the new details component

interface MyTournamentsProps {
    userProfile: UserProfile | null;
}

const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const PredictionStatusIndicator = ({ status, label }: { status: boolean, label: string }) => (
    <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-slate-400">{label}</span>
    </div>
);

const MyTournaments = ({ userProfile }: MyTournamentsProps) => {
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingTournament, setViewingTournament] = useState<Tournament | null>(null);

    useEffect(() => {
        const fetchJoinedTournaments = async () => {
            if (!userProfile) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            const tournamentsRef = collection(db, 'tournaments');
            const q = query(tournamentsRef, where('participants', 'array-contains', userProfile.uid));
            
            const querySnapshot = await getDocs(q);
            const tournamentsList = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
                    endDate: data.endDate ? (data.endDate as Timestamp).toDate() : undefined,
                } as Tournament;
            });
            setJoinedTournaments(tournamentsList);
            setIsLoading(false);
        };
        fetchJoinedTournaments();
    }, [userProfile]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
        );
    }

    if (viewingTournament) {
        return <TournamentDetails tournament={viewingTournament} onBack={() => setViewingTournament(null)} />;
    }

    return (
        <div>
            {joinedTournaments.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 p-8 rounded-lg text-center">
                    <h2 className="text-xl font-bold text-white">No Tournaments Joined Yet</h2>
                    <p className="mt-2 text-slate-400">
                        Use the "Join Tournament" menu to enter a ticket code and get started!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {joinedTournaments.map(tournament => (
                        <div key={tournament.id} className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg flex flex-col">
                            {/* UPDATED: Added text-slate-300 for better default text color */}
                            <div className="p-6 flex-grow space-y-4 text-slate-300">
                                <h3 className="text-xl font-bold text-blue-400">{tournament.name}</h3>
                                
                                <div className="text-sm space-y-2">
                                    <p><strong>Status:</strong> <span className={tournament.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{tournament.status}</span></p>
                                    <p><strong>Period:</strong> {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</p>
                                    <p><strong>Participants:</strong> {tournament.participants?.length || 0} users</p>
                                </div>

                                <div className="pt-4 border-t border-slate-700">
                                    {/* UPDATED: Changed the heading text */}
                                    <h4 className="font-semibold text-slate-200 mb-2 text-sm">Prediction Submission Status</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowChampion || false} label="Champion" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowGroupStage || false} label="Group Stage" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowRoundOf32 || false} label="Round of 32" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowRoundOf16 || false} label="Round of 16" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowQuarterFinal || false} label="Quarter-finals" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowSemiFinal || false} label="Semi-finals" />
                                        <PredictionStatusIndicator status={tournament.predictionStatus?.allowFinals || false} label="Finals" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-b-lg flex gap-4">
                                <button 
                                    onClick={() => setViewingTournament(tournament)}
                                    className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm rounded-md transition-colors"
                                >
                                    Check Tournament Details
                                </button>
                                <button 
                                    // onClick={() => onEnterPredictions(tournament.id)}
                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm rounded-md transition-colors"
                                >
                                    Enter Predictions
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyTournaments;
