import { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Tournament, UserProfile, Match } from '../../../types';
import LiveMatchView from './LiveMatchView';
import AdminMatchController from '../../admin/AdminMatchController';

interface LiveMatchMonitorProps {
    userProfile: UserProfile;
}

const LiveMatchMonitor = ({}: LiveMatchMonitorProps) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [viewMode, setViewMode] = useState<'monitor' | 'controller'>('monitor');

    useEffect(() => {
        const fetchTournaments = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'tournaments'), where('status', '==', 'active'));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
                setTournaments(list);
            } catch (err) {
                console.error("Error fetching tournaments:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTournaments();
    }, []);

    if (selectedMatch && selectedTournament) {
        if (viewMode === 'controller') {
            return (
                <AdminMatchController 
                    tournament={selectedTournament} 
                    match={selectedMatch} 
                    onBack={() => setSelectedMatch(null)} 
                />
            );
        } else {
            return (
                <LiveMatchView 
                    tournament={selectedTournament} 
                    match={selectedMatch} 
                    onBack={() => setSelectedMatch(null)} 
                />
            );
        }
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-end items-end">
                <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
                    <button 
                        onClick={() => setViewMode('monitor')}
                        className={`px-4 py-2 text-sm font-semibold rounded ${viewMode === 'monitor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Viewer Mode
                    </button>
                    <button 
                        onClick={() => setViewMode('controller')}
                        className={`px-4 py-2 text-sm font-semibold rounded ${viewMode === 'controller' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Admin Controller Mode
                    </button>
                </div>
            </div>

            {isLoading ? (
                <p className="text-slate-400">Loading tournaments...</p>
            ) : tournaments.length === 0 ? (
                <p className="text-slate-400">No active tournaments found.</p>
            ) : (
                <div className="space-y-6">
                    {tournaments.map(t => {
                        const matches = [...(t.matches || []), ...(t.knockoutMatches || [])];
                        if (matches.length === 0) return null;
                        
                        return (
                            <div key={t.id} className="bg-slate-800 border border-slate-700 p-4 rounded shadow">
                                <h3 className="text-lg font-bold text-blue-400 mb-4">{t.name}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {matches.map(m => (
                                        <div key={m.id} className="bg-slate-900 border border-slate-700 p-4 rounded hover:border-slate-500 transition-colors">
                                            <div className="text-xs text-slate-500 mb-2">{m.stage} - {m.date}</div>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="font-bold text-white text-lg">{m.team1.name}</div>
                                                <div className="text-slate-500 text-sm">vs</div>
                                                <div className="font-bold text-white text-lg">{m.team2.name}</div>
                                            </div>
                                            <button 
                                                onClick={() => { setSelectedTournament(t); setSelectedMatch(m); }}
                                                className={`w-full py-2 font-semibold rounded text-sm transition-colors ${viewMode === 'controller' ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                            >
                                                {viewMode === 'controller' ? 'Open Controller' : 'Watch Live'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveMatchMonitor;
