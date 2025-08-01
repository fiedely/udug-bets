// src/App.tsx

import { useState, useEffect } from 'react';
// Correctly import the 'User' type from Firebase
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This listener from Firebase checks for login/logout events in real-time
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    // This is a cleanup function that removes the listener when the app closes
    return () => unsubscribe();
  }, []); // The empty array [] ensures this effect runs only once on startup

  // While we're checking the user's status, show our standard loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // This is the core logic:
  // If a 'user' object exists, show the Dashboard.
  // Otherwise, show the Login page.
  return user ? <Dashboard /> : <Login />;
}

export default App;
