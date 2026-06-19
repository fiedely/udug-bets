import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, collection, addDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Tournament, Match, LiveMatchEvent, LiveMatchState } from '../../types';

interface AdminMatchControllerProps {
    tournament: Tournament;
    match: Match;
    onBack: () => void;
}

const AdminMatchController = ({ tournament, match, onBack }: AdminMatchControllerProps) => {
    const [matchState, setMatchState] = useState<LiveMatchState>({
        status: 'scheduled',
        currentMinute: 0,
        team1Score: 0,
        team2Score: 0,
        lastUpdated: null
    });
    
    const [events, setEvents] = useState<LiveMatchEvent[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Substitution selections
    const [t1SubOut, setT1SubOut] = useState('');
    const [t1SubIn, setT1SubIn] = useState('');
    const [t2SubOut, setT2SubOut] = useState('');
    const [t2SubIn, setT2SubIn] = useState('');

    const matchRef = doc(db, `tournaments/${tournament.id}/liveMatches/${match.id}`);
    const eventsRef = collection(db, `tournaments/${tournament.id}/liveMatches/${match.id}/events`);

    useEffect(() => {
        const unsubscribeState = onSnapshot(matchRef, (docSnap) => {
            if (docSnap.exists()) {
                setMatchState(docSnap.data() as LiveMatchState);
            }
        });

        const unsubscribeEvents = onSnapshot(eventsRef, (snap) => {
            const evts = snap.docs.map(d => d.data() as LiveMatchEvent);
            evts.sort((a, b) => b.minute - a.minute); // Descending
            setEvents(evts);
        });

        return () => {
            unsubscribeState();
            unsubscribeEvents();
        };
    }, [tournament.id, match.id]);

    const handleSub = (teamKey: 'team1' | 'team2') => {
        const outId = teamKey === 'team1' ? t1SubOut : t2SubOut;
        const inId = teamKey === 'team1' ? t1SubIn : t2SubIn;
        if (!outId || !inId) {
            alert("Please select both a player to sub out and a player to sub in.");
            return;
        }
        
        const teamName = teamKey === 'team1' ? match.team1.name : match.team2.name;
        pushEvent('substitution', teamKey, `Substitution - ${teamName}`, undefined, outId, inId);
        
        if (teamKey === 'team1') { setT1SubOut(''); setT1SubIn(''); }
        else { setT2SubOut(''); setT2SubIn(''); }
    };

    const pushEvent = async (type: LiveMatchEvent['type'], teamKey: LiveMatchEvent['teamKey'], description: string, updateScore?: 'team1' | 'team2', subPlayerOutId?: string, subPlayerInId?: string) => {
        setIsSubmitting(true);
        try {
            const newMinute = matchState.currentMinute;
            
            await addDoc(eventsRef, {
                id: Date.now().toString(),
                type,
                minute: newMinute,
                teamKey,
                description,
                subPlayerOutId: subPlayerOutId || null,
                subPlayerInId: subPlayerInId || null,
                timestamp: serverTimestamp()
            } as any);

            let newT1 = matchState.team1Score;
            let newT2 = matchState.team2Score;
            if (updateScore === 'team1') newT1++;
            if (updateScore === 'team2') newT2++;

            await setDoc(matchRef, {
                ...matchState,
                team1Score: newT1,
                team2Score: newT2,
                lastUpdated: serverTimestamp()
            }, { merge: true });

        } catch (err) {
            console.error("Error pushing event", err);
            alert("Failed to push event");
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadMockSquads = async () => {
        setIsSubmitting(true);
        try {
            const generateSquad = (prefix: string) => {
                const startingXI = Array.from({length: 11}, (_, i) => ({ id: `${prefix}_s_${i+1}`, name: `${prefix} Player ${i+1}`, number: i+1 }));
                const bench = Array.from({length: 5}, (_, i) => ({ id: `${prefix}_b_${i+12}`, name: `${prefix} Sub ${i+12}`, number: i+12 }));
                return { startingXI, bench };
            };
            
            await setDoc(matchRef, {
                ...matchState,
                team1Squad: generateSquad(match.team1.code),
                team2Squad: generateSquad(match.team2.code),
                lastUpdated: serverTimestamp()
            }, { merge: true });
        } catch(e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const advanceMinute = async () => {
        await setDoc(matchRef, {
            ...matchState,
            status: matchState.status === 'scheduled' ? 'first_half' : matchState.status,
            currentMinute: matchState.currentMinute + 1,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    };

    const setStatus = async (status: LiveMatchState['status']) => {
        await setDoc(matchRef, {
            ...matchState,
            status,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    };

    return (
        <div className="p-6">
            <button onClick={onBack} className="text-blue-400 hover:underline mb-4">← Back to Monitor</button>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-orange-400">Match Controller</h2>
                    <div className="flex gap-4">
                        <button onClick={loadMockSquads} disabled={isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-sm">Load Mock Squads</button>
                        <div className="bg-slate-900 px-4 py-2 rounded text-xl font-mono text-white border border-slate-700">
                            {matchState.currentMinute}'
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-6 rounded-lg mb-8 border border-slate-700">
                    <div className="text-center w-1/3">
                        <div className="text-xl font-bold text-white mb-2">{match.team1.name}</div>
                        <div className="text-4xl font-black text-blue-400">{matchState.team1Score}</div>
                    </div>
                    <div className="text-center w-1/3">
                        <div className="text-slate-400 mb-2 uppercase text-sm font-bold tracking-widest">{matchState.status.replace('_', ' ')}</div>
                        <div className="flex flex-col gap-2">
                            <button onClick={advanceMinute} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold">+1 Minute</button>
                        </div>
                    </div>
                    <div className="text-center w-1/3">
                        <div className="text-xl font-bold text-white mb-2">{match.team2.name}</div>
                        <div className="text-4xl font-black text-blue-400">{matchState.team2Score}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Team 1 Actions */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-300 border-b border-slate-700 pb-2 mb-4">{match.team1.name} Actions</h3>
                        <button disabled={isSubmitting} onClick={() => pushEvent('goal', 'team1', `Goal for ${match.team1.name}!`, 'team1')} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow disabled:opacity-50">⚽ Goal</button>
                        <div className="grid grid-cols-2 gap-3">
                            <button disabled={isSubmitting} onClick={() => pushEvent('yellow_card', 'team1', `Yellow card - ${match.team1.name}`)} className="py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow disabled:opacity-50">🟨 Yellow</button>
                            <button disabled={isSubmitting} onClick={() => pushEvent('red_card', 'team1', `Red card - ${match.team1.name}`)} className="py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow disabled:opacity-50">🟥 Red</button>
                        </div>
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-2 mt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Substitution</h4>
                            <div className="flex gap-2">
                                <select value={t1SubOut} onChange={e => setT1SubOut(e.target.value)} className="w-1/2 bg-slate-800 text-xs text-white p-2 rounded">
                                    <option value="">Out (Pitch)...</option>
                                    {matchState.team1Squad?.startingXI.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                                </select>
                                <select value={t1SubIn} onChange={e => setT1SubIn(e.target.value)} className="w-1/2 bg-slate-800 text-xs text-white p-2 rounded">
                                    <option value="">In (Bench)...</option>
                                    {matchState.team1Squad?.bench.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                                </select>
                            </div>
                            <button disabled={isSubmitting} onClick={() => handleSub('team1')} className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded shadow disabled:opacity-50 text-sm">🔄 Sub</button>
                        </div>
                    </div>

                    {/* Team 2 Actions */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-300 border-b border-slate-700 pb-2 mb-4">{match.team2.name} Actions</h3>
                        <button disabled={isSubmitting} onClick={() => pushEvent('goal', 'team2', `Goal for ${match.team2.name}!`, 'team2')} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow disabled:opacity-50">⚽ Goal</button>
                        <div className="grid grid-cols-2 gap-3">
                            <button disabled={isSubmitting} onClick={() => pushEvent('yellow_card', 'team2', `Yellow card - ${match.team2.name}`)} className="py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow disabled:opacity-50">🟨 Yellow</button>
                            <button disabled={isSubmitting} onClick={() => pushEvent('red_card', 'team2', `Red card - ${match.team2.name}`)} className="py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow disabled:opacity-50">🟥 Red</button>
                        </div>
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-2 mt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Substitution</h4>
                            <div className="flex gap-2">
                                <select value={t2SubOut} onChange={e => setT2SubOut(e.target.value)} className="w-1/2 bg-slate-800 text-xs text-white p-2 rounded">
                                    <option value="">Out (Pitch)...</option>
                                    {matchState.team2Squad?.startingXI.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                                </select>
                                <select value={t2SubIn} onChange={e => setT2SubIn(e.target.value)} className="w-1/2 bg-slate-800 text-xs text-white p-2 rounded">
                                    <option value="">In (Bench)...</option>
                                    {matchState.team2Squad?.bench.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                                </select>
                            </div>
                            <button disabled={isSubmitting} onClick={() => handleSub('team2')} className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded shadow disabled:opacity-50 text-sm">🔄 Sub</button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-700 pt-6">
                    <h3 className="font-bold text-slate-300 mb-4">Match Status</h3>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setStatus('first_half')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white">First Half</button>
                        <button onClick={() => setStatus('halftime')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white">Half Time</button>
                        <button onClick={() => setStatus('second_half')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white">Second Half</button>
                        <button onClick={() => setStatus('finished')} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white font-bold">Finish Match</button>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-slate-800 border border-slate-700 p-6 rounded shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Event Log</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {events.map((e, idx) => (
                        <div key={idx} className="flex gap-4 p-3 bg-slate-900 border border-slate-700 rounded items-center">
                            <div className="font-mono text-blue-400 font-bold w-12 text-right">{e.minute}'</div>
                            <div className="text-white">{e.description}</div>
                        </div>
                    ))}
                    {events.length === 0 && <p className="text-slate-500 text-center py-4">No events pushed yet.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminMatchController;
