// src/components/views/DashboardContent.tsx

import { type User } from 'firebase/auth';

const DashboardContent = ({ user }: { user: User | null }) => (
  <div className="bg-slate-800 border border-slate-700 p-8">
    <h1 className="text-2xl font-bold text-blue-400">Welcome, {user?.displayName || 'User'}!</h1>
    <p className="mt-2 text-slate-400">This is your main dashboard. Select a section from the sidebar to get started.</p>
  </div>
);

export default DashboardContent;