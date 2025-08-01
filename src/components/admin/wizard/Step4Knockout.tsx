// src/components/admin/wizard/Step4Knockout.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match, Team, MatchStage } from '../../../types';
import { STADIUMS } from '../../../data/stadiums';

interface Step4KnockoutProps {
    tournament: Tournament;
    onNext: () => void;
    onBack: () => void;
    setIsDirty: (dirty: boolean) => void;
}

const PLACEHOLDER_TEAM_1: Team = { name: 'TBD', code: 'TBD1', flag: '🏳️' };
const PLACEHOLDER_TEAM_2: Team = { name: 'TBD', code: 'TBD2', flag: '🏳️' };

const KNOCKOUT_STAGES: { stage: MatchStage, count: number }[] = [
    { stage: 'Round of 16', count: 8 },
    { stage: 'Quarter-final', count: 4 },
    { stage: 'Semi-final', count: 2 },
    { stage: 'Third Place Match', count: 1 },
    { stage: 'Final', count: 1 },
];

const Step4Knockout = ({ tournament, onNext, onBack, setIsDirty }: Step4KnockoutProps) => {
    const [matches, setMatches] = useState<Match[]>(tournament.knockoutMatches || []);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const allTeams = useMemo(() => [PLACEHOLDER_TEAM_1, PLACEHOLDER_TEAM_2, ...(tournament.teams || [])], [tournament.teams]);

    const generateSkeletalMatches = useCallback(() => {
        if (matches.length > 0) return; // Don't re-generate

        const newMatches: Match[] = [];
        let matchCounter = (tournament.matches?.length || 0) + 1;
        const lastGroupMatchDate = tournament.matches?.reduce((latest, match) => {
            const matchDate = new Date(match.date);
            return matchDate > latest ? matchDate : latest;
        }, new Date(0)) || new Date();

        KNOCKOUT_STAGES.forEach(({ stage, count }) => {
            for (let i = 0; i < count; i++) {
                const matchDate = new Date(lastGroupMatchDate);
                matchDate.setDate(matchDate.getDate() + 3 + Math.floor(matchCounter / 4));
                matchDate.setHours(20 + (matchCounter % 2) * 2);

                newMatches.push({
                    id: `match-${stage.toLowerCase().replace(/ /g, '-')}-${i}`,
                    stage: stage,
                    group: 'Knockout',
                    matchNumber: matchCounter,
                    team1: PLACEHOLDER_TEAM_1,
                    team2: PLACEHOLDER_TEAM_2,
                    date: matchDate.toISOString(),
                    stadium: STADIUMS[matchCounter % STADIUMS.length],
                });
                matchCounter++;
            }
        });
        setMatches(newMatches);
        setIsDirty(true);
    }, [matches.length, tournament.matches, setIsDirty]);

    useEffect(() => {
        generateSkeletalMatches();
    }, [generateSkeletalMatches]);

    const handleMatchChange = (matchId: string, field: keyof Match, value: any) => {
        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                if (field === 'team1' || field === 'team2') {
                    const selectedTeam = allTeams.find((t: Team) => t.code === value);
                    return { ...m, [field]: selectedTeam || value };
                }
                return { ...m, [field]: value };
            }
            return m;
        }));
        setIsDirty(true);
    };

    const handleSave = async (continueToNext: boolean) => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);
            await updateDoc(tournamentRef, { knockoutMatches: matches });
            setMessage('Knockout matches saved successfully!');
            setIsDirty(false);
            if (continueToNext) {
                onNext();
            }
        } catch (err) {
            console.error(err);
            setMessage('Error saving knockout matches.');
        } finally {
            setIsSaving(false);
        }
    };

    const matchesByStage = useMemo(() => {
        return matches.reduce((acc, match) => {
            const stage = match.stage;
            if (!acc[stage]) {
                acc[stage] = [];
            }
            acc[stage].push(match);
            return acc;
        }, {} as Record<MatchStage, Match[]>);
    }, [matches]);

    return (
        <div className="mt-4 space-y-6">
            <h2 className="text-2xl font-bold text-blue-400">Step 4: Knockout Round Matches</h2>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {KNOCKOUT_STAGES.map(({ stage }) => (
                    matchesByStage[stage] && (
                        <div key={stage}>
                            <h3 className="text-lg font-semibold text-blue-300 mb-2 p-2 bg-slate-700/50 rounded-t-md">{stage}</h3>
                            <div className="space-y-2">
                                {matchesByStage[stage].map(match => (
                                    <div key={match.id} className="p-3 bg-slate-900/50 border border-slate-700 rounded-b-md grid grid-cols-1 md:grid-cols-3 gap-4 text-sm items-center">
                                       <div className="md:col-span-1">
                                            <label className="block text-xs font-medium text-slate-400">Match Participants</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <select value={match.team1.code} onChange={e => handleMatchChange(match.id, 'team1', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md">
                                                    {allTeams.map(t => <option key={t.code} value={t.code}>{t.flag} {t.name}</option>)}
                                                </select>
                                                <span className="text-slate-400">vs</span>
                                                <select value={match.team2.code} onChange={e => handleMatchChange(match.id, 'team2', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md">
                                                    {allTeams.map(t => <option key={t.code} value={t.code}>{t.flag} {t.name}</option>)}
                                                </select>
                                            </div>
                                       </div>
                                       <div className="md:col-span-2 grid grid-cols-2 gap-4 items-center">
                                           <div>
                                                <label className="block text-xs font-medium text-slate-400">Date & Time</label>
                                                <input type="datetime-local" value={new Date(new Date(match.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => handleMatchChange(match.id, 'date', new Date(e.target.value).toISOString())} className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md" />
                                           </div>
                                           <div>
                                                <label className="block text-xs font-medium text-slate-400">Venue</label>
                                               <select value={match.stadium.name} onChange={e => handleMatchChange(match.id, 'stadium', STADIUMS.find(s => s.name === e.target.value))} className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md">
                                                    {STADIUMS.map(s => <option key={s.name} value={s.name}>{s.name}, {s.city}</option>)}
                                                </select>
                                           </div>
                                       </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>

            {message && <p className="text-green-400 text-sm text-center">{message}</p>}

            <div className="flex gap-4 pt-4 mt-6 border-t border-slate-700">
                <button type="button" onClick={onBack} className="w-1/4 px-4 py-3 bg-slate-700 hover:bg-slate-600 font-semibold text-white rounded-md">Back</button>
                <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed rounded-md">Save Progress</button>
                <button type="button" onClick={() => handleSave(true)} disabled={isSaving} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors rounded-md">Save & Continue</button>
            </div>
        </div>
    );
};

export default Step4Knockout;
