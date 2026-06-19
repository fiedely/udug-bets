// src/components/views/widgets/GroupStandingsWidget.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { Leaderboard, TeamStanding, Tournament } from '../../../types';

interface GroupStandingsWidgetProps {
    tournamentId?: string;
    setRefreshFunc: (func: () => void) => void;
}

const GroupStandingsWidget = ({ tournamentId, setRefreshFunc }: GroupStandingsWidgetProps) => {
    const [standings, setStandings] = useState<Record<string, TeamStanding[]> | null>(null);
    const [overrides, setOverrides] = useState<Record<string, string[]> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tournamentNotFound, setTournamentNotFound] = useState(false);

    const fetchData = useCallback(async () => {
        if (!tournamentId) return;
        setIsLoading(true);
        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const tourneyRef = doc(db, "tournaments", tournamentId);
        
        const [leaderboardSnap, tourneySnap] = await Promise.all([
            getDoc(leaderboardRef),
            getDoc(tourneyRef)
        ]);

        if (tourneySnap.exists()) {
            const data = tourneySnap.data() as Tournament;
            setOverrides(data.groupStandingsOverrides || null);
        } else {
            setTournamentNotFound(true);
            setStandings(null);
            setOverrides(null);
            setIsLoading(false);
            return;
        }

        if (leaderboardSnap.exists()) {
            const data = leaderboardSnap.data() as Leaderboard;
            setStandings(data.groupStandings || null);
        } else {
            setStandings(null);
        }
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        if (!tournamentId) {
            setIsLoading(false);
            setStandings(null);
            setTournamentNotFound(false);
            return;
        }

        setIsLoading(true);
        setTournamentNotFound(false);

        const leaderboardRef = doc(db, "leaderboards", tournamentId);
        const unsubscribeLeaderboard = onSnapshot(leaderboardRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Leaderboard;
                setStandings(data.groupStandings || null);
            } else {
                setStandings(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to leaderboard updates:", error);
            setIsLoading(false);
        });

        const tourneyRef = doc(db, "tournaments", tournamentId);
        const unsubscribeTourney = onSnapshot(tourneyRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Tournament;
                setOverrides(data.groupStandingsOverrides || null);
            } else {
                setTournamentNotFound(true);
            }
        });

        return () => {
            unsubscribeLeaderboard();
            unsubscribeTourney();
        };
    }, [tournamentId]);
    
    useEffect(() => {
        setRefreshFunc(fetchData);
    }, [fetchData, setRefreshFunc]);

    const displayStandings = useMemo(() => {
        if (!standings || Object.keys(standings).length === 0) return null;
        if (!overrides) return standings;
        const newStandings = { ...standings };
        for (const groupName in newStandings) {
            if (overrides[groupName] && overrides[groupName].length > 0) {
                const order = overrides[groupName];
                newStandings[groupName] = [...newStandings[groupName]].sort((a, b) => {
                    const idxA = order.indexOf(a.team.code);
                    const idxB = order.indexOf(b.team.code);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return 0;
                });
            }
        }
        return newStandings;
    }, [standings, overrides]);

    const advancingTeams = useMemo(() => {
        if (!displayStandings) return new Set<string>();

        const groupsCount = Object.keys(displayStandings).length;
        if (groupsCount === 0) return new Set<string>();

        let thirdPlaceCount = 0;
        if (groupsCount === 12) thirdPlaceCount = 8;
        else if (groupsCount === 6) thirdPlaceCount = 4;
        else if (groupsCount === 8) thirdPlaceCount = 0; // standard 32-team format
        else {
            // generic fallback
            const targetKnockoutTeams = groupsCount > 8 ? 32 : (groupsCount > 4 ? 16 : 8);
            thirdPlaceCount = Math.max(0, targetKnockoutTeams - (groupsCount * 2));
        }

        const topTeams = new Set<string>();
        const thirdPlaceTeams: TeamStanding[] = [];

        for (const groupName in displayStandings) {
            const group = displayStandings[groupName];
            if (group.length > 0) topTeams.add(group[0].team.code);
            if (group.length > 1) topTeams.add(group[1].team.code);
            if (group.length > 2 && thirdPlaceCount > 0) {
                thirdPlaceTeams.push(group[2]);
            }
        }

        if (thirdPlaceCount > 0) {
            thirdPlaceTeams.sort((a, b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
            });
            
            for (let i = 0; i < Math.min(thirdPlaceCount, thirdPlaceTeams.length); i++) {
                topTeams.add(thirdPlaceTeams[i].team.code);
            }
        }

        return topTeams;
    }, [displayStandings]);

    if (tournamentNotFound) {
        return (
            <div className="h-full flex items-center justify-center p-4 text-center">
                <p className="text-yellow-400 text-sm">
                    The tournament associated with this widget could not be found. It may have been deleted. Please edit the widget to select a new tournament.
                </p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Loading Standings...</p></div>;
    }
    if (!tournamentId) {
        return <div className="h-full flex items-center justify-center p-4"><p className="text-slate-400 text-sm text-center">Please join a tournament or select one in the widget settings.</p></div>;
    }
    if (!displayStandings) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm text-center">Group standings are not available yet.</p></div>;
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {Object.keys(displayStandings).sort().map(groupName => (
                    <div key={groupName} className="bg-slate-900/50 p-2">
                        <h4 className="font-bold text-blue-400 text-center mb-2">{groupName}</h4>
                        <table className="w-full text-xs text-slate-300 table-fixed">
                            <thead>
                                <tr className="text-slate-500">
                                    <th className="text-left font-medium py-1 px-1">Team</th>
                                    <th title="Matches Played" className="w-6 font-medium py-1">MP</th>
                                    <th title="Wins" className="w-6 font-medium py-1">W</th>
                                    <th title="Draws" className="w-6 font-medium py-1">D</th>
                                    <th title="Losses" className="w-6 font-medium py-1">L</th>
                                    <th title="Goal Difference" className="w-6 font-medium py-1">GD</th>
                                    <th title="Points" className="w-6 font-medium py-1">Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayStandings[groupName].map((s, index) => {
                                    const isAdvancing = advancingTeams.has(s.team.code);
                                    return (
                                        <tr key={s.team.code} className={`border-t border-slate-700 ${isAdvancing ? 'border-l-4 border-l-blue-500 bg-slate-800/30' : 'border-l-4 border-l-transparent'}`}>
                                            <td className="py-1 px-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-4 text-center flex-shrink-0">{index + 1}</span>
                                                    <span className="flex-shrink-0">{s.team.flag}</span>
                                                    <span className="truncate">{s.team.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-center font-mono">{s.mp}</td>
                                            <td className="text-center font-mono">{s.w}</td>
                                            <td className="text-center font-mono">{s.d}</td>
                                            <td className="text-center font-mono">{s.l}</td>
                                            <td className="text-center font-mono">{s.gd}</td>
                                            <td className="text-center font-mono font-bold text-white">{s.pts}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupStandingsWidget;
