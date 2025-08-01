// src/components/admin/EditTournamentContent.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
// Import Timestamp to handle date types correctly
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { PointRules, Tournament } from '../../types';

interface EditTournamentContentProps {
    tournamentId: string;
    onBackToList: () => void;
}

const EditTournamentContent = ({ tournamentId, onBackToList }: EditTournamentContentProps) => {
    // ... (Keep all the useState definitions)
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [useSamePoints, setUseSamePoints] = useState(true);
    const [pointRules, setPointRules] = useState<PointRules>({
        groupStage: { correctScore: 5, correctOutcome: 2 },
        round16: { correctScore: 5, correctOutcome: 2 },
        quarterFinal: { correctScore: 5, correctOutcome: 2 },
        semiFinal: { correctScore: 5, correctOutcome: 2 },
        final: { correctScore: 5, correctOutcome: 2 },
    });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const fetchTournament = async () => {
            const docRef = doc(db, "tournaments", tournamentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // We explicitly define the Firestore data structure to handle Timestamps safely
                const data = docSnap.data() as Omit<Tournament, 'startDate' | 'endDate'> & { startDate?: Timestamp, endDate?: Timestamp };

                setName(data.name);
                setDescription(data.description || '');
                if (data.pointRules) setPointRules(data.pointRules);

                // Convert Firestore Timestamps to the format required by datetime-local input
                if (data.startDate) setStartDate(new Date(data.startDate.seconds * 1000).toISOString().slice(0, 16));
                if (data.endDate) setEndDate(new Date(data.endDate.seconds * 1000).toISOString().slice(0, 16));
            }
            setIsLoading(false);
        };
        fetchTournament();
    }, [tournamentId]);

    // ... (Keep the 'beforeunload' useEffect and handler functions)

    // Warn user about unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handlePointsChange = (stage: keyof PointRules, type: 'correctScore' | 'correctOutcome', value: number) => {
        setIsDirty(true);
        setPointRules(prev => ({ ...prev, [stage]: { ...prev[stage], [type]: value } }));
    };

    const handleSaveProgress = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournamentId);
            const updatedData: Partial<Tournament> = {
                name,
                description,
                pointRules,
            };

             // Convert string dates back to Date objects for Firestore
            if (startDate) updatedData.startDate = new Date(startDate);
            if (endDate) updatedData.endDate = new Date(endDate);

            await updateDoc(tournamentRef, updatedData);
            setMessage('Progress saved successfully!');
            setIsDirty(false);
        } catch (err) {
            console.error(err);
            setMessage('Error saving progress.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleContinue = async () => {
        await handleSaveProgress();
        alert("Flow would continue to the next step (Structure).");
    };

    if (isLoading) {
        return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    return (
        // The full JSX from the original file remains here
        <div className="bg-slate-800 border border-slate-700 p-8">
            {/* Added a back button for better UX */}
            <button onClick={onBackToList} className="text-sm text-blue-400 hover:text-blue-300 mb-4 flex items-center">
                &larr; Back to List
            </button>

            <h2 className="text-2xl font-bold text-blue-400">Step 1: Tournament Details</h2>
            <form className="mt-4 space-y-4 max-w-2xl">
                {/* Name and Description */}
                <div>
                    <label htmlFor="tourney-name" className="block text-sm font-medium text-slate-300">Tournament Name</label>
                    <input type="text" id="tourney-name" value={name} onChange={e => { setName(e.target.value); setIsDirty(true); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                    <label htmlFor="tourney-desc" className="block text-sm font-medium text-slate-300">Description</label>
                    <textarea id="tourney-desc" value={description} onChange={e => { setDescription(e.target.value); setIsDirty(true); }} rows={3} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <p className="text-xs text-slate-500 mt-1">You can write a greeting, rules, or anything else here for people to read.</p>
                </div>

                {/* Point Rules (Keep the rest of the form as is) */}
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-100">Point Rules</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-300">Group Stage (Correct Score)</label>
                            <input type="number" value={pointRules.groupStage.correctScore} onChange={e => handlePointsChange('groupStage', 'correctScore', Number(e.target.value))} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-300">Group Stage (Win/Lose)</label>
                            <input type="number" value={pointRules.groupStage.correctOutcome} onChange={e => handlePointsChange('groupStage', 'correctOutcome', Number(e.target.value))} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="same-points" checked={useSamePoints} onChange={e => { setUseSamePoints(e.target.checked); setIsDirty(true); }} className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="same-points" className="ml-2 text-sm text-slate-300">Use same point configuration for knockout stages?</label>
                    </div>
                    {!useSamePoints && (
                        <div className="space-y-4 pt-2">
                            {/* Dynamically generate knockout stage point fields */}
                            {(['round16', 'quarterFinal', 'semiFinal', 'final'] as const).map(stage => (
                                <div key={stage} className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-slate-300">{stage.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (Correct Score)</label>
                                        <input type="number" value={pointRules[stage]?.correctScore || 0} onChange={e => handlePointsChange(stage, 'correctScore', Number(e.target.value))} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-slate-300">{stage.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (Win/Lose)</label>
                                        <input type="number" value={pointRules[stage]?.correctOutcome || 0} onChange={e => handlePointsChange(stage, 'correctOutcome', Number(e.target.value))} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Date Period */}
                <div>
                    <h3 className="text-lg font-semibold text-slate-100">Date Period</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="start-date" className="block text-sm font-medium text-slate-300">Start Date & Time</label>
                            <input type="datetime-local" id="start-date" value={startDate} onChange={e => { setStartDate(e.target.value); setIsDirty(true); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="end-date" className="block text-sm font-medium text-slate-300">End Date & Time</label>
                            <input type="datetime-local" id="end-date" value={endDate} onChange={e => { setEndDate(e.target.value); setIsDirty(true); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                    </div>
                </div>

                {message && <p className="text-green-400 text-sm text-center">{message}</p>}

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={handleSaveProgress} disabled={isSaving || !isDirty} className="w-full flex justify-center items-center px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                        {isSaving ? 'Saving...' : 'Save Progress'}
                    </button>
                    <button type="button" onClick={handleContinue} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                        Save & Continue
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditTournamentContent;