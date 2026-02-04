
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function verifyImageIntegrity() {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ No service account file found.");
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    const db = getFirestore();

    console.log("🔍 Verifying Product Image Integrity...");
    const snapshot = await db.collection('products').get();

    let mismatchCount = 0;
    let dropboxCount = 0;
    let missingImageCount = 0;
    let totalCount = 0;

    const mismatches = [];

    snapshot.forEach(doc => {
        totalCount++;
        const data = doc.data();
        const code = doc.id;
        const imageUrl = data.이미지;

        if (!imageUrl) {
            missingImageCount++;
            return;
        }

        if (imageUrl.includes('dropbox.com')) {
            dropboxCount++;
            return;
        }

        // Check Firebase Storage URL pattern
        // Pattern: .../products%2F{CODE}%2F... OR .../products/{CODE}/...
        // We look for the code segment in the URL.
        // Usually encoded as %2F

        let urlCode = null;

        // Try decoding first
        const decodedUrl = decodeURIComponent(imageUrl);
        const match = decodedUrl.match(/products\/([^/]+)\//);

        if (match) {
            urlCode = match[1];
        }

        if (urlCode && urlCode !== code) {
            console.log(`❌ Mismatch Found! Doc: [${code}] -> Image Path: [${urlCode}]`);
            mismatches.push({ docId: code, imagePathCode: urlCode, url: imageUrl });
            mismatchCount++;
        }
    });

    console.log("------------------------------------------------");
    console.log(`✅ Scan Complete. Checked ${totalCount} products.`);
    console.log(`- Missing Images: ${missingImageCount}`);
    console.log(`- Dropbox Links: ${dropboxCount}`);
    console.log(`- Path Mismatches: ${mismatchCount}`);

    if (mismatchCount > 0) {
        console.log("\nFound Mismatches:");
        console.table(mismatches);
    } else {
        console.log("\n✨ No path mismatches found between Doc ID and Storage Path.");
    }
}

verifyImageIntegrity();
