import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function fixStorage() {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("No service account file.");
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
    });

    const bucket = getStorage().bucket();
    const db = getFirestore();

    // 1. Set CORS
    console.log("Configuring CORS...");
    try {
        await bucket.setCorsConfiguration([
            {
                origin: ['*'], // Allow all origins (including localhost)
                method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
                responseHeader: ['Content-Type', 'x-goog-meta-firebaseStorageDownloadTokens'],
                maxAgeSeconds: 3600
            }
        ]);
        console.log("✅ CORS Configured to allow all origins.");
    } catch (e) {
        console.error("❌ Failed to set CORS:", e);
    }

    // 2. Verify Token Match (Firestore vs Storage)
    console.log("\nVerifying Token Consistency (Item 13021)...");
    try {
        // Get Storage Metadata
        const file = bucket.file('products/13021/image.jpg');
        const [metadata] = await file.getMetadata();
        const storageToken = metadata.metadata?.firebaseStorageDownloadTokens;

        console.log("Storage Token:", storageToken);

        // Get Firestore Data
        const docRef = db.collection('products').doc('13021');
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            console.error("Firestore doc 13021 not found.");
            return;
        }

        const imageUrl = docSnap.data().이미지;
        console.log("Firestore URL:", imageUrl);

        // Extract token from URL
        const urlToken = new URL(imageUrl).searchParams.get('token');
        console.log("URL Token:    ", urlToken);

        if (storageToken === urlToken) {
            console.log("✅ Tokens Match! Image should load.");
        } else {
            console.error("❌ Token MISMATCH! This is why it fails.");
            console.log("Action: You might need to re-run migration for this item.");
        }

    } catch (e) {
        console.error("Error verifying:", e);
    }
}

fixStorage();
