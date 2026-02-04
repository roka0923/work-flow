
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');

// Configuration
const TARGET_WIDTH = 1024;
const TARGET_FORMAT = 'jpeg';
const TARGET_QUALITY = 80;

// Get target folder from command line args
const TARGET_DIR = process.argv[2];

async function uploadLocalImages() {
    if (!TARGET_DIR) {
        console.error("❌ Please provide the local image directory path.");
        console.error("   Usage: node scripts/upload-local-images.js \"C:/path/to/images\"");
        return;
    }

    if (!fs.existsSync(TARGET_DIR)) {
        console.error(`❌ Directory not found: ${TARGET_DIR}`);
        return;
    }

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

    const bucket = getStorage().bucket();
    const db = getFirestore();

    console.log(`🚀 Starting Upload from: ${TARGET_DIR}`);

    // Helper to process files recursively or flat
    async function processFile(filePath) {
        const fileName = path.basename(filePath);
        // Try to extract code from filename
        // Matches: 13041.jpg, 13041P.jpg, DH1234.png ...
        // Assumption: The code is the alphanumeric part at the beginning.

        let code = '';

        // Strategy 1: Check if parent folder is the code (e.g. images/13041/image.jpg)
        const parentDir = path.basename(path.dirname(filePath));
        if (/^[A-Z0-9]+$/.test(parentDir) && parentDir.length > 3) {
            code = parentDir;
        } else {
            // Strategy 2: Extract from filename
            const match = fileName.match(/^([A-Z0-9]+)/);
            if (match) {
                code = match[1];
            }
        }

        if (code.endsWith('P')) {
            code = code.slice(0, -1);
        }

        if (!code) {
            console.log(`⚠️  Skipping unknown file: ${fileName}`);
            return;
        }

        console.log(`📸 Processing [${code}] <- ${fileName}`);

        try {
            // Optimize
            const buffer = await sharp(filePath)
                .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
                .toFormat(TARGET_FORMAT, { quality: TARGET_QUALITY })
                .toBuffer();

            const storagePath = `products/${code}/image.jpg`;
            const fileRef = bucket.file(storagePath);

            await fileRef.save(buffer, {
                metadata: { contentType: 'image/jpeg' },
                public: true
            });
            await fileRef.makePublic();

            const encodedPath = encodeURIComponent(storagePath);
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

            // Update Firestore
            await db.collection('products').doc(code).update({
                '이미지': publicUrl,
                'imageUpdatedAt': new Date().toISOString()
            });

            console.log(`   ✅ Uploaded & Updated`);

        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
    }

    async function scanDirectory(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                await scanDirectory(fullPath);
            } else {
                if (item.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)) {
                    await processFile(fullPath);
                }
            }
        }
    }

    await scanDirectory(TARGET_DIR);
    console.log("\n🎉 All uploads finished!");
}

uploadLocalImages();
