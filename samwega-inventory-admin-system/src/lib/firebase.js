 
// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
 apiKey: "AIzaSyBtwEOIAIv3tQr9I-Hcnx9x-9E1UQgxJcg",
  authDomain: "migingo-4724e.firebaseapp.com",
  projectId: "migingo-4724e",
  storageBucket: "migingo-4724e.firebasestorage.app",
  messagingSenderId: "795887346382",
  appId: "1:795887346382:web:a3144888495e76329a669f",
  measurementId: "G-XRWXPYFYVD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);