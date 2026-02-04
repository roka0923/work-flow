
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function checkMissingImages() {
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

    console.log("🔍 Comparing Firestore Products vs. Storage Folders...");

    // 1. Get all Product IDs from Firestore
    console.log("   Reading Firestore products...");
    const productsSnapshot = await db.collection('products').get();
    const productIds = new Set();
    const productsWithDropbox = new Set();
    const productsNoImageField = new Set();

    productsSnapshot.forEach(doc => {
        productIds.add(doc.id);
        const data = doc.data();
        if (!data.이미지) {
            productsNoImageField.add(doc.id);
        } else if (data.이미지.includes('dropbox.com')) {
            productsWithDropbox.add(doc.id);
        }
    });
    console.log(`   👉 Total Products in DB: ${productIds.size}`);

    // 2. Get all Folders from Storage
    // 2. Get all Folders from Storage
    console.log("   Scanning Storage folders...");

    let storageCodes = new Set();
    let query = {
        prefix: 'products/',
        delimiter: '/',
        autoPaginate: false
    };

    while (true) {
        const [files, nextQuery, apiResponse] = await bucket.getFiles(query);

        if (apiResponse.prefixes) {
            apiResponse.prefixes.forEach(p => {
                const parts = p.split('/');
                if (parts[1]) storageCodes.add(parts[1]);
            });
        }

        if (nextQuery) {
            query = nextQuery;
        } else {
            break;
        }
    }

    console.log(`   👉 Total Folders in Storage: ${storageCodes.size}`);

    // 3. Compare
    const missingInStorage = [];
    const orphanedFolders = [];

    // Check DB products missing in Storage
    for (const pid of productIds) {
        if (!storageCodes.has(pid)) {
            // It's missing in storage.
            // But if it has a Dropbox link, it's "technically" accounted for (legacy).
            const isDropbox = productsWithDropbox.has(pid);
            const isNoImage = productsNoImageField.has(pid);

            missingInStorage.push({ code: pid, status: isDropbox ? 'Dropbox Link' : (isNoImage ? 'No Image Data' : 'MISSING FILE') });
        }
    }

    // Check Storage folders not in DB
    for (const sc of storageCodes) {
        if (!productIds.has(sc)) {
            orphanedFolders.push(sc);
        }
    }

    console.log("\n------------------------------------------------");
    console.log(`📊 Analysis Result:`);
    console.log(`- Products needing images (From DB): ${productIds.size}`);
    console.log(`- Storage Folders Found: ${storageCodes.size}`);
    console.log(`- Products MISSING in Storage: ${missingInStorage.length}`);

    if (missingInStorage.length > 0) {
        console.log(`\n🔎 Breakdown of Missing Storage Folders:`);
        const dropbox = missingInStorage.filter(x => x.status === 'Dropbox Link').length;
        const noData = missingInStorage.filter(x => x.status === 'No Image Data').length;
        const realMissing = missingInStorage.filter(x => x.status === 'MISSING FILE').length;

        console.log(`  • Still using Dropbox: ${dropbox} (Normal for legacy)`);
        console.log(`  • No Image Data in DB: ${noData} (Maybe new products?)`);
        console.log(`  • 🚨 URL exists but File missing: ${realMissing} (These are critical)`);

        if (realMissing > 0) {
            console.log("\n⚠️ Sample of Critical Missing Files:");
            console.table(missingInStorage.filter(x => x.status === 'MISSING FILE').slice(0, 10));
        }
    }

    if (orphanedFolders.length > 0) {
        console.log(`\n🗑️ Orphaned Folders (In Storage but not in DB): ${orphanedFolders.length}`);
        // console.log(orphanedFolders.slice(0, 10));
    }
}

checkMissingImages();
