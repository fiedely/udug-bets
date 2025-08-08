// src/components/admin/wizard/Step5Confirmation.tsx

import { db } from '../../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Match, Team, MatchStage } from '../../../types';
import { useState, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import Flag from '../../common/Flag';

interface Step5ConfirmationProps {
    tournament: Tournament;
    onBack: () => void;
    onFinish: () => void;
}

const PointRuleRow = ({ label, points }: { label: string, points?: { correctScore: number; correctOutcome: number; } }) => {
    if (!points) return null;
    return (
        <div className="flex justify-between py-1">
            <span className="text-slate-400">{label}:</span>
            <span className="text-white font-mono">Score: {points.correctScore} / Outcome: {points.correctOutcome}</span>
        </div>
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

    return (
        <div>
            <h4 className="font-semibold text-blue-400 mb-2">{title} ({matches?.length || 0} Matches)</h4>
            <div className="text-sm text-slate-300 max-h-64 overflow-y-auto pr-2 border border-slate-700 p-2 bg-slate-800 space-y-3">
                {groupByStage ? (
                    sortedStageKeys.map(stageKey => (
                         <div key={stageKey}>
                            <h5 className="font-bold text-blue-300 text-md mb-1 bg-slate-700 p-2">{stageKey}</h5>
                            {Object.keys(groupedMatches[stageKey]).sort().map(dateKey => (
                                <div key={dateKey} className="pl-2 border-l-2 border-slate-600 ml-2">
                                    <h6 className="font-semibold text-slate-300 text-sm my-1">{new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h6>
                                    {(groupedMatches[stageKey] as Record<string, Match[]>)[dateKey].map(match => (
                                        <div key={match.id} className="flex justify-between items-center p-1.5 hover:bg-slate-700/50">
                                            <span className="flex items-center gap-2">
                                                <Flag code={match.team1.code} /> {match.team1.name} <span className="text-slate-500">vs</span> <Flag code={match.team2.code} /> {match.team2.name}
                                            </span>
                                            <span className="text-xs text-slate-400 text-right">{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>@ {match.stadium.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    Object.keys(groupedMatches).sort().map(dateKey => (
                        <div key={dateKey}>
                            <h5 className="font-bold text-slate-300 text-sm mb-1 bg-slate-700 p-1">{new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h5>
                            {(groupedMatches[dateKey] as Match[]).map(match => (
                                 <div key={match.id} className="flex justify-between items-center p-1.5 hover:bg-slate-700/50">
                                    <span className="flex items-center gap-2">
                                        <Flag code={match.team1.code} /> {match.team1.name} <span className="text-slate-500">vs</span> <Flag code={match.team2.code} /> {match.team2.name}
                                    </span>
                                    <span className="text-xs text-slate-400 text-right">{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>@ {match.stadium.name}</span>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


const Step5Confirmation = ({ tournament, onBack, onFinish }: Step5ConfirmationProps) => {
    const [isActivating, setIsActivating] = useState(false);
    const [renderedDescription, setRenderedDescription] = useState('');

    const handleActivate = async () => {
        setIsActivating(true);
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);
            await updateDoc(tournamentRef, { status: 'active' });
            onFinish();
        } catch (err) {
            console.error(err);
            setIsActivating(false);
        }
    };

    useEffect(() => {
        const parseDescription = async () => {
            if (!tournament.description) {
                setRenderedDescription('<p class="text-slate-400 italic">No description provided.</p>');
                return;
            }
            try {
                const html = await marked.parse(tournament.description);
                setRenderedDescription(html);
            } catch (e) {
                console.error("Error parsing markdown:", e);
                setRenderedDescription("<p>Error parsing description.</p>");
            }
        };
        parseDescription();
    }, [tournament.description]);

    return (
        <div className="mt-4 space-y-6">
            <h2 className="text-2-xl font-bold text-blue-400">Step 5: Confirmation and Activation</h2>
            <div className="space-y-6 p-6 border border-slate-700 bg-slate-900/50">
                
                <div>
                    <h3 className="text-xl font-semibold text-white border-b border-slate-700 pb-2 mb-3">{tournament.name}</h3>
                    <div
                        className="prose prose-sm prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderedDescription }}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-800 p-3 border border-slate-700">
                        <h4 className="font-semibold text-blue-400 mb-1">Tournament Period</h4>
                        <p className="text-slate-300">Start: {tournament.startDate ? new Date(tournament.startDate).toLocaleString() : 'Not set'}</p>
                        <p className="text-slate-300">End: {tournament.endDate ? new Date(tournament.endDate).toLocaleString() : 'Not set'}</p>
                    </div>
                     <div className="bg-slate-800 p-3 border border-slate-700">
                        <h4 className="font-semibold text-blue-400 mb-1">Invitation Ticket</h4>
                        <p className="text-slate-300 font-mono text-lg">{tournament.ticket}</p>
                    </div>
                </div>

                <div className="bg-slate-800 p-3 border border-slate-700 text-sm">
                    <h4 className="font-semibold text-blue-400 mb-2">Point Rules</h4>
                    <PointRuleRow label="Group Stage" points={tournament.pointRules?.groupStage} />
                    <PointRuleRow label="Round of 32" points={tournament.pointRules?.round32} />
                    <PointRuleRow label="Round of 16" points={tournament.pointRules?.round16} />
                    <PointRuleRow label="Quarter Finals" points={tournament.pointRules?.quarterFinal} />
                    <PointRuleRow label="Semi Finals" points={tournament.pointRules?.semiFinal} />
                    {tournament.hasThirdPlaceMatch && <PointRuleRow label="Third Place Match" points={tournament.pointRules?.thirdPlaceMatch} />}
                    <PointRuleRow label="Final" points={tournament.pointRules?.final} />
                    <div className="flex justify-between py-1 border-t border-slate-700 mt-1">
                        <span className="text-slate-400">Champion Bonus:</span>
                        <span className="text-white font-mono">{tournament.pointRules?.championBonus ?? 'N/A'}</span>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-blue-400 mb-2">Groups & Participants ({tournament.teams?.length || 0} teams)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {tournament.groups && Object.entries(tournament.groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, teams]) => (
                            <div key={groupName} className="bg-slate-800 p-3 border border-slate-700">
                                <h5 className="font-bold text-slate-300 text-sm mb-1">{groupName}</h5>
                                <ul className="space-y-1 text-xs text-slate-400">
                                    {teams.map((team: Team) => (
                                        <li key={team.code} className="flex items-center gap-2">
                                            <Flag code={team.code} className="w-4 h-auto" />
                                            {team.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <MatchList title="Group Stage Schedule" matches={tournament.matches} />
                    <MatchList title="Knockout Stage Schedule" matches={tournament.knockoutMatches} groupByStage={true} />
                </div>
            </div>

            {tournament.status === 'draft' && (
                <div className="p-4 bg-yellow-900 border border-yellow-700 text-yellow-100 text-sm">
                    <strong>Final Step:</strong> Activating the tournament will make it visible to users and lock most settings. Please review all details carefully.
                </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-700">
                <button type="button" onClick={onBack} className="w-1/3 px-4 py-3 bg-slate-700 hover:bg-slate-600 font-semibold text-white transition-colors">Back</button>
                {tournament.status === 'draft' ? (
                     <button type="button" onClick={handleActivate} disabled={isActivating} className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 font-semibold text-white disabled:bg-green-800 disabled:cursor-not-allowed transition-colors">
                        {isActivating ? 'Activating...' : 'Confirm & Activate Tournament'}
                    </button>
                ) : (
                    <button type="button" onClick={onFinish} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors">
                        Finish Editing
                    </button>
                )}
            </div>
        </div>
    );
};

export default Step5Confirmation;
