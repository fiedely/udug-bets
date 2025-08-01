// src/firebaseConfig.ts

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// PASTE THE CONFIG OBJECT YOU COPIED FROM THE FIREBASE CONSOLE HERE
const firebaseConfig = {
  apiKey: "AIzaSyDoW8Uush95DDGmFXzg7LISq7ePIVFyiuQ",
  authDomain: "udug-bets.firebaseapp.com",
  projectId: "udug-bets",
  storageBucket: "udug-bets.firebasestorage.app",
  messagingSenderId: "188221785750",
  appId: "1:188221785750:web:25cb51b33172a6bdf164b7",
  measurementId: "G-CESVTKW675"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export the services we'll use throughout the app
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
