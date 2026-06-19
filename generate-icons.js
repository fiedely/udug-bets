import sharp from 'sharp';
import fs from 'fs';

const input = 'src/assets/udug_bets_logo.webp';

async function generateIcons() {
  try {
    await sharp(input).resize(192, 192).toFile('public/pwa-192x192.png');
    await sharp(input).resize(512, 512).toFile('public/pwa-512x512.png');
    await sharp(input).resize(180, 180).toFile('public/apple-touch-icon.png');
    console.log('Icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
