// src/components/views/WidgetConfigModal.tsx

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Widget, Tournament, UserProfile } from '../../types';

interface WidgetConfigModalProps {
    isOpen: boolean;
    widget: Partial<Widget> | null;
    userProfile: UserProfile;
    onClose: () => void;
    onSave: (widget: Partial<Widget>) => void;
}

const HEADER_COLORS = [
    { name: 'Default', class: 'bg-slate-700/50' },
    { name: 'Red', class: 'bg-red-900' },
    { name: 'Orange', class: 'bg-orange-900' },
    { name: 'Yellow', class: 'bg-yellow-900' },
    { name: 'Green', class: 'bg-green-900' },
    { name: 'Blue', class: 'bg-blue-900' },
    { name: 'Indigo', class: 'bg-indigo-900' },
    { name: 'Violet', class: 'bg-violet-900' },
];

const WidgetConfigModal = ({ isOpen, widget, userProfile, onClose, onSave }: WidgetConfigModalProps) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [title, setTitle] = useState('');
    const [headerColor, setHeaderColor] = useState(HEADER_COLORS[0].class);

    const defaultTitle = widget?.type === 'predictionChart' ? 'Prediction Chart' : 'Leaderboard';

    useEffect(() => {
        if (widget) {
            setSelectedTournamentId(widget.props?.tournamentId || '');
            setTitle(widget.title || defaultTitle);
            setHeaderColor(widget.headerColor || HEADER_COLORS[0].class);
        }
    }, [widget, defaultTitle]);

    useEffect(() => {
        const fetchTournaments = async () => {
            const tournamentsRef = collection(db, 'tournaments');
            let q;
            if (userProfile.role === 'admin' || userProfile.role === 'superadmin') {
                q = query(tournamentsRef, where('status', '==', 'active'));
            } else {
                q = query(tournamentsRef,
                    where('participants', 'array-contains', userProfile.uid),
                    where('status', '==', 'active')
                );
            }
            const snapshot = await getDocs(q);
            const tourneyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
            setTournaments(tourneyList);
            
            if (!widget?.props?.tournamentId && tourneyList.length > 0) {
                setSelectedTournamentId(tourneyList[0].id);
            }
        };
        fetchTournaments();
    }, [userProfile, widget]);

    const handleSave = () => {
        if (widget) {
            onSave({
                ...widget,
                title: title.trim() || defaultTitle,
                headerColor: headerColor,
                props: {
                    ...widget.props,
                    tournamentId: selectedTournamentId,
                }
            });
        }
    };

    if (!isOpen || !widget) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-4">Configure Widget</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="widget-title" className="block text-sm font-medium text-slate-300">Widget Title</label>
                        <input
                            id="widget-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Header Color</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {HEADER_COLORS.map(color => (
                                <button
                                    key={color.name}
                                    title={color.name}
                                    onClick={() => setHeaderColor(color.class)}
                                    className={`w-8 h-8 border-2 ${headerColor === color.class ? 'border-white' : 'border-transparent'} ${color.class}`}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="tournament-select" className="block text-sm font-medium text-slate-300">Select Tournament</label>
                        <select
                            id="tournament-select"
                            value={selectedTournamentId}
                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                            className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {tournaments.length === 0 && <option>No active tournaments found</option>}
                            {tournaments.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white">Save</button>
                </div>
            </div>
        </div>
    );
};

export default WidgetConfigModal;
