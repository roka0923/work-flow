import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDCEeOsgMDzwrMPmnYWVJIzYA3GuRQQ65Y",
    authDomain: "daehansa-workflow.firebaseapp.com",
    databaseURL: "https://daehansa-workflow-default-rtdb.firebaseio.com",
    projectId: "daehansa-workflow",
    storageBucket: "daehansa-workflow.firebasestorage.app",
    messagingSenderId: "409744604160",
    appId: "1:409744604160:web:f084448f8bdca61f6e6ce5"
};

// initialize Firebase
const app = initializeApp(firebaseConfig);

// initialize Services
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
