import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function debugProduct() {
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
    const CODE = '16211';

    console.log(`🔍 Debugging Product [${CODE}]...`);

    // 1. Check Firestore
    const docRef = db.collection('products').doc(CODE);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        console.error("❌ Firestore Document NOT FOUND.");
        return;
    }

    const data = docSnap.data();
    console.log("Firestore Data:", {
        code: data.code,
        image_field: data.이미지
    });

    if (!data.이미지) {
        console.error("❌ '이미지' field is empty in Firestore.");
        return;
    }

    // 2. Check Storage File (Try common extensions)
    const extensions = ['jpg', 'png', 'jpeg'];
    let foundFile = null;

    for (const ext of extensions) {
        const filePath = `products/${CODE}/image.${ext}`;
        const file = bucket.file(filePath);
        const [exists] = await file.exists();

        if (exists) {
            console.log(`✅ File FOUND in Storage: ${filePath}`);
            foundFile = file;
            break;
        }
    }

    if (!foundFile) {
        console.error("❌ File NOT FOUND in Storage (checked jpg, png, jpeg).");
        console.log("This implies the migration didn't upload it, or it was uploaded with a weird name.");
        return;
    }

    // 3. Check Metadata & Token
    const [metadata] = await foundFile.getMetadata();
    const storageToken = metadata.metadata?.firebaseStorageDownloadTokens;
    console.log("Storage Token:", storageToken);

    // 4. Compare with URL
    const urlToken = new URL(data.이미지).searchParams.get('token');
    console.log("URL Token:    ", urlToken);

    if (storageToken !== urlToken) {
        console.error("❌ Token MISMATCH!");
        console.log("Fixing it now...");

        // Auto-fix: Update Firestore with correct URL
        const uuid = storageToken || crypto.randomUUID();

        // If no token in storage, set it
        if (!storageToken) {
            console.log("Generating new token for storage...");
            await foundFile.setMetadata({
                metadata: { firebaseStorageDownloadTokens: uuid }
            });
        }

        const finalToken = storageToken || uuid;
        const bucketName = foundFile.bucket.name;
        const encodedPath = encodeURIComponent(foundFile.name);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${finalToken}`;

        await docRef.update({
            '이미지': publicUrl,
            lastUpdated: new Date().toISOString()
        });
        console.log(`✅ FIXED! Updated Firestore with: ${publicUrl}`);
    } else {
        console.log("✅ Tokens Match. The issue might be browser cache or content type.");
        console.log("Content-Type:", metadata.contentType);
    }
}

debugProduct();
