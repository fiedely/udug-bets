// src/components/Dashboard.tsx

import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import type { View, UserProfile, Tournament } from '../types';
import { logAudit } from '../utils/auditLogger';
import udugBetsLogo from '../assets/udug_bets_logo.webp';
import CreateTournamentContent from './admin/CreateTournamentContent';
import ListTournamentsContent from './admin/ListTournamentsContent';
import TournamentWizard from './admin/TournamentWizard';
import ManageUsersContent from './admin/ManageUsersContent';
import ScoreManagement from './admin/ScoreManagement';
import TournamentLeaderboard from './admin/TournamentLeaderboard';
import AllPredictionsView from './admin/AllPredictionsView';
import AiConfiguration from './admin/AiConfiguration';
import DebugSeeder from './admin/DebugSeeder';
import JoinTournament from './views/JoinTournament';
import MyTournaments from './views/MyTournaments';
import PredictionEntry from './views/PredictionEntry';
import UserDashboard from './views/UserDashboard';
import UserProfileModal from './views/UserProfileModal';
import AuditLogViewer from './admin/AuditLogViewer';
import { useTranslation } from 'react-i18next';
import { useSwipeable } from 'react-swipeable';
const LeaderboardContent = () => <div className="bg-slate-800 p-8">Leaderboard View - Coming Soon!</div>;

interface DashboardProps {
    userProfile: UserProfile;
}

const Dashboard = ({ userProfile: initialProfile }: DashboardProps) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(initialProfile);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>('User Dashboard');
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(true);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [predictingTournament, setPredictingTournament] = useState<Tournament | null>(null);
  const [managingTournament, setManagingTournament] = useState<Tournament | null>(null);
  const [managingAiConfigFor, setManagingAiConfigFor] = useState<Tournament | null>(null);
  const [viewingLeaderboardFor, setViewingLeaderboardFor] = useState<Tournament | null>(null);
  const [viewingAllPredictionsFor, setViewingAllPredictionsFor] = useState<Tournament | null>(null);
  const [isScoreManagerDirty, setIsScoreManagerDirty] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { t } = useTranslation();

  const user = auth.currentUser;

  useEffect(() => {
      setUserProfile(initialProfile);
      if (initialProfile.role === 'admin' || initialProfile.role === 'superadmin') {
        setActiveView('List Tournaments');
      } else {
        setActiveView('User Dashboard');
      }
  }, [initialProfile]);

  const handleSignOut = async () => {
    try {
      await logAudit(userProfile, 'USER_LOGOUT', 'Sign Out clicked');
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

  const handleManageAiConfig = (tournament: Tournament) => {
      setManagingAiConfigFor(tournament);
      setActiveView('Manage AI Config');
  };

  const renderContent = () => {
    if (viewingAllPredictionsFor) {
        return <AllPredictionsView tournament={viewingAllPredictionsFor} onBack={() => setViewingAllPredictionsFor(null)} userProfile={userProfile} />;
    }
    if (viewingLeaderboardFor) {
        return <TournamentLeaderboard tournament={viewingLeaderboardFor} onBack={() => setViewingLeaderboardFor(null)} />;
    }
    if (predictingTournament) {
        return <PredictionEntry tournament={predictingTournament} userProfile={userProfile} onBack={() => setPredictingTournament(null)} />;
    }
    if (managingTournament) {
        return <ScoreManagement tournament={managingTournament} onBack={() => handleSetView('List Tournaments')} reportDirtyState={setIsScoreManagerDirty} userProfile={userProfile} />;
    }
    if (managingAiConfigFor) {
        return <AiConfiguration tournament={managingAiConfigFor} onBack={() => { setManagingAiConfigFor(null); handleSetView('List Tournaments'); }} userProfile={userProfile} />;
    }
    if (activeView === 'Edit Tournament' && editingTournamentId) {
        return <TournamentWizard tournamentId={editingTournamentId} onBackToList={() => handleSetView('List Tournaments')} reportDirtyState={setIsEditorDirty} userProfile={userProfile} />;
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
                    onManageAiConfig={handleManageAiConfig}
                    onCreateTournament={() => handleSetView('Create Tournament')}
                    userProfile={userProfile} 
                />;
      case 'Audit Logs':
        return <AuditLogViewer />;
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
    if (viewingLeaderboardFor) return `${t('dashboard.widget.leaderboard', 'Leaderboard')}: ${viewingLeaderboardFor.name}`;
    if (predictingTournament) return `Predict: ${predictingTournament.name}`;
    if (managingTournament) return `Manage: ${managingTournament.name}`;
    if (activeView === 'User Dashboard') return t('menu.myDashboard', 'My Dashboard');
    
    // For specific active views that match keys
    if (activeView === 'My Tournaments') return t('menu.myTournaments', 'My Tournaments');
    if (activeView === 'List Tournaments') return t('menu.listTournaments', 'List Tournaments');
    if (activeView === 'Create Tournament') return t('menu.createTournament', 'Create Tournament');
    if (activeView === 'Manage Users') return t('menu.manageUsers', 'Manage Users');
    if (activeView === 'Debug') return t('menu.debug', 'Debug');
    if (activeView === 'Audit Logs') return 'Audit Logs';

    return activeView;
  }

  const swipeHandlers = useSwipeable({
      onSwipedRight: (eventData) => {
          if (window.innerWidth < 768 && eventData.initial[0] <= 50) {
              setIsSidebarOpen(true);
          }
      },
      onSwipedLeft: () => {
          if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
          }
      },
      preventScrollOnSwipe: true,
      trackMouse: false
  });

  return (
    <>
      {isProfileModalOpen && (
          <UserProfileModal 
              userProfile={userProfile} 
              onClose={() => setIsProfileModalOpen(false)}
              onProfileUpdate={(updatedProfile) => setUserProfile(updatedProfile)}
          />
      )}
      <div {...swipeHandlers} className="relative h-[100dvh] flex bg-slate-900 overflow-hidden">
        {isSidebarOpen && (
          <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        <aside
          className={`
            bg-slate-800 border-r border-slate-700 text-slate-300 w-64 space-y-2 py-7 px-2
            absolute inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
            flex flex-col z-50
          `}
        >
          <div className="px-4">
            <h2 className="text-2xl font-bold text-blue-400">Udug Bets</h2>
          </div>
          <nav className="flex-grow overflow-y-auto">
            <div className="space-y-1">
              <button onClick={() => handleSetView('User Dashboard')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'User Dashboard' ? 'bg-slate-700 text-white' : ''}`}>{t('menu.myDashboard', 'My Dashboard')}</button>
              {(userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin') && (
                  <button onClick={() => handleSetView('My Tournaments')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'My Tournaments' ? 'bg-slate-700 text-white' : ''}`}>{t('menu.myTournaments', 'My Tournaments')}</button>
              )}
              <button onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }} className="w-full text-left block py-2.5 px-4 hover:bg-slate-700">{t('menu.myProfile', 'My Profile')}</button>
            </div>
            
            {(userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <button onClick={handleAdminClick} className="w-full text-left flex justify-between items-center py-2.5 px-4 hover:bg-slate-700">
                  <span>{t('menu.adminPanel', 'Admin Panel')}</span>
                  <svg className={`w-5 h-5 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {isAdminMenuOpen && (
                  <div className="pl-4 mt-2 space-y-1">
                     <button onClick={() => handleSetView('List Tournaments')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${(activeView === 'List Tournaments' || activeView === 'Edit Tournament' || activeView === 'Manage Scores') ? 'bg-slate-700 text-white' : ''}`}>{t('menu.listTournaments', 'List Tournaments')}</button>
                    <button onClick={() => handleSetView('Manage Users')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Manage Users' ? 'bg-slate-700 text-white' : ''}`}>{t('menu.manageUsers', 'Manage Users')}</button>
                    <button onClick={() => handleSetView('Audit Logs')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Audit Logs' ? 'bg-slate-700 text-white' : ''}`}>Audit Logs</button>
                    {userProfile.role === 'superadmin' && (
                      <button onClick={() => handleSetView('Debug')} className={`w-full text-left block py-2.5 px-4 hover:bg-slate-700 ${activeView === 'Debug' ? 'bg-slate-700 text-white' : ''} text-red-500 font-bold`}>Debug (Don't Touch)</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          <div className="px-4 py-4 border-t border-slate-700 flex flex-col items-center">
              <div className="flex justify-center mb-2">
                  {userProfile?.avatarUrl || user?.photoURL ? (
                      <img loading="lazy" decoding="async" src={userProfile?.avatarUrl || user?.photoURL || ''} alt="Avatar" className="w-24 h-24 rounded-full transform-gpu object-cover border-2 border-slate-600" />
                  ) : (
                      <img loading="lazy" decoding="async" src={udugBetsLogo} alt="Udug Bets Logo" className="w-28 h-28 object-cover" />
                  )}
              </div>
              <p className="text-sm font-semibold truncate text-center w-full">{user?.displayName || 'User'}</p>
              <p className="text-xs text-slate-400 truncate text-center w-full">{user?.email}</p>
              <button onClick={handleSignOut} className="text-xs text-blue-400 hover:text-blue-300 mt-2 hover:underline">{t('menu.signOut', 'Sign Out')}</button>
          </div>
        </aside>
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 p-4 flex justify-between items-center shadow-sm">
            <button className="text-slate-300 md:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            
            <div className="text-lg md:text-xl font-semibold text-slate-100 truncate flex-1 ml-4 md:ml-0">{getHeaderTitle()}</div>
            
            <div className="flex items-center gap-2">
                {/* Actions moved to sidebar */}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 overflow-y-auto min-h-0">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
