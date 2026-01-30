import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function verifyMetadata() {
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

    // Pick a file we executed on. E.g. a domestic code.
    const file = bucket.file('products/13021/image.jpg'); // 13021 was migrated

    try {
        const [metadata] = await file.getMetadata();
        console.log("--- File Metadata ---");
        console.log("Name:", metadata.name);
        console.log("Bucket:", metadata.bucket);
        console.log("ContentType:", metadata.contentType);
        console.log("Custom Metadata:", metadata.metadata);

        if (metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens) {
            console.log("✅ Token found:", metadata.metadata.firebaseStorageDownloadTokens);
        } else {
            console.error("❌ Token MISSING in metadata!");
        }
    } catch (e) {
        console.error("Error fetching metadata:", e);
    }
}

verifyMetadata();
