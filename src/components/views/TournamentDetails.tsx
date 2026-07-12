// src/components/views/TournamentDetails.tsx

import type { Tournament, Match, MatchStage } from '../../types';
import { useMemo, useState, useEffect } from 'react';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';

interface TournamentDetailsProps {
    tournament: Tournament;
    onBack: () => void;
}

const PointRuleTableRow = ({ label, points, calcRule }: { label: string, points?: { correctScore: number; correctOutcome: number; }, calcRule?: '90m' | '120m' | '120m_pen' }) => {
    if (!points) return null;
    let calcText = '90 Min';
    if (calcRule === '90m') calcText = '90 Min';
    else if (calcRule === '120m') calcText = '120 Min';
    else if (calcRule === '120m_pen') calcText = '120 Min + Pen';
    
    return (
        <tr className="hover:bg-slate-800/50 transition-colors">
            <td className="py-2 text-slate-300">{label}</td>
            <td className="py-2 text-center text-emerald-400 font-mono">+{points.correctOutcome}</td>
            <td className="py-2 text-center text-blue-400 font-mono">+{points.correctScore}</td>
            <td className="py-2 text-center text-slate-400 font-mono text-xs">{calcText}</td>
        </tr>
    );
};

const STAGE_ORDER: MatchStage[] = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place Match', 'Final'];

const MatchList = ({ title, matches, groupByStage = false }: { title: string, matches?: Match[], groupByStage?: boolean }) => {
    const groupedMatches = useMemo(() => {
        if (!matches) return {};
        if (groupByStage) {
            return matches.reduce((acc, match) => {
                const stage = match.stage;
                const date = new Date(match.date).toLocaleDateString('en-CA');
                if (!acc[stage]) acc[stage] = {};
                if (!acc[stage][date]) acc[stage][date] = [];
                acc[stage][date].push(match);
                return acc;
            }, {} as Record<string, Record<string, Match[]>>);
        } else {
            return matches.reduce((acc, match) => {
                const date = new Date(match.date).toLocaleDateString('en-CA');
                if (!acc[date]) acc[date] = [];
                acc[date].push(match);
                return acc;
            }, {} as Record<string, Match[]>);
        }
    }, [matches, groupByStage]);

    const sortedStageKeys = useMemo(() => {
        return Object.keys(groupedMatches).sort((a, b) => STAGE_ORDER.indexOf(a as MatchStage) - STAGE_ORDER.indexOf(b as MatchStage));
    }, [groupedMatches]);

    const { t } = useTranslation();
    
    return (
        <div>
            <h4 className="font-semibold text-blue-400 mb-2">{title} ({t('tournamentDetails.matchesCount', '{{count}} Matches', { count: matches?.length || 0 })})</h4>
            <div className="text-sm text-slate-300 max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 border border-slate-700 p-2 bg-slate-800 space-y-3">
                {groupByStage ? (
                    sortedStageKeys.map(stageKey => (
                         <div key={stageKey}>
                            <h5 className="font-bold text-blue-300 text-md mb-1 bg-slate-700 p-2">{stageKey}</h5>
                            {Object.keys(groupedMatches[stageKey]).sort().map(dateKey => (
                                <div key={dateKey} className="pl-2 border-l-2 border-slate-600 ml-2">
                                    <h6 className="font-semibold text-slate-300 text-sm my-1">{new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h6>
                                    <table className="w-full table-fixed text-left text-sm mt-1 mb-3 border-collapse bg-slate-900/30 rounded">
                                        <tbody>
                                            {(groupedMatches[stageKey] as Record<string, Match[]>)[dateKey].map(match => (
                                                <tr key={match.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 last:border-0">
                                                    <td className="p-2 text-right w-2/5">
                                                        <span className="mr-2 truncate">{match.team1.name}</span>
                                                        <span>{match.team1.flag}</span>
                                                    </td>
                                                    <td className="p-2 text-center text-slate-500 w-1/5 text-xs">
                                                        <div className="font-mono text-slate-400">{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        <div className="text-[10px] uppercase">vs</div>
                                                    </td>
                                                    <td className="p-2 text-left w-2/5">
                                                        <span>{match.team2.flag}</span>
                                                        <span className="ml-2 truncate">{match.team2.name}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    Object.keys(groupedMatches).sort().map(dateKey => (
                        <div key={dateKey}>
                            <h5 className="font-bold text-slate-300 text-sm mb-1 bg-slate-700 p-1">{new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h5>
                            <table className="w-full table-fixed text-left text-sm border-collapse bg-slate-900/30 rounded mt-1 mb-2">
                                <tbody>
                                    {(groupedMatches[dateKey] as Match[]).map(match => (
                                        <tr key={match.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 last:border-0">
                                            <td className="p-2 text-right w-2/5">
                                                <span className="mr-2 truncate">{match.team1.name}</span>
                                                <span>{match.team1.flag}</span>
                                            </td>
                                            <td className="p-2 text-center text-slate-500 w-1/5 text-xs">
                                                <div className="font-mono text-slate-400">{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div className="text-[10px] uppercase">vs</div>
                                            </td>
                                            <td className="p-2 text-left w-2/5">
                                                <span>{match.team2.flag}</span>
                                                <span className="ml-2 truncate">{match.team2.name}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


const TournamentDetails = ({ tournament, onBack }: TournamentDetailsProps) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [previewDescription, setPreviewDescription] = useState('');
    const [fullDescription, setFullDescription] = useState('');

    useEffect(() => {
        const parseDescription = async () => {
            if (!tournament.description) {
                const noDescHtml = `<p class="text-slate-400 italic">${t('tournamentDetails.noDescription', 'No description provided.')}</p>`;
                setFullDescription(noDescHtml);
                setPreviewDescription(noDescHtml);
                return;
            }
            try {
                const sentences = tournament.description.match(/[^.!?]+[.!?]+/g) || [tournament.description];
                const previewStr = sentences.slice(0, 3).join('').trim();
                
                const fullHtml = await marked.parse(tournament.description);
                const previewHtml = await marked.parse(previewStr + (sentences.length > 3 ? '...' : ''));
                
                setFullDescription(fullHtml);
                setPreviewDescription(previewHtml);
            } catch (error) {
                const errorHtml = `<p>${t('tournamentDetails.errorDescription', 'Error parsing description.')}</p>`;
                setFullDescription(errorHtml);
                setPreviewDescription(errorHtml);
            }
        };
        parseDescription();
    }, [tournament.description, t]);

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto w-full">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage: {tournament.name}</h2>
                        <p className="text-sm text-slate-400">Check Tournament Details: {tournament.name}</p>
                    </div>
                </div>
            </div>
            <div className="p-4 flex flex-col gap-6 max-w-6xl mx-auto w-full">
                <div className="space-y-6">
                    <div className="bg-slate-800 p-4 border border-slate-700 rounded shadow">
                        <div
                            className="prose prose-sm prose-invert max-w-none transition-all duration-300"
                            dangerouslySetInnerHTML={{ __html: isExpanded ? fullDescription : previewDescription }}
                        />
                        {tournament.description && (tournament.description.match(/[^.!?]+[.!?]+/g)?.length || 0) > 3 && (
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="text-blue-400 hover:text-blue-300 text-sm mt-4 font-medium"
                            >
                                {isExpanded ? t('common.showLess', 'Show Less') : t('common.readMore', 'Read More')}
                            </button>
                        )}
                    </div>

                <div className="bg-slate-900/50 p-4 border border-slate-700 rounded shadow text-sm">
                    <h4 className="font-semibold text-blue-400 mb-4">{t('tournamentDetails.pointRules', 'Point Rules')}</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400">
                                    <th className="pb-2 font-medium">{t('common.stage', 'Stage')}</th>
                                    <th className="pb-2 font-medium text-center">{t('common.outcome', 'Outcome')}</th>
                                    <th className="pb-2 font-medium text-center">{t('common.score', 'Score')}</th>
                                    <th className="pb-2 font-medium text-center">{t('tournamentDetails.calcRule', 'Calculation')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                <PointRuleTableRow label={t('stages.groupStage', 'Group Stage')} points={tournament.pointRules?.groupStage} />
                                <PointRuleTableRow label={t('stages.round32', 'Round of 32')} points={tournament.pointRules?.round32} calcRule={tournament.knockoutPointCalculationRules?.round32} />
                                <PointRuleTableRow label={t('stages.round16', 'Round of 16')} points={tournament.pointRules?.round16} calcRule={tournament.knockoutPointCalculationRules?.round16} />
                                <PointRuleTableRow label={t('stages.quarterFinals', 'Quarter-finals')} points={tournament.pointRules?.quarterFinal} calcRule={tournament.knockoutPointCalculationRules?.quarterFinal} />
                                <PointRuleTableRow label={t('stages.semiFinals', 'Semi-finals')} points={tournament.pointRules?.semiFinal} calcRule={tournament.knockoutPointCalculationRules?.semiFinal} />
                                {tournament.hasThirdPlaceMatch && <PointRuleTableRow label={t('stages.thirdPlaceMatch', 'Third Place Match')} points={tournament.pointRules?.thirdPlaceMatch} calcRule={tournament.knockoutPointCalculationRules?.thirdPlaceMatch} />}
                                <PointRuleTableRow label={t('stages.finals', 'Final')} points={tournament.pointRules?.final} calcRule={tournament.knockoutPointCalculationRules?.final} />
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between py-3 border-t border-slate-700 mt-4">
                        <span className="text-slate-400">{t('tournamentDetails.championBonus', 'Champion Bonus:')}</span>
                        <span className="text-emerald-400 font-mono font-bold">+{tournament.pointRules?.championBonus ?? 'N/A'}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <MatchList title={t('tournamentDetails.groupStageSchedule', 'Group Stage Schedule')} matches={tournament.matches} />
                    <MatchList title={t('tournamentDetails.knockoutStageSchedule', 'Knockout Stage Schedule')} matches={tournament.knockoutMatches} groupByStage={true} />
                </div>
            </div>
        </div>
        </div>
    );
};

export default TournamentDetails;
