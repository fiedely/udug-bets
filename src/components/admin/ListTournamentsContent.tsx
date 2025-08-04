// src/components/admin/ListTournamentsContent.tsx

import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Tournament, UserProfile, PredictionStatus } from '../../types';
import InviteModal from './InviteModal';

interface ListTournamentsContentProps {
    onEditTournament: (id: string) => void;
    onManageTournament: (tournament: Tournament) => void;
    onViewLeaderboard: (tournament: Tournament) => void; // New prop
    userProfile: UserProfile | null;
}

const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US').format(date);
};

const defaultPredictionStatus: PredictionStatus = {
    allowChampion: false, allowGroupStage: false, allowRoundOf32: false,
    allowRoundOf16: false, allowQuarterFinal: false, allowSemiFinal: false, allowFinals: false,
};

const ListTournamentsContent = ({ onEditTournament, onManageTournament, onViewLeaderboard, userProfile }: ListTournamentsContentProps) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);
    const [invitingTournament, setInvitingTournament] = useState<Tournament | null>(null);
    const [managingPredictionsFor, setManagingPredictionsFor] = useState<string | null>(null);
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

    const handleDelete = async (tournamentId: string) => {
        if (!tournamentId) return;
        try {
            await deleteDoc(doc(db, "tournaments", tournamentId));
            setTournaments(tournaments.filter(t => t.id !== tournamentId));
        } catch (error) {
            console.error("Error deleting tournament: ", error);
        } finally {
            setDeletingTournament(null);
        }
    };

    const handleTogglePredictionStatus = async (tournamentId: string, stage: keyof PredictionStatus, currentValue: boolean) => {
        const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
        if (!isAdmin) return;
        const newValue = !currentValue;
        const fieldPath = `predictionStatus.${stage}`;
        try {
            await updateDoc(doc(db, "tournaments", tournamentId), { [fieldPath]: newValue });
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

    return (
        <>
            <div className="bg-slate-800 border border-slate-700 p-8">
                <h2 className="text-2xl font-bold text-blue-400">Your Tournaments</h2>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tournaments.map(t => (
                        <div key={t.id} className="bg-slate-900 p-4 border border-slate-700 flex flex-col gap-4 shadow">
                            <div className="flex-grow">
                                <h3 className="font-semibold text-white text-lg">{t.name}</h3>
                                <p className="text-sm text-slate-400">Status: <span className={t.status === 'draft' ? 'text-yellow-400' : (t.status === 'active' ? 'text-green-400' : 'text-gray-400')}>{t.status}</span></p>
                                <p className="text-sm text-slate-500">Ticket: {t.ticket}</p>
                            </div>
                            <div className="text-sm text-slate-300 border-t border-b border-slate-700 py-2 space-y-1">
                                <p><strong>Period:</strong> {formatDate(t.startDate)} - {formatDate(t.endDate)}</p>
                                <p><strong>Participants:</strong> {t.participants?.length || 0} users</p>
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-4">
                                <div className="relative">
                                    <button onClick={() => setManagingPredictionsFor(managingPredictionsFor === t.id ? null : t.id)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm" disabled={!isAdmin || t.status === 'draft'}>
                                        Manage Predictions
                                    </button>
                                    {managingPredictionsFor === t.id && (
                                        <div ref={predictionMenuRef} className="absolute bottom-full mb-2 w-64 bg-slate-700 border border-slate-600 shadow-lg p-2 z-10">
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
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => onViewLeaderboard(t)} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 font-semibold text-white text-xs" disabled={t.status === 'draft'}>Leaderboard</button>
                                    <button onClick={() => setInvitingTournament(t)} className="px-3 py-2 bg-green-600 hover:bg-green-500 font-semibold text-white text-xs">Invite</button>
                                    <button onClick={() => onManageTournament(t)} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 font-semibold text-white text-xs" disabled={t.status === 'draft'}>Manage Scores</button>
                                    <button onClick={() => onEditTournament(t.id)} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white text-xs">Edit</button>
                                    <button onClick={() => setDeletingTournament(t)} className="px-3 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white text-xs">Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {deletingTournament && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                        <p className="mt-2 text-slate-400">Are you sure you want to delete the tournament "{deletingTournament.name}"? This action cannot be undone.</p>
                        <div className="mt-6 flex justify-end gap-4">
                            <button onClick={() => setDeletingTournament(null)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white">Cancel</button>
                            <button onClick={() => handleDelete(deletingTournament.id)} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-semibold text-white">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {invitingTournament && (
                <InviteModal tournament={invitingTournament} onClose={() => setInvitingTournament(null)} onParticipantsChange={handleParticipantsChange} />
            )}
        </>
    );
};

export default ListTournamentsContent;
