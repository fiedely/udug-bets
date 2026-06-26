// src/components/admin/ScoreManagement.tsx

import { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match, Team, MatchStage, UserProfile } from '../../types';
import { logAudit } from '../../utils/auditLogger';

interface ScoreManagementProps {
    tournament: Tournament;
    userProfile: UserProfile;
    onBack: () => void;
    reportDirtyState: (isDirty: boolean) => void;
}

const STAGE_ORDER: MatchStage[] = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place Match', 'Final'];

const OutcomeBadge = ({ outcome }: { outcome: 'WIN' | 'LOSE' | 'DRAW' | null }) => {
    if (!outcome) return null;
    const baseClasses = "text-xs font-bold py-0.5 w-12 flex items-center justify-center";
    switch (outcome) {
        case 'WIN': return <span className={`${baseClasses} bg-green-500 text-white`}>WIN</span>;
        case 'LOSE': return <span className={`${baseClasses} bg-red-500 text-white`}>LOSE</span>;
        case 'DRAW': return <span className={`${baseClasses} bg-slate-600 text-white`}>DRAW</span>;
        default: return <span className={`${baseClasses} bg-transparent`}></span>;
    }
};

const ScoreManagement = ({ tournament, userProfile, onBack, reportDirtyState }: ScoreManagementProps) => {
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

    const handleTiebreakerTypeChange = (matchId: string, type: 'Extra Time' | 'Penalty Shootout' | '') => {
        setIsDirty(true);
        setKnockoutMatches(prev => prev.map(m => m.id === matchId ? { ...m, tiebreakerType: type === '' ? undefined : type } : m));
    };

    const handleTiebreakerScoreChange = (matchId: string, team: 'team1TiebreakerScore' | 'team2TiebreakerScore', value: string) => {
        setIsDirty(true);
        const score = value === '' ? null : parseInt(value, 10);
        setKnockoutMatches(prev => prev.map(m => {
            if (m.id !== matchId) return m;
            const newMatch = { ...m, [team]: score };
            
            // Auto-calculate winner if both scores are set and not equal
            const t1Score = newMatch.team1TiebreakerScore;
            const t2Score = newMatch.team2TiebreakerScore;
            
            if (typeof t1Score === 'number' && typeof t2Score === 'number' && t1Score !== t2Score) {
                newMatch.winnerTeamCode = t1Score > t2Score ? newMatch.team1.code : newMatch.team2.code;
            }
            return newMatch;
        }));
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

            await logAudit(userProfile, 'INPUT_SCORE', `Updated scores/seeding for tournament: ${tournament.name}`, { tournamentId: tournament.id });

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
    
    const allMatchesCombined = useMemo(() => [...matches, ...knockoutMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [matches, knockoutMatches]);

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

    useEffect(() => {
        const firstEmptyMatch = allMatchesCombined.find(m => m.team1Score === undefined || m.team2Score === undefined || m.team1Score === null || m.team2Score === null);
        if (firstEmptyMatch) {
            setTimeout(() => {
                const el = document.getElementById(`match-${firstEmptyMatch.id}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Optionally highlight it
                    el.classList.add('ring-2', 'ring-blue-500');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000);
                }
            }, 300);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournament.id]);

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
        <div id="score-management-top" className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto w-full relative">
            <div id="score-management-top-anchor" className="absolute top-0 left-0"></div>
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage: {tournament.name}</h2>
                        <p className="text-sm text-slate-400">Input Actual Scores: {tournament.name}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6 max-w-6xl mx-auto w-full">

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
                                                    <div key={match.id} id={`match-${match.id}`} className="p-3 bg-slate-900/50 space-y-3 transition-shadow duration-500">
                                                        <div className="hidden sm:flex flex-row items-center justify-between gap-3 text-sm">
                                                            <div className="flex-1 text-right">
                                                                <select value={match.team1.code} onChange={e => handleTeamChange(match.id, 'team1', e.target.value)} disabled={!isKnockout} className="w-full bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                    {isKnockout ? selectableTeams.map(t => <SelectOption key={`t1-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team1} />}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <OutcomeBadge outcome={team1Outcome} />
                                                                <input type="number" min="0" value={match.team1Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team1Score', e.target.value)} className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" />
                                                                <span className="text-slate-500 font-bold text-lg">-</span>
                                                                <input type="number" min="0" value={match.team2Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team2Score', e.target.value)} className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" />
                                                                <OutcomeBadge outcome={team2Outcome} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <select value={match.team2.code} onChange={e => handleTeamChange(match.id, 'team2', e.target.value)} disabled={!isKnockout} className="w-full bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                     {isKnockout ? selectableTeams.map(t => <SelectOption key={`t2-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team2} />}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="sm:hidden space-y-2 text-sm">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <select value={match.team1.code} onChange={e => handleTeamChange(match.id, 'team1', e.target.value)} disabled={!isKnockout} className="flex-1 min-w-0 bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                    {isKnockout ? selectableTeams.map(t => <SelectOption key={`t1-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team1} />}
                                                                </select>
                                                                <div className="flex items-center gap-2">
                                                                    <OutcomeBadge outcome={team1Outcome} />
                                                                    <input type="number" min="0" value={match.team1Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team1Score', e.target.value)} className="w-16 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <select value={match.team2.code} onChange={e => handleTeamChange(match.id, 'team2', e.target.value)} disabled={!isKnockout} className="flex-1 min-w-0 bg-slate-800 border border-slate-600 text-white p-1 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                                                                     {isKnockout ? selectableTeams.map(t => <SelectOption key={`t2-${match.id}-${t.code}`} team={t} />) : <SelectOption team={match.team2} />}
                                                                </select>
                                                                <div className="flex items-center gap-2">
                                                                    <OutcomeBadge outcome={team2Outcome} />
                                                                    <input type="number" min="0" value={match.team2Score ?? ''} onChange={e => handleScoreChange(match.id, isKnockout, 'team2Score', e.target.value)} className="w-16 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" />
                                                                </div>
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
                                                                <span className="text-xs font-bold text-yellow-400">TIE-BREAKER DETAILS</span>
                                                                
                                                                <div className="flex flex-col items-center gap-3 mt-3 text-sm">
                                                                    <select 
                                                                        value={match.tiebreakerType || ''} 
                                                                        onChange={e => handleTiebreakerTypeChange(match.id, e.target.value as any)}
                                                                        className="bg-slate-800 border border-slate-600 text-white p-1 text-xs w-48 text-center"
                                                                    >
                                                                        <option value="">-- Select Tiebreaker --</option>
                                                                        <option value="Extra Time">Extra Time</option>
                                                                        <option value="Penalty Shootout">Penalty Shootout</option>
                                                                    </select>
                                                                    
                                                                    {match.tiebreakerType && (
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className="text-slate-300 text-xs w-16 text-right truncate">{match.team1.code}</span>
                                                                            <input 
                                                                                type="number" min="0" 
                                                                                value={match.team1TiebreakerScore ?? ''} 
                                                                                onChange={e => handleTiebreakerScoreChange(match.id, 'team1TiebreakerScore', e.target.value)} 
                                                                                className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" 
                                                                                placeholder="0"
                                                                            />
                                                                            <span className="text-slate-500 font-bold text-lg">-</span>
                                                                            <input 
                                                                                type="number" min="0" 
                                                                                value={match.team2TiebreakerScore ?? ''} 
                                                                                onChange={e => handleTiebreakerScoreChange(match.id, 'team2TiebreakerScore', e.target.value)} 
                                                                                className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1" 
                                                                                placeholder="0"
                                                                            />
                                                                            <span className="text-slate-300 text-xs w-16 text-left truncate">{match.team2.code}</span>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {match.tiebreakerType && (
                                                                        <div className="mt-2 text-xs text-slate-400">
                                                                            Winner:
                                                                            <div className="flex justify-center gap-4 mt-1">
                                                                                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`winner-${match.id}`}
                                                                                        checked={match.winnerTeamCode === match.team1.code}
                                                                                        onChange={() => handleWinnerChange(match.id, isKnockout, match.team1.code)}
                                                                                        className="appearance-none h-4 w-4 bg-slate-800 border border-slate-500 checked:bg-blue-600 checked:border-blue-500"
                                                                                    />
                                                                                    {match.team1.name}
                                                                                </label>
                                                                                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                                                                    <input
                                                                                        type="radio"
                                                                                        name={`winner-${match.id}`}
                                                                                        checked={match.winnerTeamCode === match.team2.code}
                                                                                        onChange={() => handleWinnerChange(match.id, isKnockout, match.team2.code)}
                                                                                        className="appearance-none h-4 w-4 bg-slate-800 border border-slate-500 checked:bg-blue-600 checked:border-blue-500"
                                                                                    />
                                                                                    {match.team2.name}
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    )}
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
            
            <div id="score-management-bottom" className="mt-8 pt-6 border-t border-slate-700 flex justify-end items-center gap-4">
                {message && <p className="text-green-400 text-sm">{message}</p>}
                <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isSaving ? 'Saving...' : 'Save Results & Seeding'}
                </button>
            </div>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
                <button 
                    onClick={() => document.getElementById('score-management-top-anchor')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-12 h-12 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-full flex items-center justify-center shadow-lg text-slate-300 hover:text-white transition-colors"
                    title="Scroll to Top"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                </button>
                <button 
                    onClick={() => document.getElementById('score-management-bottom')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-12 h-12 bg-blue-600 hover:bg-blue-500 border border-blue-400 rounded-full flex items-center justify-center shadow-lg text-white transition-colors"
                    title="Scroll to Save"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </button>
            </div>
        </div>
        </div>
    );
};

export default ScoreManagement;
