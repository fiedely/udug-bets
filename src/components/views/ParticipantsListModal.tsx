import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import type { Tournament, UserProfile } from '../../types';

interface ParticipantsListModalProps {
    tournament: Tournament;
    onClose: () => void;
}

const ParticipantsListModal = ({ tournament, onClose }: ParticipantsListModalProps) => {
    const { t } = useTranslation();
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        const fetchParticipants = async () => {
            if (!tournament.participants || tournament.participants.length === 0) {
                setIsLoading(false);
                return;
            }
            
            try {
                const getParticipants = httpsCallable<{tournamentId: string}, UserProfile[]>(functions, 'getTournamentParticipants');
                const result = await getParticipants({ tournamentId: tournament.id });
                const fetchedParticipants = result.data;
                fetchedParticipants.sort((a, b) => a.name.localeCompare(b.name));
                setParticipants(fetchedParticipants);
            } catch (err: any) {
                console.error("Error fetching participants:", err);
                setError(t('participantsList.error', 'Gagal memuat peserta.'));
            } finally {
                setIsLoading(false);
            }
        };
        fetchParticipants();
    }, [tournament]);

    return (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-blue-400">{t('participantsList.title', 'Daftar Peserta')}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    {isLoading ? (
                        <p className="text-center text-slate-400 py-4">{t('participantsList.loading', 'Loading...')}</p>
                    ) : error ? (
                        <p className="text-center text-red-400 py-4">{error}</p>
                    ) : participants.length === 0 ? (
                        <p className="text-center text-slate-400 py-4">{t('participantsList.empty', 'Belum ada peserta.')}</p>
                    ) : (
                        <ul className="space-y-4">
                            {participants.map(user => (
                                <li key={user.uid} className="flex items-center gap-4 p-2 hover:bg-slate-700/50 rounded transition-colors">
                                    {user.avatarUrl ? (
                                        <img loading="lazy" decoding="async" src={user.avatarUrl} 
                                            alt={user.name} 
                                            className="w-12 h-12 rounded-full transform-gpu object-cover border border-slate-600 cursor-pointer hover:opacity-80 transition-opacity" 
                                            onClick={() => setZoomedImage(user.avatarUrl!)}
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full transform-gpu bg-slate-600 flex items-center justify-center text-slate-300 font-bold border border-slate-500 text-lg">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="text-slate-200 font-medium text-lg">{user.name}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="p-4 border-t border-slate-700 text-right bg-slate-900/50">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold text-sm">
                        {t('participantsList.close', 'Tutup')}
                    </button>
                </div>
            </div>

            {zoomedImage && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setZoomedImage(null)}
                >
                    <img loading="lazy" decoding="async" src={zoomedImage} 
                        alt="Zoomed Profile" 
                        className="max-w-full max-h-full object-contain rounded shadow-2xl" 
                    />
                </div>
            )}
        </div>
    );
};

export default ParticipantsListModal;
