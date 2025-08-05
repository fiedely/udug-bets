// src/firebaseConfig.ts

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDoW8Uush95DDGmFXzg7LISq7ePIVFyiuQ",
  authDomain: "udug-bets.firebaseapp.com",
  projectId: "udug-bets",
  storageBucket: "udug-bets.firebasestorage.app",
  messagingSenderId: "188221785750",
  appId: "1:188221785750:web:25cb51b33172a6bdf164b7",
  measurementId: "G-CESVTKW675"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-southeast2');
