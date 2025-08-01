// src/components/Dashboard.tsx

import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const Dashboard = () => {
  // State to manage the visibility of the sidebar on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // --- Sidebar Component ---
  const Sidebar = () => (
    <aside 
      className={`
        bg-slate-800 border-r border-slate-700 text-slate-300 w-64 space-y-6 py-7 px-2
        absolute inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
        flex flex-col
      `}
    >
      <div className="px-4">
        <h2 className="text-2xl font-bold text-blue-400">Udug Bets</h2>
      </div>
      <nav className="flex-grow">
        {/* We will add navigation links here later */}
        <a href="#" className="block py-2.5 px-4 bg-slate-700 text-white">Dashboard</a>
        <a href="#" className="block py-2.5 px-4 hover:bg-slate-700">Matches</a>
        <a href="#" className="block py-2.5 px-4 hover:bg-slate-700">Leaderboard</a>
        <a href="#" className="block py-2.5 px-4 hover:bg-slate-700">Admin</a>
      </nav>
      <div className="px-4 py-2 border-t border-slate-700">
        <p className="text-sm font-semibold">{user?.displayName || 'User'}</p>
        <p className="text-xs text-slate-400">{user?.email}</p>
      </div>
    </aside>
  );

  // --- Header Component ---
  const Header = () => (
    <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
      {/* Mobile Menu Button */}
      <button className="md:hidden text-slate-300" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>
      <div className="text-xl font-semibold text-slate-100">Dashboard</div>
      <button 
        onClick={handleSignOut}
        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm transition-colors"
      >
        Sign Out
      </button>
    </header>
  );

  return (
    <div className="relative min-h-screen md:flex bg-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-8">
          {/* Main content goes here */}
          <div className="bg-slate-800 border border-slate-700 p-8">
            <h1 className="text-2xl font-bold text-blue-400">Welcome, {user?.displayName || 'User'}!</h1>
            <p className="mt-2 text-slate-400">This is your main dashboard. Select a section from the sidebar to get started.</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
