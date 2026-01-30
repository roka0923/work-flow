import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module setup for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
// ---------------------

async function migrateImages() {
    console.log("🚀 Starting Image Migration (All Items)...");

    // 1. Check for Service Account Key
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ Error: 'service-account.json' not found!");
        console.error("Please download it from Firebase Console -> Project Settings -> Service Accounts");
        console.error("and place it in the project root directory.");
        process.exit(1);
    }

    // 2. Initialize Firebase Admin
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
        });
    } catch (error) {
        console.error("❌ Firebase Admin Init Failed:", error);
        process.exit(1);
    }

    const db = getFirestore();
    const bucket = getStorage().bucket();

    try {
        // 3. Check Bucket
        const [exists] = await bucket.exists();
        if (!exists) {
            console.warn("⚠️  Default bucket might not exist. Trying .appspot.com...");
        }

        console.log("✅ Connected to Firebase. Fetching products...");

        const productsRef = db.collection('products');
        const snapshot = await productsRef.get();

        if (snapshot.empty) {
            console.log("No matching documents.");
            return;
        }

        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Use field 'code' OR document ID
            const code = data.code || doc.id;
            const { 이미지, model, origin } = data;

            // 1. Validation
            if (!code || !이미지) {
                continue;
            }

            // 2. Filter: REMOVED - Migrating ALL items now
            // (Previously filtered for domestic only)

            // 3. Skip if already migrated
            if (이미지.includes('firebasestorage.googleapis.com')) {
                skipCount++;
                continue;
            }

            console.log(`Processing [${code}] ${model || 'No Model'} ...`);

            try {
                // 3. Download Image
                let downloadUrl = 이미지;
                // Dropbox raw link conversion
                if (downloadUrl.includes('dropbox.com') && !downloadUrl.includes('raw=1')) {
                    downloadUrl = downloadUrl.replace('dl=0', 'raw=1');
                    if (!downloadUrl.includes('raw=1')) downloadUrl += '&raw=1';
                }

                const response = await axios({
                    url: downloadUrl,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    timeout: 20000 // 20 sec timeout
                });

                const buffer = Buffer.from(response.data, 'binary');

                // 4. Upload to Firebase Storage
                const contentType = response.headers['content-type'];
                let ext = 'jpg';
                if (contentType && contentType.includes('png')) ext = 'png';
                else if (contentType && contentType.includes('jpeg')) ext = 'jpg';
                else if (contentType && contentType.includes('webp')) ext = 'webp';

                // Sanitize filename
                const safeCode = code.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
                const fileName = `products/${safeCode}/image.${ext}`;
                const file = bucket.file(fileName);

                // Use a UUID for the download token
                const downloadToken = crypto.randomUUID();

                await file.save(buffer, {
                    metadata: {
                        contentType: contentType || 'image/jpeg',
                        metadata: {
                            firebaseStorageDownloadTokens: downloadToken
                        }
                    }
                });

                // Construct Public URL
                const bucketName = file.bucket.name;
                const encodedPath = encodeURIComponent(fileName);
                const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

                // 5. Update Firestore
                await productsRef.doc(doc.id).update({
                    '이미지': publicUrl,
                    lastSynced: new Date().toISOString()
                });

                console.log(`  ✅ Migrated: .../${fileName}`);
                successCount++;

            } catch (err) {
                const errorMsg = err.message;
                console.error(`  ❌ Failed to migrate ${code}: ${errorMsg}`);
                failCount++;
            }

            // Rate limit: 1000ms delay
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("------------------------------------------------");
        console.log(`Migration Complete.`);
        console.log(`Total: ${snapshot.size}`);
        console.log(`Success: ${successCount}`);
        console.log(`Skipped: ${skipCount}`);
        console.log(`Failed: ${failCount}`);
        console.log("------------------------------------------------");

    } catch (err) {
        console.error("Migration script error:", err);
    }
}

migrateImages();
