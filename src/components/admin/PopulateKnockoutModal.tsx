import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match } from '../../types';
import { STAGE_MATCH_NUMBERS, getNextMatchId } from '../../utils/bracketRouting';

interface PopulateKnockoutModalProps {
    tournament: Tournament;
    onClose: () => void;
}

const STAGE_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];

const PopulateKnockoutModal: React.FC<PopulateKnockoutModalProps> = ({ tournament, onClose }) => {
    const [matches, setMatches] = useState<Match[]>(() => {
        if (tournament.knockoutMatches && tournament.knockoutMatches.length > 0) {
            const currentFormat = tournament.format || 'generic';
            return tournament.knockoutMatches.map(m => ({
                ...m,
                nextMatchId: m.nextMatchId || getNextMatchId(m.matchNumber, currentFormat)
            }));
        }

        // Generate skeleton matches based on tournament.knockoutStartStage
        const startStage = tournament.knockoutStartStage || 'Round of 16';
        const startIndex = STAGE_ORDER.indexOf(startStage);
        if (startIndex === -1) return [];

        const format = tournament.format || 'generic';
        const newMatches: Match[] = [];
        let genericNum = 101; 
        let matchCount = Math.pow(2, STAGE_ORDER.length - 1 - startIndex);
        
        for (let i = startIndex; i < STAGE_ORDER.length; i++) {
            const stage = STAGE_ORDER[i];
            const specificNumbers = format !== 'generic' ? STAGE_MATCH_NUMBERS[format][stage] : null;

            for (let j = 0; j < matchCount; j++) {
                const matchNumber = specificNumbers ? specificNumbers[j] : genericNum++;
                const nextMatchId = getNextMatchId(matchNumber, format);

                newMatches.push({
                    id: `skel-${stage}-${j}`,
                    stage: stage as any,
                    matchNumber,
                    nextMatchId,
                    team1: { name: 'TBD', code: 'TBD', flag: '🏳️' },
                    team2: { name: 'TBD', code: 'TBD', flag: '🏳️' },
                    date: new Date().toISOString(),
                    stadium: { name: 'TBD', city: 'TBD' }
                });
            }
            matchCount /= 2;
        }
        
        if (tournament.hasThirdPlaceMatch) {
            const thirdPlaceNums = format !== 'generic' ? STAGE_MATCH_NUMBERS[format]['Third Place Match'] : null;
            newMatches.push({
                id: `skel-Third-Place-1`,
                stage: 'Third Place Match',
                matchNumber: thirdPlaceNums ? thirdPlaceNums[0] : genericNum++,
                team1: { name: 'TBD', code: 'TBD', flag: '🏳️' },
                team2: { name: 'TBD', code: 'TBD', flag: '🏳️' },
                date: new Date().toISOString(),
                stadium: { name: 'TBD', city: 'TBD' }
            });
        }
        
        return newMatches;
    });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const teams = tournament.teams || [];
    const thirdPlaceMatch = tournament.hasThirdPlaceMatch ? matches.find(m => m.stage === 'Third Place Match') : null;

    // Group and sort matches
    const groupedMatches: Record<string, Match[]> = {};
    const format = tournament.format || 'generic';

    if (format === 'generic') {
        // Fallback: sort sequentially
        STAGE_ORDER.forEach(stage => {
            groupedMatches[stage] = matches
                .filter(m => m.stage === stage)
                .sort((a, b) => a.matchNumber - b.matchNumber);
        });
    } else {
        // Recursive bracket sort
        // 1. Final
        groupedMatches['Final'] = matches.filter(m => m.stage === 'Final').sort((a, b) => a.matchNumber - b.matchNumber);
        
        // 2. Build backwards
        for (let i = STAGE_ORDER.length - 2; i >= 0; i--) {
            const stage = STAGE_ORDER[i];
            const nextStageMatches = groupedMatches[STAGE_ORDER[i + 1]] || [];
            const stageMatches = matches.filter(m => m.stage === stage);
            
            const sortedStageMatches: Match[] = [];
            // For each match in the NEXT stage, find the two matches from THIS stage that feed into it
            nextStageMatches.forEach(nextMatch => {
                const feedsIntoNext = stageMatches.filter(m => m.nextMatchId === nextMatch.matchNumber.toString());
                // Sort them numerically so the top bracket stays on top
                feedsIntoNext.sort((a, b) => a.matchNumber - b.matchNumber);
                sortedStageMatches.push(...feedsIntoNext);
            });
            
            // If any were missed (e.g., partial bracket), just append them
            const missed = stageMatches.filter(m => !sortedStageMatches.includes(m)).sort((a, b) => a.matchNumber - b.matchNumber);
            groupedMatches[stage] = [...sortedStageMatches, ...missed];
        }
    }

    const activeStages = STAGE_ORDER.filter(stage => groupedMatches[stage].length > 0);
    const [mobileSelectedStage, setMobileSelectedStage] = useState(activeStages[0] || '');

    const handleTeamChange = (matchId: string, teamSlot: 'team1' | 'team2', teamCode: string) => {
        const team = teams.find(t => t.code === teamCode) || { name: 'TBD', code: 'TBD', flag: '🏳️' };
        
        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return { ...m, [teamSlot]: team };
            }
            return m;
        }));
    };

    const handleDateChange = (matchId: string, newDate: string) => {
        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return { ...m, date: newDate };
            }
            return m;
        }));
    };

    const renderMatchCard = (match: Match) => {
        // Convert ISO string to format required by datetime-local input (YYYY-MM-DDThh:mm)
        const dateObj = new Date(match.date);
        const tzoffset = dateObj.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dateObj.getTime() - tzoffset)).toISOString().slice(0, 16);

        return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 w-full shadow-lg z-10 relative">
                <div className="text-xs text-slate-500 mb-2 font-mono flex items-center justify-between gap-2">
                    <span className="shrink-0 font-bold">Match {match.matchNumber}</span>
                    <input 
                        type="datetime-local" 
                        value={localISOTime}
                        onChange={(e) => {
                            const newDateObj = new Date(e.target.value);
                            handleDateChange(match.id, newDateObj.toISOString());
                        }}
                        className="bg-slate-900 text-slate-300 border border-slate-700 rounded px-1 py-0.5 text-[10px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 w-full"
                    />
                </div>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg w-6 text-center">{match.team1?.flag || '🏳️'}</span>
                    <select 
                        value={match.team1?.code || 'TBD'} 
                        onChange={(e) => handleTeamChange(match.id, 'team1', e.target.value)}
                        className="bg-slate-700 text-white border border-slate-600 text-sm rounded flex-1 p-1.5 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="TBD">TBD</option>
                        {teams.map(t => (
                            <option key={t.code} value={t.code}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-lg w-6 text-center">{match.team2?.flag || '🏳️'}</span>
                    <select 
                        value={match.team2?.code || 'TBD'} 
                        onChange={(e) => handleTeamChange(match.id, 'team2', e.target.value)}
                        className="bg-slate-700 text-white border border-slate-600 text-sm rounded flex-1 p-1.5 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="TBD">TBD</option>
                        {teams.map(t => (
                            <option key={t.code} value={t.code}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            </div>
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const sanitizedMatches = matches.map(match => {
                const cleanMatch = { ...match };
                Object.keys(cleanMatch).forEach(key => {
                    const k = key as keyof Match;
                    if (cleanMatch[k] === undefined) {
                        delete cleanMatch[k];
                    }
                });
                return cleanMatch;
            });

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                knockoutMatches: sanitizedMatches,
                skipLeaderboardUpdate: Date.now() // Flag to skip leaderboard recalculation
            });
            setMessage('Knockout teams saved successfully!');
            setTimeout(() => onClose(), 1500);
        } catch (error) {
            console.error('Error saving knockout matches:', error);
            setMessage('Error saving. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    const totalBaseRows = activeStages.length > 0 ? groupedMatches[activeStages[0]].length : 1;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col h-[100dvh] overflow-hidden text-slate-100 w-full">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">{tournament.name}</h2>
                        <p className="text-sm text-slate-400">Populate Knockout Rounds</p>
                    </div>
                </div>
                <div className="flex gap-4 items-center w-full sm:w-auto">
                    {message && <span className={message.includes('Error') ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{message}</span>}
                    <button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                        {isSaving ? 'Saving...' : 'Save Knockout Teams'}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col">
                <div className="md:hidden mb-4">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Select Stage</label>
                    <select 
                        value={mobileSelectedStage} 
                        onChange={(e) => setMobileSelectedStage(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded"
                    >
                        {activeStages.map(stage => (
                            <option key={stage} value={stage}>
                                {stage === 'Final' && tournament.hasThirdPlaceMatch ? 'Final (Third Place Match)' : stage}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-w-max flex flex-col">
                    {/* Headers Row */}
                    <div className="flex gap-0 mb-4">
                        {activeStages.map(stage => {
                            const isMobileVisible = stage === mobileSelectedStage;
                            return (
                                <h3 key={`header-${stage}`} className={`flex-1 text-center font-bold text-slate-300 min-w-[300px] ${!isMobileVisible ? 'hidden md:block' : 'block'}`}>
                                    {stage}
                                </h3>
                            );
                        })}
                    </div>

                    {/* Bracket Container */}
                    <div className="flex flex-1 gap-0 h-max">
                        {activeStages.map((stage, stageIndex) => {
                            const isMobileVisible = stage === mobileSelectedStage;
                            const isLastStage = stageIndex === activeStages.length - 1;
                            const isFirstStage = stageIndex === 0;
                            const rowSpan = Math.pow(2, stageIndex);

                            return (
                                <div 
                                    key={stage} 
                                    className={`flex-1 min-w-[300px] flex-col gap-4 md:gap-0 ${!isMobileVisible ? 'hidden md:grid' : 'flex md:grid'}`}
                                    style={{ gridTemplateRows: `repeat(${totalBaseRows}, minmax(130px, 1fr))` }}
                                >
                                    {groupedMatches[stage].map((match, matchIndex) => {
                                        const isEven = matchIndex % 2 === 0;

                                        return (
                                            <div 
                                                key={match.id} 
                                                className="relative flex flex-col justify-center px-4 py-2 md:py-2"
                                                style={{ gridRow: `span ${rowSpan}` }}
                                            >
                                                {/* Connecting Lines for Desktop */}
                                                <div className="hidden md:block absolute inset-0 pointer-events-none">
                                                    {/* Line coming in from left (not on first stage) */}
                                                    {!isFirstStage && (
                                                        <div className="absolute top-1/2 left-0 w-4 border-t-2 border-slate-600"></div>
                                                    )}
                                                    
                                                    {/* Lines going out to right (not on last stage) */}
                                                    {!isLastStage && (
                                                        <>
                                                            <div className="absolute top-1/2 right-0 w-4 border-t-2 border-slate-600"></div>
                                                            <div className={`absolute right-0 w-0 border-r-2 border-slate-600 ${isEven ? 'top-1/2 bottom-0' : 'top-0 bottom-1/2'}`}></div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="relative w-full">
                                                    {renderMatchCard(match)}

                                                    {stage === 'Final' && matchIndex === 0 && thirdPlaceMatch && (
                                                        <div className="mt-8 md:mt-8 md:absolute md:top-full md:left-0 md:right-0 relative z-10">
                                                            <h3 className="text-center font-bold text-slate-300 mb-6">Third Place Match</h3>
                                                            {renderMatchCard(thirdPlaceMatch)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PopulateKnockoutModal;
