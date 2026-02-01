import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Check environment variables
const missingVars = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => `VITE_FIREBASE_${key.toUpperCase()}`);

if (missingVars.length > 0) {
    console.error("❌ Firebase 환경 변수가 누락되었습니다:", missingVars.join(", "));
    console.log("현재 환경 변수 상태:", {
        hasApiKey: !!firebaseConfig.apiKey,
        hasDbUrl: !!firebaseConfig.databaseURL,
        envMode: import.meta.env.MODE
    });
} else {
    console.log("✅ Firebase 환경 변수가 정상적으로 로드되었습니다.");
}

let app;
try {
    // initialize Firebase
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase가 성공적으로 초기화되었습니다.");
} catch (error) {
    console.error("❌ Firebase 초기화 실패:", error);
    // 즉시 throw하지 않고 앱이 실행될 기회를 줌 (에러 화면 표시용)
    app = null; 
}

// initialize Services
export const rtdb = app ? getDatabase(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
export const db = app ? getFirestore(app) : null;

export default app;
