// src/components/Dashboard.tsx

import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import type { View, UserProfile, Tournament } from '../types';

// Import your new logo
import udugBetsLogo from '../assets/udug_bets_logo.png';

// Admin Components
import CreateTournamentContent from './admin/CreateTournamentContent';
import ListTournamentsContent from './admin/ListTournamentsContent';
import TournamentWizard from './admin/TournamentWizard';
import ManageUsersContent from './admin/ManageUsersContent';
import ScoreManagement from './admin/ScoreManagement';
import TournamentLeaderboard from './admin/TournamentLeaderboard';
import AllPredictionsView from './admin/AllPredictionsView';
import DebugSeeder from './admin/DebugSeeder';

// User Components
import JoinTournament from './views/JoinTournament';
import MyTournaments from './views/MyTournaments';
import PredictionEntry from './views/PredictionEntry';
import UserDashboard from './views/UserDashboard';
const LeaderboardContent = () => <div className="bg-slate-800 p-8">Leaderboard View - Coming Soon!</div>;

interface DashboardProps {
    userProfile: UserProfile;
}

const Dashboard = ({ userProfile }: DashboardProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>('User Dashboard');
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [predictingTournament, setPredictingTournament] = useState<Tournament | null>(null);
  const [managingTournament, setManagingTournament] = useState<Tournament | null>(null);
  const [viewingLeaderboardFor, setViewingLeaderboardFor] = useState<Tournament | null>(null);
  const [viewingAllPredictionsFor, setViewingAllPredictionsFor] = useState<Tournament | null>(null);
  const [isScoreManagerDirty, setIsScoreManagerDirty] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
      if (userProfile.role === 'admin' || userProfile.role === 'superadmin') {
        setActiveView('List Tournaments');
      } else {
        setActiveView('User Dashboard');
      }
  }, [userProfile]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleAdminClick = () => {
    if (!['Create Tournament', 'Manage Users', 'List Tournaments', 'Edit Tournament', 'Manage Scores', 'Debug'].includes(activeView)) {
      setActiveView('List Tournaments');
    }
    setIsAdminMenuOpen(!isAdminMenuOpen);
  };

  const handleSetView = (view: View) => {
    if ((activeView === 'Edit Tournament' && isEditorDirty) || (activeView === 'Manage Scores' && isScoreManagerDirty)) {
        const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave this page?");
        if (!confirmLeave) return;
    }
    setIsEditorDirty(false);
    setIsScoreManagerDirty(false);
    setPredictingTournament(null);
    setManagingTournament(null);
    setViewingLeaderboardFor(null);
    setViewingAllPredictionsFor(null);
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
  
  const handleEnterPredictions = (tournament: Tournament) => {
      setPredictingTournament(tournament);
  };

  const handleManageTournament = (tournament: Tournament) => {
      setManagingTournament(tournament);
      setActiveView('Manage Scores');
  };

  const handleViewLeaderboard = (tournament: Tournament) => {
      setViewingLeaderboardFor(tournament);
  };

  const handleViewAllPredictions = (tournament: Tournament) => {
      setViewingAllPredictionsFor(tournament);
  };

  const renderContent = () => {
    if (viewingAllPredictionsFor) {
        return <AllPredictionsView tournament={viewingAllPredictionsFor} onBack={() => setViewingAllPredictionsFor(null)} />;
    }
    if (viewingLeaderboardFor) {
        return <TournamentLeaderboard tournament={viewingLeaderboardFor} onBack={() => setViewingLeaderboardFor(null)} />;
    }
    if (predictingTournament) {
        return <PredictionEntry tournament={predictingTournament} userProfile={userProfile} onBack={() => setPredictingTournament(null)} />;
    }
    if (managingTournament) {
        return <ScoreManagement tournament={managingTournament} onBack={() => handleSetView('List Tournaments')} reportDirtyState={setIsScoreManagerDirty} />;
    }
    if (activeView === 'Edit Tournament' && editingTournamentId) {
        return <TournamentWizard tournamentId={editingTournamentId} onBackToList={() => handleSetView('List Tournaments')} reportDirtyState={setIsEditorDirty} />;
    }

    switch (activeView) {
      case 'User Dashboard':
        return <UserDashboard userProfile={userProfile} />;
      case 'Create Tournament':
        return <CreateTournamentContent user={user} onTournamentCreated={handleEditTournament} />;
      case 'List Tournaments':
        return <ListTournamentsContent 
                    onEditTournament={handleEditTournament} 
                    onManageTournament={handleManageTournament} 
                    onViewLeaderboard={handleViewLeaderboard}
                    onViewAllPredictions={handleViewAllPredictions}
                    userProfile={userProfile} 
                />;
      case 'Manage Users':
        return <ManageUsersContent userProfile={userProfile} />;
      case 'Join Tournament':
        return <JoinTournament userProfile={userProfile} setView={handleSetView} />;
      case 'Leaderboard':
        return <LeaderboardContent />;
      case 'Debug':
        return <DebugSeeder />;
      case 'My Tournaments':
      default:
        return <MyTournaments userProfile={userProfile} onEnterPredictions={handleEnterPredictions} />;
    }
  };

  const getHeaderTitle = () => {
    if (viewingAllPredictionsFor) return `All Predictions: ${viewingAllPredictionsFor.name}`;
    if (viewingLeaderboardFor) return `Leaderboard: ${viewingLeaderboardFor.name}`;
    if (predictingTournament) return `Predict: ${predictingTournament.name}`;
    if (managingTournament) return `Manage: ${managingTournament.name}`;
    return activeView;
  }

  return (
    <div className="relative min-h-screen md:flex bg-slate-900">
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

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
            <button onClick={() => handleSetView('User Dashboard')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'User Dashboard' ? 'bg-slate-700 text-white' : ''}`}>Dashboard</button>
            <button onClick={() => handleSetView('My Tournaments')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'My Tournaments' ? 'bg-slate-700 text-white' : ''}`}>My Tournaments</button>
            <button onClick={() => handleSetView('Join Tournament')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Join Tournament' ? 'bg-slate-700 text-white' : ''}`}>Join Tournament</button>
          </div>
          
          {(userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <button onClick={handleAdminClick} className="w-full text-left flex justify-between items-center py-2.5 px-4 hover:bg-slate-700">
                <span>Admin Panel</span>
                <svg className={`w-5 h-5 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              {isAdminMenuOpen && (
                <div className="pl-4 mt-2 space-y-1">
                  <button onClick={() => handleSetView('Create Tournament')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Create Tournament' ? 'bg-slate-700 text-white' : ''}`}>Create Tournament</button>
                   <button onClick={() => handleSetView('List Tournaments')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${(activeView === 'List Tournaments' || activeView === 'Edit Tournament' || activeView === 'Manage Scores') ? 'bg-slate-700 text-white' : ''}`}>List Tournaments</button>
                  <button onClick={() => handleSetView('Manage Users')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Manage Users' ? 'bg-slate-700 text-white' : ''}`}>Manage Users</button>
                  {userProfile.role === 'superadmin' && (
                    <button onClick={() => handleSetView('Debug')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Debug' ? 'bg-slate-700 text-white' : ''}`}>Debug</button>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
        
        <div className="px-4 py-4 border-t border-slate-700">
            <div className="flex justify-center mb-2">
                <img src={udugBetsLogo} alt="Udug Bets Logo" className="w-28 h-28 object-cover" />
            </div>
            <p className="text-sm font-semibold truncate text-center">{user?.displayName || 'User'}</p>
            <p className="text-xs text-slate-400 truncate text-center">{user?.email}</p>
        </div>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
          <button className="text-slate-300 md:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          
          <div className="text-lg md:text-xl font-semibold text-slate-100 truncate">{getHeaderTitle()}</div>
          
          <button onClick={handleSignOut} className="px-3 py-2 md:px-4 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm transition-colors whitespace-nowrap">Sign Out</button>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
