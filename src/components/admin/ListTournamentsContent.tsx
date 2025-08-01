// src/components/admin/ListTournamentsContent.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import type { Tournament } from '../../types';

interface ListTournamentsContentProps {
    onEditTournament: (id: string) => void;
}

const ListTournamentsContent = ({ onEditTournament }: ListTournamentsContentProps) => {
    // ... (The rest of the component logic remains the same)
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);

    const fetchTournaments = async () => {
        setIsLoading(true);
        const querySnapshot = await getDocs(collection(db, "tournaments"));
        // Note: The dates here will be Firestore Timestamps, but that's okay for this list view.
        const tourneyList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
        setTournaments(tourneyList);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const handleDelete = async () => {
        if (!deletingTournament) return;

        await deleteDoc(doc(db, "tournaments", deletingTournament.id));
        setDeletingTournament(null);
        fetchTournaments();
    };

    if (isLoading) {
        return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    return (
        <>
            <div className="bg-slate-800 border border-slate-700 p-8">
                <h2 className="text-2xl font-bold text-blue-400">Your Tournaments</h2>
                <div className="mt-4 space-y-4">
                    {tournaments.map(t => (
                        <div key={t.id} className="bg-slate-900 p-4 border border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-white">{t.name}</h3>
                                <p className="text-sm text-slate-400">Status: <span className={t.status === 'draft' ? 'text-yellow-400' : 'text-green-400'}>{t.status}</span></p>
                                <p className="text-sm text-slate-500">Ticket: {t.ticket}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => onEditTournament(t.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm">Edit</button>
                                <button onClick={() => setDeletingTournament(t)} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white text-sm">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {deletingTournament && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 p-8 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                        <p className="text-slate-400 mt-2">Are you sure you want to delete the tournament "{deletingTournament.name}"? This action cannot be undone.</p>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setDeletingTournament(null)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white">Cancel</button>
                            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white">Confirm Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ListTournamentsContent;