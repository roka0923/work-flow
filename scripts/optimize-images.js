
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
const TARGET_WIDTH = 1024; // Max width
const TARGET_FORMAT = 'jpeg';
const TARGET_QUALITY = 80;

async function optimizeImages() {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ No service account file found at:", SERVICE_ACCOUNT_PATH);
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

    console.log("🚀 Starting Image Optimization Process...");
    console.log(`Settings: Max Width ${TARGET_WIDTH}px, Format ${TARGET_FORMAT}, Quality ${TARGET_QUALITY}%`);

    try {
        // 1. Get all files in products/ folder
        const [files] = await bucket.getFiles({ prefix: 'products/' });
        console.log(`📂 Found ${files.length} files in 'products/' folder.`);

        const processedCodes = new Set();

        for (const file of files) {
            // Check if file is an image and not a folder placeholder
            if (file.name.endsWith('/')) continue;

            // Extract code from path: products/{CODE}/{filename}
            const match = file.name.match(/products\/([^/]+)\/(.+)/);
            if (!match) continue;

            const code = match[1];
            const fileName = match[2];

            const targetFileName = 'image.jpg';
            const targetPath = `products/${code}/${targetFileName}`;

            // Optimization: If we have multiple files for one code (e.g. image.png AND image.jpg), we should pick one, optimize, and delete others.
            if (processedCodes.has(code)) {
                console.log(`⏭️ [${code}] Already processed a file for this code. Checking for cleanup...`);
                // If this file is NOT the one we just created (image.jpg), delete it?
                if (file.name !== targetPath) {
                    console.log(`   🗑️ Deleting extra file: ${file.name}`);
                    await file.delete();
                }
                continue;
            }

            console.log(`\n📸 Processing [${code}] - ${fileName}`);

            try {
                // Download
                const tempFilePath = path.join(__dirname, `temp_${code}_${Date.now()}`);
                await file.download({ destination: tempFilePath });

                // Process with Sharp
                const buffer = await sharp(tempFilePath)
                    .resize({ width: TARGET_WIDTH, withoutEnlargement: true }) // Don't upscale small images
                    .toFormat(TARGET_FORMAT, { quality: TARGET_QUALITY })
                    .toBuffer();

                // Upload to strict path 'products/{code}/image.jpg'
                const newFile = bucket.file(targetPath);
                await newFile.save(buffer, {
                    metadata: {
                        contentType: 'image/jpeg',
                    },
                    public: true // Make public? Or use getSignedUrl? 
                    // Usually we want public access for the app. 
                });

                // Make it public explicitly to get a consistent URL
                await newFile.makePublic();
                // Construct Public URL manually or via getMetadata
                // Standard Firebase Storage Public URL format:
                // https://storage.googleapis.com/{bucket}/{path} 
                // OR https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path_encoded}?alt=media

                const encodedPath = encodeURIComponent(targetPath);
                const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

                console.log(`   ✅ Optimized & Uploaded to: ${targetPath}`);

                // Update Firestore
                const docRef = db.collection('products').doc(code);
                await docRef.update({
                    '이미지': publicUrl,
                    'imageUpdatedAt': new Date().toISOString()
                });
                console.log(`   📝 Firestore updated.`);

                // Cleanup Local
                fs.unlinkSync(tempFilePath);

                // Cleanup Remote (Original File) if it was different name
                if (file.name !== targetPath) {
                    console.log(`   🗑️ Deleting original file: ${file.name}`);
                    await file.delete();
                }

                processedCodes.add(code);

            } catch (err) {
                console.error(`   ❌ Error processing ${code}:`, err.message);
                // Clean temp file if exists
                try {
                    const tempFiles = fs.readdirSync(__dirname).filter(f => f.startsWith(`temp_${code}_`));
                    tempFiles.forEach(f => fs.unlinkSync(path.join(__dirname, f)));
                } catch (cleanupErr) {
                    // ignore
                }
            }
        }

        console.log("\n🎉 Optimization Complete!");

    } catch (error) {
        console.error("Fatal Error:", error);
    }
}

optimizeImages();
