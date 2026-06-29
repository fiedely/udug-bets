import React from 'react';
import type { Tournament, Match } from '../../types';
import { STAGE_MATCH_NUMBERS, getNextMatchId } from '../../utils/bracketRouting';

interface KnockoutTreeWidgetProps {
    tournament: Tournament;
}

const STAGE_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];

const KnockoutTreeWidget: React.FC<KnockoutTreeWidgetProps> = ({ tournament }) => {
    // We only want to visualize, so we create the match list without state updates
    const getVisualMatches = (): Match[] => {
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
    };

    const matches = getVisualMatches();
    const thirdPlaceMatch = tournament.hasThirdPlaceMatch ? matches.find(m => m.stage === 'Third Place Match') : null;

    // Group and sort matches
    const groupedMatches: Record<string, Match[]> = {};
    const format = tournament.format || 'generic';

    if (format === 'generic') {
        STAGE_ORDER.forEach(stage => {
            groupedMatches[stage] = matches
                .filter(m => m.stage === stage)
                .sort((a, b) => a.matchNumber - b.matchNumber);
        });
    } else {
        // Recursive bracket sort
        groupedMatches['Final'] = matches.filter(m => m.stage === 'Final').sort((a, b) => a.matchNumber - b.matchNumber);
        for (let i = STAGE_ORDER.length - 2; i >= 0; i--) {
            const stage = STAGE_ORDER[i];
            const nextStageMatches = groupedMatches[STAGE_ORDER[i + 1]] || [];
            const stageMatches = matches.filter(m => m.stage === stage);
            
            const sortedStageMatches: Match[] = [];
            nextStageMatches.forEach(nextMatch => {
                const feedsIntoNext = stageMatches.filter(m => m.nextMatchId === nextMatch.matchNumber.toString());
                feedsIntoNext.sort((a, b) => a.matchNumber - b.matchNumber);
                sortedStageMatches.push(...feedsIntoNext);
            });
            
            const missed = stageMatches.filter(m => !sortedStageMatches.includes(m)).sort((a, b) => a.matchNumber - b.matchNumber);
            groupedMatches[stage] = [...sortedStageMatches, ...missed];
        }
    }

    const activeStages = STAGE_ORDER.filter(stage => groupedMatches[stage].length > 0);
    const totalBaseRows = activeStages.length > 0 ? groupedMatches[activeStages[0]].length : 1;

    const formatDateTime = (dateString: string) => {
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const renderMatchCard = (match: Match) => {
        const isTeam1Set = match.team1.code.substring(0, 3) !== 'TBD';
        const isTeam2Set = match.team2.code.substring(0, 3) !== 'TBD';
        
        let team1Display = isTeam1Set ? match.team1.name : `Winner Match ${match.matchNumber - 2}`;
        let team2Display = isTeam2Set ? match.team2.name : `Winner Match ${match.matchNumber - 1}`;
        
        if (!isTeam1Set || !isTeam2Set) {
            const sources = matches.filter(m => m.nextMatchId === match.matchNumber.toString()).sort((a, b) => a.matchNumber - b.matchNumber);
            if (sources.length >= 1 && !isTeam1Set) team1Display = `Winner Match ${sources[0].matchNumber}`;
            if (sources.length >= 2 && !isTeam2Set) team2Display = `Winner Match ${sources[1].matchNumber}`;
        }

        let team1IsWinner = false;
        let team2IsWinner = false;
        let isMatchFinished = typeof match.team1Score === 'number' && typeof match.team2Score === 'number';
        
        if (isMatchFinished) {
            if (match.winnerTeamCode) {
                team1IsWinner = match.winnerTeamCode === match.team1.code;
                team2IsWinner = match.winnerTeamCode === match.team2.code;
            } else {
                team1IsWinner = match.team1Score! > match.team2Score!;
                team2IsWinner = match.team2Score! > match.team1Score!;
            }
        }

        const getScoreColor = (isTeam1: boolean) => {
            if (!isMatchFinished) return 'text-slate-300';
            if (!team1IsWinner && !team2IsWinner) return 'text-slate-300';
            const isWinner = isTeam1 ? team1IsWinner : team2IsWinner;
            return isWinner ? 'text-green-400' : 'text-red-400';
        };

        const renderTiebreaker = (isTeam1: boolean) => {
            if (!match.tiebreakerType) return null;
            const score = isTeam1 ? match.team1TiebreakerScore : match.team2TiebreakerScore;
            if (score === undefined) return null;
            
            const isWinner = isTeam1 ? team1IsWinner : team2IsWinner;
            const colorClass = isWinner ? 'text-green-400' : 'text-red-400';
            const prefix = match.tiebreakerType === 'Penalty Shootout' ? 'p' : 'et';
            
            return <span className={`text-[10px] italic ${colorClass}`}>{prefix}({score})</span>;
        };

        return (
            <div className="flex flex-col w-[200px] sm:w-[220px] shrink-0 z-10">
                <div className="text-[10px] sm:text-xs text-slate-400 font-medium mb-1 px-1 flex gap-1 truncate justify-between">
                    <span>{formatDateTime(match.date)}</span>
                    <span className="text-slate-500">M{match.matchNumber}</span>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded shadow text-slate-200 text-sm overflow-hidden flex flex-col">
                    {/* Team 1 */}
                    <div className="flex justify-between items-center px-2 py-1.5 border-b border-slate-700 h-8">
                        <div className="flex items-center gap-2 truncate pr-2">
                            <span>{isTeam1Set ? match.team1.flag : '🏳️'}</span>
                            <span className="truncate whitespace-nowrap">{team1Display}</span>
                        </div>
                        {typeof match.team1Score === 'number' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                {renderTiebreaker(true)}
                                <span className={`font-bold ${getScoreColor(true)}`}>{match.team1Score}</span>
                            </div>
                        )}
                    </div>
                    {/* Team 2 */}
                    <div className="flex justify-between items-center px-2 py-1.5 h-8">
                        <div className="flex items-center gap-2 truncate pr-2">
                            <span>{isTeam2Set ? match.team2.flag : '🏳️'}</span>
                            <span className="truncate whitespace-nowrap">{team2Display}</span>
                        </div>
                        {typeof match.team2Score === 'number' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                {renderTiebreaker(false)}
                                <span className={`font-bold ${getScoreColor(false)}`}>{match.team2Score}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (activeStages.length === 0) {
        return <div className="p-8 text-center text-slate-400">No knockout matches available.</div>;
    }

    return (
        <div 
            className="w-full h-full bg-slate-800 overflow-auto relative font-sans text-slate-100 p-4 sm:p-8" 
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none', touchAction: 'pan-x pan-y' }}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
        >
            <div className="min-w-max flex flex-col">
                {/* Headers Row */}
                <div className="flex gap-12 sm:gap-16 mb-6">
                    {activeStages.map(stage => (
                        <div key={`header-${stage}`} className="w-[200px] sm:w-[220px] shrink-0">
                            <div className="border border-slate-600 text-center py-1 text-sm font-semibold text-slate-300 bg-slate-900 rounded shadow-sm">
                                {stage === 'Final' && tournament.hasThirdPlaceMatch ? 'Final' : stage}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bracket Container */}
                <div className="flex gap-12 sm:gap-16 min-h-max pb-32">
                    {activeStages.map((stage, stageIndex) => {
                        const isLastStage = stageIndex === activeStages.length - 1;
                        const isFirstStage = stageIndex === 0;
                        const rowSpan = Math.pow(2, stageIndex);

                        return (
                            <div 
                                key={stage} 
                                className="w-[200px] sm:w-[220px] shrink-0 grid"
                                style={{ gridTemplateRows: `repeat(${totalBaseRows}, minmax(64px, 1fr))` }}
                            >
                                {groupedMatches[stage].map((match, matchIndex) => {
                                    const isEven = matchIndex % 2 === 0;

                                    return (
                                        <div 
                                            key={match.id} 
                                            className="relative flex flex-col justify-center"
                                            style={{ gridRow: `span ${rowSpan}` }}
                                        >
                                            {/* Connecting Lines for ALL views */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {/* Line coming in from left */}
                                                {!isFirstStage && (
                                                    <div className="absolute top-1/2 -left-6 sm:-left-8 w-6 sm:w-8 border-t-2 border-slate-600"></div>
                                                )}
                                                
                                                {/* Lines going out to right */}
                                                {!isLastStage && (
                                                    <>
                                                        <div className="absolute top-1/2 -right-6 sm:-right-8 w-6 sm:w-8 border-t-2 border-slate-600"></div>
                                                        <div className={`absolute -right-6 sm:-right-8 w-0 border-r-2 border-slate-600 ${isEven ? 'top-1/2 bottom-0' : 'top-0 bottom-1/2'}`}></div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="relative mx-auto z-10 w-[200px] sm:w-[220px]">
                                                {renderMatchCard(match)}

                                                {stage === 'Final' && matchIndex === 0 && thirdPlaceMatch && (
                                                    <div className="absolute top-full mt-8 left-0 right-0 z-10">
                                                        <div className="border border-slate-600 text-center py-0.5 text-xs text-slate-300 bg-slate-900 rounded-t mb-1">
                                                            Third place
                                                        </div>
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
    );
};

export default KnockoutTreeWidget;
