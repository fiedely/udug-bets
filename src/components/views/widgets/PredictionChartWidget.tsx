// src/components/views/widgets/PredictionChartWidget.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, Match } from '../../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Flag from '../../common/Flag';

interface PredictionChartWidgetProps {
    tournamentId?: string;
    currentMatchIndex: number;
    onMatchIndexChange: (index: number) => void;
    setRefreshFunc: (func: () => void) => void;
}

const PredictionChartWidget = ({ tournamentId, currentMatchIndex, onMatchIndexChange, setRefreshFunc }: PredictionChartWidgetProps) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [predictions, setPredictions] = useState<UserPredictions[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const allMatches = useMemo(() => {
        if (!tournament) return [];
        return [...(tournament.matches || []), ...(tournament.knockoutMatches || [])]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [tournament]);

    const fetchData = useCallback(async () => {
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

    const currentMatch: Match | undefined = allMatches[currentMatchIndex];

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
            .sort((a, b) => b.count - a.count);

        return { outcomeData, scoreData };
    }, [currentMatch, predictions]);

    const handlePrev = () => onMatchIndexChange(Math.max(0, currentMatchIndex - 1));
    const handleNext = () => onMatchIndexChange(Math.min(allMatches.length - 1, currentMatchIndex + 1));

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading Chart Data...</p></div>;
    }
    if (!tournamentId || !tournament) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">Please configure this widget.</p></div>;
    }
     if (!currentMatch) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">No matches found in this tournament.</p></div>;
    }

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            <div className="flex-shrink-0 border-b border-slate-700 pb-2 mb-2">
                <div className="flex justify-between items-center">
                    <button onClick={handlePrev} disabled={currentMatchIndex === 0} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50">&lt;</button>
                    <div className="text-center">
                        <p className="font-bold text-white text-sm flex items-center justify-center gap-2">
                            <Flag code={currentMatch.team1.code} /> {currentMatch.team1.name} vs <Flag code={currentMatch.team2.code} /> {currentMatch.team2.name}
                        </p>
                        <p className="text-slate-400 text-xs">Match {currentMatch.matchNumber} &bull; {new Date(currentMatch.date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={handleNext} disabled={currentMatchIndex === allMatches.length - 1} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50">&gt;</button>
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
                <div className="flex flex-col">
                    <h5 className="text-center font-bold text-slate-400 mb-1">Predicted Outcome</h5>
                    <div className="flex-grow">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.outcomeData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 10 }} />
                                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                <Bar dataKey="count" fill="#38bdf8" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="flex flex-col">
                     <h5 className="text-center font-bold text-slate-400 mb-1">Exact Score Guesses</h5>
                    <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.scoreData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="score" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                <Bar dataKey="count" fill="#818cf8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictionChartWidget;
