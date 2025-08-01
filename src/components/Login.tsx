// src/components/Login.tsx

import React, { useState } from 'react';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig'; // Import our services

const Login = () => {
  // State to manage the component's mode
  const [isLoginMode, setIsLoginMode] = useState(true); 
  
  // State for form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reenterPassword, setReenterPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // State for user feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isLoginMode) {
      // --- SIGN IN LOGIC ---
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any)
      {
        setError('Failed to sign in. Please check your email and password.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // --- SIGN UP LOGIC ---
      if (password !== reenterPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password should be at least 6 characters long.');
        return;
      }
      if (!agreedToTerms) {
        setError('You must agree to the Terms & Conditions to sign up.');
        return;
      }
      
      setIsLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        setIsLoginMode(true);
        setMessage('Account created successfully! Please sign in.');

      } catch (err: any) {
        setError('Failed to create account. The email might already be in use.');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleForgotPassword = async () => {
    setError('');
    setMessage('');
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError('Failed to send password reset email.');
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setReenterPassword('');
    setName('');
    setAgreedToTerms(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <div className="w-full max-w-sm p-8 space-y-5 bg-slate-800 border border-slate-700">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-400">Udug Bets</h1>
          <p className="mt-2 text-slate-400">
            {isLoginMode ? 'Sign in to join the tournament.' : 'Create your account.'}
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {!isLoginMode && (
            <div className="relative">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className="w-full pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
            </div>
          )}
          <div className="relative">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="w-full pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
          </div>
          <div className="relative">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
             <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
          </div>
          {!isLoginMode && (
             <div className="relative">
              <input type="password" value={reenterPassword} onChange={(e) => setReenterPassword(e.target.value)} placeholder="Re-enter Password" required className="w-full pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
            </div>
          )}
          {isLoginMode ? (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-slate-400 cursor-pointer"><input type="checkbox" className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" /><span className="ml-2">Save Password</span></label>
              <button type="button" onClick={handleForgotPassword} className="font-medium text-blue-500 hover:text-blue-400">Forgot Password?</button>
            </div>
          ) : (
            <div className="flex items-center text-sm">
               <label className="flex items-center text-slate-400 cursor-pointer"><input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} required className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" /><span className="ml-2">Agree <del>with Terms & Conditions</del> to have fun!</span></label>
            </div>
          )}
          {error && <p className="text-red-400 text-sm text-center pt-1">{error}</p>}
          {message && <p className="text-green-400 text-sm text-center pt-1">{message}</p>}
          <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
            {isLoading ? (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (isLoginMode ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="text-center text-sm text-slate-400">{isLoginMode ? "Or sign in with" : "Or register with"}</div>

        {/* Simplified Google Button for both modes */}
        <div className="flex justify-center">
          <button onClick={handleGoogleSignIn} aria-label="Sign in with Google" className="p-3 border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors">
            <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,34.556,44,28.717,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
          </button>
        </div>

        <div className="text-center text-sm">
          <span className="text-slate-400">{isLoginMode ? "Don't have an account?" : "Already have an account?"} </span>
          <button onClick={toggleMode} className="font-semibold text-blue-500 hover:text-blue-400 bg-transparent border-none p-0">
            {isLoginMode ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
