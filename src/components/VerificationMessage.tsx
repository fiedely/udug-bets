// src/components/VerificationMessage.tsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { sendEmailVerification, signOut } from 'firebase/auth';

interface VerificationMessageProps {
  onVerified: () => void;
}

const VerificationMessage: React.FC<VerificationMessageProps> = ({ onVerified }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const user = auth.currentUser;

  // This effect will periodically check if the user has verified their email
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          onVerified();
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [onVerified]);

  const handleResendVerification = async () => {
    if (!user) {
      setError("No user is signed in to resend verification.");
      return;
    }
    setIsResending(true);
    setError('');
    setMessage('');
    try {
      await sendEmailVerification(user);
      setMessage('A new verification email has been sent to your inbox.');
    } catch (err) {
      setError('Failed to send verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 border border-slate-700 text-center">
        <h1 className="text-3xl font-bold text-blue-400">Verify Your Email</h1>
        <p className="text-slate-300">
          We've sent a verification link to <strong className="text-white">{user?.email}</strong>.
          Please click the link in the email to continue.
        </p>
        <p className="text-slate-400 text-sm">
          Once you've verified, you will be logged in automatically.
        </p>
        
        {message && <p className="text-green-400 text-sm">{message}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="space-y-3 pt-4">
          <button 
            onClick={handleResendVerification} 
            disabled={isResending}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <button 
            onClick={handleSignOut} 
            className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-500 font-semibold text-white transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationMessage;
