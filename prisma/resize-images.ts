// One-off: shrinks images saved before uploads were resized. Safe to run more than once
import * as fs from 'fs';
import sharp from 'sharp';
import { ImageFolder, imagePath, MAX_IMAGE_SIZE } from '../src/utils/images';

async function main() {
  let resized = 0;

  for (const folder of Object.values(ImageFolder)) {
    const dir = imagePath(folder, '');
    const files = await fs.promises.readdir(dir).catch(() => [] as string[]);

    for (const file of files.filter((name) => name.endsWith('.webp'))) {
      const path = imagePath(folder, file);
      // Read up front so sharp never holds the file open, which blocks writing it on Windows
      const original = await fs.promises.readFile(path);
      const { width = 0, height = 0 } = await sharp(original).metadata();
      if (width <= MAX_IMAGE_SIZE && height <= MAX_IMAGE_SIZE) continue;

      const buffer = await sharp(original)
        .resize({ width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE, fit: 'inside' })
        .webp({ quality: 75 })
        .toBuffer();
      await fs.promises.writeFile(path, buffer);
      resized++;
    }
  }

  console.log(`Resized ${resized} images`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
