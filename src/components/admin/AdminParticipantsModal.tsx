import { useState, useEffect, useMemo } from 'react';
import { db, functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserProfile, UserPredictions } from '../../types';

interface AdminParticipantsModalProps {
    tournament: Tournament;
    onClose: () => void;
}

const STAGES_TO_DISPLAY: { stage: string; label: string }[] = [
    { stage: 'Champ & Group', label: 'Champ & Group' },
    { stage: 'Round of 32', label: 'Ro32' },
    { stage: 'Round of 16', label: 'Ro16' },
    { stage: 'Quarter-final', label: 'Quarter' },
    { stage: 'Semi-final', label: 'Semi' },
    { stage: 'Final', label: 'Final' },
];

const AdminParticipantsModal = ({ tournament, onClose }: AdminParticipantsModalProps) => {
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [predictions, setPredictions] = useState<Record<string, UserPredictions>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'not-complete'>('all');
    const [filterStage, setFilterStage] = useState<string>('all');

    const allMatches = useMemo(() => {
        return [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
    }, [tournament]);

    const applicableStages = useMemo(() => {
        const stages = new Set<string>();
        stages.add('Champion');
        allMatches.forEach(m => stages.add(m.stage));
        if (tournament.hasThirdPlaceMatch) stages.add('Third Place Match');
        return stages;
    }, [allMatches, tournament.hasThirdPlaceMatch]);

    useEffect(() => {
        const fetchData = async () => {
            if (!tournament.participants || tournament.participants.length === 0) {
                setIsLoading(false);
                return;
            }
            
            try {
                // Fetch Users
                const getParticipants = httpsCallable<{tournamentId: string}, UserProfile[]>(functions, 'getTournamentParticipants');
                const result = await getParticipants({ tournamentId: tournament.id });
                const users = result.data;
                
                // Sort users alphabetically by name
                users.sort((a, b) => a.name.localeCompare(b.name));
                
                setParticipants(users);

                // Fetch Predictions
                const predPromises = users.map(u => getDoc(doc(db, "predictions", `${tournament.id}_${u.uid}`)));
                const predSnapshots = await Promise.all(predPromises);
                
                const predsMap: Record<string, UserPredictions> = {};
                predSnapshots.forEach(snap => {
                    if (snap.exists()) {
                        const data = snap.data() as UserPredictions;
                        predsMap[data.userId] = data;
                    }
                });
                setPredictions(predsMap);
            } catch (err: any) {
                console.error("Error fetching participants data:", err);
                setError("Failed to load participants and predictions.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [tournament]);

    const getStageStatus = (userId: string, stage: string): 'complete' | 'incomplete' | 'none' | 'na' => {
        if (stage === 'Champ & Group') {
            const champStatus = getStageStatus(userId, 'Champion');
            const groupStatus = getStageStatus(userId, 'Group Stage');
            if (champStatus === 'na' && groupStatus === 'na') return 'na';
            if (champStatus === 'complete' && groupStatus === 'complete') return 'complete';
            if (champStatus === 'none' && groupStatus === 'none') return 'none';
            return 'incomplete';
        }

        if (!applicableStages.has(stage) && stage !== 'Round of 32' && stage !== 'Round of 16') {
            return 'na';
        }
        if (stage !== 'Champion' && !applicableStages.has(stage)) {
            return 'na';
        }

        const userPred = predictions[userId];

        if (stage === 'Champion') {
            return userPred?.championPrediction ? 'complete' : 'none';
        }

        let stageMatches = allMatches.filter(m => m.stage === stage);
        if (stage === 'Final' && tournament.hasThirdPlaceMatch) {
            const thirdPlaceMatch = allMatches.find(m => m.stage === 'Third Place Match');
            if (thirdPlaceMatch) stageMatches.push(thirdPlaceMatch);
        }

        if (stageMatches.length === 0) return 'na';

        const submittedCount = stageMatches.reduce((count, match) => {
            const pred = userPred?.matchPredictions?.[match.id];
            if (pred && pred.team1Score > -1 && pred.team2Score > -1) {
                return count + 1;
            }
            return count;
        }, 0);

        if (submittedCount === 0) return 'none';
        if (submittedCount < stageMatches.length) return 'incomplete';
        return 'complete';
    };

    const renderStatusIcon = (status: 'complete' | 'incomplete' | 'none' | 'na') => {
        if (status === 'na') return <span className="text-slate-600">-</span>;
        if (status === 'complete') return <span className="text-green-500">✅</span>;
        if (status === 'incomplete') return <span className="text-yellow-500">⚠️</span>;
        return <span className="text-red-500">❌</span>;
    };

    const participantsWithStatus = useMemo(() => {
        return participants.map(user => {
            let overallStatus: 'complete' | 'incomplete' | 'none' = 'incomplete';

            if (filterStage !== 'all') {
                const s = getStageStatus(user.uid, filterStage);
                if (s === 'na') overallStatus = 'none'; // fallback
                else overallStatus = s;
            } else {
                let allComplete = true;
                let allNone = true;
                let hasApplicable = false;

                STAGES_TO_DISPLAY.forEach(stage => {
                    const s = getStageStatus(user.uid, stage.stage);
                    if (s !== 'na') {
                        hasApplicable = true;
                        if (s !== 'complete') allComplete = false;
                        if (s !== 'none') allNone = false;
                    }
                });

                if (!hasApplicable || allNone) overallStatus = 'none';
                else if (allComplete) overallStatus = 'complete';
            }

            return { ...user, overallStatus };
        });
    }, [participants, getStageStatus, filterStage]);

    const summary = useMemo(() => {
        return {
            total: participantsWithStatus.length,
            complete: participantsWithStatus.filter(p => p.overallStatus === 'complete').length,
            notComplete: participantsWithStatus.filter(p => p.overallStatus === 'incomplete' || p.overallStatus === 'none').length,
        };
    }, [participantsWithStatus]);

    const filteredParticipants = useMemo(() => {
        if (filterStatus === 'all') return participantsWithStatus;
        if (filterStatus === 'complete') return participantsWithStatus.filter(p => p.overallStatus === 'complete');
        return participantsWithStatus.filter(p => p.overallStatus === 'incomplete' || p.overallStatus === 'none');
    }, [participantsWithStatus, filterStatus]);

    return (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 border-b border-slate-700 bg-slate-900/50 gap-2">
                    <div className="flex-grow w-full flex justify-between items-center sm:block">
                        <div>
                            <h3 className="text-lg font-bold text-blue-400 leading-tight">Prediction Completeness Report</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">{tournament.name}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none sm:hidden">&times;</button>
                    </div>
                    
                    {!isLoading && !error && participants.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                            <div className="flex flex-wrap sm:flex-nowrap gap-x-3 gap-y-1 text-[10px] font-semibold bg-slate-800 p-1.5 rounded border border-slate-700 w-full sm:w-auto justify-center">
                                <span className="text-white whitespace-nowrap">Total: {summary.total}</span>
                                <span className="text-green-400 whitespace-nowrap">✅ {summary.complete}</span>
                                <span className="text-red-400 whitespace-nowrap">❌ Not Complete: {summary.notComplete}</span>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select 
                                    value={filterStage}
                                    onChange={(e) => setFilterStage(e.target.value as any)}
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white w-full sm:w-auto"
                                >
                                    <option value="all">All Stages</option>
                                    {STAGES_TO_DISPLAY.map(stage => {
                                        if (getStageStatus(participants[0]?.uid, stage.stage) !== 'na') {
                                            return <option key={stage.stage} value={stage.stage}>{stage.label}</option>;
                                        }
                                        return null;
                                    })}
                                </select>
                                <select 
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as any)}
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white w-full sm:w-auto"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="complete">Complete Only</option>
                                    <option value="not-complete">Not Complete Only</option>
                                </select>
                            </div>
                        </div>
                    )}
                    <button onClick={onClose} className="hidden sm:block text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 flex-grow overflow-x-auto overflow-y-auto">
                    {isLoading ? (
                        <p className="text-center text-slate-400 py-8">Loading report data...</p>
                    ) : error ? (
                        <p className="text-center text-red-400 py-8">{error}</p>
                    ) : filteredParticipants.length === 0 ? (
                        <p className="text-center text-slate-400 py-8">No participants matching this filter.</p>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-900/50 text-slate-400 text-[10px]">
                                <tr>
                                    <th className="px-2 py-1 font-semibold border-b border-slate-700 w-auto">Participant</th>
                                    {STAGES_TO_DISPLAY.map(stage => {
                                        if (filterStage !== 'all' && filterStage !== stage.stage) return null;
                                        if (getStageStatus(participants[0]?.uid, stage.stage) !== 'na') {
                                            return <th key={stage.stage} className="px-1 py-1 font-semibold text-center border-b border-slate-700 w-20 min-w-[5rem]">{stage.label}</th>;
                                        }
                                        return null;
                                    })}
                                    <th className="w-full border-b border-slate-700"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredParticipants.map(user => (
                                    <tr key={user.uid} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                        <td className="px-2 py-0.5 flex items-center gap-2">
                                            {user.avatarUrl ? (
                                                <img loading="lazy" decoding="async" src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full transform-gpu object-cover border border-slate-600" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full transform-gpu bg-slate-600 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                <span className="font-semibold text-slate-200">{user.name}</span>
                                                <span className="text-slate-500 ml-1">| {user.email}</span>
                                            </div>
                                        </td>
                                        {STAGES_TO_DISPLAY.map(stage => {
                                            if (filterStage !== 'all' && filterStage !== stage.stage) return null;
                                            const status = getStageStatus(user.uid, stage.stage);
                                            if (status !== 'na') {
                                                return (
                                                    <td key={stage.stage} className="px-1 py-0.5 text-center text-xs">
                                                        {renderStatusIcon(status)}
                                                    </td>
                                                );
                                            }
                                            return null;
                                        })}
                                        <td className="w-full"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-2 px-4 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center text-[10px] text-slate-400">
                    <span>Legend: ✅ Complete &nbsp;|&nbsp; ⚠️ Incomplete &nbsp;|&nbsp; ❌ Not Submitted</span>
                    <button onClick={onClose} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded font-semibold text-xs">Close</button>
                </div>
            </div>
        </div>
    );
};

export default AdminParticipantsModal;
