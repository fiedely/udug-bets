// src/components/admin/CreateTournamentContent.tsx

import { useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { type User } from 'firebase/auth';

interface CreateTournamentContentProps {
    user: User | null;
    onTournamentCreated: (id: string) => void;
}

const CreateTournamentContent = ({ user, onTournamentCreated }: CreateTournamentContentProps) => {
    const [tournamentName, setTournamentName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreateTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tournamentName.trim()) {
            setError('Tournament name is required.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const ticket = Math.floor(100000 + Math.random() * 900000).toString();
            const newTournamentRef = await addDoc(collection(db, 'tournaments'), {
                name: tournamentName,
                status: 'draft',
                creatorId: user?.uid,
                createdAt: serverTimestamp(),
                ticket: ticket,
                allowGuesses: false,
            });
            onTournamentCreated(newTournamentRef.id);
        } catch (err) {
            console.error(err);
            setError('Failed to create tournament.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-blue-400">Create New Tournament</h2>
            <p className="mt-1 text-slate-400 text-sm">Start by giving your tournament a name. You can configure the rest of the details in the next steps.</p>
            <form onSubmit={handleCreateTournament} className="mt-4 space-y-4 max-w-lg">
                <div>
                    <label htmlFor="tourney-name" className="block text-sm font-medium text-slate-300">Tournament Name</label>
                    <input type="text" id="tourney-name" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isLoading ? (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : 'Save and Create'}
                </button>
            </form>
        </div>
    );
};

export default CreateTournamentContent;