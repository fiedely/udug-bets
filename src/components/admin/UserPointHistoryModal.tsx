import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, PointRules, MatchStage, PointRule } from '../../types';

interface UserPointHistoryModalProps {
    tournament: Tournament;
    userId: string;
    userName: string;
    onClose: () => void;
}

const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage",
    "Round of 32": "round32",
    "Round of 16": "round16",
    "Quarter-final": "quarterFinal",
    "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch",
    "Final": "final",
};

const UserPointHistoryModal = ({ tournament, userId, userName, onClose }: UserPointHistoryModalProps) => {
    const [predictions, setPredictions] = useState<UserPredictions | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPredictions = async () => {
            setIsLoading(true);
            try {
                const predRef = doc(db, "predictions", `${tournament.id}_${userId}`);
                const snap = await getDoc(predRef);
                if (snap.exists()) {
                    setPredictions(snap.data() as UserPredictions);
                }
            } catch (err) {
                console.error("Error fetching predictions:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPredictions();
    }, [tournament.id, userId]);

    const historyData = useMemo(() => {
        if (!predictions) return null;

        const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])]
            .filter(m => typeof m.team1Score === 'number') // Only completed matches
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningTotal = 0;
        const rows = allMatches.map(match => {
            const pred = predictions.matchPredictions[match.id];
            let outcomePts = 0;
            let scorePts = 0;

            if (pred && pred.team1Score > -1) {
                const actualOutcome = Math.sign(match.team1Score! - match.team2Score!);
                const predictedOutcome = Math.sign(pred.team1Score - pred.team2Score);
                const stageKey = stageToRuleKeyMap[match.stage];
                const rules = (((stageKey && tournament.pointRules?.[stageKey]) ? tournament.pointRules[stageKey] : tournament.pointRules?.groupStage) as PointRule) || { correctOutcome: 0, correctScore: 0 };

                if (actualOutcome === predictedOutcome) {
                    outcomePts = rules.correctOutcome;
                    if (match.team1Score === pred.team1Score && match.team2Score === pred.team2Score) {
                        scorePts = rules.correctScore;
                    }
                }
            }

            const matchTotal = outcomePts + scorePts;
            runningTotal += matchTotal;

            return {
                id: match.id,
                stage: match.stage,
                matchLabel: `${match.team1.name} vs ${match.team2.name}`,
                predicted: pred && pred.team1Score > -1 ? `${pred.team1Score} - ${pred.team2Score}` : 'N/A',
                actual: `${match.team1Score} - ${match.team2Score}`,
                outcomePts,
                scorePts,
                matchTotal,
                runningTotal
            };
        });

        let championBonus = 0;
        let championTeamName = '-';
        if (predictions.championPrediction) {
            championTeamName = tournament.teams?.find(t => t.code === predictions.championPrediction)?.name || predictions.championPrediction;
            if (tournament.champion && tournament.champion === predictions.championPrediction) {
                championBonus = tournament.pointRules?.championBonus || 0;
                runningTotal += championBonus;
            }
        }

        return {
            rows,
            championPick: championTeamName,
            championBonus,
            finalTotal: runningTotal,
        };
    }, [tournament, predictions]);

    return (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-blue-400">Point History: {userName}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    {isLoading ? (
                        <p className="text-center text-slate-400 py-8">Loading history...</p>
                    ) : !historyData ? (
                        <p className="text-center text-slate-400 py-8">No predictions found for this user.</p>
                    ) : (
                        <div className="space-y-4">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-700 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Match</th>
                                        <th scope="col" className="px-4 py-3 text-center">Predicted</th>
                                        <th scope="col" className="px-4 py-3 text-center">Actual</th>
                                        <th scope="col" className="px-4 py-3 text-right">Outcome Pts</th>
                                        <th scope="col" className="px-4 py-3 text-right">Score Pts</th>
                                        <th scope="col" className="px-4 py-3 text-right text-blue-300 font-bold">Accumulated Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyData.rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No completed matches yet.</td>
                                        </tr>
                                    ) : (
                                        historyData.rows.map((row) => (
                                            <tr key={row.id} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-white">{row.matchLabel}</div>
                                                    <div className="text-[10px] text-slate-500">{row.stage}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono">{row.predicted}</td>
                                                <td className="px-4 py-3 text-center font-mono">{row.actual}</td>
                                                <td className="px-4 py-3 text-right text-green-400">{row.outcomePts > 0 ? `+${row.outcomePts}` : '0'}</td>
                                                <td className="px-4 py-3 text-right text-green-400">{row.scorePts > 0 ? `+${row.scorePts}` : '0'}</td>
                                                <td className="px-4 py-3 text-right text-blue-300 font-bold text-base">{row.runningTotal}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            <div className="bg-slate-700/30 border border-slate-600 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div>
                                    <h4 className="text-slate-400 text-sm">Champion Prediction</h4>
                                    <div className="text-xl font-bold text-white flex items-center gap-2">
                                        🏆 {historyData.championPick}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-slate-400 text-sm">Champion Bonus</div>
                                    <div className={`text-2xl font-bold ${historyData.championBonus > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                                        +{historyData.championBonus} Pts
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pt-4 pb-2 border-t border-slate-700">
                                <span className="text-slate-400 mr-4">Final Total Points:</span>
                                <span className="text-3xl font-bold text-blue-400">{historyData.finalTotal}</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-700 text-right bg-slate-900/50">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded text-sm transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserPointHistoryModal;
