// src/components/admin/ListTournamentsContent.tsx

// src/components/admin/ListTournamentsContent.tsx

import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Tournament, UserProfile, PredictionStatus } from '../../types';
import InviteModal from './InviteModal';
import AdminParticipantsModal from './AdminParticipantsModal';
import TournamentDetails from '../views/TournamentDetails';
import OverrideStandingsModal from './OverrideStandingsModal';
import { logAudit } from '../../utils/auditLogger';

const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US').format(date);
};

const defaultPredictionStatus: PredictionStatus = {
    allowChampion: false, allowGroupStage: false, allowRoundOf32: false,
    allowRoundOf16: false, allowQuarterFinal: false, allowSemiFinal: false, allowFinals: false,
};

interface ListTournamentsContentProps {
    onEditTournament: (id: string) => void;
    onManageTournament: (tournament: Tournament) => void;
    onViewLeaderboard: (tournament: Tournament) => void;
    onViewAllPredictions: (tournament: Tournament) => void;
    onManageAiConfig: (tournament: Tournament) => void;
    onCreateTournament: () => void;
    userProfile: UserProfile | null;
}

const ListTournamentsContent = ({ onEditTournament, onManageTournament, onViewLeaderboard, onViewAllPredictions, onManageAiConfig, onCreateTournament, userProfile }: ListTournamentsContentProps) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [invitingTournament, setInvitingTournament] = useState<Tournament | null>(null);
    const [overridingTournament, setOverridingTournament] = useState<Tournament | null>(null);
    const [viewingParticipantsFor, setViewingParticipantsFor] = useState<Tournament | null>(null);
    const [managingPredictionsFor, setManagingPredictionsFor] = useState<string | null>(null);
    const [viewingTournamentDetails, setViewingTournamentDetails] = useState<Tournament | null>(null);
    const predictionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchTournaments = async () => {
            setIsLoading(true);
            const querySnapshot = await getDocs(collection(db, "tournaments"));
            const tourneyList = querySnapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return {
                    id: docSnapshot.id, ...data,
                    startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
                    endDate: data.endDate ? (data.endDate as Timestamp).toDate() : undefined,
                    participants: data.participants || [],
                    predictionStatus: { ...defaultPredictionStatus, ...(data.predictionStatus || {}) },
                } as Tournament;
            });
            setTournaments(tourneyList);
            setIsLoading(false);
        };
        fetchTournaments();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (predictionMenuRef.current && !predictionMenuRef.current.contains(event.target as Node)) {
                setManagingPredictionsFor(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDeactivate = async (tournamentId: string) => {
        if (!tournamentId) return;
        setIsDeleting(true);
        try {
            await updateDoc(doc(db, "tournaments", tournamentId), { status: 'inactive' });
            const deactivatedT = tournaments.find(t => t.id === tournamentId);
            if (deactivatedT && userProfile) {
                await logAudit(userProfile, 'DEACTIVATE_TOURNAMENT', `Deactivated tournament: ${deactivatedT.name}`, { tournamentId });
            }
            setTournaments(tournaments.map(t => t.id === tournamentId ? { ...t, status: 'inactive' } : t));
        } catch (error) {
            console.error("Error deactivating tournament: ", error);
        } finally {
            setDeletingTournament(null);
            setIsDeleting(false);
        }
    };

    const handleTogglePredictionStatus = async (tournamentId: string, stage: keyof PredictionStatus, currentValue: boolean) => {
        const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
        if (!isAdmin) return;
        const newValue = !currentValue;
        const fieldPath = `predictionStatus.${stage}`;
        try {
            await updateDoc(doc(db, "tournaments", tournamentId), { [fieldPath]: newValue });
            const toggledT = tournaments.find(t => t.id === tournamentId);
            if (toggledT && userProfile) {
                await logAudit(userProfile, 'TOGGLE_PREDICTION_PERIOD', `${newValue ? 'Opened' : 'Closed'} prediction for ${stage} in ${toggledT.name}`, { tournamentId, stage, newValue });
            }
            setTournaments(prev => prev.map(t => t.id === tournamentId && t.predictionStatus ? { ...t, predictionStatus: { ...t.predictionStatus, [stage]: newValue } } : t));
        } catch (error) {
            console.error(`Error updating ${stage}:`, error);
        }
    };

    const handleParticipantsChange = (tournamentId: string, newParticipants: string[]) => {
        setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, participants: newParticipants } : t));
        if (invitingTournament?.id === tournamentId) {
            setInvitingTournament(prev => prev ? { ...prev, participants: newParticipants } : null);
        }
    };

    if (isLoading) {
       return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    if (viewingTournamentDetails) {
        return <TournamentDetails tournament={viewingTournamentDetails} onBack={() => setViewingTournamentDetails(null)} />;
    }

    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';

    const PredictionToggle = ({ t, stage, label }: { t: Tournament, stage: keyof PredictionStatus, label: string }) => (
        <label className="flex justify-between items-center p-2 hover:bg-slate-600 cursor-pointer">
            <span className="text-sm text-slate-300">{label}</span>
            <div className="relative inline-flex items-center">
                <input type="checkbox" checked={t.predictionStatus?.[stage] || false} onChange={() => handleTogglePredictionStatus(t.id, stage, t.predictionStatus?.[stage] || false)} className="sr-only peer" disabled={!isAdmin || t.status === 'draft'} />
                <div className={`w-9 h-5 bg-gray-700 peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-4 after:w-4 after:transition-all border-gray-600 peer-checked:bg-blue-600 ${(!isAdmin || t.status === 'draft') ? 'opacity-50' : ''}`}></div>
            </div>
        </label>
    );

    const baseButtonClasses = "w-full px-3 py-2 font-semibold text-white text-xs sm:text-sm transition-colors disabled:cursor-not-allowed";

    return (
        <>
            <div className="bg-slate-800 border border-slate-700 p-4 md:p-8">
                <div className="flex justify-end mb-4">
                    <button 
                        onClick={onCreateTournament}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"></path></svg>
                        Create Tournament
                    </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {tournaments.map(t => (
                        <div key={t.id} className="bg-slate-900 p-4 border border-slate-700 flex flex-col gap-4 shadow">
                            <div className="flex-grow">
                                <h3 className="font-semibold text-white text-lg">{t.name}</h3>
                                <p className="text-sm text-slate-400">Status: <span className={t.status === 'draft' ? 'text-yellow-400' : (t.status === 'active' ? 'text-green-400' : 'text-gray-400')}>{t.status}</span></p>
                                <p className="text-sm text-slate-500">Ticket: {t.ticket}</p>
                            </div>
                            <div className="text-sm text-slate-300 border-t border-b border-slate-700 py-2 space-y-1">
                                <p><strong>Period:</strong> {formatDate(t.startDate)} - {formatDate(t.endDate)}</p>
                                <p className="flex items-center gap-2">
                                    <span><strong>Participants:</strong> {t.participants?.length || 0} users</span>
                                    {t.participants && t.participants.length > 0 && (
                                        <button 
                                            onClick={() => setViewingParticipantsFor(t)}
                                            className="text-blue-400 hover:text-blue-300 hover:underline font-semibold"
                                        >
                                            (Prediction Completeness Report)
                                        </button>
                                    )}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative col-span-2">
                                    <button onClick={() => setManagingPredictionsFor(managingPredictionsFor === t.id ? null : t.id)} className={`${baseButtonClasses} bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700`} disabled={!isAdmin || t.status === 'draft'}>
                                        Toggle Predictions Period
                                    </button>
                                    {managingPredictionsFor === t.id && (
                                        <div ref={predictionMenuRef} className="absolute top-full mt-1 w-full max-h-60 overflow-y-auto bg-slate-700 border border-slate-600 shadow-xl p-2 z-[100] space-y-1 rounded">
                                            <PredictionToggle t={t} stage="allowChampion" label="Champion" />
                                            <PredictionToggle t={t} stage="allowGroupStage" label="Group Stage" />
                                            <PredictionToggle t={t} stage="allowRoundOf32" label="Round of 32" />
                                            <PredictionToggle t={t} stage="allowRoundOf16" label="Round of 16" />
                                            <PredictionToggle t={t} stage="allowQuarterFinal" label="Quarter-finals" />
                                            <PredictionToggle t={t} stage="allowSemiFinal" label="Semi-finals" />
                                            <PredictionToggle t={t} stage="allowFinals" label="Finals" />
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => onManageTournament(t)} className={`${baseButtonClasses} bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 col-span-2`} disabled={t.status === 'draft'}>
                                    Input Actual Scores
                                </button>
                                <button onClick={() => setViewingTournamentDetails(t)} className={`${baseButtonClasses} bg-slate-600 hover:bg-slate-500 col-span-2`}>
                                    Check Tournament Details
                                </button>
                                <button onClick={() => onViewLeaderboard(t)} className={`${baseButtonClasses} bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700`} disabled={t.status === 'draft'}>Participant Point History</button>
                                <button onClick={() => onViewAllPredictions(t)} className={`${baseButtonClasses} bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700`} disabled={t.status === 'draft'}>All Predictions</button>
                                <button onClick={() => setInvitingTournament(t)} className={`${baseButtonClasses} bg-slate-600 hover:bg-slate-500`}>Invite Participant</button>
                                <button onClick={() => onEditTournament(t.id)} className={`${baseButtonClasses} bg-slate-600 hover:bg-slate-500`}>Edit Tournament Detail</button>
                                <button onClick={() => setOverridingTournament(t)} className={`${baseButtonClasses} bg-orange-700 hover:bg-orange-600 col-span-2 text-white`}>Override Group Standings</button>
                                <button onClick={() => onManageAiConfig(t)} className={`${baseButtonClasses} bg-purple-700 hover:bg-purple-600 col-span-2 text-white`}>Manage AI Config</button>
                                <button onClick={() => setDeletingTournament(t)} className={`${baseButtonClasses} bg-red-800 hover:bg-red-700 col-span-2`}>De-activate Tournament</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {deletingTournament && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-white">Confirm Deactivation</h3>
                        <p className="mt-2 text-slate-400">
                            Are you sure you want to de-activate "{deletingTournament.name}"?
                            <br />
                            <strong className="text-red-400">This will hide the tournament from active status and prevent participants from editing their predictions.</strong>
                        </p>
                        <div className="mt-6 flex justify-end gap-4">
                            <button onClick={() => setDeletingTournament(null)} disabled={isDeleting} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white disabled:opacity-50">Cancel</button>
                            <button onClick={() => handleDeactivate(deletingTournament.id)} disabled={isDeleting} className="px-4 py-2 bg-red-800 hover:bg-red-700 font-semibold text-white disabled:bg-red-900 disabled:cursor-not-allowed">
                                {isDeleting ? 'Deactivating...' : 'Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {invitingTournament && (
                <InviteModal tournament={invitingTournament} onClose={() => setInvitingTournament(null)} onParticipantsChange={handleParticipantsChange} />
            )}
            {viewingParticipantsFor && (
                <AdminParticipantsModal tournament={viewingParticipantsFor} onClose={() => setViewingParticipantsFor(null)} />
            )}
            {overridingTournament && (
                <OverrideStandingsModal 
                    tournament={overridingTournament} 
                    userProfile={userProfile!}
                    onClose={() => setOverridingTournament(null)} 
                />
            )}
        </>
    );
};

export default ListTournamentsContent;
