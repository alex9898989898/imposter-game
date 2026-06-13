import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXexSVoVHy0kuqwg4URUTfgydv11ZtlXM",
  authDomain: "imposter-game-1eba8.firebaseapp.com",
  projectId: "imposter-game-1eba8"
};




const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, setDoc, updateDoc, onSnapshot, getDoc, arrayUnion };