// src/components/views/PredictionEntry.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { logAudit } from '../../utils/auditLogger';
import type { Tournament, UserProfile, UserPredictions, Match, MatchStage } from '../../types';
import { useTranslation } from 'react-i18next';

interface PredictionEntryProps {
    tournament: Tournament;
    userProfile: UserProfile | null;
    onBack: () => void;
}

const STAGE_ORDER: MatchStage[] = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third Place Match', 'Final'];

const OutcomeBadge = ({ outcome }: { outcome: 'WIN' | 'LOSE' | 'DRAW' | null }) => {
    if (!outcome) return <span className="text-xs font-bold py-0.5 w-12 flex items-center justify-center bg-transparent"></span>;
    const baseClasses = "text-xs font-bold py-0.5 w-12 flex items-center justify-center";
    switch (outcome) {
        case 'WIN': return <span className={`${baseClasses} bg-green-500 text-white`}>WIN</span>;
        case 'LOSE': return <span className={`${baseClasses} bg-red-500 text-white`}>LOSE</span>;
        case 'DRAW': return <span className={`${baseClasses} bg-slate-600 text-white`}>DRAW</span>;
        default: return <span className={`${baseClasses} bg-transparent`}></span>;
    }
};

const PredictionEntry = ({ tournament, userProfile, onBack }: PredictionEntryProps) => {
    const { t } = useTranslation();
    const [predictions, setPredictions] = useState<UserPredictions | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>(() => {
        try {
            const savedState = localStorage.getItem(`udug-bets-collapsed-${tournament.id}`);
            return savedState ? JSON.parse(savedState) : {};
        } catch (error) {
            console.error("Failed to parse collapsed state from localStorage", error);
            return {};
        }
    });

    const allMatches = useMemo(() => [...(tournament.matches || []), ...(tournament.knockoutMatches || [])], [tournament]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty]);

    const fetchPredictions = useCallback(async () => {
        if (!userProfile) return;
        setIsLoading(true);
        const predictionDocId = `${tournament.id}_${userProfile.uid}`;
        const predictionRef = doc(db, "predictions", predictionDocId);
        const docSnap = await getDoc(predictionRef);

        if (docSnap.exists()) {
            setPredictions(docSnap.data() as UserPredictions);
        } else {
            setPredictions({
                tournamentId: tournament.id,
                userId: userProfile.uid,
                matchPredictions: {},
            });
        }
        setIsLoading(false);
    }, [tournament.id, userProfile]);

    useEffect(() => {
        fetchPredictions();
    }, [fetchPredictions]);

    const handleScoreChange = (matchId: string, team: 'team1Score' | 'team2Score', value: string) => {
        setIsDirty(true);
        const score = value === '' ? -1 : parseInt(value, 10);
        setPredictions(prev => {
            if (!prev) return null;
            const newMatchPredictions = { ...prev.matchPredictions };
            const currentPrediction = newMatchPredictions[matchId] || { team1Score: -1, team2Score: -1 };
            newMatchPredictions[matchId] = { ...currentPrediction, [team]: score };
            return { ...prev, matchPredictions: newMatchPredictions };
        });
    };

    const handleChampionChange = (teamCode: string) => {
        setIsDirty(true);
        setPredictions(prev => prev ? { ...prev, championPrediction: teamCode } : null);
    };

    const handleSave = async () => {
        if (!predictions) return;
        setIsSaving(true);
        setMessage('');
        try {
            const predictionDocId = `${tournament.id}_${userProfile!.uid}`;
            await setDoc(doc(db, "predictions", predictionDocId), { ...predictions, lastUpdated: Timestamp.now() });
            
            await logAudit(userProfile, 'SUBMIT_PREDICTION', `Tournament: ${tournament.name}`, predictions);

            setIsDirty(false);
            setMessage('Your predictions have been saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving predictions:", error);
            setMessage('Failed to save predictions. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes that will be lost. Are you sure you want to leave?")) {
                onBack();
            }
        } else {
            onBack();
        }
    };

    const matchesByStageAndDate = useMemo(() => {
        const sortedMatches = [...allMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return sortedMatches.reduce((acc, match) => {
            const stage = match.stage;
            const date = new Date(match.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[stage]) acc[stage] = {};
            if (!acc[stage][date]) acc[stage][date] = [];
            acc[stage][date].push(match);
            return acc;
        }, {} as Record<MatchStage, Record<string, Match[]>>);
    }, [allMatches]);

    const sortedStageKeys = useMemo(() => {
        return Object.keys(matchesByStageAndDate).sort((a, b) => STAGE_ORDER.indexOf(a as MatchStage) - STAGE_ORDER.indexOf(b as MatchStage));
    }, [matchesByStageAndDate]);

    const isPredictionDisabled = (stage: MatchStage): boolean => {
        const status = tournament.predictionStatus;
        if (!status) return true;
        switch (stage) {
            case 'Group Stage': return !status.allowGroupStage;
            case 'Round of 32': return !status.allowRoundOf32;
            case 'Round of 16': return !status.allowRoundOf16;
            case 'Quarter-final': return !status.allowQuarterFinal;
            case 'Semi-final': return !status.allowSemiFinal;
            case 'Third Place Match':
            case 'Final': return !status.allowFinals;
            default: return true;
        }
    };

    const toggleStageCollapse = (stage: string) => {
        const newCollapsedState = { ...collapsedStages, [stage]: !collapsedStages[stage] };
        setCollapsedStages(newCollapsedState);
        localStorage.setItem(`udug-bets-collapsed-${tournament.id}`, JSON.stringify(newCollapsedState));
    };

    if (isLoading || !predictions) {
        return <div className="text-center p-8"><svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    return (
        <div id="prediction-entry-top" className="bg-slate-800 border border-slate-700 p-4 md:p-8 relative">
            <div id="prediction-entry-top-anchor" className="absolute top-0 left-0"></div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">{tournament.name}</h2>
                        <p className="text-sm text-slate-400">{t('predictionEntry.enterYourPredictions', 'Enter Your Predictions')}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <div className="bg-slate-900/50 p-4 border border-slate-700">
                    <label htmlFor="champion-select" className="block text-lg font-semibold text-slate-100 mb-2">{t('predictionEntry.championPrediction', 'Champion Prediction')}</label>
                    <div className="flex items-center">
                        <select 
                            id="champion-select"
                            value={predictions.championPrediction || ''}
                            onChange={e => handleChampionChange(e.target.value)}
                            disabled={!tournament.predictionStatus?.allowChampion}
                            className="w-full md:w-1/2 px-4 py-2 bg-slate-800 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <option value="">{t('predictionEntry.selectChampion', '-- Select a Champion --')}</option>
                            {tournament.teams?.sort((a,b) => a.name.localeCompare(b.name)).map(team => (
                                <option key={team.code} value={team.code}>{team.flag} {team.name}</option>
                            ))}
                        </select>
                        {predictions.championPrediction && <span className="text-2xl ml-3">🏆</span>}
                    </div>
                </div>

                {sortedStageKeys.map(stage => (
                    <div key={stage}>
                        <button onClick={() => toggleStageCollapse(stage)} className="w-full flex justify-between items-center text-xl font-semibold text-blue-300 mb-3 p-2 bg-slate-700/50 hover:bg-slate-700">
                            <span>{stage}</span>
                            <svg className={`w-5 h-5 transition-transform ${collapsedStages[stage] ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        {!collapsedStages[stage] && (
                            <div className="space-y-3">
                                {Object.keys(matchesByStageAndDate[stage as MatchStage]).sort((a,b) => new Date(a).getTime() - new Date(b).getTime()).map(date => (
                                    <div key={date}>
                                        <h4 className="font-semibold text-slate-300 text-sm mb-2 pl-2">{date}</h4>
                                        <div className="space-y-2 pl-4 border-l-2 border-slate-700">
                                            {matchesByStageAndDate[stage as MatchStage][date].map(match => {
                                                const pred = predictions.matchPredictions[match.id];
                                                const isDisabled = isPredictionDisabled(match.stage);
                                                let team1Outcome: 'WIN' | 'LOSE' | 'DRAW' | null = null;
                                                let team2Outcome: 'WIN' | 'LOSE' | 'DRAW' | null = null;
                                                if (pred && pred.team1Score > -1 && pred.team2Score > -1) {
                                                    if (pred.team1Score > pred.team2Score) { team1Outcome = 'WIN'; team2Outcome = 'LOSE'; }
                                                    else if (pred.team2Score > pred.team1Score) { team1Outcome = 'LOSE'; team2Outcome = 'WIN'; }
                                                    else { team1Outcome = 'DRAW'; team2Outcome = 'DRAW'; }
                                                }

                                                return (
                                                    <div key={match.id} className={`p-3 space-y-3 ${isDisabled ? 'bg-slate-800/50' : 'bg-slate-900/50'}`}>
                                                        <div>
                                                            <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className="text-right text-white">{match.team1.flag} {match.team1.name}</span>
                                                                </div>
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <OutcomeBadge outcome={team1Outcome} />
                                                                    <input type="number" min="0" value={pred?.team1Score > -1 ? pred.team1Score : ''} onChange={e => handleScoreChange(match.id, 'team1Score', e.target.value)} disabled={isDisabled} className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1 disabled:opacity-50" />
                                                                    <span className="text-slate-500 font-bold text-lg">-</span>
                                                                    <input type="number" min="0" value={pred?.team2Score > -1 ? pred.team2Score : ''} onChange={e => handleScoreChange(match.id, 'team2Score', e.target.value)} disabled={isDisabled} className="w-12 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1 disabled:opacity-50" />
                                                                    <OutcomeBadge outcome={team2Outcome} />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-left text-white">{match.team2.name} {match.team2.flag}</span>
                                                                </div>
                                                            </div>

                                                            <div className="sm:hidden space-y-2 text-sm">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-white truncate flex-1 min-w-0">{match.team1.flag} {match.team1.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <OutcomeBadge outcome={team1Outcome} />
                                                                        <input type="number" min="0" value={pred?.team1Score > -1 ? pred.team1Score : ''} onChange={e => handleScoreChange(match.id, 'team1Score', e.target.value)} disabled={isDisabled} className="w-16 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1 disabled:opacity-50" />
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-white truncate flex-1 min-w-0">{match.team2.flag} {match.team2.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <OutcomeBadge outcome={team2Outcome} />
                                                                        <input type="number" min="0" value={pred?.team2Score > -1 ? pred.team2Score : ''} onChange={e => handleScoreChange(match.id, 'team2Score', e.target.value)} disabled={isDisabled} className="w-16 text-center bg-slate-800 border border-slate-600 text-white font-bold p-1 disabled:opacity-50" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-center text-xs text-slate-500 flex flex-wrap justify-center items-center gap-x-2">
                                                            <span>{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
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
            
            <div id="prediction-entry-bottom" className="mt-8 pt-6 border-t border-slate-700 flex justify-end items-center gap-4">
                {message && <p className="text-green-400 text-sm">{message}</p>}
                <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {isSaving ? t('predictionEntry.saving', 'Saving...') : t('predictionEntry.savePredictions', 'Save Predictions')}
                </button>
            </div>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
                <button 
                    onClick={() => document.getElementById('prediction-entry-top-anchor')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-12 h-12 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-full flex items-center justify-center shadow-lg text-slate-300 hover:text-white transition-colors"
                    title="Scroll to Top"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                </button>
                <button 
                    onClick={() => document.getElementById('prediction-entry-bottom')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-12 h-12 bg-blue-600 hover:bg-blue-500 border border-blue-400 rounded-full flex items-center justify-center shadow-lg text-white transition-colors"
                    title="Scroll to Save"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </button>
            </div>
        </div>
    );
};

export default PredictionEntry;
