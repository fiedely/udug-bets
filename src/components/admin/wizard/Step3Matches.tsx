// src/components/admin/wizard/Step3Matches.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match, Team } from '../../../types';
import { STADIUMS } from '../../../data/stadiums';

interface Step3MatchesProps {
    tournament: Tournament;
    onNext: () => void;
    onBack: () => void;
    setIsDirty: (dirty: boolean) => void;
}

// Dynamic round-robin generator
const getRoundRobinPairs = (teams: Team[]) => {
    const pairs: { t1: Team; t2: Team }[] = [];
    if (teams.length < 2) return [];

    const scheduleTeams = [...teams];
    if (scheduleTeams.length % 2 !== 0) {
        scheduleTeams.push({ name: 'dummy', code: 'dummy', flag: '' });
    }

    const numTeams = scheduleTeams.length;
    const numRounds = numTeams - 1;
    const half = numTeams / 2;

    for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < half; i++) {
            const team1 = scheduleTeams[i];
            const team2 = scheduleTeams[numTeams - 1 - i];
            
            if (team1.code !== 'dummy' && team2.code !== 'dummy') {
                pairs.push({ t1: team1, t2: team2 });
            }
        }
        const lastTeam = scheduleTeams.pop();
        if (lastTeam) {
            scheduleTeams.splice(1, 0, lastTeam);
        }
    }
    return pairs;
};

const Step3Matches = ({ tournament, onNext, onBack, setIsDirty }: Step3MatchesProps) => {
    const [matches, setMatches] = useState<Match[]>(tournament.matches || []);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [message, setMessage] = useState('');

    const allTeams = useMemo(() => tournament.teams || [], [tournament.teams]);

    const generateMatches = useCallback(() => {
        if (!tournament.groups || matches.length > 0) return;
        
        setIsGenerating(true);
        
        const newMatches: Match[] = [];
        let matchCounter = 0;
        const tournamentStartDate = tournament.startDate || new Date();

        Object.entries(tournament.groups).forEach(([groupName, teams]) => {
            const pairs = getRoundRobinPairs(teams);
            pairs.forEach((pair, index) => {
                const matchDate = new Date(tournamentStartDate);
                matchDate.setDate(matchDate.getDate() + Math.floor(matchCounter / 8)); 
                matchDate.setHours(19 + (matchCounter % 4) * 2);

                newMatches.push({
                    id: `match-group-${groupName.toLowerCase().replace(' ', '')}-${index}`,
                    stage: 'Group Stage',
                    group: groupName,
                    matchNumber: matchCounter + 1,
                    team1: pair.t1,
                    team2: pair.t2,
                    date: matchDate.toISOString(),
                    stadium: STADIUMS[matchCounter % STADIUMS.length],
                });
                matchCounter++;
            });
        });

        setMatches(newMatches);
        setIsDirty(true);
        setIsGenerating(false);
    }, [tournament.groups, tournament.startDate, matches.length, setIsDirty]);

    useEffect(() => {
        generateMatches();
    }, [generateMatches]);

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

    const handleDeleteMatch = (matchId: string) => {
        setMatches(prev => prev.filter(m => m.id !== matchId));
        setIsDirty(true);
    };

    const handleSave = async (continueToNext: boolean) => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);
            await updateDoc(tournamentRef, { matches: matches });
            setMessage('Matches saved successfully!');
            setIsDirty(false);
            if (continueToNext) {
                onNext();
            }
        } catch (err) {
            console.error(err);
            setMessage('Error saving matches.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mt-4 space-y-6">
            <h2 className="text-2xl font-bold text-blue-400">Step 3: Group Stage Matches</h2>
            
            {isGenerating && (
                <div className="flex items-center justify-center p-8 bg-slate-800 border border-slate-700 rounded-lg">
                    <svg className="animate-spin h-6 w-6 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-slate-300">Generating matches...</span>
                </div>
            )}

            {matches.length > 0 && (
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {matches.map(match => (
                        <div key={match.id} className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-sm items-center">
                           <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-slate-400">Match Participants</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <select
                                        value={match.team1.code}
                                        onChange={e => handleMatchChange(match.id, 'team1', e.target.value)}
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md"
                                    >
                                        {allTeams.map((t: Team) => <option key={t.code} value={t.code}>{t.flag} {t.name}</option>)}
                                    </select>
                                    <span className="text-slate-400">vs</span>
                                    <select
                                        value={match.team2.code}
                                        onChange={e => handleMatchChange(match.id, 'team2', e.target.value)}
                                        className="w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md"
                                    >
                                        {allTeams.map((t: Team) => <option key={t.code} value={t.code}>{t.flag} {t.name}</option>)}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{match.group} - Match {match.matchNumber}</p>
                           </div>
                           <div className="md:col-span-2 grid grid-cols-3 gap-4 items-center">
                               <div>
                                    <label className="block text-xs font-medium text-slate-400">Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={new Date(new Date(match.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        onChange={e => handleMatchChange(match.id, 'date', new Date(e.target.value).toISOString())}
                                        className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md"
                                    />
                               </div>
                               <div>
                                    <label className="block text-xs font-medium text-slate-400">Venue</label>
                                   <select
                                        value={match.stadium.name}
                                        onChange={e => handleMatchChange(match.id, 'stadium', STADIUMS.find((s) => s.name === e.target.value))}
                                        className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-md"
                                    >
                                        {STADIUMS.map((s) => <option key={s.name} value={s.name}>{s.name}, {s.city}</option>)}
                                    </select>
                               </div>
                               <div className="text-right">
                                    <button onClick={() => handleDeleteMatch(match.id)} className="px-3 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors">
                                        Delete
                                    </button>
                               </div>
                           </div>
                        </div>
                    ))}
                 </div>
            )}

            {message && <p className="text-green-400 text-sm text-center">{message}</p>}

            <div className="flex gap-4 pt-4 mt-6 border-t border-slate-700">
                <button type="button" onClick={onBack} className="w-1/4 px-4 py-3 bg-slate-700 hover:bg-slate-600 font-semibold text-white transition-colors rounded-md">Back</button>
                <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed rounded-md">Save Progress</button>
                <button type="button" onClick={() => handleSave(true)} disabled={isSaving || matches.length === 0} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors rounded-md">Save & Continue</button>
            </div>
        </div>
    );
};

export default Step3Matches;
