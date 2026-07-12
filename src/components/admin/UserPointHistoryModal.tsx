import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserPredictions, PointRules, MatchStage, PointRule } from '../../types';
import { getEffectiveScores } from '../../utils/scoreCalculator';

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

            const { team1: effTeam1, team2: effTeam2 } = getEffectiveScores(match, tournament);
            if (pred && pred.team1Score > -1) {
                const actualOutcome = Math.sign(effTeam1 - effTeam2);
                const predictedOutcome = Math.sign(pred.team1Score - pred.team2Score);
                const stageKey = stageToRuleKeyMap[match.stage];
                const rules = (((stageKey && tournament.pointRules?.[stageKey]) ? tournament.pointRules[stageKey] : tournament.pointRules?.groupStage) as PointRule) || { correctOutcome: 0, correctScore: 0 };

                if (actualOutcome === predictedOutcome) {
                    outcomePts = rules.correctOutcome;
                    if (effTeam1 === pred.team1Score && effTeam2 === pred.team2Score) {
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
                actual: `${effTeam1} - ${effTeam2}`,
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
                            <div>
                                <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-slate-400 uppercase bg-slate-700 font-medium sticky top-0">
                                    <div className="col-span-3">Match</div>
                                    <div className="col-span-2 text-center">Predicted</div>
                                    <div className="col-span-2 text-center">Actual</div>
                                    <div className="col-span-2 text-right">Outcome Pts</div>
                                    <div className="col-span-1 text-right">Score Pts</div>
                                    <div className="col-span-2 text-right text-blue-300 font-bold">Accumulated Pts</div>
                                </div>
                                <div className="space-y-4 md:space-y-0 mt-4 md:mt-0">
                                    {historyData.rows.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-slate-500">No completed matches yet.</div>
                                    ) : (
                                        historyData.rows.map((row) => (
                                            <div key={row.id} className="bg-slate-900/50 md:bg-transparent border md:border-t md:border-b-0 border-slate-700 p-4 md:p-0 md:grid md:grid-cols-12 md:gap-4 md:px-4 md:py-3 items-center text-sm hover:bg-slate-700/50 transition-colors">
                                                <div className="col-span-3">
                                                    <div className="font-medium text-white">{row.matchLabel}</div>
                                                    <div className="text-[10px] text-slate-500">{row.stage}</div>
                                                </div>
                                                <div className="col-span-2 mt-2 md:mt-0 flex justify-between md:justify-center items-center">
                                                    <span className="md:hidden font-semibold text-slate-400">Predicted:</span>
                                                    <span className="font-mono text-white">{row.predicted}</span>
                                                </div>
                                                <div className="col-span-2 mt-2 md:mt-0 flex justify-between md:justify-center items-center">
                                                    <span className="md:hidden font-semibold text-slate-400">Actual:</span>
                                                    <span className="font-mono text-white">{row.actual}</span>
                                                </div>
                                                <div className="col-span-2 mt-2 md:mt-0 flex justify-between md:justify-end items-center">
                                                    <span className="md:hidden font-semibold text-slate-400">Outcome Pts:</span>
                                                    <span className="text-green-400">{row.outcomePts > 0 ? `+${row.outcomePts}` : '0'}</span>
                                                </div>
                                                <div className="col-span-1 mt-2 md:mt-0 flex justify-between md:justify-end items-center">
                                                    <span className="md:hidden font-semibold text-slate-400">Score Pts:</span>
                                                    <span className="text-green-400">{row.scorePts > 0 ? `+${row.scorePts}` : '0'}</span>
                                                </div>
                                                <div className="col-span-2 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-700 md:border-0 flex justify-between md:justify-end items-center">
                                                    <span className="md:hidden font-semibold text-slate-400">Accumulated:</span>
                                                    <span className="text-blue-300 font-bold text-base">{row.runningTotal}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
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
