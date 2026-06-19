// src/components/admin/AiConfiguration.tsx
import { useState, useEffect, useRef } from 'react';
import { db, functions } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { Tournament, AiTopic, UserProfile } from '../../types';
import { logAudit } from '../../utils/auditLogger';

interface AiConfigurationProps {
    tournament: Tournament;
    userProfile: UserProfile;
    onBack: () => void;
}

interface Connection {
    type: string;
    target: string;
}

interface ParticipantContext {
    gender: 'unknown' | 'male' | 'female';
    connections?: Connection[];
    notes?: string;
}

export default function AiConfiguration({ tournament, userProfile, onBack }: AiConfigurationProps) {
    const [topics, setTopics] = useState<AiTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [contexts, setContexts] = useState<Record<string, ParticipantContext>>({});
    const [isSavingContexts, setIsSavingContexts] = useState(false);
    
    // Form state
    const [newTopicTitle, setNewTopicTitle] = useState('');
    const [newTopicDetails, setNewTopicDetails] = useState('');
    const [newUsageMode, setNewUsageMode] = useState<'forced' | 'optional'>('optional');

    // Mentions state
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState<number | null>(null);
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Connection Mentions state
    const [connectionMentionSearch, setConnectionMentionSearch] = useState<string | null>(null);
    const [connectionMentionIndex, setConnectionMentionIndex] = useState<number | null>(null);
    const [connectionMentionSelectedIndex, setConnectionMentionSelectedIndex] = useState(0);
    const [activeConnectionInput, setActiveConnectionInput] = useState<{userId: string, connIndex: number} | null>(null);

    useEffect(() => {
        const fetchParticipants = async () => {
            if (!tournament.participants || tournament.participants.length === 0) return;
            try {
                const getParticipants = httpsCallable<{tournamentId: string}, UserProfile[]>(functions, 'getTournamentParticipants');
                const result = await getParticipants({ tournamentId: tournament.id });
                const users = result.data.sort((a, b) => a.name.localeCompare(b.name));
                setParticipants(users);
            } catch (err) {
                console.error("Error fetching participants:", err);
            }
        };
        const fetchContexts = async () => {
            try {
                const docRef = doc(db, `tournaments/${tournament.id}/aiConfig`, 'participantContext');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setContexts(snap.data().contexts || {});
                }
            } catch (err) {
                console.error("Error fetching contexts:", err);
            }
        };
        fetchParticipants();
        fetchContexts();
    }, [tournament]);

    useEffect(() => {
        const q = query(
            collection(db, `tournaments/${tournament.id}/aiTopics`),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiTopic));
            setTopics(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [tournament.id]);

    const handleDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewTopicDetails(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPosition);
        
        const match = textBeforeCursor.match(/@(\w*)$/);
        
        if (match) {
            setMentionSearch(match[1]);
            setMentionIndex(cursorPosition - match[1].length - 1);
            setMentionSelectedIndex(0);
        } else {
            setMentionSearch(null);
            setMentionIndex(null);
        }
    };

    const filteredParticipants = participants.filter(p => 
        p.name.toLowerCase().includes((mentionSearch || '').toLowerCase())
    );

    const insertMention = (name: string) => {
        if (mentionIndex === null) return;
        const textBeforeAt = newTopicDetails.substring(0, mentionIndex);
        const textAfterCursor = newTopicDetails.substring(mentionIndex + (mentionSearch?.length || 0) + 1);
        
        const newText = textBeforeAt + name + ' ' + textAfterCursor;
        setNewTopicDetails(newText);
        setMentionSearch(null);
        setMentionIndex(null);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = textBeforeAt.length + name.length + 1;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const handleDetailsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionSearch !== null && filteredParticipants.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionSelectedIndex(prev => (prev + 1) % filteredParticipants.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionSelectedIndex(prev => (prev - 1 + filteredParticipants.length) % filteredParticipants.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredParticipants[mentionSelectedIndex].name);
            } else if (e.key === 'Escape') {
                setMentionSearch(null);
                setMentionIndex(null);
            }
        }
    };

    const filteredConnectionParticipants = participants.filter(p => 
        p.name.toLowerCase().includes((connectionMentionSearch || '').toLowerCase())
    );

    const handleConnectionTargetChange = (e: React.ChangeEvent<HTMLInputElement>, userId: string, connIndex: number) => {
        const val = e.target.value;
        handleConnectionChange(userId, connIndex, 'target', val);
        setActiveConnectionInput({ userId, connIndex });

        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = val.substring(0, cursorPosition);
        
        const match = textBeforeCursor.match(/@(\w*)$/);
        
        if (match) {
            setConnectionMentionSearch(match[1]);
            setConnectionMentionIndex(cursorPosition - match[1].length - 1);
            setConnectionMentionSelectedIndex(0);
        } else {
            setConnectionMentionSearch(null);
            setConnectionMentionIndex(null);
        }
    };

    const insertConnectionMention = (name: string, userId: string, connIndex: number) => {
        if (connectionMentionIndex === null) return;
        const currentTarget = contexts[userId]?.connections?.[connIndex]?.target || '';
        const textBeforeAt = currentTarget.substring(0, connectionMentionIndex);
        const textAfterCursor = currentTarget.substring(connectionMentionIndex + (connectionMentionSearch?.length || 0) + 1);
        
        const newText = textBeforeAt + name + ' ' + textAfterCursor;
        handleConnectionChange(userId, connIndex, 'target', newText);
        setConnectionMentionSearch(null);
        setConnectionMentionIndex(null);
        setActiveConnectionInput(null);
    };

    const handleConnectionTargetKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, userId: string, connIndex: number) => {
        if (connectionMentionSearch !== null && filteredConnectionParticipants.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setConnectionMentionSelectedIndex(prev => (prev + 1) % filteredConnectionParticipants.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setConnectionMentionSelectedIndex(prev => (prev - 1 + filteredConnectionParticipants.length) % filteredConnectionParticipants.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertConnectionMention(filteredConnectionParticipants[connectionMentionSelectedIndex].name, userId, connIndex);
            } else if (e.key === 'Escape') {
                setConnectionMentionSearch(null);
                setConnectionMentionIndex(null);
            }
        }
    };

    const handleAddTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicTitle.trim() || !newTopicDetails.trim()) return;

        try {
            await addDoc(collection(db, `tournaments/${tournament.id}/aiTopics`), {
                topic: newTopicTitle.trim(),
                details: newTopicDetails.trim(),
                status: 'in_queue',
                usageMode: newUsageMode,
                createdAt: Timestamp.now()
            });
            await logAudit(userProfile, 'ADD_AI_TOPIC', `Added AI Topic to ${tournament.name}`, { title: newTopicTitle, usageMode: newUsageMode });
            setNewTopicTitle('');
            setNewTopicDetails('');
            setNewUsageMode('optional');
            setMentionSearch(null);
        } catch (error) {
            console.error("Error adding topic:", error);
            alert("Failed to add topic.");
        }
    };

    const handleUpdateTopic = async (topicId: string, field: keyof AiTopic, value: any) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/aiTopics`, topicId), {
                [field]: value
            });
            await logAudit(userProfile, 'UPDATE_AI_TOPIC', `Updated AI Topic in ${tournament.name}`, { topicId, field, value });
        } catch (error) {
            console.error("Error updating topic:", error);
            alert("Failed to update topic.");
        }
    };

    const handleDeleteTopic = async (topic: AiTopic) => {
        if (!window.confirm(`Are you sure you want to delete the topic "${topic.topic}"?`)) return;
        try {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/aiTopics`, topic.id));
            await logAudit(userProfile, 'DELETE_AI_TOPIC', `Deleted AI Topic from ${tournament.name}`, { topicId: topic.id, title: topic.topic });
        } catch (error) {
            console.error("Error deleting topic:", error);
            alert("Failed to delete topic.");
        }
    };

    const handleContextChange = (userId: string, field: 'gender' | 'notes', value: string) => {
        setContexts(prev => {
            const currentContext = prev[userId] || { gender: 'unknown', connections: [] };
            return {
                ...prev,
                [userId]: {
                    ...currentContext,
                    [field]: field === 'gender' ? value as 'unknown' | 'male' | 'female' : value
                }
            };
        });
    };

    const handleConnectionChange = (userId: string, index: number, field: keyof Connection, value: string) => {
        setContexts(prev => {
            const userContext = prev[userId] || ({ gender: 'unknown', connections: [] } as ParticipantContext);
            const connections = [...(userContext.connections || [])];
            if (connections[index]) {
                connections[index] = { ...connections[index], [field]: value };
            }
            return {
                ...prev,
                [userId]: {
                    ...userContext,
                    connections
                }
            };
        });
    };

    const addConnection = (userId: string) => {
        setContexts(prev => {
            const userContext = prev[userId] || ({ gender: 'unknown', connections: [] } as ParticipantContext);
            return {
                ...prev,
                [userId]: {
                    ...userContext,
                    connections: [...(userContext.connections || []), { type: 'friend', target: '' }]
                }
            };
        });
    };

    const removeConnection = (userId: string, index: number) => {
        setContexts(prev => {
            const userContext = prev[userId] || ({ gender: 'unknown', connections: [] } as ParticipantContext);
            const connections = [...(userContext.connections || [])];
            connections.splice(index, 1);
            return {
                ...prev,
                [userId]: {
                    ...userContext,
                    connections
                }
            };
        });
    };

    const inverseMap: Record<string, string> = {
        'spouse': 'spouse',
        'sibling': 'sibling',
        'kid': 'parent',
        'parent': 'kid',
        'grandparent': 'grandkid',
        'uncle/aunt': 'niece/nephew',
        'cousin': 'cousin',
        'niece/nephew': 'uncle/aunt',
        'friend': 'friend'
    };

    const getAutoConnections = (targetName: string) => {
        const autos: { type: string, target: string, sourceUserId: string }[] = [];
        Object.entries(contexts).forEach(([uid, ctx]) => {
            const sourceUser = participants.find(u => u.uid === uid);
            if (!sourceUser || sourceUser.name === targetName) return;
            (ctx.connections || []).forEach(conn => {
                const cleanTarget = conn.target.replace('@', '').trim();
                if (cleanTarget.toLowerCase() === targetName.toLowerCase()) {
                    const invType = inverseMap[conn.type] || 'connected';
                    autos.push({ type: invType, target: `@${sourceUser.name}`, sourceUserId: uid });
                }
            });
        });
        return autos;
    };

    const handleSaveContexts = async () => {
        setIsSavingContexts(true);
        try {
            await setDoc(doc(db, `tournaments/${tournament.id}/aiConfig`, 'participantContext'), { contexts });
            await logAudit(userProfile, 'UPDATE_AI_CONTEXT', `Updated Participant AI Contexts in ${tournament.name}`);
            alert("Participant contexts saved successfully!");
        } catch (error) {
            console.error("Error saving contexts:", error);
            alert("Failed to save contexts.");
        } finally {
            setIsSavingContexts(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto w-full">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage: {tournament.name}</h2>
                        <p className="text-sm text-slate-400">Manage AI Config: {tournament.name}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6 max-w-6xl mx-auto w-full">
                
                {/* SECTION 1: AI Topics */}
                <div className="bg-slate-800 rounded-lg shadow border border-slate-700 overflow-hidden flex flex-col md:flex-row h-[800px] md:h-[450px]">
                    {/* Add Topic Form */}
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-700 bg-slate-800/50 flex flex-col p-4 shrink-0">
                        <h3 className="text-md font-semibold text-blue-400 mb-4">Add New Topic</h3>
                        <form onSubmit={handleAddTopic} className="space-y-4 flex-1">
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-1">Topic Title</label>
                                <input 
                                    type="text" 
                                    value={newTopicTitle}
                                    onChange={e => setNewTopicTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    required
                                    placeholder="e.g. Upset of the Century"
                                />
                            </div>
                            <div className="relative flex-1 flex flex-col">
                                <label className="block text-sm font-semibold text-slate-300 mb-1">Details / Context</label>
                                <textarea 
                                    ref={textareaRef}
                                    value={newTopicDetails}
                                    onChange={handleDetailsChange}
                                    onKeyDown={handleDetailsKeyDown}
                                    onClick={handleDetailsChange as any}
                                    onKeyUp={handleDetailsChange as any}
                                    className="w-full bg-slate-900 border border-slate-600 rounded text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 resize-none"
                                    required
                                    placeholder="Describe the joke or context. Use @ to mention participants."
                                />
                                {mentionSearch !== null && filteredParticipants.length > 0 && (
                                    <ul className="absolute z-10 w-full max-h-40 overflow-y-auto bg-slate-700 border border-slate-600 rounded shadow-lg bottom-full left-0 text-sm mb-1">
                                        {filteredParticipants.map((p, i) => (
                                            <li 
                                                key={p.uid} 
                                                className={`px-3 py-1.5 cursor-pointer hover:bg-blue-600 ${i === mentionSelectedIndex ? 'bg-blue-600' : ''}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    insertMention(p.name);
                                                }}
                                            >
                                                {p.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-1">Usage Mode</label>
                                <select 
                                    value={newUsageMode}
                                    onChange={e => setNewUsageMode(e.target.value as 'forced' | 'optional')}
                                    className="w-full bg-slate-900 border border-slate-600 rounded text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                >
                                    <option value="optional">Optional</option>
                                    <option value="forced">Forced</option>
                                </select>
                            </div>
                            <button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors mt-2"
                            >
                                Add to Queue
                            </button>
                        </form>
                    </div>

                    {/* Topics List */}
                    <div className="w-full md:w-2/3 bg-slate-900 flex flex-col p-4 flex-1 overflow-hidden">
                        <h3 className="text-md font-semibold text-blue-400 mb-4 shrink-0">Topic Library</h3>
                        <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                            {isLoading ? (
                                <p className="text-slate-400 text-sm">Loading topics...</p>
                            ) : topics.length === 0 ? (
                                <p className="text-slate-500 text-sm">No topics added yet.</p>
                            ) : (
                                topics.map(topic => (
                                    <div key={topic.id} className="bg-slate-800 border border-slate-700 p-3 rounded shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-white text-base">{topic.topic}</h4>
                                            <button 
                                                onClick={() => handleDeleteTopic(topic)}
                                                className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/30 rounded"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <p className="text-slate-300 text-sm mb-3 italic">"{topic.details}"</p>
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <select 
                                                value={topic.status}
                                                onChange={e => handleUpdateTopic(topic.id, 'status', e.target.value)}
                                                className={`text-xs font-medium px-2 py-1 rounded border ${topic.status === 'in_queue' ? 'bg-yellow-900 border-yellow-700 text-yellow-100' : topic.status === 'used' ? 'bg-green-900 border-green-700 text-green-100' : 'bg-slate-700 border-slate-600 text-slate-300'} focus:outline-none`}
                                            >
                                                <option value="in_queue">In Queue</option>
                                                <option value="used">Used</option>
                                                <option value="not_active">Not Active</option>
                                            </select>

                                            <select 
                                                value={topic.usageMode}
                                                onChange={e => handleUpdateTopic(topic.id, 'usageMode', e.target.value)}
                                                className={`text-xs font-medium px-2 py-1 rounded border ${topic.usageMode === 'forced' ? 'bg-red-900 border-red-700 text-red-100' : 'bg-blue-900 border-blue-700 text-blue-100'} focus:outline-none`}
                                            >
                                                <option value="optional">Optional</option>
                                                <option value="forced">Forced</option>
                                            </select>
                                            
                                            <span className="text-xs text-slate-500 ml-auto">
                                                Added: {topic.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Participant Context Menu */}
                <div className="bg-slate-800 rounded-lg shadow border border-slate-700 flex flex-col overflow-hidden mb-8">
                    <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                        <div>
                            <h3 className="text-md font-semibold text-blue-400">Participant Context Menu</h3>
                            <p className="text-xs text-slate-400 mt-1">Set gender pronouns and custom notes for the AI to roast or praise them accurately.</p>
                        </div>
                        <button 
                            onClick={handleSaveContexts}
                            disabled={isSavingContexts}
                            className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white px-4 py-2 rounded text-sm font-bold shadow transition-colors"
                        >
                            {isSavingContexts ? 'Saving...' : 'Save Contexts'}
                        </button>
                    </div>
                    <div className="overflow-x-auto overscroll-x-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3">Participant</th>
                                    <th className="px-4 py-3 w-40">Gender</th>
                                    <th className="px-4 py-3">Relationships</th>
                                    <th className="px-4 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {participants.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-4 text-center text-slate-500">No participants found.</td>
                                    </tr>
                                ) : (
                                    participants.map(p => (
                                        <tr key={p.uid} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{p.name}</td>
                                            <td className="px-4 py-3 align-top">
                                                <select 
                                                    value={contexts[p.uid]?.gender || 'unknown'}
                                                    onChange={e => handleContextChange(p.uid, 'gender', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded text-slate-200 px-2 py-1.5 focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="unknown">Unknown</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="space-y-2">
                                                    {(contexts[p.uid]?.connections || []).map((conn, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center relative bg-slate-800/50 p-1.5 rounded border border-slate-700/50">
                                                            <span className="text-xs text-slate-400 whitespace-nowrap">is the</span>
                                                            <select
                                                                value={conn.type}
                                                                onChange={e => handleConnectionChange(p.uid, idx, 'type', e.target.value)}
                                                                className="bg-slate-900 border border-slate-600 rounded text-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500 w-28 shrink-0"
                                                            >
                                                                <option value="spouse">Spouse</option>
                                                                <option value="sibling">Sibling</option>
                                                                <option value="kid">Kid</option>
                                                                <option value="parent">Parent</option>
                                                                <option value="grandparent">Grandparent</option>
                                                                <option value="uncle/aunt">Uncle/Aunt</option>
                                                                <option value="cousin">Cousin</option>
                                                                <option value="niece/nephew">Niece/Nephew</option>
                                                                <option value="friend">Friend</option>
                                                            </select>
                                                            <span className="text-xs text-slate-400 whitespace-nowrap">of</span>
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={conn.target}
                                                                    onChange={e => handleConnectionTargetChange(e, p.uid, idx)}
                                                                    onKeyDown={e => handleConnectionTargetKeyDown(e, p.uid, idx)}
                                                                    onClick={e => handleConnectionTargetChange(e as any, p.uid, idx)}
                                                                    onKeyUp={e => handleConnectionTargetChange(e as any, p.uid, idx)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded text-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                                                                    placeholder="e.g. @Fyr"
                                                                />
                                                                {activeConnectionInput?.userId === p.uid && activeConnectionInput?.connIndex === idx && connectionMentionSearch !== null && filteredConnectionParticipants.length > 0 && (
                                                                    <ul className="absolute z-10 w-full max-h-40 overflow-y-auto bg-slate-700 border border-slate-600 rounded shadow-lg top-full left-0 text-xs mt-1">
                                                                        {filteredConnectionParticipants.map((fp, i) => (
                                                                            <li 
                                                                                key={fp.uid} 
                                                                                className={`px-2 py-1 cursor-pointer hover:bg-blue-600 ${i === connectionMentionSelectedIndex ? 'bg-blue-600' : ''}`}
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    insertConnectionMention(fp.name, p.uid, idx);
                                                                                }}
                                                                            >
                                                                                {fp.name}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={() => removeConnection(p.uid, idx)}
                                                                className="text-red-400 hover:text-red-300 px-1 font-bold text-lg leading-none"
                                                                title="Remove connection"
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => addConnection(p.uid)}
                                                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                                    >
                                                        + Add Relationship
                                                    </button>
                                                    
                                                    {getAutoConnections(p.name).map((autoConn, idx) => (
                                                        <div key={`auto-${idx}`} className="flex gap-2 items-center relative bg-slate-800/20 p-1.5 rounded border border-slate-700/30 opacity-60 pointer-events-none">
                                                            <span className="text-xs text-slate-500 whitespace-nowrap italic">is the</span>
                                                            <div className="bg-slate-900 border border-slate-700 rounded text-slate-400 px-2 py-1 text-xs w-28 shrink-0 capitalize">
                                                                {autoConn.type}
                                                            </div>
                                                            <span className="text-xs text-slate-500 whitespace-nowrap italic">of</span>
                                                            <div className="flex-1">
                                                                <div className="w-full bg-slate-900 border border-slate-700 rounded text-slate-400 px-2 py-1 text-xs">
                                                                    {autoConn.target}
                                                                </div>
                                                            </div>
                                                            <div className="w-5" /> {/* Spacer for symmetry with the 'x' button */}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <textarea 
                                                    value={contexts[p.uid]?.notes || ''}
                                                    onChange={e => handleContextChange(p.uid, 'notes', e.target.value)}
                                                    className="w-full min-w-[200px] h-20 bg-slate-900 border border-slate-600 rounded text-slate-200 px-3 py-1.5 focus:outline-none focus:border-blue-500 resize-y"
                                                    placeholder="e.g. Suka pasang aneh-aneh"
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
