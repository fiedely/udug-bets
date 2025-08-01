// src/components/Dashboard.tsx

import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const Dashboard = () => {
  // Get the current user's display name, or show 'User' as a fallback
  const userName = auth.currentUser?.displayName || 'User';

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 text-slate-100">
      <div className="w-full max-w-4xl p-8 bg-slate-800 border border-slate-700 text-center">
        <h1 className="text-4xl font-bold text-blue-400">Welcome, {userName}!</h1>
        <p className="mt-2 text-slate-400">You are now logged in.</p>

        <button 
          onClick={handleSignOut}
          className="mt-8 px-6 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
