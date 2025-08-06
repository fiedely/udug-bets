// src/components/views/JoinTournament.tsx

import React, { useState } from 'react';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Tournament, UserProfile, View } from '../../types';
import cramorantImage from '../../assets/delz-cramorant.png'; // 1. Import the image

interface JoinTournamentProps {
    userProfile: UserProfile | null;
    setView: (view: View) => void;
}

const JoinTournament = ({ userProfile, setView }: JoinTournamentProps) => {
    const [ticket, setTicket] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<React.ReactNode | null>(null);

    if (userProfile?.role === 'admin' || userProfile?.role === 'superadmin') {
        return (
            <div className="bg-slate-800 border border-slate-700 p-8 max-w-lg mx-auto text-center">
                <h2 className="text-xl font-bold text-blue-400 mb-4">Admins Cannot Join Tournaments</h2>
                <p className="text-slate-300 mb-6">
                    But don't be sad, here is a picture of Cramorant to cheer you up!
                </p>
                {/* 2. Use the imported image variable */}
                <img 
                    src={cramorantImage} 
                    alt="A cheerful Cramorant" 
                    className="mx-auto w-48 h-48 object-contain"
                />
            </div>
        );
    }

    const handleJoinTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(null);

        if (!/^\d{6}$/.test(ticket)) {
            setError('Please enter a valid 6-digit ticket code.');
            return;
        }

        setIsLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser || !userProfile) {
            setError('You must be logged in to join a tournament.');
            setIsLoading(false);
            return;
        }

        try {
            const tournamentsRef = collection(db, 'tournaments');
            const q = query(tournamentsRef, where('ticket', '==', ticket));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError('Invalid ticket code. No tournament found.');
                setIsLoading(false);
                return;
            }

            const tournamentDoc = querySnapshot.docs[0];
            const tournamentData = tournamentDoc.data() as Tournament;

            if (tournamentData.status !== 'active') {
                setError(`This tournament, "${tournamentData.name}", is not active and cannot be joined.`);
                setIsLoading(false);
                return;
            }

            if (tournamentData.participants?.includes(currentUser.uid)) {
                setSuccess(
                    <div>
                        <div>You have already joined "{tournamentData.name}"!</div>
                        <div>
                            Check {' '}
                            <button onClick={() => setView('My Tournaments')} className="font-semibold text-blue-400 underline hover:text-blue-300">
                                My Tournaments
                            </button>
                            .
                        </div>
                    </div>
                );
                setIsLoading(false);
                return;
            }

            const tournamentRef = doc(db, 'tournaments', tournamentDoc.id);
            await updateDoc(tournamentRef, {
                participants: arrayUnion(currentUser.uid)
            });

            setSuccess(
                <div>
                    <div>Successfully joined {tournamentData.name}!</div>
                    <div>
                        Check the My Tournaments menu to see the {' '}
                        <button onClick={() => setView('My Tournaments')} className="font-semibold text-blue-400 underline hover:text-blue-300">
                            {tournamentData.name}
                        </button>
                        {' '} tournament.
                    </div>
                </div>
            );
            setTicket('');

        } catch (err) {
            console.error(err);
            setError('An error occurred while trying to join the tournament. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-8 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-blue-400 mb-1">Join a Tournament</h2>
            <p className="text-slate-400 text-sm mb-6">Enter the 6-digit ticket code you received from the tournament administrator.</p>
            
            <form onSubmit={handleJoinTournament} className="space-y-4">
                <div>
                    <label htmlFor="ticket-code" className="block text-sm font-medium text-slate-300">Ticket Code</label>
                    <input 
                        type="text" 
                        id="ticket-code" 
                        value={ticket}
                        onChange={(e) => setTicket(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="e.g., 777777"
                        className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 text-center text-2xl tracking-[.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" 
                    />
                </div>

                {error && <p className="text-red-400 text-sm text-center pt-1">{error}</p>}
                {success && <div className="text-green-400 text-sm text-center pt-1 leading-relaxed">{success}</div>}

                <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : 'Join Tournament'}
                </button>
            </form>
        </div>
    );
};

export default JoinTournament;
