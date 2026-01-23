import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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
} catch (error) {
    console.error("❌ Firebase 초기화 실패:", error);
    throw new Error("Firebase 초기화 중 오류가 발생했습니다. 환경 변수 설정을 확인해 주세요.");
}

// initialize Services
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
