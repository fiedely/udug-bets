// src/components/admin/wizard/Step1Details.tsx

import { useState, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { PointRules, Tournament } from '../../../types';

interface Step1DetailsProps {
    tournament: Tournament;
    onNext: () => void;
    onBack: () => void;
    setIsDirty: (dirty: boolean) => void;
}

const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
};

const KNOCKOUT_STAGES = ['round32', 'round16', 'quarterFinal', 'semiFinal', 'thirdPlaceMatch', 'final'] as const;
const DEFAULT_POINTS = { correctScore: 3, correctOutcome: 1 };

type PointRuleStage = 'groupStage' | 'round32' | 'round16' | 'quarterFinal' | 'semiFinal' | 'thirdPlaceMatch' | 'final';

const Step1Details = ({ tournament, onNext, onBack, setIsDirty }: Step1DetailsProps) => {
    const [name, setName] = useState(tournament.name);
    const [description, setDescription] = useState(tournament.description || '');

    const initialPointRules: PointRules = tournament.pointRules || {
        groupStage: DEFAULT_POINTS,
        round32: DEFAULT_POINTS,
        round16: DEFAULT_POINTS,
        quarterFinal: DEFAULT_POINTS,
        semiFinal: DEFAULT_POINTS,
        thirdPlaceMatch: DEFAULT_POINTS,
        final: DEFAULT_POINTS,
        championBonus: 10,
    };

    const [pointRules, setPointRules] = useState<PointRules>(initialPointRules);
    const [championBonus, setChampionBonus] = useState(initialPointRules.championBonus || 10);

    const [useSamePoints, setUseSamePoints] = useState(() => {
        if (!initialPointRules) return true;
        const gs = initialPointRules.groupStage;
        return KNOCKOUT_STAGES.every(stage =>
            initialPointRules[stage]?.correctScore === gs.correctScore &&
            initialPointRules[stage]?.correctOutcome === gs.correctOutcome
        );
    });

    const [startDate, setStartDate] = useState(formatDateForInput(tournament.startDate));
    const [endDate, setEndDate] = useState(formatDateForInput(tournament.endDate));
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const markDirty = () => setIsDirty(true);

    const handlePointsChange = useCallback((stage: PointRuleStage, type: 'correctScore' | 'correctOutcome', value: number) => {
        markDirty();
        setPointRules(prev => {
            const newRules = { ...prev };
            newRules[stage] = { ...(prev[stage] || DEFAULT_POINTS), [type]: value };
            
            if (useSamePoints && stage === 'groupStage') {
                KNOCKOUT_STAGES.forEach(koStage => {
                    newRules[koStage] = { ...(newRules[koStage] || DEFAULT_POINTS), [type]: value };
                });
            }
            return newRules;
        });
    }, [useSamePoints]);

    const handleToggleUseSamePoints = (checked: boolean) => {
        markDirty();
        setUseSamePoints(checked);
        if (checked) {
            const gs = pointRules.groupStage;
            setPointRules(prev => {
                const newRules = { ...prev };
                KNOCKOUT_STAGES.forEach(stage => {
                    newRules[stage] = { ...gs };
                });
                return newRules;
            });
        }
    };

    const handleSave = async (continueToNext: boolean) => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);
            const updatedData: Partial<Tournament> = {
                name,
                description,
                pointRules: { ...pointRules, championBonus },
            };

            if (startDate) updatedData.startDate = new Date(startDate);
            if (endDate) updatedData.endDate = new Date(endDate);
            
            await updateDoc(tournamentRef, updatedData as { [x: string]: any });
            setMessage('Progress saved successfully!');
            setIsDirty(false);

            if (continueToNext) {
                onNext();
            }
        } catch (err) {
            console.error(err);
            setMessage('Error saving progress.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const formatStageName = (stage: string) => {
        return stage.replace(/([A-Z])/g, ' $1').replace('Match', ' Match').replace(/^./, str => str.toUpperCase());
    }

    return (
        <>
            <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300 mb-4 flex items-center">
                &larr; Back to List
            </button>
            <form className="mt-4 space-y-6 max-w-2xl" onSubmit={e => e.preventDefault()}>
                <h2 className="text-2xl font-bold text-blue-400">Step 1: Tournament Details</h2>
                <div>
                    <label htmlFor="tourney-name" className="block text-sm font-medium text-slate-300">Tournament Name</label>
                    <input type="text" id="tourney-name" value={name} onChange={e => { setName(e.target.value); markDirty(); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                    <label htmlFor="tourney-desc" className="block text-sm font-medium text-slate-300">Description</label>
                    <textarea id="tourney-desc" value={description} onChange={e => { setDescription(e.target.value); markDirty(); }} rows={5} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    {/* NEW: Added instruction for Markdown support */}
                    <p className="mt-2 text-xs text-slate-400">
                        You can use Markdown for formatting (e.g., `**bold**`, `*italic*`, `[link](url)`).
                    </p>
                </div>

                <div className="space-y-4 p-4 border border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-100">Point Rules</h3>
                    <div>
                        <label htmlFor="champion-bonus" className="block text-sm font-medium text-slate-300">Champion Bonus Points</label>
                        <input type="number" id="champion-bonus" value={championBonus} onChange={e => { setChampionBonus(Number(e.target.value)); markDirty(); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>

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

                    <div className="flex items-center py-2">
                        <input type="checkbox" id="same-points" checked={useSamePoints} onChange={e => handleToggleUseSamePoints(e.target.checked)} className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="same-points" className="ml-2 text-sm text-slate-300">Use same point configuration for knockout stages?</label>
                    </div>

                    <div className="space-y-4 pt-2">
                        {KNOCKOUT_STAGES.map(stage => (
                            <div key={stage} className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-300">{formatStageName(stage)} (Correct Score)</label>
                                    <input
                                        type="number"
                                        value={pointRules[stage]?.correctScore || 0}
                                        onChange={e => handlePointsChange(stage, 'correctScore', Number(e.target.value))}
                                        disabled={useSamePoints}
                                        className={`mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 ${useSamePoints ? 'opacity-50 cursor-not-allowed bg-slate-800' : ''}`}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-300">{formatStageName(stage)} (Win/Lose)</label>
                                    <input
                                        type="number"
                                        value={pointRules[stage]?.correctOutcome || 0}
                                        onChange={e => handlePointsChange(stage, 'correctOutcome', Number(e.target.value))}
                                        disabled={useSamePoints}
                                        className={`mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 ${useSamePoints ? 'opacity-50 cursor-not-allowed bg-slate-800' : ''}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-slate-100">Date Period</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="start-date" className="block text-sm font-medium text-slate-300">Start Date & Time</label>
                            <input type="datetime-local" id="start-date" value={startDate} onChange={e => { setStartDate(e.target.value); markDirty(); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="end-date" className="block text-sm font-medium text-slate-300">End Date & Time</label>
                            <input type="datetime-local" id="end-date" value={endDate} onChange={e => { setEndDate(e.target.value); markDirty(); }} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                    </div>
                </div>

                {message && <p className="text-green-400 text-sm text-center">{message}</p>}

                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                        {isSaving ? 'Saving...' : 'Save Progress'}
                    </button>
                    <button type="button" onClick={() => handleSave(true)} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                        Save & Continue
                    </button>
                </div>
            </form>
        </>
    );
};

export default Step1Details;
