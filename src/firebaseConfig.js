import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDL3fIB7x-mt8eLRpNeuxIoWt_nneWg5kU",
  authDomain: "shade-55901.firebaseapp.com",
  projectId: "shade-55901",
  storageBucket: "shade-55901.firebasestorage.app",
  messagingSenderId: "723724693264",
  appId: "1:723724693264:web:8d8075562c6ab6ae607f95",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
