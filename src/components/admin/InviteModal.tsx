// src/components/admin/InviteModal.tsx

import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Tournament, UserProfile } from '../../types';

interface InviteModalProps {
    tournament: Tournament;
    onClose: () => void;
    onParticipantsChange: (tournamentId: string, newParticipants: string[]) => void;
}

const InviteModal = ({ tournament, onClose, onParticipantsChange }: InviteModalProps) => {
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchAllUsers = async () => {
            setIsLoading(true);
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersList = usersSnapshot.docs.map(d => d.data() as UserProfile);
            setAllUsers(usersList.filter(u => u.role === 'user'));
            setIsLoading(false);
        };
        fetchAllUsers();
    }, []);

    const { joinedUsers, availableUsers } = useMemo(() => {
        const joinedIds = new Set(tournament.participants || []);
        
        const joined = allUsers.filter(u => joinedIds.has(u.uid));
        const available = allUsers.filter(u => !joinedIds.has(u.uid));

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            return {
                joinedUsers: joined.filter(u => u.name.toLowerCase().includes(lowercasedFilter) || u.email.toLowerCase().includes(lowercasedFilter)),
                availableUsers: available.filter(u => u.name.toLowerCase().includes(lowercasedFilter) || u.email.toLowerCase().includes(lowercasedFilter))
            };
        }

        return { joinedUsers: joined, availableUsers: available };
    }, [allUsers, tournament.participants, searchTerm]);

    const handleInvite = async (userId: string) => {
        const tournamentRef = doc(db, "tournaments", tournament.id);
        await updateDoc(tournamentRef, {
            participants: arrayUnion(userId)
        });
        onParticipantsChange(tournament.id, [...(tournament.participants || []), userId]);
    };

    const handleRemove = async (userId: string) => {
        const tournamentRef = doc(db, "tournaments", tournament.id);
        await updateDoc(tournamentRef, {
            participants: arrayRemove(userId)
        });
        onParticipantsChange(tournament.id, (tournament.participants || []).filter(p => p !== userId));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-4xl w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Invite Users to "{tournament.name}"</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
                </div>

                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 mb-4 bg-slate-900 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {isLoading ? (
                    <p className="text-center text-slate-400">Loading users...</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                            <h4 className="text-lg font-semibold text-blue-400 border-b border-slate-600 pb-2">Available to Invite ({availableUsers.length})</h4>
                            <ul className="space-y-2 pr-2">
                                {availableUsers.map(user => (
                                    <li key={user.uid} className="flex justify-between items-center p-2 bg-slate-700/50">
                                        <div>
                                            <p className="font-medium text-white">{user.name}</p>
                                            <p className="text-xs text-slate-400">{user.email}</p>
                                        </div>
                                        <button onClick={() => handleInvite(user.uid)} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold">Invite</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-lg font-semibold text-green-400 border-b border-slate-600 pb-2">Already Joined ({joinedUsers.length})</h4>
                            <ul className="space-y-2 pr-2">
                                {joinedUsers.map(user => (
                                    <li key={user.uid} className="flex justify-between items-center p-2 bg-slate-900">
                                        <div>
                                            <p className="font-medium text-white">{user.name}</p>
                                            <p className="text-xs text-slate-400">{user.email}</p>
                                        </div>
                                        <button onClick={() => handleRemove(user.uid)} className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold">Remove</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white">Close</button>
                </div>
            </div>
        </div>
    );
};

export default InviteModal;
