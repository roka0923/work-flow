
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function checkPSuffixFolders() {
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

    console.log("🔍 Scanning for 'P' suffix folders in Storage...");

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

    // 2. Filter for 'P' folders (e.g. products/DH1021P/)
    // Regex: products/([A-Z0-9]+)P/
    const pFolders = [];
    const pFolderCodes = new Set();

    for (const prefix of folderPrefixes) {
        const parts = prefix.split('/');
        const codePart = parts[1]; // 'DH1021P'

        if (codePart && codePart.endsWith('P') && codePart.startsWith('DH')) {
            // Check if it's strictly the pattern we suspect (Code + P)
            // We want to be careful not to catch legitimate codes ending in P if any.
            // But user said "DH code... P folder".
            pFolders.push(prefix);
            pFolderCodes.add(codePart);
        }
    }

    console.log(`\nfound ${pFolders.length} folders with 'P' suffix (e.g. DHxxxxP).`);

    if (pFolders.length === 0) {
        console.log("✅ No suspicious 'P' folders found.");
        return;
    }

    // 3. Check if these images are used in DB
    console.log("   Checking usage in Firestore...");
    const usedFolders = new Set();

    const snapshot = await db.collection('products').get();
    snapshot.forEach(doc => {
        const data = doc.data();
        const imageUrl = data.이미지;
        if (!imageUrl) return;

        // Check if URL contains any of the P codes
        // URL encoded: products%2FDH1021P%2F...
        const decoded = decodeURIComponent(imageUrl);

        for (const pCode of pFolderCodes) {
            if (decoded.includes(`products/${pCode}/`)) {
                usedFolders.add(pCode);
                console.log(`⚠️  WARNING: Product [${doc.id}] is using folder [${pCode}]`);
            }
        }
    });

    console.log(`\n------------------------------------------------`);
    console.log(`📊 Result:`);
    console.log(`- Total 'P' folders: ${pFolders.length}`);
    console.log(`- Actively used by DB: ${usedFolders.size}`);

    const safeToDelete = pFolders.length - usedFolders.size;
    console.log(`- Safe to delete: ${safeToDelete}`);

    if (usedFolders.size === 0) {
        console.log("\n✅ CONCLUSION: unsafe usage not found. All 'P' folders seem to be leftovers/duplicates.");
        console.log("   (Double check: Are the regular folders 'DHxxxx' present and used?)");
    } else {
        console.log("\n❌ CAUTION: Some 'P' folders are IN USE. Do not delete all blindly.");
    }
}

checkPSuffixFolders();
