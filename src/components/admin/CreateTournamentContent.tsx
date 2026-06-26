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
    const [format, setFormat] = useState<'world_cup' | 'euro' | 'generic'>('generic');
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
                format: format,
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
                    <label className="block text-sm font-medium text-slate-300">Tournament Name</label>
                    <input 
                        type="text"
                        value={tournamentName}
                        onChange={(e) => setTournamentName(e.target.value)}
                        className="mt-1 block w-full rounded-md bg-slate-900 border-slate-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                        placeholder="e.g. World Cup 2026 Predictions"
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Tournament Format</label>
                    <select 
                        value={format}
                        onChange={(e) => setFormat(e.target.value as any)}
                        className="mt-1 block w-full rounded-md bg-slate-900 border-slate-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                        disabled={isLoading}
                    >
                        <option value="generic">Generic (Standard Binary Tree)</option>
                        <option value="world_cup">FIFA World Cup 2026</option>
                        <option value="euro">UEFA Euro 2024</option>
                    </select>
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isLoading ? (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : 'Save and Create'}
                </button>
            </form>
        </div>
    );
};

export default CreateTournamentContent;