import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const debtFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_DEBT_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_DEBT_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_DEBT_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_DEBT_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_DEBT_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_DEBT_FIREBASE_APP_ID,
};

// Debug: Check if config is loaded
if (typeof window !== "undefined") {
    if (!debtFirebaseConfig.apiKey) {
        console.warn("⚠️ Debt Firebase Config missing! Ensure .env.local variables are loaded and server is restarted.");
    } else {
        console.log("✅ Debt Firebase Config detected for project:", debtFirebaseConfig.projectId);
    }
}

// Initialize secondary Firebase app for Debt System
const getDebtApp = () => {
    const apps = getApps();
    const name = "debt-system";
    const existingApp = apps.find(app => app.name === name);
    if (existingApp) return existingApp;

    return initializeApp(debtFirebaseConfig, name);
};

const debtApp = getDebtApp();

// Use initializeFirestore to enable force long polling (helps with some network environments/proxies)
export const debtDb = initializeFirestore(debtApp, {
    experimentalForceLongPolling: true,
});

export default debtApp;
