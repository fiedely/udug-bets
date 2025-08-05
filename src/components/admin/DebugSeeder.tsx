// src/components/admin/DebugSeeder.tsx

import { useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { faker } from '@faker-js/faker'; // Make sure @faker-js/faker is installed
import type { Team, UserProfile, Match } from '../../types';

const TOURNAMENT_NAME_PREFIX = "Seeded Test Showdown";
const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L', 'Group M', 'Group N', 'Group O', 'Group P'];

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

const getRoundRobinPairs = (teams: Team[]) => {
    const pairs: { t1: Team; t2: Team }[] = [];
    if (teams.length < 2) return [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            pairs.push({ t1: teams[i], t2: teams[j] });
        }
    }
    return pairs;
};

// Function to create a single fake user, adapted from your seed.js
const createFakeUser = () => {
  const name = faker.person.fullName();
  const email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] }).toLowerCase();
  return {
    uid: faker.string.uuid(),
    name,
    email,
    role: 'user' as const,
  };
};


const DebugSeeder = () => {
    // State for full tournament seeder
    const [isSeedingTournament, setIsSeedingTournament] = useState(false);
    const [tournamentLog, setTournamentLog] = useState<string[]>([]);
    const [numTeams, setNumTeams] = useState(32);
    const [numParticipants, setNumParticipants] = useState(20);

    // State for user-only seeder
    const [isSeedingUsers, setIsSeedingUsers] = useState(false);
    const [userSeedLog, setUserSeedLog] = useState<string[]>([]);
    const [numUsersToSeed, setNumUsersToSeed] = useState(50);


    const addTournamentLog = (message: string) => {
        console.log(`[Tournament] ${message}`);
        setTournamentLog(prev => [...prev, message]);
    };

    const addUserSeedLog = (message: string) => {
        console.log(`[User Seed] ${message}`);
        setUserSeedLog(prev => [...prev, message]);
    };

    const handleSeedTournament = async () => {
        setIsSeedingTournament(true);
        setTournamentLog([]);
        
        const teamsPerGroup = 4;
        const numGroups = numTeams / teamsPerGroup;
        if (numTeams % teamsPerGroup !== 0) {
            addTournamentLog(`❌ Error: Number of teams (${numTeams}) must be a multiple of ${teamsPerGroup}.`);
            setIsSeedingTournament(false);
            return;
        }

        try {
            addTournamentLog("Step 1: Fetching available teams and users...");
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const allTeamsData = teamsSnapshot.docs.map(doc => doc.data() as Team);
            if (allTeamsData.length < numTeams) {
                 throw new Error(`Not enough teams in 'teams' collection. Found ${allTeamsData.length}, need ${numTeams}.`);
            }
            const allTeams = allTeamsData.slice(0, numTeams);

            const usersQuery = query(collection(db, 'users'), where('role', '==', 'user'));
            const usersSnapshot = await getDocs(usersQuery);
            const allUsersData = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
            if (allUsersData.length < numParticipants) {
                throw new Error(`Not enough users in 'users' collection. Found ${allUsersData.length}, need ${numParticipants}.`);
            }
            const participants = allUsersData.slice(0, numParticipants);
            const participantIds = participants.map(p => p.uid);
            addTournamentLog(`   -> Using ${allTeams.length} teams and ${participants.length} users.`);
            
            addTournamentLog("Step 2: Structuring tournament...");
            const tournamentGroups: Record<string, Team[]> = {};
            for (let i = 0; i < numGroups; i++) {
                const groupName = GROUPS[i];
                const startIndex = i * teamsPerGroup;
                tournamentGroups[groupName] = allTeams.slice(startIndex, startIndex + teamsPerGroup);
            }

            let matchCounter = 1;
            const groupMatches: Match[] = [];
            Object.entries(tournamentGroups).forEach(([groupName, teams]) => {
                const pairs = getRoundRobinPairs(teams);
                pairs.forEach((pair, index) => {
                    groupMatches.push({
                        id: `match-group-${groupName.toLowerCase().replace(' ', '')}-${index}`,
                        stage: 'Group Stage', group: groupName, matchNumber: matchCounter++,
                        team1: pair.t1, team2: pair.t2, date: new Date().toISOString(),
                        stadium: { name: "Test Stadium", city: "Test City" },
                    });
                });
            });

            addTournamentLog("Step 3: Creating tournament and prediction documents in a batch...");
            const batch = writeBatch(db);
            const tournamentRef = doc(collection(db, 'tournaments'));
            const newTournament = {
                name: `${TOURNAMENT_NAME_PREFIX} (${numTeams} Teams)`,
                id: tournamentRef.id, status: 'active',
                creatorId: 'seed_script', ticket: String(getRandomInt(100000, 999999)),
                teams: allTeams, groups: tournamentGroups, matches: groupMatches,
                knockoutMatches: [], participants: participantIds,
                pointRules: {
                    groupStage: { correctScore: 3, correctOutcome: 1 },
                    round16: { correctScore: 4, correctOutcome: 2 }, quarterFinal: { correctScore: 5, correctOutcome: 3 },
                    semiFinal: { correctScore: 6, correctOutcome: 4 }, thirdPlaceMatch: { correctScore: 6, correctOutcome: 4 },
                    final: { correctScore: 8, correctOutcome: 5 }, championBonus: 15,
                },
                predictionStatus: { allowChampion: true, allowGroupStage: true, allowRoundOf16: false, allowQuarterFinal: false, allowSemiFinal: false, allowFinals: false },
            };
            batch.set(tournamentRef, newTournament as any);

            participants.forEach(user => {
                const predictionDocRef = doc(db, 'predictions', `${newTournament.id}_${user.uid}`);
                const matchPredictions: Record<string, {team1Score: number, team2Score: number}> = {};
                groupMatches.forEach(match => {
                    matchPredictions[match.id] = { team1Score: getRandomInt(0, 4), team2Score: getRandomInt(0, 4) };
                });
                batch.set(predictionDocRef, {
                    tournamentId: newTournament.id, userId: user.uid,
                    matchPredictions, championPrediction: getRandomElement(allTeams).code,
                });
            });

            await batch.commit();
            addTournamentLog("--- ✅ Seeding Complete! ---");

        } catch (error: any) {
            addTournamentLog(`--- ❌ An error occurred: ${error.message} ---`);
        } finally {
            setIsSeedingTournament(false);
        }
    };

    const handleSeedUsers = async () => {
        setIsSeedingUsers(true);
        setUserSeedLog([]);
        addUserSeedLog(`Starting to generate ${numUsersToSeed} fake users...`);

        try {
            const batch = writeBatch(db);
            const usersCollection = collection(db, 'users');

            for (let i = 0; i < numUsersToSeed; i++) {
                const fakeUser = createFakeUser();
                const userRef = doc(usersCollection, fakeUser.uid);
                batch.set(userRef, fakeUser);
            }
            
            await batch.commit();
            addUserSeedLog(`--- ✅ Successfully added ${numUsersToSeed} users to the database. ---`);
        } catch (error: any) {
            addUserSeedLog(`--- ❌ Error writing batch to Firestore: ${error.message} ---`);
        } finally {
            setIsSeedingUsers(false);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-8 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-blue-400">Debug & Seeding Panel</h2>
                <p className="mt-2 text-slate-400 text-sm">Use these tools for testing purposes. (Visible to superadmins only)</p>
            </div>

            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white">Generate Full Test Tournament</h3>
                <p className="mt-1 text-slate-400 text-sm mb-4">
                    Creates a new tournament, adds existing users, and generates random predictions.
                </p>
                <div className="flex items-end gap-4">
                    <div>
                        <label className="text-xs text-slate-400"># of Teams</label>
                        <input type="number" value={numTeams} onChange={e => setNumTeams(Number(e.target.value))} step="4" className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 text-white" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400"># of Participants</label>
                        <input type="number" value={numParticipants} onChange={e => setNumParticipants(Number(e.target.value))} className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 text-white" />
                    </div>
                    <button
                        onClick={handleSeedTournament}
                        disabled={isSeedingTournament}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold text-white disabled:bg-indigo-800 disabled:cursor-not-allowed"
                    >
                        {isSeedingTournament ? 'Seeding...' : 'Generate Tournament'}
                    </button>
                </div>

                {tournamentLog.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-900 text-xs text-slate-300 font-mono h-48 overflow-y-auto">
                        {tournamentLog.map((line, index) => <p key={index}>{line}</p>)}
                    </div>
                )}
            </div>
            
            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white">Seed Fake Users</h3>
                <p className="mt-1 text-slate-400 text-sm mb-4">
                    Creates new fake user accounts in the 'users' collection with the 'user' role.
                </p>
                <div className="flex items-end gap-4">
                     <div>
                        <label className="text-xs text-slate-400"># of Users to Create</label>
                        <input type="number" value={numUsersToSeed} onChange={e => setNumUsersToSeed(Number(e.target.value))} className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 text-white" />
                    </div>
                    <button
                        onClick={handleSeedUsers}
                        disabled={isSeedingUsers}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 font-semibold text-white disabled:bg-teal-800 disabled:cursor-not-allowed"
                    >
                        {isSeedingUsers ? 'Creating...' : 'Seed Users'}
                    </button>
                </div>
                 {userSeedLog.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-900 text-xs text-slate-300 font-mono h-48 overflow-y-auto">
                        {userSeedLog.map((line, index) => <p key={index}>{line}</p>)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebugSeeder;