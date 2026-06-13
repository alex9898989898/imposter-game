// ==========================
// FIREBASE CONFIG + INIT
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// ==========================
// YOUR FIREBASE CONFIG
// (replace with your own)
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyAXexSVoVHy0kuqwg4URUTfgydv11ZtlXM",
  authDomain: "imposter-game-1eba8.firebaseapp.com",
  projectId: "imposter-game-1eba8",
  storageBucket: "imposter-game-1eba8.firebasestorage.app",
  messagingSenderId: "912226381058",
  appId: "1:912226381058:web:e64b9ae9feea4f638fa61b",
  measurementId: "G-HS0QZDGGEJ"
};


// ==========================
// INIT APP
// ==========================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ==========================
// EXPORTS (used in app.js)
// ==========================
export {
  db,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove
};