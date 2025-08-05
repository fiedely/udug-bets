// src/components/admin/AllPredictionsView.tsx

import { useState, useEffect, useRef, Fragment } from 'react';
import { db, functions } from '../../firebaseConfig'; // Import functions
import { httpsCallable } from 'firebase/functions'; // Import httpsCallable
import { doc, getDoc } from 'firebase/firestore'; // Removed unused collection, getDocs, query, where
import type { Tournament, UserProfile, UserPredictions, Match, Team, PointRule, PointRules, MatchStage } from '../../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AllPredictionsViewProps {
    tournament: Tournament;
    onBack: () => void;
}

interface EnrichedMatch extends Match {
    participantPredictions: {
        userId: string;
        prediction?: { team1Score: number; team2Score: number; };
        points: number;
    }[];
}

const PredictionCell = ({ actual, prediction }: { actual?: number, prediction?: number }) => {
    if (typeof prediction !== 'number' || prediction < 0) {
        return <span className="text-slate-500">-</span>;
    }
    if (typeof actual === 'number') {
        const isCorrect = actual === prediction;
        return <span className={isCorrect ? 'text-green-400 font-bold' : ''}>{prediction}</span>;
    }
    return <span>{prediction}</span>;
};

const stageToRuleKeyMap: { [key in MatchStage]?: keyof PointRules } = {
    "Group Stage": "groupStage", "Round of 32": "round32", "Round of 16": "round16",
    "Quarter-final": "quarterFinal", "Semi-final": "semiFinal",
    "Third Place Match": "thirdPlaceMatch", "Final": "final",
};


const AllPredictionsView = ({ tournament, onBack }: AllPredictionsViewProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [enrichedMatches, setEnrichedMatches] = useState<EnrichedMatch[]>([]);
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [championPredictions, setChampionPredictions] = useState<{ userId: string; team?: Team; points: number }[]>([]);
    const tableRef = useRef<HTMLTableElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllData = async () => {
            setError(null);
            if (!tournament.participants || tournament.participants.length === 0) {
                setIsLoading(false);
                return;
            }

            try {
                const getTournamentParticipants = httpsCallable(functions, 'getTournamentParticipants');
                const result = await getTournamentParticipants({ tournamentId: tournament.id });
                const participantProfiles = (result.data as UserProfile[]).sort((a, b) => a.name.localeCompare(b.name));
                setParticipants(participantProfiles);

                const predictionPromises = tournament.participants.map(userId =>
                    getDoc(doc(db, "predictions", `${tournament.id}_${userId}`))
                );
                const predictionSnapshots = await Promise.all(predictionPromises);
                
                const userPredictionsMap = new Map<string, UserPredictions>();
                predictionSnapshots.forEach(snap => {
                    if (snap.exists()) {
                        const data = snap.data() as UserPredictions;
                        userPredictionsMap.set(data.userId, data);
                    }
                });

                const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
                const pointRules = tournament.pointRules;

                const enriched = allMatches.map(match => {
                    const participantPredictions = participantProfiles.map(participant => {
                        const predictionDoc = userPredictionsMap.get(participant.uid);
                        const prediction = predictionDoc?.matchPredictions[match.id];
                        let points = 0;

                        if (prediction && pointRules && typeof match.team1Score === 'number' && typeof match.team2Score === 'number') {
                            const actualOutcome = Math.sign(match.team1Score - match.team2Score);
                            const predictedOutcome = Math.sign(prediction.team1Score - prediction.team2Score);
                            const stageKey = stageToRuleKeyMap[match.stage];
                            const rules = (stageKey && pointRules?.[stageKey]) ? (pointRules[stageKey] as PointRule) : pointRules.groupStage;
                            if (actualOutcome === predictedOutcome) {
                                points += rules.correctOutcome;
                                if (match.team1Score === prediction.team1Score && match.team2Score === prediction.team2Score) {
                                    points += rules.correctScore;
                                }
                            }
                        }
                        return { userId: participant.uid, prediction, points };
                    });
                    return { ...match, participantPredictions };
                });

                setEnrichedMatches(enriched);

                const champPredictions = participantProfiles.map(p => {
                    const predictionDoc = userPredictionsMap.get(p.uid);
                    const championCode = predictionDoc?.championPrediction;
                    const team = tournament.teams?.find(t => t.code === championCode);
                    let points = 0;
                    if (pointRules?.championBonus && tournament.champion && tournament.champion === championCode) {
                        points = pointRules.championBonus;
                    }
                    return { userId: p.uid, team, points };
                });
                setChampionPredictions(champPredictions);

            } catch (err: any) {
                console.error("Error fetching participant data:", err);
                setError(err.message || "An error occurred while fetching data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [tournament]);

    const handleExportPDF = async () => {
        const table = tableRef.current;
        if (!table) return;

        setIsGeneratingPdf(true);
        const canvas = await html2canvas(table, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;
        const contentWidth = pdfWidth - margin * 2;
        const ratio = contentWidth / imgWidth;
        const totalPDFHeight = imgHeight * ratio;

        let heightLeft = totalPDFHeight;
        let position = 0;

        pdf.setFontSize(20);
        pdf.text(`${tournament.name} - All Predictions`, margin, margin);
        pdf.addImage(imgData, 'PNG', margin, 60, contentWidth, totalPDFHeight, undefined, 'MEDIUM');
        heightLeft -= (pdfHeight - 60 - margin);

        while (heightLeft > 0) {
            position -= (pdfHeight - margin * 2);
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, totalPDFHeight, undefined, 'MEDIUM');
            heightLeft -= (pdfHeight - margin * 2);
        }
        
        pdf.save(`${tournament.name.replace(/ /g, '_')}_predictions.pdf`);
        setIsGeneratingPdf(false);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-6 md:p-8 flex flex-col h-[85vh] w-full">
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{tournament.name}</h2>
                        <p className="text-blue-400">All Participant Predictions</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleExportPDF} disabled={isGeneratingPdf} className="px-4 py-2 bg-green-600 hover:bg-green-500 font-semibold text-white text-sm disabled:bg-green-800 disabled:cursor-not-allowed">
                            {isGeneratingPdf ? 'Generating...' : 'Download as PDF'}
                        </button>
                        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300 flex items-center whitespace-nowrap">
                            &larr; Back
                        </button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                 <div className="flex-grow flex items-center justify-center"><svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
            ) : error ? (
                <div className="text-center p-8 bg-red-900/20 border border-red-700"><p className="text-red-400">Error: {error}</p></div>
            ) : participants.length === 0 ? (
                <div className="text-center p-8 bg-slate-900/50 border border-slate-700"><p className="text-slate-300">This tournament has no participants.</p></div>
            ) : (
                <div ref={scrollContainerRef} className="overflow-auto border border-slate-700 flex-grow min-h-0">
                    <table ref={tableRef} className="w-full text-sm text-left text-slate-300 border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th scope="col" className="p-3 font-semibold text-slate-300 sticky left-0 bg-slate-700 z-30 w-48">Match</th>
                                {participants.map(p => (
                                    <th key={p.uid} scope="col" colSpan={2} className="p-3 font-semibold text-center w-32 bg-slate-700 border-l border-slate-600">{p.name}</th>
                                ))}
                            </tr>
                            <tr>
                                <th scope="col" className="p-2 text-xs text-slate-400 sticky left-0 bg-slate-700 z-30 w-48"></th>
                                {participants.map(p => (
                                    <Fragment key={p.uid}>
                                        <th scope="col" className="p-2 text-xs text-slate-400 text-center font-normal bg-slate-700 border-l border-slate-600">Prediction</th>
                                        <th scope="col" className="p-2 text-xs text-slate-400 text-center font-normal w-12 bg-slate-700">Points</th>
                                    </Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-slate-800">
                            {enrichedMatches.map((match) => (
                                <tr key={match.id} className="border-b border-slate-700">
                                    <td className="p-3 font-medium text-white sticky left-0 bg-slate-800 z-10 w-48">
                                        {match.team1.flag} {match.team1.name} vs {match.team2.flag} {match.team2.name}
                                        <div className="text-xs text-slate-400">Actual: {typeof match.team1Score === 'number' ? `${match.team1Score} - ${match.team2Score}` : 'Not Played'}</div>
                                    </td>
                                    {match.participantPredictions.map(p => (
                                        <Fragment key={p.userId}>
                                            <td className="p-3 text-center font-mono border-l border-slate-700">
                                                <PredictionCell actual={match.team1Score} prediction={p.prediction?.team1Score} />
                                                {' - '}
                                                <PredictionCell actual={match.team2Score} prediction={p.prediction?.team2Score} />
                                            </td>
                                            <td className="p-3 text-center font-mono text-blue-400 w-12">{p.points}</td>
                                        </Fragment>
                                    ))}
                                </tr>
                            ))}
                            <tr className="border-t-2 border-blue-500 bg-slate-700">
                                <td className="p-3 font-bold text-white sticky left-0 bg-slate-700 z-10 w-48">
                                    Champion
                                    <div className="text-xs text-slate-400">Actual: {tournament.champion ? tournament.teams?.find(t => t.code === tournament.champion)?.name : 'TBD'}</div>
                                </td>
                                {championPredictions.map(p => (
                                    <Fragment key={p.userId}>
                                        <td className="p-3 text-center text-xs border-l border-slate-600">
                                            {p.team ? `${p.team.flag} ${p.team.name}` : <span className="text-slate-500">-</span>}
                                        </td>
                                        <td className="p-3 text-center font-mono text-blue-400 w-12">{p.points}</td>
                                    </Fragment>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AllPredictionsView;
