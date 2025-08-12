// src/App.tsx

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import VerificationMessage from './components/VerificationMessage';
import type { UserProfile } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);

  const fetchUserProfile = async (uid: string) => {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      setUserProfile(docSnap.data() as UserProfile);
    } else {
      console.error("User profile not found in Firestore. Signing out.");
      signOut(auth);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        await currentUser.reload(); // Get the latest user state from Firebase
        if (currentUser.emailVerified) {
          setUser(currentUser);
          setIsAwaitingVerification(false);
          await fetchUserProfile(currentUser.uid);
        } else if (currentUser.providerData.some(p => p.providerId === 'password')) {
          // Email/password user, but not verified
          setUser(currentUser);
          setIsAwaitingVerification(true);
          setUserProfile(null);
        } else {
          // Social login (Google), considered verified by default
          setUser(currentUser);
          setIsAwaitingVerification(false);
          await fetchUserProfile(currentUser.uid);
        }
      } else {
        // No user is signed in
        setUser(null);
        setUserProfile(null);
        setIsAwaitingVerification(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
  
  if (user) {
    if (isAwaitingVerification) {
      return <VerificationMessage onVerified={() => {
        setIsAwaitingVerification(false);
        fetchUserProfile(user.uid);
      }} />;
    }
    if (userProfile) {
      return <Dashboard userProfile={userProfile} />;
    }
  }

  return <Login />;
}

export default App;
