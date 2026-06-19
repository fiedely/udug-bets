import { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import type { Tournament, Match, LiveMatchEvent, LiveMatchState } from '../../../types';
import SquadModal from './SquadModal';

interface LiveMatchViewProps {
    tournament: Tournament;
    match: Match;
    onBack: () => void;
}

const LiveMatchView = ({ tournament, match, onBack }: LiveMatchViewProps) => {
    const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
    const [events, setEvents] = useState<LiveMatchEvent[]>([]);
    const [viewingSquad, setViewingSquad] = useState<'team1' | 'team2' | null>(null);

    useEffect(() => {
        const matchRef = doc(db, `tournaments/${tournament.id}/liveMatches/${match.id}`);
        const eventsRef = collection(db, `tournaments/${tournament.id}/liveMatches/${match.id}/events`);

        const unsubscribeState = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                setMatchState(docSnap.data() as LiveMatchState);
            }
        });

        const unsubscribeEvents = onSnapshot(eventsRef, (snap) => {
            const evts = snap.docs.map(d => d.data() as LiveMatchEvent);
            evts.sort((a, b) => b.minute - a.minute); // Descending (latest first)
            setEvents(evts);
        });

        return () => {
            unsubscribeState();
            unsubscribeEvents();
        };
    }, [tournament.id, match.id]);

    const renderEventIcon = (type: LiveMatchEvent['type']) => {
        switch (type) {
            case 'goal': return '⚽';
            case 'yellow_card': return '🟨';
            case 'red_card': return '🟥';
            case 'substitution': return '🔄';
            case 'foul': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button onClick={onBack} className="text-blue-400 hover:underline mb-6 font-semibold flex items-center gap-2">
                &larr; Back to Match Selection
            </button>

            {/* Scoreboard Header */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden mb-8">
                <div className="bg-slate-900/50 p-4 text-center border-b border-slate-700">
                    <span className="text-xs uppercase tracking-widest font-bold text-slate-400">
                        {match.stage} • {tournament.name}
                    </span>
                </div>
                
                <div className="p-8 flex items-center justify-between relative">
                    {/* Team 1 */}
                    <div className="flex flex-col items-center w-1/3">
                        <div className="text-4xl sm:text-5xl mb-4">{match.team1.flag}</div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white text-center">{match.team1.name}</h2>
                        <span className="text-slate-400 font-mono mt-1">{match.team1.code}</span>
                        {matchState?.team1Squad && (
                            <button onClick={() => setViewingSquad('team1')} className="mt-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold rounded-full transform-gpu border border-slate-700 transition-colors">
                                View Squad &rarr;
                            </button>
                        )}
                    </div>

                    {/* Score Center */}
                    <div className="flex flex-col items-center justify-center w-1/3">
                        <div className="flex items-center gap-4 sm:gap-6 mb-2">
                            <span className="text-5xl sm:text-7xl font-black text-white">{matchState?.team1Score ?? 0}</span>
                            <span className="text-3xl text-slate-600">-</span>
                            <span className="text-5xl sm:text-7xl font-black text-white">{matchState?.team2Score ?? 0}</span>
                        </div>
                        <div className="mt-2 bg-slate-900 px-4 py-1.5 rounded-full transform-gpu flex items-center gap-2 border border-slate-700">
                            {matchState && matchState.status !== 'scheduled' && matchState.status !== 'finished' && (
                                <span className="w-2 h-2 rounded-full transform-gpu bg-red-500 animate-pulse"></span>
                            )}
                            <span className={`font-mono font-bold ${matchState?.status === 'finished' ? 'text-slate-400' : 'text-orange-400'}`}>
                                {matchState ? (matchState.status === 'finished' ? 'FT' : `${matchState.currentMinute}'`) : 'Upcoming'}
                            </span>
                        </div>
                        {matchState && matchState.status && matchState.status !== 'scheduled' && (
                            <span className="text-xs text-slate-500 uppercase font-bold mt-2 tracking-wider">
                                {matchState.status.replace('_', ' ')}
                            </span>
                        )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex flex-col items-center w-1/3">
                        <div className="text-4xl sm:text-5xl mb-4">{match.team2.flag}</div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white text-center">{match.team2.name}</h2>
                        <span className="text-slate-400 font-mono mt-1">{match.team2.code}</span>
                        {matchState?.team2Squad && (
                            <button onClick={() => setViewingSquad('team2')} className="mt-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold rounded-full transform-gpu border border-slate-700 transition-colors">
                                View Squad &rarr;
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Timeline View */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Match Timeline</h3>
                
                {events.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <p>No events recorded yet.</p>
                        <p className="text-sm mt-1">Waiting for kickoff...</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Center Line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700 transform -translate-x-1/2"></div>
                        
                        <div className="space-y-6">
                            {events.map((e) => {
                                const isTeam1 = e.teamKey === 'team1';
                                return (
                                    <div key={e.id} className={`flex items-center w-full ${isTeam1 ? 'flex-row' : 'flex-row-reverse'}`}>
                                        
                                        {/* Event Box */}
                                        <div className={`w-1/2 flex ${isTeam1 ? 'justify-end pr-8' : 'justify-start pl-8'}`}>
                                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow min-w-[200px] flex items-center gap-3">
                                                <div className="text-2xl">{renderEventIcon(e.type)}</div>
                                                <div className={`${isTeam1 ? 'text-right' : 'text-left'} flex-grow`}>
                                                    <div className="text-white font-medium">{e.description}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{isTeam1 ? match.team1.name : match.team2.name}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center Minute Marker */}
                                        <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full transform-gpu bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-lg z-10">
                                            <span className="font-mono text-sm font-bold text-blue-400">{e.minute}'</span>
                                        </div>

                                        {/* Empty Side */}
                                        <div className="w-1/2"></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {viewingSquad === 'team1' && matchState?.team1Squad && (
                <SquadModal 
                    team={match.team1} 
                    squad={matchState.team1Squad} 
                    events={events} 
                    teamKey="team1" 
                    onClose={() => setViewingSquad(null)} 
                />
            )}
            
            {viewingSquad === 'team2' && matchState?.team2Squad && (
                <SquadModal 
                    team={match.team2} 
                    squad={matchState.team2Squad} 
                    events={events} 
                    teamKey="team2" 
                    onClose={() => setViewingSquad(null)} 
                />
            )}
        </div>
    );
};

export default LiveMatchView;
