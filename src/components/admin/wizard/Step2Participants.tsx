// src/components/admin/wizard/Step2Participants.tsx

import { useState, useMemo, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { Tournament, Team } from '../../../types';
import { FIFA_COUNTRIES } from '../../../data/countries';

interface Step2ParticipantsProps {
    tournament: Tournament;
    onNext: () => void;
    onBack: () => void;
    setIsDirty: (dirty: boolean) => void;
}

const Step2Participants = ({ tournament, onNext, onBack, setIsDirty }: Step2ParticipantsProps) => {
    const initialTeams = tournament.teams || [];
    const [selectedTeams, setSelectedTeams] = useState<Team[]>(initialTeams);

    const [groups, setGroups] = useState<Record<string, Team[]>>(tournament.groups || {});
    const [numGroups, setNumGroups] = useState(Object.keys(tournament.groups || {}).length || 8);
    const [teamsPerGroup, setTeamsPerGroup] = useState(4);

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const markDirty = () => setIsDirty(true);

    useEffect(() => {
        const newGroups: Record<string, Team[]> = {};
        let structureChanged = false;

        for (let i = 0; i < numGroups; i++) {
            const groupName = `Group ${String.fromCharCode(65 + i)}`;
            newGroups[groupName] = groups[groupName] || [];
            if (!groups[groupName]) {
                structureChanged = true;
            }
        }

        if (Object.keys(groups).length !== numGroups) {
            structureChanged = true;
        }

        if (structureChanged) {
            setGroups(newGroups);
             if (Object.keys(groups).length > 0 || numGroups !== 8) {
                markDirty();
            }
        }
    }, [numGroups, groups]);

    const handleTeamSelect = (team: Team) => {
        const isSelected = selectedTeams.some(t => t.code === team.code);

        if (isSelected) {
            setSelectedTeams(prev => prev.filter(t => t.code !== team.code));
            const updatedGroups = { ...groups };
            for (const groupName in updatedGroups) {
                updatedGroups[groupName] = updatedGroups[groupName].filter(t => t.code !== team.code);
            }
            setGroups(updatedGroups);
        } else {
            setSelectedTeams(prev => [...prev, team]);
        }
        markDirty();
    };

    const availableTeams = useMemo(() => {
        const assignedCodes = Object.values(groups).flat().map(t => t.code);
        return selectedTeams.filter(t => !assignedCodes.includes(t.code));
    }, [selectedTeams, groups]);

    const handleDropInGroup = (groupName: string, e: React.DragEvent) => {
        e.preventDefault();
        const teamData = e.dataTransfer.getData("team");
        if (!teamData) return;

        const team: Team = JSON.parse(teamData);

        if (groups[groupName].length >= teamsPerGroup) {
            setMessage(`Error: Group ${groupName} is full.`);
            return;
        }

        setGroups(prev => ({
            ...prev,
            [groupName]: [...prev[groupName], team]
        }));
        markDirty();
    };

    const removeTeamFromGroup = (groupName: string, teamCode: string) => {
        setGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].filter(t => t.code !== teamCode)
        }));
        markDirty();
    };

    const handleSave = async (continueToNext: boolean) => {
        setIsSaving(true);
        setMessage('');
        try {
            const tournamentRef = doc(db, "tournaments", tournament.id);
            const updatedData: Partial<Tournament> = {
                teams: selectedTeams,
                groups: groups,
            };

            await updateDoc(tournamentRef, updatedData);
            setMessage('Participants and Groups saved successfully!');
            setIsDirty(false);

            if (continueToNext) {
                onNext();
            }
        } catch (err) {
            console.error(err);
            setMessage('Error saving progress.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mt-4 space-y-6">
            <h2 className="text-2xl font-bold text-blue-400">Step 2: Participants and Groups</h2>

            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 border border-slate-700 bg-slate-900/50">
                <div>
                    <label className="block text-sm font-medium text-slate-300">Number of Groups</label>
                    <input type="number" min="1" max="16" value={numGroups} onChange={e => setNumGroups(Number(e.target.value))} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Max Teams per Group</label>
                    <input type="number" min="2" max="8" value={teamsPerGroup} onChange={e => {setTeamsPerGroup(Number(e.target.value)); markDirty();}} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-100" />
                </div>
                <div className="pt-6 text-slate-400">
                    Total Teams Recommended: {numGroups * teamsPerGroup}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">Select Teams ({selectedTeams.length} selected)</h3>
                    <div className="h-96 overflow-y-auto border border-slate-700 p-2 space-y-1 bg-slate-900">
                        {FIFA_COUNTRIES.map(country => (
                            <div key={country.code} className="flex items-center justify-between p-2 hover:bg-slate-700 cursor-pointer" onClick={() => handleTeamSelect(country)}>
                                <span className="text-sm text-slate-100 flex items-center gap-2">
                                    {country.flag}
                                    {country.name}
                                </span>
                                <input type="checkbox" checked={selectedTeams.some(t => t.code === country.code)} readOnly className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-100 mb-2">Available Pool (Drag to Group)</h3>
                        <div className="h-96 overflow-y-auto border border-dashed border-slate-500 p-2 space-y-2 bg-slate-900">
                            {availableTeams.map(team => (
                                <div
                                    key={team.code}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData("team", JSON.stringify(team))}
                                    className="p-2 bg-blue-700 hover:bg-blue-600 cursor-grab text-white text-sm shadow-md flex items-center gap-2"
                                >
                                    {team.flag} {team.name}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-100 mb-2">Groups</h3>
                        <div className="h-96 overflow-y-auto space-y-4 pr-2">
                            {Object.keys(groups).sort().map(groupName => (
                                <div
                                    key={groupName}
                                    className="border border-blue-500 p-3 bg-slate-700/50"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDropInGroup(groupName, e)}
                                >
                                    <h4 className="font-medium text-blue-400 mb-2">{groupName} ({groups[groupName].length}/{teamsPerGroup})</h4>
                                    <div className="space-y-1 min-h-[2rem]">
                                        {groups[groupName].map(team => (
                                            <div key={team.code} className="flex justify-between items-center text-sm text-white p-1 bg-slate-900">
                                                <span className="flex items-center gap-2">
                                                    {team.flag} {team.name}
                                                </span>
                                                <button onClick={() => removeTeamFromGroup(groupName, team.code)} className="text-red-500 hover:text-red-300 ml-2 px-2">X</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {message && <p className={`text-sm text-center mt-4 ${message.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}

            <div className="flex gap-4 pt-4 mt-6 border-t border-slate-700">
                <button type="button" onClick={onBack} className="w-1/4 px-4 py-3 bg-slate-700 hover:bg-slate-600 font-semibold text-white transition-colors">
                    Back
                </button>
                <button type="button" onClick={() => handleSave(false)} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                    {isSaving ? 'Saving...' : 'Save Progress'}
                </button>
                <button type="button" onClick={() => handleSave(true)} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
                    Save & Continue
                </button>
            </div>
        </div>
    );
};

export default Step2Participants;
