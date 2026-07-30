import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length === 0 
  ? initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "omega-90935",
    })
  : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
