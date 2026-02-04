
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function cleanupPFolders() {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ No service account file found.");
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
        });
    }

    const db = getFirestore();
    const bucket = getStorage().bucket();

    console.log("🔍 Scanning for unused 'P' suffix folders to delete...");

    // 1. List all folders
    let folderPrefixes = [];
    let query = {
        prefix: 'products/',
        delimiter: '/',
        autoPaginate: false
    };

    while (true) {
        const [files, nextQuery, apiResponse] = await bucket.getFiles(query);
        if (apiResponse.prefixes) {
            folderPrefixes.push(...apiResponse.prefixes);
        }
        if (nextQuery) {
            query = nextQuery;
        } else {
            break;
        }
    }

    // 2. Filter for 'P' folders
    // Pattern: starts with products/, ends with P/ (ignoring the products/ prefix logic for a sec)
    // prefix is like 'products/DH1021P/'
    const pFolders = folderPrefixes.filter(prefix => {
        const parts = prefix.split('/'); // ['', 'products', 'DH1021P', ''] or similar depending on implementation
        // Usually: products/DH1021P/ -> split('/') -> ['products', 'DH1021P', '']
        const code = parts[1];
        return code && code.endsWith('P') && code.startsWith('DH');
    });

    console.log(`Found ${pFolders.length} candidates for deletion (ending in P).`);

    if (pFolders.length === 0) {
        console.log("✅ No 'P' folders found.");
        return;
    }

    // 3. Get all active Image URLs to ensure safety
    console.log("   Verifying safety against Firestore...");
    const activeUrls = new Set();
    const snapshot = await db.collection('products').get();

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.이미지) {
            // Decode to handle %2F
            activeUrls.add(decodeURIComponent(data.이미지));
        }
    });

    // 4. Delete loop
    let deletedCount = 0;
    let skippedCount = 0;

    for (const folderPrefix of pFolders) {
        const parts = folderPrefix.split('/');
        const code = parts[1];

        // Safety Check: Is this folder path used in ANY active URL?
        // Active URL might look like: .../products/DH1021P/image.jpg
        let isUsed = false;
        for (const url of activeUrls) {
            if (url.includes(folderPrefix)) {
                isUsed = true;
                break;
            }
        }

        if (isUsed) {
            console.log(`⚠️  SKIPPING [${code}]: Currently in use by DB!`);
            skippedCount++;
            continue;
        }

        console.log(`🗑️  Deleting [${code}]...`);
        try {
            await bucket.deleteFiles({ prefix: folderPrefix });
            deletedCount++;
        } catch (err) {
            console.error(`   ❌ Error deleting ${folderPrefix}:`, err.message);
        }
    }

    console.log("\n------------------------------------------------");
    console.log(`🎉 Cleanup Complete.`);
    console.log(`- Deleted Folders: ${deletedCount}`);
    console.log(`- Skipped (In Use): ${skippedCount}`);
}

cleanupPFolders();
