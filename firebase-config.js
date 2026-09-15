/*
  SAMANTHA P. LANIOG - Smart Storage Monitoring System
  Firebase Realtime Database configuration
  Project: smartstorage-c125c
*/

const firebaseConfig = {
  apiKey: "AIzaSyD87c8qNzinqcTsifEMSfp7gzru9sOEM_c",
  authDomain: "smartstorage-c125c.firebaseapp.com",
  databaseURL: "https://smartstorage-c125c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartstorage-c125c",
  storageBucket: "smartstorage-c125c.firebasestorage.app",
  messagingSenderId: "533023610172",
  appId: "1:533023610172:web:8afa27434d423b4f3dfa39"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();
const auth = firebase.auth();

// Authenticate before any SmartStorage read/write is attempted.
// This matches Realtime Database rules that use auth != null.
const firebaseAuthReady = auth.currentUser
  ? Promise.resolve(auth.currentUser)
  : auth.signInAnonymously().then(result => {
      console.log("Firebase anonymous authentication successful.");
      return result.user;
    }).catch(error => {
      console.error("Firebase anonymous sign-in failed:", error);
      throw error;
    });

const DB_PATHS = {
  current: "SmartStorage/current",
  history: "SmartStorage/history",
  status: "SmartStorage/status",
  recordCount: "SmartStorage/recordCount"
};
