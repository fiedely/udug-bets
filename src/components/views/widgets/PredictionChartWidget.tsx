// src/components/views/widgets/PredictionChartWidget.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, Match, UserProfile } from '../../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PredictionChartWidgetProps {
    tournamentId?: string;
    currentMatchIndex: number;
    onMatchIndexChange: (index: number) => void;
    setRefreshFunc: (func: () => void) => void;
    userProfile?: UserProfile;
}

const PredictionChartWidget = ({ tournamentId, onMatchIndexChange, setRefreshFunc, userProfile }: PredictionChartWidgetProps) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [predictions, setPredictions] = useState<UserPredictions[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tournamentNotFound, setTournamentNotFound] = useState(false);
    
    const [localMatchIndex, setLocalMatchIndex] = useState<number>(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allMatches = useMemo(() => {
        if (!tournament) return [];
        return [...(tournament.matches || []), ...(tournament.knockoutMatches || [])]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [tournament]);

    useEffect(() => {
        if (allMatches.length === 0 || !tournamentId) return;

        let autoIdx = allMatches.findIndex(m => typeof m.team1Score !== 'number');
        if (autoIdx === -1) {
            autoIdx = allMatches.length - 1; // All completed, show last match
        }

        const storageKey = `predictionWidgetState_${tournamentId}`;
        try {
            const storedStr = localStorage.getItem(storageKey);
            if (storedStr) {
                const stored = JSON.parse(storedStr);
                if (stored.date === new Date().toDateString() && typeof stored.index === 'number') {
                    if (stored.index >= 0 && stored.index < allMatches.length) {
                        setLocalMatchIndex(stored.index);
                        return;
                    }
                }
            }
        } catch (e) {
            console.error("Error reading localStorage", e);
        }

        setLocalMatchIndex(autoIdx);
    }, [allMatches, tournamentId]);

    const fetchData = useCallback(async () => {
        setTournamentNotFound(false);
        if (!tournamentId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        
        const tourneyRef = doc(db, "tournaments", tournamentId);
        const tourneySnap = await getDoc(tourneyRef);
        let fetchedTournament: Tournament | null = null;

        if (tourneySnap.exists()) {
            fetchedTournament = { id: tourneySnap.id, ...tourneySnap.data() } as Tournament;
            setTournament(fetchedTournament);
        } else {
            setTournamentNotFound(true);
            setTournament(null);
            setPredictions([]);
            setIsLoading(false);
            return;
        }

        if (fetchedTournament && fetchedTournament.participants && fetchedTournament.participants.length > 0) {
            const predictionPromises = fetchedTournament.participants.map(userId => 
                getDoc(doc(db, "predictions", `${tournamentId}_${userId}`))
            );
            const predictionSnapshots = await Promise.all(predictionPromises);
            const preds = predictionSnapshots
                .filter(snap => snap.exists())
                .map(snap => snap.data() as UserPredictions);
            setPredictions(preds);
        } else {
            setPredictions([]);
        }
        
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);

    const areSubmissionsClosed = useMemo(() => {
        if (!tournament) return true;
        const predStatus = tournament.predictionStatus;
        return predStatus ?
            !predStatus.allowChampion &&
            !predStatus.allowGroupStage &&
            !predStatus.allowRoundOf32 &&
            !predStatus.allowRoundOf16 &&
            !predStatus.allowQuarterFinal &&
            !predStatus.allowSemiFinal &&
            !predStatus.allowFinals
            : true;
    }, [tournament]);

    const currentMatch: Match | undefined = allMatches[localMatchIndex];

    const chartData = useMemo(() => {
        if (!currentMatch || predictions.length === 0) return { outcomeData: [], scoreData: [] };

        const outcomeCounts = { team1Win: 0, draw: 0, team2Win: 0 };
        const scoreCounts: { [score: string]: number } = {};

        predictions.forEach(p => {
            const matchPred = p.matchPredictions[currentMatch.id];
            if (matchPred && matchPred.team1Score >= 0 && matchPred.team2Score >= 0) {
                if (matchPred.team1Score > matchPred.team2Score) outcomeCounts.team1Win++;
                else if (matchPred.team2Score > matchPred.team1Score) outcomeCounts.team2Win++;
                else outcomeCounts.draw++;

                const scoreString = `${matchPred.team1Score}-${matchPred.team2Score}`;
                scoreCounts[scoreString] = (scoreCounts[scoreString] || 0) + 1;
            }
        });

        const outcomeData = [
            { name: currentMatch.team1.name, count: outcomeCounts.team1Win },
            { name: 'Draw', count: outcomeCounts.draw },
            { name: currentMatch.team2.name, count: outcomeCounts.team2Win },
        ];

        const scoreData = Object.entries(scoreCounts)
            .map(([score, count]) => ({ score, count }))
            .sort((a, b) => {
                const [a1, a2] = a.score.split('-').map(Number);
                const [b1, b2] = b.score.split('-').map(Number);
                if (a1 !== b1) {
                    return a1 - b1;
                }
                return a2 - b2;
            });

        return { outcomeData, scoreData };
    }, [currentMatch, predictions]);

    const updateLocalIndex = (idx: number) => {
        setLocalMatchIndex(idx);
        if (onMatchIndexChange) {
            onMatchIndexChange(idx);
        }
        try {
            const storageKey = `predictionWidgetState_${tournamentId}`;
            localStorage.setItem(storageKey, JSON.stringify({
                date: new Date().toDateString(),
                index: idx
            }));
        } catch (e) {
            // Ignore storage errors
        }
    };

    const handlePrev = () => updateLocalIndex(Math.max(0, localMatchIndex - 1));
    const handleNext = () => updateLocalIndex(Math.min(allMatches.length - 1, localMatchIndex + 1));

    if (tournamentNotFound) {
        return (
            <div className="h-full flex items-center justify-center p-4 text-center">
                <p className="text-yellow-400 text-sm">
                    The tournament associated with this widget could not be found. It may have been deleted. Please edit the widget to select a new tournament.
                </p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading Chart Data...</p></div>;
    }
    if (!tournamentId) {
        return <div className="h-full flex items-center justify-center p-4"><p className="text-slate-400 text-sm text-center">Please join a tournament or select one in the widget settings.</p></div>;
    }
    const isVisible = areSubmissionsClosed || userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
    if (!isVisible) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                <p className="text-slate-400 text-sm font-semibold">Data Hidden</p>
                <p className="text-slate-500 text-xs mt-1">This widget cannot be accessed until the prediction input period is closed.</p>
            </div>
        );
    }
     if (!currentMatch) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No matches found in this tournament.</p></div>;
    }

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            <div className="flex-shrink-0 border-b border-slate-700 pb-2 mb-2 relative" ref={dropdownRef}>
                <div className="flex justify-between items-center">
                    <button onClick={handlePrev} disabled={localMatchIndex === 0} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50">&lt;</button>
                    <div className="text-center cursor-pointer hover:bg-slate-700/50 p-1 rounded group flex-grow mx-2 transition-colors" onClick={() => setShowDropdown(!showDropdown)}>
                        <p className="font-bold text-white text-sm flex items-center justify-center gap-2">
                            {currentMatch.team1.flag} {currentMatch.team1.name} vs {currentMatch.team2.flag} {currentMatch.team2.name}
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </p>
                        <p className="text-slate-400 text-xs">
                            {new Date(currentMatch.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                    </div>
                    <button onClick={handleNext} disabled={localMatchIndex === allMatches.length - 1} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50">&gt;</button>
                </div>

                {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-50 max-h-[185px] overflow-y-auto custom-scrollbar">
                        {allMatches.map((match, idx) => (
                            <div 
                                key={match.id} 
                                className={`p-2 cursor-pointer border-b border-slate-700 last:border-0 hover:bg-slate-600 flex justify-between items-center transition-colors ${idx === localMatchIndex ? 'bg-slate-700/50 border-l-4 border-l-blue-500' : 'pl-3'}`}
                                onClick={() => {
                                    updateLocalIndex(idx);
                                    setShowDropdown(false);
                                }}
                            >
                                <span className="text-sm text-white font-medium truncate pr-2">
                                    {match.team1.flag} {match.team1.name} <span className="text-slate-500 text-xs mx-1">vs</span> {match.team2.name} {match.team2.flag}
                                </span>
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                    {new Date(match.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-grow flex flex-col sm:flex-row gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                    <h5 className="text-center font-bold text-slate-400 mb-1">Predicted Outcome</h5>
                    <div className="flex-grow">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.outcomeData} layout="horizontal" margin={{ top: 1, right: 15, left: -35, bottom: 1 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="category" dataKey="name" stroke="#FFFFFF" tick={{ fontSize: 10 }} interval={0} />
                                <YAxis type="number" stroke="#FFFFFF" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                <Bar dataKey="count" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                     <h5 className="text-center font-bold text-slate-400 mb-1">Exact Score Guesses</h5>
                    <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.scoreData} layout="horizontal" margin={{ top: 1, right: 15, left: -35, bottom: 1 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="category" dataKey="score" stroke="#FFFFFF" tick={{ fontSize: 10 }} />
                                <YAxis type="number" stroke="#FFFFFF" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                <Bar dataKey="count" fill="#6366f1" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictionChartWidget;
