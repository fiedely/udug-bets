// src/components/Dashboard.tsx

import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { View, UserProfile, Tournament } from '../types';

// Admin Components
import CreateTournamentContent from './admin/CreateTournamentContent';
import ListTournamentsContent from './admin/ListTournamentsContent';
import TournamentWizard from './admin/TournamentWizard';
import ManageUsersContent from './admin/ManageUsersContent';

// User Components
import JoinTournament from './views/JoinTournament'; 
import MyTournaments from './views/MyTournaments'; 
import PredictionEntry from './views/PredictionEntry'; // NEW
const LeaderboardContent = () => <div className="bg-slate-800 p-8 rounded-lg">Leaderboard View - Coming Soon!</div>;


const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>('My Tournaments');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  // NEW: State to manage which tournament is being predicted
  const [predictingTournament, setPredictingTournament] = useState<Tournament | null>(null);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      }
      setIsLoadingProfile(false);
    };
    fetchUserProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleAdminClick = () => {
    if (!['Create Tournament', 'Manage Users', 'List Tournaments', 'Edit Tournament'].includes(activeView)) {
      setActiveView('List Tournaments');
    }
    setIsAdminMenuOpen(!isAdminMenuOpen);
  };

  const handleSetView = (view: View) => {
    if (activeView === 'Edit Tournament' && isEditorDirty) {
        const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave this page?");
        if (!confirmLeave) return;
    }
    setIsEditorDirty(false);
    setPredictingTournament(null); // Clear prediction view when changing main view
    setActiveView(view);
    if (view !== 'Edit Tournament') {
      setEditingTournamentId(null);
    }
    setIsSidebarOpen(false);
  };

  const handleEditTournament = (id: string) => {
    setEditingTournamentId(id);
    setActiveView('Edit Tournament');
  };
  
  // NEW: Function to handle navigating to the prediction entry page
  const handleEnterPredictions = (tournament: Tournament) => {
      setPredictingTournament(tournament);
  };

  const renderContent = () => {
    if (isLoadingProfile) {
      return (
        <div className="flex items-center justify-center h-full">
           <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      );
    }
    
    // NEW: Prioritize rendering the prediction entry view if a tournament is selected
    if (predictingTournament) {
        return <PredictionEntry 
                 tournament={predictingTournament} 
                 userProfile={userProfile} 
                 onBack={() => setPredictingTournament(null)} 
               />;
    }

    if (activeView === 'Edit Tournament' && editingTournamentId) {
        return <TournamentWizard
                 tournamentId={editingTournamentId}
                 onBackToList={() => handleSetView('List Tournaments')}
                 reportDirtyState={setIsEditorDirty}
               />;
    }
    switch (activeView) {
      case 'Create Tournament':
        return <CreateTournamentContent user={user} onTournamentCreated={handleEditTournament} />;
      case 'List Tournaments':
        return <ListTournamentsContent onEditTournament={handleEditTournament} userProfile={userProfile} />;
      case 'Manage Users':
        return <ManageUsersContent userProfile={userProfile} />;
      
      case 'Join Tournament':
        return <JoinTournament userProfile={userProfile} setView={handleSetView} />;
      case 'Leaderboard':
        return <LeaderboardContent />;
      case 'My Tournaments':
      default:
        return <MyTournaments userProfile={userProfile} onEnterPredictions={handleEnterPredictions} />;
    }
  };

  return (
    <div className="relative min-h-screen md:flex bg-slate-900">
      <aside
        className={`
          bg-slate-800 border-r border-slate-700 text-slate-300 w-64 space-y-2 py-7 px-2
          absolute inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
          flex flex-col z-30
        `}
      >
        <div className="px-4">
          <h2 className="text-2xl font-bold text-blue-400">Udug Bets</h2>
        </div>
        <nav className="flex-grow">
          <div className="space-y-1">
            <button onClick={() => handleSetView('My Tournaments')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${activeView === 'My Tournaments' ? 'bg-slate-700 text-white' : ''}`}>My Tournaments</button>
            <button onClick={() => handleSetView('Join Tournament')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${activeView === 'Join Tournament' ? 'bg-slate-700 text-white' : ''}`}>Join Tournament</button>
            <button onClick={() => handleSetView('Leaderboard')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${activeView === 'Leaderboard' ? 'bg-slate-700 text-white' : ''}`}>Leaderboard</button>
          </div>
          
          {(userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <button onClick={handleAdminClick} className="w-full text-left flex justify-between items-center py-2.5 px-4 rounded-md hover:bg-slate-700">
                <span>Admin Panel</span>
                <svg className={`w-5 h-5 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              {isAdminMenuOpen && (
                <div className="pl-4 mt-2 space-y-1">
                  <button onClick={() => handleSetView('Create Tournament')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${activeView === 'Create Tournament' ? 'bg-slate-700 text-white' : ''}`}>Create Tournament</button>
                   <button onClick={() => handleSetView('List Tournaments')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${(activeView === 'List Tournaments' || activeView === 'Edit Tournament') ? 'bg-slate-700 text-white' : ''}`}>List Tournaments</button>
                  <button onClick={() => handleSetView('Manage Users')} className={`w-full text-left block py-2.5 px-4 rounded-md hover:bg-slate-700 ${activeView === 'Manage Users' ? 'bg-slate-700 text-white' : ''}`}>Manage Users</button>
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="px-4 py-2 border-t border-slate-700">
          <p className="text-sm font-semibold">{user?.displayName || 'User'}</p>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
          <button className="md:hidden text-slate-300" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          {/* UPDATED: Show tournament name in header when predicting */}
          <div className="text-xl font-semibold text-slate-100">{predictingTournament ? `Predict: ${predictingTournament.name}` : activeView}</div>
          <button onClick={handleSignOut} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm rounded-md transition-colors">Sign Out</button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
