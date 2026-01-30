import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

async function findBadImages() {
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

    console.log("🔍 Scanning for corrupted images (HTML/Invalid Content-Type)...");

    try {
        // Get all files in products/ folder
        const [files] = await bucket.getFiles({ prefix: 'products/' });

        console.log(`Checking ${files.length} files...`);
        let badCount = 0;
        const badCodes = [];

        for (const file of files) {
            // file.metadata is populated by getFiles usually
            const type = file.metadata.contentType;
            const size = parseInt(file.metadata.size);

            // Criteria for "Bad Image":
            // 1. Content-Type includes 'html'
            // 2. Content-Type is NOT an image type
            // 3. (Optional) Extremely small size for an image could be suspicious, but let's stick to content-type first.

            const isImage = type && (type.includes('image/') || type.includes('application/octet-stream')); // octet-stream might be valid binary, but usually we set extension
            // Dropbox redirects might result in text/html

            if (type && type.includes('html')) {
                // Extract code from path: products/{CODE}/image.jpg
                const match = file.name.match(/products\/([^\/]+)\//);
                const code = match ? match[1] : 'UNKNOWN';

                console.log(`❌ Found Bad File: [${code}] Type: ${type}, Size: ${size} bytes`);
                badCodes.push(code);
                badCount++;
            }
        }

        console.log("------------------------------------------------");
        console.log(`Scan Complete.`);
        console.log(`Found ${badCount} bad files.`);

        if (badCount > 0) {
            console.log("Here is the list of codes to fix:");
            console.log(JSON.stringify(badCodes, null, 2));
        } else {
            console.log("✅ No corrupted files found!");
        }

    } catch (e) {
        console.error("Error scanning files:", e);
    }
}

findBadImages();
