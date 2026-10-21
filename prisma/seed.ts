// Fills the database with sample data for local development.
// Run with `pnpm db:seed`. WARNING: this deletes every existing row first.
import 'dotenv/config';
import * as fs from 'fs';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { createImageFolders, ImageFolder, imagePath, MAX_IMAGE_SIZE } from '../src/utils/images';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Every seeded account signs in with this password
const PASSWORD = 'password123';

// Seed images are prefixed so reseeding only removes its own files
const SEED_IMAGE_PREFIX = 'seed-';

const PALETTE = ['#e11d48', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#ea580c', '#db2777'];

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

// Fixed-seed random numbers so every reseed produces the same data
let randomState = 42;
const random = () => {
  randomState = (randomState * 1103515245 + 12345) % 2 ** 31;
  return randomState / 2 ** 31;
};
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const initials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

let colourIndex = 0;

// Draws a coloured square with the name's initials, saved as webp like real uploads
async function createImage(folder: ImageFolder, name: string): Promise<string> {
  const filename = `${SEED_IMAGE_PREFIX}${slugify(name)}.webp`;
  const colour = PALETTE[colourIndex++ % PALETTE.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <rect width="100%" height="100%" fill="${colour}"/>
      <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="200" font-weight="bold" fill="#ffffff">${initials(name)}</text>
    </svg>`;

  await sharp(Buffer.from(svg)).webp({ quality: 75 }).toFile(imagePath(folder, filename));
  return filename;
}

// pravatar.cc has 70 numbered face photos, so each person gets the next one in order
const PORTRAIT_COUNT = 70;
let portraitIndex = 0;

// Downloads a stock face photo, falling back to initials when offline
async function createPortrait(name: string): Promise<string> {
  const filename = `${SEED_IMAGE_PREFIX}${slugify(name)}.webp`;
  const img = (portraitIndex++ % PORTRAIT_COUNT) + 1;
  try {
    const res = await fetch(`https://i.pravatar.cc/${MAX_IMAGE_SIZE}?img=${img}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await sharp(Buffer.from(await res.arrayBuffer()))
      .webp({ quality: 75 })
      .toFile(imagePath(ImageFolder.PEOPLE, filename));
    return filename;
  } catch (err) {
    console.warn(`Couldn't download a photo for ${name}, using initials: ${(err as Error).message}`);
    return createImage(ImageFolder.PEOPLE, name);
  }
}

async function removeSeedImages() {
  await Promise.all(
    Object.values(ImageFolder).map(async (folder) => {
      const dir = imagePath(folder, '');
      const files = await fs.promises.readdir(dir);
      await Promise.all(
        files
          .filter((file) => file.startsWith(SEED_IMAGE_PREFIX))
          .map((file) => fs.promises.rm(imagePath(folder, file), { force: true })),
      );
    }),
  );
}

async function clearDatabase() {
  // Children before parents so foreign keys don't block the deletes
  await prisma.venueBan.deleteMany();
  await prisma.ban.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.bannedPerson.deleteMany();
  await prisma.venueManager.deleteMany();
  await prisma.dutyManager.deleteMany();
  await prisma.venue.deleteMany();
  // Existing admin accounts are kept so you can still sign in after seeding
  await prisma.staff.deleteMany({ where: { role: { not: Role.ADMIN } } });
}

async function main() {
  await createImageFolders();
  await removeSeedImages();
  await clearDatabase();

  const password = await argon2.hash(PASSWORD);

  // --- Staff ---
  const staffData = {
    morgan: { name: 'Morgan Reid', email: 'morgan@bounce.test', role: Role.VENUE_MANAGER },
    sam: { name: 'Sam Patel', email: 'sam@bounce.test', role: Role.VENUE_MANAGER },
    jordan: { name: 'Jordan Lee', email: 'jordan@bounce.test', role: Role.DUTY_MANAGER },
    casey: { name: 'Casey Nguyen', email: 'casey@bounce.test', role: Role.DUTY_MANAGER },
    riley: { name: 'Riley Brooks', email: 'riley@bounce.test', role: Role.BOUNCER },
    taylor: { name: 'Taylor Kim', email: 'taylor@bounce.test', role: Role.BOUNCER },
    jamie: { name: 'Jamie Ortiz', email: 'jamie@bounce.test', role: Role.BOUNCER },
  };

  const staff = Object.fromEntries(
    await Promise.all(
      Object.entries(staffData).map(async ([key, data]) => [
        key,
        await prisma.staff.create({ data: { ...data, password } }),
      ]),
    ),
  ) as Record<keyof typeof staffData | 'admin', { id: string }>;

  // Reuse an existing admin, only creating one on an empty database
  const existingAdmin = await prisma.staff.findFirst({ where: { role: Role.ADMIN } });
  staff.admin =
    existingAdmin ??
    (await prisma.staff.create({
      data: { name: 'Alex Admin', email: 'admin@bounce.test', role: Role.ADMIN, password },
    }));

  // --- Venues ---
  const venueNames = {
    velvet: 'Velvet Lounge',
    neon: 'Neon Room',
    docks: 'The Docks',
    skyline: 'Skyline Rooftop',
    // No managers or duty managers assigned
    harbour: 'Harbour Bar',
  };

  const venues = Object.fromEntries(
    await Promise.all(
      Object.entries(venueNames).map(async ([key, name]) => [
        key,
        await prisma.venue.create({
          data: { name },
        }),
      ]),
    ),
  ) as Record<keyof typeof venueNames, { id: string }>;

  const allVenueIds = Object.values(venues).map((venue) => venue.id);

  await prisma.venueManager.createMany({
    data: [
      { staffId: staff.morgan.id, venueId: venues.velvet.id },
      { staffId: staff.morgan.id, venueId: venues.docks.id },
      { staffId: staff.sam.id, venueId: venues.neon.id },
      { staffId: staff.sam.id, venueId: venues.skyline.id },
    ],
  });

  await prisma.dutyManager.createMany({
    data: [
      { staffId: staff.jordan.id, venueId: venues.velvet.id },
      { staffId: staff.jordan.id, venueId: venues.docks.id },
      { staffId: staff.casey.id, venueId: venues.neon.id },
      { staffId: staff.casey.id, venueId: venues.skyline.id },
    ],
  });

  // --- Banned people and their bans ---
  type SeedBan = {
    reason: string;
    start: number; // days from now
    end: number;
    venueIds: string[];
    by: keyof typeof staff;
    // Bans from anyone other than admins and venue managers start out pending
    pending?: boolean;
  };

  const people: { name: string; bans: SeedBan[] }[] = [
    {
      name: 'Blake Turner',
      bans: [{ reason: 'Assaulted a staff member', start: -20, end: 345, venueIds: allVenueIds, by: 'admin' }],
    },
    {
      // Two bans that only add up to a blanket ban together
      name: 'Emerson Clark',
      bans: [
        { reason: 'Repeated fighting', start: -10, end: 80, venueIds: [venues.velvet.id, venues.docks.id], by: 'morgan' },
        { reason: 'Repeated fighting', start: -8, end: 82, venueIds: [venues.neon.id, venues.skyline.id, venues.harbour.id], by: 'admin' },
      ],
    },
    {
      name: 'Drew Collins',
      bans: [{ reason: 'Harassing customers', start: -5, end: 85, venueIds: [venues.velvet.id], by: 'morgan' }],
    },
    {
      name: 'Quinn Harper',
      bans: [
        { reason: 'Underage with a fake id', start: -200, end: -20, venueIds: [venues.neon.id], by: 'sam' },
        { reason: 'Refused to leave when asked', start: -3, end: 27, venueIds: [venues.docks.id], by: 'morgan' },
      ],
    },
    {
      name: 'Reese Walker',
      bans: [{ reason: 'Threatened door staff', start: 5, end: 95, venueIds: [venues.skyline.id], by: 'sam' }],
    },
    {
      name: 'Sky Bennett',
      bans: [{ reason: 'Smashed a glass', start: -120, end: -30, venueIds: [venues.velvet.id, venues.neon.id], by: 'admin' }],
    },
    {
      name: 'Avery Morgan',
      bans: [{ reason: 'Drunk and abusive at the door', start: 0, end: 30, venueIds: [venues.velvet.id], by: 'riley', pending: true }],
    },
    {
      name: 'Parker Hayes',
      bans: [{ reason: 'Caught dealing in the bathrooms', start: 0, end: 180, venueIds: [venues.neon.id, venues.docks.id], by: 'jordan', pending: true }],
    },
    {
      name: 'Rowan Fisher',
      bans: [{ reason: 'Started a fight on the dancefloor', start: 1, end: 365, venueIds: allVenueIds, by: 'casey', pending: true }],
    },
    {
      // Has an approved ban and a pending one on top
      name: 'Hayden Price',
      bans: [
        { reason: 'Stole from the bar', start: -15, end: 45, venueIds: [venues.skyline.id], by: 'sam' },
        { reason: 'Stole from the bar again', start: 0, end: 90, venueIds: [venues.neon.id], by: 'taylor', pending: true },
      ],
    },
    {
      // Banned from every venue but one, so not a blanket ban
      name: 'Morgan Ellis',
      bans: [
        {
          reason: 'Kept sneaking drinks in',
          start: -4,
          end: 60,
          venueIds: allVenueIds.filter((id) => id !== venues.harbour.id),
          by: 'admin',
        },
      ],
    },
    {
      // Was banned from every venue, but it has run out
      name: 'Jesse Long',
      bans: [{ reason: 'Vandalised the toilets', start: -400, end: -10, venueIds: allVenueIds, by: 'admin' }],
    },
    ...generatedPeople(),
  ];

  // Enough extra people to fill several screens, for scrolling, searching and image loading
  function generatedPeople(): { name: string; bans: SeedBan[] }[] {
    const firstNames = ['Alex', 'Bailey', 'Cameron', 'Dakota', 'Elliot', 'Finley', 'Harper', 'Jordan', 'Kai', 'Logan', 'Micah', 'Noah', 'Peyton', 'Riley', 'Sage', 'Toby'];
    const lastNames = ['Adams', 'Brooks', 'Carter', 'Dixon', 'Evans', 'Foster', 'Grant', 'Hughes', 'Irwin', 'James', 'Knight', 'Lowe', 'Mason', 'Nash', 'Owens', 'Pierce'];
    const reasons = ['Fighting', 'Abusive to staff', 'Fake id', 'Drunk and disorderly', 'Theft', 'Refused to leave', 'Damaged property', 'Harassing customers'];
    const bannedBy = ['admin', 'morgan', 'sam'] as const;
    // [start, end] in days from now: active, expired and future bans
    const periods = [[-30, 60], [-10, 20], [-200, -50], [-5, 365], [3, 90]] as const;

    const names = new Set<string>();
    while (names.size < 30) names.add(`${pick(firstNames)} ${pick(lastNames)}`);

    return [...names].map((name) => {
      const [start, end] = pick(periods);
      const venueIds = allVenueIds.filter(() => random() < 0.4);
      return {
        name,
        bans: [
          {
            reason: pick(reasons),
            start,
            end,
            venueIds: venueIds.length > 0 ? venueIds : [venues.velvet.id],
            by: pick(bannedBy),
            pending: random() < 0.15,
          },
        ],
      };
    });
  }

  const bannedPeople: Record<string, { id: string; imagePath: string }> = {};

  for (const person of people) {
    const created = await prisma.bannedPerson.create({
      data: {
        name: person.name,
        imagePath: await createPortrait(person.name),
        bans: {
          create: person.bans.map((ban) => ({
            reason: ban.reason,
            startDate: daysFromNow(ban.start),
            endDate: daysFromNow(ban.end),
            isPending: ban.pending ?? false,
            createdById: staff[ban.by].id,
            venueBans: { create: ban.venueIds.map((venueId) => ({ venueId })) },
          })),
        },
      },
    });
    bannedPeople[person.name] = created;
  }

  // --- Alerts ---
  // Standalone alerts own an image in the alerts folder
  for (const [reason, by] of [
    ['Group of four in matching red jackets causing trouble on the strip', staff.jamie.id],
    ['Man in a grey hoodie trying fake ids at several venues', staff.riley.id],
    ['Two men in suits asking staff about the cash office', staff.taylor.id],
    ['Woman with a pink backpack reported for pickpocketing', staff.jordan.id],
    ['Silver hatchback idling outside the back entrance', staff.casey.id],
  ] as const) {
    await prisma.alert.create({
      data: {
        reason,
        imagePath: await createImage(ImageFolder.ALERTS, reason.split(' ').slice(0, 3).join(' ')),
        createdById: by,
      },
    });
  }

  // Alerts about a banned person reuse that person's image
  const blake = bannedPeople['Blake Turner'];
  await prisma.alert.create({
    data: {
      reason: 'Blake turner seen heading towards the docks',
      imagePath: blake.imagePath,
      bannedPersonId: blake.id,
      createdById: staff.taylor.id,
    },
  });

  const alertCount = await prisma.alert.count();
  console.log(
    `Seeded ${Object.keys(staff).length} staff, ${allVenueIds.length} venues, ${people.length} banned people and ${alertCount} alerts`,
  );
  console.log(
    existingAdmin
      ? `Kept existing admin; seeded accounts sign in with password "${PASSWORD}"`
      : `Sign in as admin@bounce.test (or any seeded account) with password "${PASSWORD}"`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
