const admin = require('firebase-admin');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Initialize Firebase Admin (Uses Application Default Credentials if running locally with firebase login)
admin.initializeApp({
    storageBucket: 'udug-bets.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function processAvatars() {
    console.log("Fetching files from bucket...");
    try {
        const [files] = await bucket.getFiles({ prefix: 'users/' });
        
        let processedCount = 0;
        let skippedCount = 0;

        for (const file of files) {
            // Check if the file is an avatar
            if (file.name.endsWith('/avatar')) {
                console.log(`Processing ${file.name}...`);
                
                const [metadata] = await file.getMetadata();
                
                // If it's already a webp and very small, we might skip it (or just force re-compress)
                // Let's just force compress to be safe, but check size
                if (metadata.size < 50000 && metadata.contentType === 'image/webp') {
                    console.log(`Skipping ${file.name} - already compressed (${metadata.size} bytes).`);
                    skippedCount++;
                    continue;
                }

                const tempFilePath = path.join(os.tmpdir(), path.basename(file.name) + '_' + Date.now());
                
                // Download file
                await file.download({ destination: tempFilePath });
                
                try {
                    // Compress using sharp
                    const compressedBuffer = await sharp(tempFilePath)
                        .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toBuffer();
                    
                    // Upload back
                    await file.save(compressedBuffer, {
                        metadata: {
                            contentType: 'image/webp',
                            cacheControl: 'public, max-age=31536000'
                        }
                    });
                    
                    console.log(`Successfully compressed and uploaded ${file.name}. Original size: ${metadata.size}, New size: ${compressedBuffer.length}`);
                    processedCount++;
                } catch (imgErr) {
                    console.error(`Error processing image ${file.name}:`, imgErr);
                } finally {
                    // Cleanup
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            }
        }
        
        console.log(`\nDone! Processed: ${processedCount}, Skipped: ${skippedCount}`);
    } catch (error) {
        console.error("Error processing avatars:", error);
    }
}

processAvatars();
