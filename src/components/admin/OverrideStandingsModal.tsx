import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Tournament, Team, Leaderboard, UserProfile } from '../../types';
import { logAudit } from '../../utils/auditLogger';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface OverrideStandingsModalProps {
    tournament: Tournament;
    userProfile: UserProfile;
    onClose: () => void;
}

const SortableTeamRow = ({ code, team, index, overriddenOrder }: { code: string, team: Team, index: number, overriddenOrder: boolean }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: code });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className={`flex items-center justify-between p-2 rounded mb-1 bg-slate-800 border border-slate-700 ${overriddenOrder ? 'ring-1 ring-orange-800' : ''}`}>
            <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono w-4">{index + 1}.</span>
                <span className="text-2xl">{team.flag}</span>
                <span className="text-white font-medium">{team.name}</span>
                <span className="text-xs text-slate-500">({team.code})</span>
            </div>
            {/* Drag Handle Area */}
            <div 
                {...attributes} 
                {...listeners} 
                className="text-slate-500 cursor-grab active:cursor-grabbing p-2 hover:bg-slate-700 rounded touch-none"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>
        </div>
    );
};

const OverrideStandingsModal = ({ tournament, userProfile, onClose }: OverrideStandingsModalProps) => {
    const [overrides, setOverrides] = useState<Record<string, string[]>>({});
    const [actualStandings, setActualStandings] = useState<Record<string, string[]> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const fetchFreshData = async () => {
            setIsLoading(true);
            try {
                const [tourneySnap, leaderboardSnap] = await Promise.all([
                    getDoc(doc(db, 'tournaments', tournament.id)),
                    getDoc(doc(db, 'leaderboards', tournament.id))
                ]);
                
                if (tourneySnap.exists()) {
                    setOverrides(tourneySnap.data().groupStandingsOverrides || {});
                } else {
                    setOverrides(tournament.groupStandingsOverrides || {});
                }

                if (leaderboardSnap.exists()) {
                    const lbData = leaderboardSnap.data() as Leaderboard;
                    if (lbData.groupStandings) {
                        const standingsCodes: Record<string, string[]> = {};
                        for (const group in lbData.groupStandings) {
                            standingsCodes[group] = lbData.groupStandings[group].map(s => s.team.code);
                        }
                        setActualStandings(standingsCodes);
                    }
                }
            } catch (err) {
                console.error("Error fetching fresh data", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFreshData();
    }, [tournament.id, tournament.groupStandingsOverrides]);

    const handleDragEnd = (event: DragEndEvent, groupName: string) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            setOverrides((prev) => {
                const currentOrder = prev[groupName] 
                    ? [...prev[groupName]] 
                    : (actualStandings?.[groupName] || (tournament.groups?.[groupName] || []).map(t => t.code));

                const oldIndex = currentOrder.indexOf(active.id as string);
                const newIndex = currentOrder.indexOf(over.id as string);
                
                return {
                    ...prev,
                    [groupName]: arrayMove(currentOrder, oldIndex, newIndex),
                };
            });
        }
    };

    const handleReset = (groupName: string) => {
        setOverrides(prev => {
            const newOverrides = { ...prev };
            delete newOverrides[groupName];
            return newOverrides;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            const tourneyRef = doc(db, 'tournaments', tournament.id);
            await updateDoc(tourneyRef, {
                groupStandingsOverrides: overrides
            });
            await logAudit(userProfile, 'OVERRIDE_GROUP_STANDING', `Overrode group standings for tournament: ${tournament.name}`, { tournamentId: tournament.id, overrides });
            onClose();
        } catch (err: any) {
            console.error("Error saving overrides", err);
            setError(err.message || "Failed to save overrides.");
            setIsSaving(false);
        }
    };

    const groups = tournament.groups || {};
    const groupNames = Object.keys(groups).sort();

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                <div className="bg-slate-800 border border-slate-700 shadow-xl max-w-sm w-full p-8 text-center rounded">
                    <p className="text-white">Loading current standings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col rounded">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Override Group Standings: {tournament.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-grow custom-scrollbar space-y-6">
                    {error && <div className="p-2 bg-red-900/50 border border-red-500 text-red-200 text-sm mb-4">{error}</div>}
                    <p className="text-sm text-slate-400 mb-4">
                        Drag and drop teams to force their position in the standings. This will override the automatic calculation (Points, GD, GF) in the dashboard widget. Click "Reset to Auto" to let the system calculate it automatically again.
                    </p>

                    {groupNames.map(groupName => {
                        const originalTeams = groups[groupName];
                        const overriddenOrder = overrides[groupName];
                        
                        const teamMap = new Map<string, Team>(originalTeams.map(t => [t.code, t]));
                        const activeTeamCodes = overriddenOrder || (actualStandings?.[groupName] || originalTeams.map(t => t.code));

                        return (
                            <div key={groupName} className={`bg-slate-900 p-4 rounded border ${overriddenOrder ? 'border-orange-800/50 bg-orange-900/10' : 'border-slate-700'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-white text-md">{groupName}</h4>
                                    {overriddenOrder && (
                                        <button 
                                            onClick={() => handleReset(groupName)}
                                            className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white"
                                        >
                                            Reset to Auto
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <DndContext 
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(e) => handleDragEnd(e, groupName)}
                                    >
                                        <SortableContext 
                                            items={activeTeamCodes}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {activeTeamCodes.map((code, index) => {
                                                const team = teamMap.get(code);
                                                if (!team) return null;
                                                return (
                                                    <SortableTeamRow 
                                                        key={code}
                                                        code={code}
                                                        team={team}
                                                        index={index}
                                                        overriddenOrder={!!overriddenOrder}
                                                    />
                                                );
                                            })}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-800">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded disabled:opacity-50">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save Overrides'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverrideStandingsModal;
