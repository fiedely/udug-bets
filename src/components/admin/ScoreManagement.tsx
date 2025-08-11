// src/components/admin/ScoreManagement.tsx

import { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match, Team, MatchStage } from '../../types';

interface ScoreManagementProps {
    tournament: Tournament;
    onBack: () => void;
    reportDirtyState: (isDirty: boolean) => void;
}

const STAGE_ORDER: MatchStage[] = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place Match', 'Final'];

const OutcomeBadge = ({ outcome }: { outcome: 'WIN' | 'LOSE' | 'DRAW' | null }) => {
    if (!outcome) return null;
    const baseClasses = "text-xs font-bold px-2 py-0.5";
    switch (outcome) {
        case 'WIN': return <span className={`${baseClasses} bg-green-500 text-white`}>WIN</span>;
        case 'LOSE': return <span className={`${baseClasses} bg-red-500 text-white`}>LOSE</span>;
        case 'DRAW': return <span className={`${baseClasses} bg-slate-600 text-white`}>DRAW</span>;
        default: return null;
    }
};

const ScoreManagement = ({ tournament, onBack, reportDirtyState }: ScoreManagementProps) => {
    const [matches, setMatches] = useState<Match[]>(() => JSON.parse(JSON.stringify(tournament.matches || [])));
    const [knockoutMatches, setKnockoutMatches] = useState<Match[]>(() => JSON.parse(JSON.stringify(tournament.knockoutMatches || [])));
    const [champion, setChampion] = useState(tournament.champion || '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>(() => {
        try {
            const savedState = localStorage.getItem(`udug-bets-admin-collapsed-${tournament.id}`);
            return savedState ? JSON.parse(savedState) : {};
        } catch (error) { return {}; }
    });

    useEffect(() => {
        reportDirtyState(isDirty);
    }, [isDirty, reportDirtyState]);

    const allTeams = useMemo(() => tournament.teams || [], [tournament.teams]);
    const placeholderTeam: Team = { name: 'TBD', code: 'TBD', flag: '🏳️' };
    const selectableTeams = useMemo(() => [placeholderTeam, ...allTeams.sort((a,b) => a.name.localeCompare(b.name))], [allTeams]);

    const handleScoreChange = (matchId: string, isKnockout: boolean, team: 'team1Score' | 'team2Score', value: string) => {
        setIsDirty(true);
        const score = value === '' ? null : parseInt(value, 10);
        const updater = isKnockout ? setKnockoutMatches : setMatches;
        updater(prev => prev.map(m => m.id === matchId ? { ...m, [team]: score } : m));
    };

    const handleTeamChange = (matchId: string, teamNum: 'team1' | 'team2', teamCode: string) => {
        setIsDirty(true);
        const selectedTeam = selectableTeams.find(t => t.code === teamCode) || placeholderTeam;
        setKnockoutMatches(prev => prev.map(m => m.id === matchId ? { ...m, [teamNum]: selectedTeam } : m));
    };
    
    const handleWinnerChange = (matchId: string, isKnockout: boolean, winnerCode: string) => {
        setIsDirty(true);
        const updater = isKnockout ? setKnockoutMatches : setMatches;
        updater(prev => prev.map(m => m.id === matchId ? { ...m, winnerTeamCode: winnerCode } : m));
    };

    const handleChampionChange = (teamCode: string) => {
        setIsDirty(true);
        setChampion(teamCode);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);

            const sanitizeMatches = (matchArray: Match[]) => {
                return matchArray.map(m => {
                    const matchCopy: Partial<Match> & { id: string } = { ...m };
                    if (matchCopy.team1Score === null || matchCopy.team1Score === undefined) {
                        delete matchCopy.team1Score;
                    }
                    if (matchCopy.team2Score === null || matchCopy.team2Score === undefined) {
                        delete matchCopy.team2Score;
                    }
                    return matchCopy;
                });
            };
            
            await updateDoc(tournamentRef, {
                matches: sanitizeMatches(matches),
                knockoutMatches: sanitizeMatches(knockoutMatches),
                champion: champion
            });

            setIsDirty(false);
            setMessage('Scores and seeding saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving results:", error);
            setMessage('Failed to save results. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const allMatchesCombined = useMemo(() => [...matches, ...knockoutMatches], [matches, knockoutMatches]);

    const matchesByStageAndDate = useMemo(() => {
        return allMatchesCombined.reduce((acc, match) => {
            const stage = match.stage;
            const date = new Date(match.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[stage]) acc[stage] = {};
            if (!acc[stage][date]) acc[stage][date] = [];
            acc[stage][date].push(match);
            return acc;
        }, {} as Record<MatchStage, Record<string, Match[]>>);
    }, [allMatchesCombined]);

    const sortedStageKeys = useMemo(() => {
        return Object.keys(matchesByStageAndDate).sort((a, b) => STAGE_ORDER.indexOf(a as MatchStage) - STAGE_ORDER.indexOf(b as MatchStage));
    }, [matchesByStageAndDate]);
    
    const toggleStageCollapse = (stage: string) => {
        const newCollapsedState = { ...collapsedStages, [stage]: !collapsedStages[stage] };
        setCollapsedStages(newCollapsedState);
        localStorage.setItem(`udug-bets-admin-collapsed-${tournament.id}`, JSON.stringify(newCollapsedState));
    };
    
    const SelectOption = ({ team }: { team: Team }) => (
        <option value={team.code}>
            {team.flag} {team.name}
        </option>
    );

    return (
        <div className="bg-slate-800 border border-slate-700 p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-start mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">{tournament.name}</h2>
                    <p className="text-blue-400">Manage Scores & Knockout Seeding</p>
                </div>
                <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300 flex items-center whitespace-nowrap self-start md:self-auto">
                    &larr; Back to Tournaments List
                </button>
            </div>

            <div className="space-y-8">
                <div className="bg-slate-900/50 p-4 border border-slate-700">
                    <label htmlFor="champion-select" className="block text-lg font-semibold text-slate-100 mb-2">🏆 Official Tournament Champion</label>
                    <select id="champion-select" value={champion} onChange={e => handleChampionChange(e.target.value)} className="w-full md:w-1/2 px-4 py-2 bg-slate-800 border border-slate-600 text-slate-100">
                        <option value="">-- Select a Champion --</option>
                        {allTeams.map(team => (
                            <option key={team.code} value={team.code}>{team.flag} {team.name}</option>
                        ))}
                    </select>
                </div>

                {sortedStageKeys.map(stage => (
                    <div key={stage}>
                        <button onClick={() => toggleStageCollapse(stage)} className="w-full flex justify-between items-center text-xl font-semibold text-blue-300 mb-3 p-2 bg-slate-700/50 hover:bg-slate-700">
                            <span>{stage}</span>
                            <svg className={`w-5 h-5 transition-transform ${collapsedStages[stage] ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        {!collapsedStages[stage] && (
                            <div className="space-y-3">
                                {Object.keys(matchesByStageAndDate[stage as MatchStage]).map(date => (
                                    <div key={date}>
                                        <h4 className="font-semibold text-slate-300 text-sm mb-2 pl-2">{date}</h4>
                                        <div className="space-y-2 pl-4 border-l-2 border-slate-700">
                                            {matchesByStageAndDate[stage as MatchStage][date].map(match => {
                                                const isKnockout = match.stage !== 'Group Stage';
                                                const isDraw = typeof match.team1Score === 'number' && match.team1Score === match.team2Score;
                                                let team1Outcome: 'WIN' | 'LOSE' | 'DRAW' | null = null;
                                                let team2Outcome: 'WIN' | 'LOSE' | 'DRAW' | null = null;
                                                if (match.team1Score !== undefined && match.team1Score !== null && match.team2Score !== undefined && match.team2Score !== null) {
                                                    if (match.team1Score > match.team2Score) { team1Outcome = 'WIN'; team2Outcome = 'LOSE'; }
                                                    else if (match.team2Score > match.team1Score) { team1Outcome = 'LOSE'; team2Outcome = 'WIN'; }
                                                    else { team1Outcome = 'DRAW'; team2Outcome = 'DRAW'; }
                                                }

                                                return (
                                                    <div key={match.id} className="p-3 bg-slate-900/50 space-y-2">
                                                        <div className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-12 gap-2 items-center text-sm">
                                                            <div className="flex items-center justify-end gap-2 md:col-span-5">
                                                                <OutcomeBadge outcome={team1Outcome} />
                                                                <select value={match.team1.code} onChange={e => handleTeamChange(match.id, 'team1', e.target.value)} disabled={!isKnockout} className="w-full bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                    {isKnockout ? selectableTeams.map(t => <SelectOption key={`t1-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team1} />}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center justify-center gap-1 md:col-span-2">
                                                                <input type="number" min="0" value={match.team1Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team1Score', e.target.value)} className="w-10 text-center bg-slate-800 border border-slate-600 text-white font-bold" />
                                                                <span className="text-slate-500">-</span>
                                                                <input type="number" min="0" value={match.team2Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team2Score', e.target.value)} className="w-10 text-center bg-slate-800 border border-slate-600 text-white font-bold" />
                                                            </div>
                                                            <div className="flex items-center gap-2 md:col-span-5">
                                                                <select value={match.team2.code} onChange={e => handleTeamChange(match.id, 'team2', e.target.value)} disabled={!isKnockout} className="w-full bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                     {isKnockout ? selectableTeams.map(t => <SelectOption key={`t2-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team2} />}
                                                                </select>
                                                                <OutcomeBadge outcome={team2Outcome} />
                                                            </div>
                                                        </div>
                                                        <div className="text-center text-xs text-slate-500 flex flex-wrap justify-center items-center gap-x-2">
                                                            <span>{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span className="text-slate-600 hidden sm:inline">•</span>
                                                            <span className="w-full sm:w-auto text-center">{match.stadium.name}, {match.stadium.city}</span>
                                                            <span className="text-slate-600 hidden sm:inline">•</span>
                                                            <span>Match #{match.matchNumber}</span>
                                                        </div>
                                                        {isKnockout && isDraw && (
                                                            <div className="pt-2 mt-2 border-t border-slate-700 text-center">
                                                                <span className="text-xs font-bold text-yellow-400">TIE-BREAKER: DECLARE WINNER</span>
                                                                <div className="flex justify-center gap-4 mt-1 text-sm">
                                                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                                                        <input
                                                                            type="radio"
                                                                            name={`winner-${match.id}`}
                                                                            checked={match.winnerTeamCode === match.team1.code}
                                                                            onChange={() => handleWinnerChange(match.id, isKnockout, match.team1.code)}
                                                                            className="appearance-none h-4 w-4 bg-slate-800 border border-slate-500 checked:bg-blue-600 checked:border-blue-500"
                                                                        />
                                                                        {match.team1.name} won
                                                                    </label>
                                                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                                                        <input
                                                                            type="radio"
                                                                            name={`winner-${match.id}`}
                                                                            checked={match.winnerTeamCode === match.team2.code}
                                                                            onChange={() => handleWinnerChange(match.id, isKnockout, match.team2.code)}
                                                                            className="appearance-none h-4 w-4 bg-slate-800 border border-slate-500 checked:bg-blue-600 checked:border-blue-500"
                                                                        />
                                                                        {match.team2.name} won
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end items-center gap-4">
                {message && <p className="text-green-400 text-sm">{message}</p>}
                <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isSaving ? 'Saving...' : 'Save Results & Seeding'}
                </button>
            </div>
        </div>
    );
};

export default ScoreManagement;
