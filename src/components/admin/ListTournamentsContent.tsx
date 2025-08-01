// src/components/admin/ListTournamentsContent.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Tournament, UserProfile } from '../../types';

interface ListTournamentsContentProps {
    onEditTournament: (id: string) => void;
    userProfile: UserProfile | null;
}

const ListTournamentsContent = ({ onEditTournament, userProfile }: ListTournamentsContentProps) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);

    const fetchTournaments = async () => {
        setIsLoading(true);
        const querySnapshot = await getDocs(collection(db, "tournaments"));
        const now = new Date();

        const tourneyList: Tournament[] = [];
        const updates: Promise<void>[] = [];

        querySnapshot.docs.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const startDate = data.startDate ? (data.startDate as Timestamp).toDate() : null;
            const endDate = data.endDate ? (data.endDate as Timestamp).toDate() : null;

            const tournament = {
                id: docSnapshot.id,
                ...data,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            } as Tournament;

            let calculatedAllowGuesses = tournament.allowGuesses;
            let needsUpdate = false;

            if ((startDate && now >= startDate) || (endDate && now >= endDate)) {
                 if (tournament.allowGuesses) {
                    calculatedAllowGuesses = false;
                    needsUpdate = true;
                 }
            }

            if (needsUpdate) {
                updates.push(updateDoc(doc(db, "tournaments", docSnapshot.id), { allowGuesses: calculatedAllowGuesses }));
                tournament.allowGuesses = calculatedAllowGuesses;
            }

            tourneyList.push(tournament);
        });

        await Promise.all(updates).catch(err => console.error("Failed to auto-update tournament status:", err));

        setTournaments(tourneyList);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    // FIX: Re-implement the handleDelete function
    const handleDelete = async (tournamentId: string) => {
        if (!tournamentId) return;
        try {
            await deleteDoc(doc(db, "tournaments", tournamentId));
            // Refresh the list by filtering out the deleted tournament
            setTournaments(tournaments.filter(t => t.id !== tournamentId));
        } catch (error) {
            console.error("Error deleting tournament: ", error);
        } finally {
            // Close the modal
            setDeletingTournament(null);
        }
    };

    const handleToggleAllowGuesses = async (tournamentId: string, currentValue: boolean) => {
        const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
        if (!isAdmin) return;

        const newValue = !currentValue;
        try {
            await updateDoc(doc(db, "tournaments", tournamentId), { allowGuesses: newValue });
            setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, allowGuesses: newValue } : t));
        } catch (error) {
            console.error("Error updating allowGuesses:", error);
        }
    };

    if (isLoading) {
       return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';

    return (
        <>
            <div className="bg-slate-800 border border-slate-700 p-8">
                <h2 className="text-2xl font-bold text-blue-400">Your Tournaments</h2>
                <div className="mt-4 space-y-4">
                    {tournaments.map(t => (
                        <div key={t.id} className="bg-slate-900 p-4 border border-slate-700 flex flex-wrap justify-between items-center gap-4 rounded-lg shadow">
                            <div className="flex-grow">
                                <h3 className="font-semibold text-white">{t.name}</h3>
                                <p className="text-sm text-slate-400">
                                    Status: <span className={t.status === 'draft' ? 'text-yellow-400' : (t.status === 'active' ? 'text-green-400' : 'text-gray-400')}>{t.status}</span>
                                </p>
                                <p className="text-sm text-slate-500">Ticket: {t.ticket}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-300">Allow Guesses:</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={t.allowGuesses || false}
                                        onChange={() => handleToggleAllowGuesses(t.id, t.allowGuesses)}
                                        className="sr-only peer"
                                        disabled={!isAdmin || t.status === 'draft'}
                                    />
                                    <div className={`w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-gray-600 peer-checked:bg-blue-600 ${(!isAdmin || t.status === 'draft') ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => onEditTournament(t.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm rounded-md">Edit</button>
                                <button onClick={() => setDeletingTournament(t)} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white text-sm rounded-md">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FIX: Add the delete confirmation modal */}
            {deletingTournament && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                        <p className="mt-2 text-slate-400">
                            Are you sure you want to delete the tournament "{deletingTournament.name}"? This action cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-end gap-4">
                            <button
                                onClick={() => setDeletingTournament(null)}
                                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deletingTournament.id)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white rounded-md"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ListTournamentsContent;
