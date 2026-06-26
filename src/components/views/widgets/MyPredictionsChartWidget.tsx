// src/components/views/widgets/MyPredictionsChartWidget.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    correct: '#22c55e',
    wrong: '#ef4444',
};

const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, value } = props;

    if (value === 0) {
        return null;
    }
    
    const RADIAN = Math.PI / 180;
    const percentage = Math.round(percent * 100);
    const labelText = `${value} (${percentage}%)`;

    const radius = outerRadius + 7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    const textAnchor = x > cx ? 'start' : 'end';

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize="10px"
            fontWeight="normal"
        >
            {labelText}
        </text>
    );
};


const MyPredictionsChartWidget = ({ userProfile, tournamentId, selectedUserId, onSelectedUserChange, setRefreshFunc }: MyPredictionsChartWidgetProps) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [predictions, setPredictions] = useState<UserPredictions | null>(null);
    const [allParticipants, setAllParticipants] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tournamentNotFound, setTournamentNotFound] = useState(false);

    const [selectedStage, setSelectedStage] = useState<string>('All Stages');

    const isAdmin = userProfile.role === 'admin' || userProfile.role === 'superadmin';
    const targetUserId = isAdmin ? selectedUserId : userProfile.uid;

    useEffect(() => {
        if (tournamentId) {
            try {
                const storedStage = localStorage.getItem(`myPredictionsChartStage_${tournamentId}`);
                if (storedStage) {
                    setSelectedStage(storedStage);
                }
                
                if (isAdmin) {
                    const storedUser = localStorage.getItem(`myPredictionsChartUser_${tournamentId}`);
                    if (storedUser && storedUser !== selectedUserId) {
                        onSelectedUserChange(storedUser);
                    }
                }
            } catch (e) {
                console.error("Failed to read from localStorage", e);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId, isAdmin]);

    const handleStageChange = (newStage: string) => {
        setSelectedStage(newStage);
        if (tournamentId) {
            try {
                localStorage.setItem(`myPredictionsChartStage_${tournamentId}`, newStage);
            } catch (e) {
                console.error("Failed to save stage to localStorage", e);
            }
        }
    };

    const fetchIdRef = useRef(0);

    const fetchData = useCallback(async () => {
        fetchIdRef.current += 1;
        const currentFetchId = fetchIdRef.current;

        setTournamentNotFound(false);
        if (!tournamentId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const tourneyRef = doc(db, "tournaments", tournamentId);
        const tourneySnap = await getDoc(tourneyRef);
        
        if (currentFetchId !== fetchIdRef.current) return;

        if (tourneySnap.exists()) {
            const tourneyData = { id: tourneySnap.id, ...tourneySnap.data() } as Tournament;
            setTournament(tourneyData);

            if (isAdmin && tourneyData.participants && tourneyData.participants.length > 0) {
                const userPromises = tourneyData.participants.map(uid => getDoc(doc(db, 'users', uid)));
                const userDocs = await Promise.all(userPromises);
                
                if (currentFetchId !== fetchIdRef.current) return;

                const participantProfiles = userDocs
                    .filter(d => d.exists())
                    .map(d => d.data() as UserProfile)
                    .sort((a,b) => a.name.localeCompare(b.name));
                setAllParticipants(participantProfiles);
            }
        } else {
            setTournamentNotFound(true);
            setTournament(null);
            setPredictions(null);
            setIsLoading(false);
            return;
        }

        if (targetUserId) {
            const predRef = doc(db, "predictions", `${tournamentId}_${targetUserId}`);
            const predSnap = await getDoc(predRef);
            
            if (currentFetchId !== fetchIdRef.current) return;

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

    const availableStages = useMemo(() => {
        if (!tournament) return ['All Stages'];
        const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
        const stages = new Set<string>();
        allMatches.forEach(m => {
            if (m.stage) stages.add(m.stage);
        });
        // Sort stages roughly by a typical order, or just alphabetical if we don't know the exact order.
        // The type MatchStage has known values, we can order them explicitly:
        const order = ["Group Stage", "Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Third Place Match", "Final"];
        const sortedStages = Array.from(stages).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.localeCompare(b);
        });
        return ['All Stages', ...sortedStages];
    }, [tournament]);

    const chartData = useMemo(() => {
        const outcomeStats = { correct: 0, wrong: 0 };
        const scoreStats = { correct: 0, wrong: 0 };

        if (!tournament || !predictions) {
            // No data or predictions, we just leave them at 0
        } else {
            const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
            const filteredMatches = selectedStage === 'All Stages' ? allMatches : allMatches.filter(m => m.stage === selectedStage);
            filteredMatches.forEach(match => {
                const pred = predictions.matchPredictions[match.id];
                const hasResult = typeof match.team1Score === 'number';

                if (!hasResult) {
                    // We only want to include games already played, so do nothing here
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
            ].filter(d => d.value > 0),
            scoreData: [
                { name: 'Correct', value: scoreStats.correct },
                { name: 'Wrong', value: scoreStats.wrong },
            ].filter(d => d.value > 0),
        };
    }, [tournament, predictions, selectedStage]);
    
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

    return (
        <div className="h-full flex flex-col text-slate-300 text-xs">
            {isAdmin && (
                <div className="flex-shrink-0 mb-2">
                    <select
                        value={selectedUserId || ''}
                        onChange={e => {
                            const newUserId = e.target.value;
                            onSelectedUserChange(newUserId);
                            if (tournamentId) {
                                try {
                                    localStorage.setItem(`myPredictionsChartUser_${tournamentId}`, newUserId);
                                } catch (err) {
                                    console.error("Failed to save to localStorage", err);
                                }
                            }
                        }}
                        className="w-full bg-slate-700 text-xs text-white p-1 border border-slate-600 focus:outline-none"
                    >
                        <option value="">-- Select a Participant --</option>
                        {allParticipants.map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}
                    </select>
                </div>
            )}
            <div className="flex-shrink-0 mb-2">
                <select
                    value={selectedStage}
                    onChange={e => handleStageChange(e.target.value)}
                    className="w-full bg-slate-700 text-xs text-white p-1 border border-slate-600 focus:outline-none"
                >
                    {availableStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
            </div>
            <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-hidden">
                {chartData.outcomeData.length === 0 && chartData.scoreData.length === 0 ? (
                    <div className="col-span-1 sm:col-span-2 flex items-center justify-center text-slate-500 italic">
                        Data not available yet
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center">
                            <h5 className="font-bold text-slate-400 mb-1">Outcome Accuracy</h5>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData.outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} label={renderCustomizedLabel} labelLine={false}>
                                        {chartData.outcomeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} itemStyle={{ color: '#cbd5e1' }}/>
                                    <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col items-center">
                            <h5 className="font-bold text-slate-400 mb-1">Score Accuracy</h5>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData.scoreData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45} label={renderCustomizedLabel} labelLine={false}>
                                        {chartData.scoreData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} itemStyle={{ color: '#cbd5e1' }}/>
                                    <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MyPredictionsChartWidget;
