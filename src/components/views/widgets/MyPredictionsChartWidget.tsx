// src/components/views/widgets/MyPredictionsChartWidget.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, UserProfile } from '../../../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MyPredictionsChartWidgetProps {
    userProfile: UserProfile;
    tournamentId?: string;
    selectedUserId?: string;
    onSelectedUserChange: (userId: string) => void;
    setRefreshFunc: (func: () => void) => void;
}

const COLORS = {
    correct: '#22c55e', // green-500
    wrong: '#ef4444',   // red-500
    notYet: '#64748b', // slate-500
};

const MyPredictionsChartWidget = ({ userProfile, tournamentId, selectedUserId, onSelectedUserChange, setRefreshFunc }: MyPredictionsChartWidgetProps) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [predictions, setPredictions] = useState<UserPredictions | null>(null);
    const [allParticipants, setAllParticipants] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = userProfile.role === 'admin' || userProfile.role === 'superadmin';
    const targetUserId = isAdmin ? selectedUserId : userProfile.uid;

    const fetchData = useCallback(async () => {
        if (!tournamentId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        // Fetch tournament data
        const tourneyRef = doc(db, "tournaments", tournamentId);
        const tourneySnap = await getDoc(tourneyRef);
        if (tourneySnap.exists()) {
            const tourneyData = { id: tourneySnap.id, ...tourneySnap.data() } as Tournament;
            setTournament(tourneyData);

            // If admin, fetch all participant profiles for the dropdown
            if (isAdmin && tourneyData.participants && tourneyData.participants.length > 0) {
                const userPromises = tourneyData.participants.map(uid => getDoc(doc(db, 'users', uid)));
                const userDocs = await Promise.all(userPromises);
                const participantProfiles = userDocs
                    .filter(d => d.exists())
                    .map(d => d.data() as UserProfile)
                    .sort((a,b) => a.name.localeCompare(b.name));
                setAllParticipants(participantProfiles);
            }
        }

        // Fetch the specific user's predictions
        if (targetUserId) {
            const predRef = doc(db, "predictions", `${tournamentId}_${targetUserId}`);
            const predSnap = await getDoc(predRef);
            if (predSnap.exists()) {
                setPredictions(predSnap.data() as UserPredictions);
            } else {
                setPredictions(null);
            }
        }
        
        setIsLoading(false);
    }, [tournamentId, targetUserId, isAdmin]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);

    const chartData = useMemo(() => {
        const outcomeStats = { correct: 0, wrong: 0, notYet: 0 };
        const scoreStats = { correct: 0, wrong: 0, notYet: 0 };

        if (!tournament || !predictions) {
            const matchCount = (tournament?.matches?.length || 0) + (tournament?.knockoutMatches?.length || 0);
            outcomeStats.notYet = matchCount;
            scoreStats.notYet = matchCount;
        } else {
            const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
            allMatches.forEach(match => {
                const pred = predictions.matchPredictions[match.id];
                const hasResult = typeof match.team1Score === 'number';

                if (!hasResult) {
                    outcomeStats.notYet++;
                    scoreStats.notYet++;
                } else if (!pred || pred.team1Score < 0) {
                    outcomeStats.wrong++;
                    scoreStats.wrong++;
                } else {
                    const actualOutcome = Math.sign(match.team1Score! - match.team2Score!);
                    const predictedOutcome = Math.sign(pred.team1Score - pred.team2Score);
                    
                    if (actualOutcome === predictedOutcome) {
                        outcomeStats.correct++;
                    } else {
                        outcomeStats.wrong++;
                    }

                    if (match.team1Score === pred.team1Score && match.team2Score === pred.team2Score) {
                        scoreStats.correct++;
                    } else {
                        scoreStats.wrong++;
                    }
                }
            });
        }

        return {
            outcomeData: [
                { name: 'Correct', value: outcomeStats.correct },
                { name: 'Wrong', value: outcomeStats.wrong },
                { name: 'Not Yet', value: outcomeStats.notYet },
            ].filter(d => d.value > 0),
            scoreData: [
                { name: 'Correct', value: scoreStats.correct },
                { name: 'Wrong', value: scoreStats.wrong },
                { name: 'Not Yet', value: scoreStats.notYet },
            ].filter(d => d.value > 0),
        };
    }, [tournament, predictions]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading Chart Data...</p></div>;
    }
    if (!tournamentId) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">Please configure this widget.</p></div>;
    }

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            {isAdmin && (
                <div className="flex-shrink-0 mb-2">
                    <select
                        value={selectedUserId || ''}
                        onChange={e => onSelectedUserChange(e.target.value)}
                        className="w-full bg-slate-700 text-xs text-white p-1 border border-slate-600 focus:outline-none"
                    >
                        <option value="">-- Select a Participant --</option>
                        {allParticipants.map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}
                    </select>
                </div>
            )}
            <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-hidden">
                <div className="flex flex-col items-center">
                    <h5 className="font-bold text-slate-400 mb-1">Outcome Accuracy</h5>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={(entry) => entry.value}>
                                {chartData.outcomeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} itemStyle={{ color: '#cbd5e1' }}/>
                            <Legend iconSize={10} wrapperStyle={{fontSize: '10px'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                 <div className="flex flex-col items-center">
                    <h5 className="font-bold text-slate-400 mb-1">Score Accuracy</h5>
                    <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={chartData.scoreData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={(entry) => entry.value}>
                                {chartData.scoreData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} itemStyle={{ color: '#cbd5e1' }}/>
                            <Legend iconSize={10} wrapperStyle={{fontSize: '10px'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default MyPredictionsChartWidget;
