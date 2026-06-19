// src/components/views/JoinTournament.tsx

import React, { useState } from 'react';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { logAudit } from '../../utils/auditLogger';
import type { Tournament, UserProfile, View } from '../../types';
import { useTranslation } from 'react-i18next';
import cramorantImage from '../../assets/delz-cramorant.webp';

interface JoinTournamentProps {
    userProfile: UserProfile | null;
    setView: (view: View) => void;
}

const JoinTournament = ({ userProfile, setView }: JoinTournamentProps) => {
    const { t } = useTranslation();
    const [ticketCode, setTicketCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<React.ReactNode | null>(null);

    if (userProfile?.role === 'admin' || userProfile?.role === 'superadmin') {
        return (
            <div className="bg-slate-800 border border-slate-700 p-8 max-w-lg mx-auto text-center">
                <h2 className="text-xl font-bold text-blue-400 mb-4">{t('joinTournament.adminTitle', 'Admins Cannot Join Tournaments')}</h2>
                <p className="text-slate-300 mb-6">
                    {t('joinTournament.adminSubtitle', 'This page is for participants. But don\'t be sad, here is a picture of Cramoly the Cramorant to cheer you up!')}
                </p>
                <img loading="lazy" decoding="async" src={cramorantImage} 
                    alt="A cheerful Cramorant" 
                    className="mx-auto w-48 h-48 object-contain"
                />
            </div>
        );
    }

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(null);

        if (!/^\d{6}$/.test(ticketCode)) {
            setError(t('joinTournament.invalidCode', 'Please enter a valid 6-digit ticket code.'));
            return;
        }

        setIsJoining(true);
        const currentUser = auth.currentUser;
        if (!currentUser || !userProfile) {
            setError(t('joinTournament.mustBeLoggedIn', 'You must be logged in to join a tournament.'));
            setIsJoining(false);
            return;
        }

        try {
            const tournamentsRef = collection(db, 'tournaments');
            const q = query(tournamentsRef, where('ticket', '==', ticketCode));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError(t('joinTournament.notFound', 'Invalid ticket code. No tournament found.'));
                setIsJoining(false);
                return;
            }

            const tournamentDoc = querySnapshot.docs[0];
            const tournamentData = tournamentDoc.data() as Tournament;

            if (tournamentData.status !== 'active') {
                setError(t('joinTournament.notActive', 'This tournament is not active and cannot be joined.'));
                setIsJoining(false);
                return;
            }

            if (tournamentData.participants?.includes(currentUser.uid)) {
                setSuccess(
                    <div className="text-green-400 text-sm bg-green-900/20 p-3 border border-green-800">
                        <div>{t('joinTournament.alreadyJoined', 'You have already joined this tournament!')}</div>
                    </div>
                );
                setIsJoining(false);
                return;
            }

            const tournamentRef = doc(db, 'tournaments', tournamentDoc.id);
            await updateDoc(tournamentRef, {
                participants: arrayUnion(currentUser.uid)
            });
            
            await logAudit(userProfile, 'JOIN_TOURNAMENT', `Tournament: ${tournamentData.name}`, { tournamentId: tournamentDoc.id, code: ticketCode });

            setSuccess(
                <div className="text-green-400 text-sm bg-green-900/20 p-3 border border-green-800">
                    <p className="font-semibold mb-1">{t('joinTournament.successMessage', 'Successfully joined tournament!')}</p>
                    <p>{t('joinTournament.checkMenu', 'Check the My Tournaments menu to see the')} {' '}
                    <button onClick={() => setView('My Tournaments')} className="font-semibold text-blue-400 underline hover:text-blue-300">
                        {t('menu.myTournaments', 'My Tournaments')}
                    </button> {' '}
                    {t('joinTournament.tournamentLabel', 'tournament.')}</p>
                </div>
            );
            setTicketCode('');

        } catch (err) {
            console.error(err);
            setError(t('joinTournament.error', 'An error occurred while trying to join the tournament. Please try again.'));
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-8 max-w-lg mx-auto mt-10 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-2">{t('joinTournament.title', 'Join a Tournament')}</h2>
            <p className="text-slate-400 mb-6">{t('joinTournament.subtitle', 'Enter the 6-digit ticket code to participate')}</p>

            <form onSubmit={handleJoin} className="space-y-4">
                <div>
                    <label htmlFor="ticketCode" className="block text-sm font-medium text-slate-300 mb-1">{t('joinTournament.ticketCodeLabel', 'Ticket Code')}</label>
                    <input 
                        id="ticketCode"
                        type="text" 
                        value={ticketCode}
                        onChange={(e) => setTicketCode(e.target.value.toUpperCase().replace(/\D/g, ''))}
                        maxLength={6}
                        placeholder={t('joinTournament.ticketCodePlaceholder', 'e.g. 123456')}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 text-white text-2xl tracking-widest text-center font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                {error && <p className="text-red-400 text-sm bg-red-900/20 p-3 border border-red-800">{error}</p>}
                
                {success}

                <button 
                    type="submit" 
                    disabled={isJoining || ticketCode.length < 6}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 mt-4"
                >
                    {isJoining ? t('joinTournament.joining', 'Joining...') : t('joinTournament.joinButton', 'Join Tournament')}
                </button>
            </form>
        </div>
    );
};

export default JoinTournament;