// One-off: copies images saved on disk (before images moved to Supabase Storage) into the
// bucket under the same names, then lists any image the database points to that's still missing.
// Safe to run more than once
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { ensureImageBucket, ImageFolder, listImages, uploadImage } from '../src/utils/images';

const LOCAL_FOLDER = path.join(process.cwd(), 'uploads', 'compressed');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await ensureImageBucket();

  let uploaded = 0;
  for (const folder of Object.values(ImageFolder)) {
    const dir = path.join(LOCAL_FOLDER, folder);
    const files = await fs.promises.readdir(dir).catch(() => [] as string[]);
    for (const file of files.filter((name) => name.endsWith('.webp'))) {
      await uploadImage(folder, file, await fs.promises.readFile(path.join(dir, file)));
      uploaded++;
    }
  }
  console.log(`Uploaded ${uploaded} images`);

  // Alerts about a banned person use the image in the people folder
  const stored = {
    [ImageFolder.PEOPLE]: new Set(await listImages(ImageFolder.PEOPLE)),
    [ImageFolder.ALERTS]: new Set(await listImages(ImageFolder.ALERTS)),
  };
  const people = await prisma.bannedPerson.findMany({ select: { name: true, imagePath: true } });
  const alerts = await prisma.alert.findMany({
    select: { reason: true, imagePath: true, bannedPersonId: true },
  });
  const missing = [
    ...people
      .filter((person) => !stored.people.has(person.imagePath))
      .map((person) => `banned person "${person.name}"`),
    ...alerts
      .filter((alert) => !stored[alert.bannedPersonId ? 'people' : 'alerts'].has(alert.imagePath))
      .map((alert) => `alert "${alert.reason}"`),
  ];

  if (missing.length === 0) {
    console.log('Every image in the database is in storage');
  } else {
    console.log(`${missing.length} images are missing, re-upload them in the app:`);
    for (const item of missing) console.log(`  - ${item}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
