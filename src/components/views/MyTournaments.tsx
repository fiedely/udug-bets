// src/components/views/MyTournaments.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Tournament, UserProfile, UserPredictions, MatchStage } from '../../types';
import TournamentDetails from './TournamentDetails';
import AllPredictionsView from '../admin/AllPredictionsView';
import cramorantImage from '../../assets/delz-cramorant.png';

interface MyTournamentsProps {
    userProfile: UserProfile | null;
    onEnterPredictions: (tournament: Tournament) => void;
}

const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const StatusLight = ({ isApplicable, isOn }: { isApplicable: boolean, isOn: boolean }) => {
    let lightClass = "bg-slate-600";
    if (isApplicable && isOn) {
        lightClass = "bg-green-500 glow-green";
    } else if (!isApplicable) {
        lightClass = "bg-slate-700";
    }
    return <span className={`w-3 h-3 ${lightClass}`}></span>;
};

const SubmissionStatus = ({ tournament, predictions, stage, isApplicable }: { tournament: Tournament, predictions: UserPredictions | null, stage: MatchStage | 'Champion', isApplicable: boolean }) => {
    if (!isApplicable) {
        return <span className="text-xs text-slate-500">N/A</span>;
    }
    
    if (stage === 'Champion') {
        const status = predictions?.championPrediction ? 'Complete' : 'Not Submitted';
        const color = status === 'Complete' ? 'text-green-400' : 'text-slate-500';
        return <span className={`text-xs ${color}`}>{status}</span>;
    }

    const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
    let stageMatches = allMatches.filter(m => m.stage === stage);
    
    if (stage === 'Final' && tournament.hasThirdPlaceMatch) {
        const thirdPlaceMatch = allMatches.find(m => m.stage === 'Third Place Match');
        if (thirdPlaceMatch) stageMatches.push(thirdPlaceMatch);
    }
    if (stage === 'Third Place Match') return null;

    if (stageMatches.length === 0) return <span className="text-xs text-slate-500">N/A</span>;

    const submittedCount = stageMatches.reduce((count, match) => {
        const pred = predictions?.matchPredictions[match.id];
        if (pred && pred.team1Score > -1 && pred.team2Score > -1) {
            return count + 1;
        }
        return count;
    }, 0);

    if (submittedCount === 0) return <span className="text-xs text-slate-500">Not Submitted</span>;
    if (submittedCount < stageMatches.length) return <span className="text-xs text-yellow-400">Incomplete</span>;
    return <span className="text-xs text-green-400">Complete</span>;
};


const MyTournaments = ({ userProfile, onEnterPredictions }: MyTournamentsProps) => {
    const [joinedTournaments, setJoinedTournaments] = useState<Tournament[]>([]);
    const [userPredictions, setUserPredictions] = useState<Record<string, UserPredictions>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [viewingTournament, setViewingTournament] = useState<Tournament | null>(null);
    const [viewingAllPredictionsFor, setViewingAllPredictionsFor] = useState<Tournament | null>(null);

    if (userProfile?.role === 'admin' || userProfile?.role === 'superadmin') {
        return (
            <div className="bg-slate-800 border border-slate-700 p-8 max-w-lg mx-auto text-center">
                <h2 className="text-xl font-bold text-blue-400 mb-4">Admins Cannot Access My Tournaments view</h2>
                <p className="text-slate-300 mb-6">
                    This page is for participants. But don't be sad, here is a picture of Cramoly the Cramorant to cheer you up!
                </p>
                <img 
                    src={cramorantImage} 
                    alt="A cheerful Cramorant" 
                    className="mx-auto w-48 h-48 object-contain"
                />
            </div>
        );
    }

    useEffect(() => {
        const fetchAllData = async () => {
            if (!userProfile) { setIsLoading(false); return; }
            setIsLoading(true);

            const tournamentsRef = collection(db, 'tournaments');
            const q = query(tournamentsRef, where('participants', 'array-contains', userProfile.uid));
            const tourneySnapshot = await getDocs(q);
            const tournamentsList = tourneySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, ...data,
                    startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
                    endDate: data.endDate ? (data.endDate as Timestamp).toDate() : undefined,
                } as Tournament;
            });
            setJoinedTournaments(tournamentsList);

            const predictionPromises = tournamentsList.map(t => getDoc(doc(db, "predictions", `${t.id}_${userProfile.uid}`)));
            const predictionSnapshots = await Promise.all(predictionPromises);
            
            const predictionsMap: Record<string, UserPredictions> = {};
            predictionSnapshots.forEach(snap => {
                if (snap.exists()) {
                    const data = snap.data() as UserPredictions;
                    predictionsMap[data.tournamentId] = data;
                }
            });
            setUserPredictions(predictionsMap);
            setIsLoading(false);
        };
        fetchAllData();
    }, [userProfile]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
        );
    }
    
    if (viewingAllPredictionsFor) {
        return <AllPredictionsView tournament={viewingAllPredictionsFor} onBack={() => setViewingAllPredictionsFor(null)} />;
    }

    if (viewingTournament) {
        return <TournamentDetails tournament={viewingTournament} onBack={() => setViewingTournament(null)} />;
    }

    const STAGES_TO_DISPLAY: { stage: MatchStage | 'Champion', label: string }[] = [
        { stage: 'Champion', label: 'Champion' },
        { stage: 'Group Stage', label: 'Group Stage' },
        { stage: 'Round of 32', label: 'Round of 32' },
        { stage: 'Round of 16', label: 'Round of 16' },
        { stage: 'Quarter-final', label: 'Quarter-finals' },
        { stage: 'Semi-final', label: 'Semi-finals' },
        { stage: 'Final', label: 'Finals' },
    ];

    return (
        <div>
            {joinedTournaments.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 p-8 text-center">
                    <h2 className="text-xl font-bold text-white">No Tournaments Joined Yet</h2>
                    <p className="mt-2 text-slate-400">Use the "Join Tournament" menu to enter a ticket code and get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {joinedTournaments.map(tournament => {
                        const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
                        const applicableStages = new Set(allMatches.map(m => m.stage));
                        if (tournament.hasThirdPlaceMatch) applicableStages.add('Third Place Match');

                        const predStatus = tournament.predictionStatus;
                        const areSubmissionsClosed = predStatus ?
                            !predStatus.allowChampion &&
                            !predStatus.allowGroupStage &&
                            !predStatus.allowRoundOf32 &&
                            !predStatus.allowRoundOf16 &&
                            !predStatus.allowQuarterFinal &&
                            !predStatus.allowSemiFinal &&
                            !predStatus.allowFinals
                            : true;

                        return (
                            <div key={tournament.id} className="bg-slate-800 border border-slate-700 shadow-lg flex flex-col">
                                <div className="p-6 flex-grow space-y-4 text-slate-300">
                                    <h3 className="text-xl font-bold text-blue-400">{tournament.name}</h3>
                                    <div className="text-sm space-y-2">
                                        <p><strong>Status:</strong> <span className={tournament.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{tournament.status}</span></p>
                                        <p><strong>Period:</strong> {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</p>
                                        <p><strong>Participants:</strong> {tournament.participants?.length || 0} users</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-700">
                                        <h4 className="font-semibold text-slate-200 mb-2 text-sm">Prediction Submission Status</h4>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-left text-slate-500">
                                                    <th className="py-1 font-medium">Stage</th>
                                                    <th className="py-1 font-medium text-center">Submission Open</th>
                                                    <th className="py-1 font-medium text-right">Your Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {STAGES_TO_DISPLAY.map(({ stage, label }) => {
                                                    const isApplicable = stage === 'Champion' || applicableStages.has(stage) || (stage === 'Final' && applicableStages.has('Third Place Match'));
                                                    if (!isApplicable && stage !== 'Round of 32' && stage !== 'Round of 16') return null;

                                                    const currentPredStatus = tournament.predictionStatus;
                                                    let isOpen = false;
                                                    if (stage === 'Champion') isOpen = currentPredStatus?.allowChampion || false;
                                                    else if (stage === 'Group Stage') isOpen = currentPredStatus?.allowGroupStage || false;
                                                    else if (stage === 'Round of 32') isOpen = currentPredStatus?.allowRoundOf32 || false;
                                                    else if (stage === 'Round of 16') isOpen = currentPredStatus?.allowRoundOf16 || false;
                                                    else if (stage === 'Quarter-final') isOpen = currentPredStatus?.allowQuarterFinal || false;
                                                    else if (stage === 'Semi-final') isOpen = currentPredStatus?.allowSemiFinal || false;
                                                    else if (stage === 'Final') isOpen = currentPredStatus?.allowFinals || false;

                                                    return (
                                                        <tr key={stage} className="border-t border-slate-700/50">
                                                            <td className="py-2 text-slate-300">{label}</td>
                                                            <td className="py-2 flex justify-center"><StatusLight isApplicable={isApplicable} isOn={isOpen} /></td>
                                                            <td className="py-2 text-right"><SubmissionStatus tournament={tournament} predictions={userPredictions[tournament.id]} stage={stage} isApplicable={isApplicable} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-900/50 grid grid-cols-3 gap-4">
                                    <button onClick={() => setViewingTournament(tournament)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm">Details</button>
                                    <button 
                                        onClick={() => setViewingAllPredictionsFor(tournament)} 
                                        className="px-4 py-2 bg-gray-500 hover:bg-gray-400 font-semibold text-white text-sm disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                                        disabled={!areSubmissionsClosed}
                                        title={!areSubmissionsClosed ? "Available after all prediction windows close" : "View all predictions"}
                                    >
                                        Predictions
                                    </button>
                                    <button onClick={() => onEnterPredictions(tournament)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm">Enter/Edit</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyTournaments;