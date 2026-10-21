import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

// Each kind of image lives in its own folder of the storage bucket
export const ImageFolder = {
  ALERTS: 'alerts',
  PEOPLE: 'people',
} as const;
export type ImageFolder = (typeof ImageFolder)[keyof typeof ImageFolder];

const ALLOWED_MIME_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
// Images only ever show as cards, so anything bigger is wasted download
export const MAX_IMAGE_SIZE = 800;
// Phone photos are a few MB; this just stops someone filling the server's memory
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// Every saved image gets a new random filename, so a URL's content never changes
const CACHE_SECONDS = String(365 * 24 * 60 * 60);

let client: SupabaseClient | undefined;

// Created on first use so .env has been loaded by then
function supabase(): SupabaseClient {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

const storage = () => supabase().storage.from(imageBucket());

export function imageBucket(): string {
  return process.env.SUPABASE_BUCKET ?? 'images';
}

const objectPath = (folder: ImageFolder, filename: string) => `${folder}/${filename}`;

// Accepts a single 'image' field and keeps it in memory until saveImage converts it
export const ImageUpload = () =>
  FileInterceptor('image', {
    limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
    storage: multer.memoryStorage(),
    fileFilter: (req, file, callback) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('File given is not a png, webp or jpeg'), false);
      }
    },
  });

// Public bucket, so the URL is fixed and needs no request to build
export function imageUrl(folder: ImageFolder, filename: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${imageBucket()}/${objectPath(folder, filename)}`;
}

// Stores already-encoded webp bytes under the given filename
export async function uploadImage(folder: ImageFolder, filename: string, webp: Buffer): Promise<void> {
  const { error } = await storage().upload(objectPath(folder, filename), webp, {
    contentType: 'image/webp',
    cacheControl: CACHE_SECONDS,
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload image ${filename}: ${error.message}`);
}

// Converts an uploaded image to webp in the given folder and returns the new filename
export async function saveImage(file: Express.Multer.File, folder: ImageFolder): Promise<string> {
  const filename = `${uuidv4()}.webp`;
  const webp = await sharp(file.buffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
  await uploadImage(folder, filename, webp);
  return filename;
}

export async function copyImage(from: ImageFolder, to: ImageFolder, filename: string): Promise<void> {
  const { error } = await storage().copy(objectPath(from, filename), objectPath(to, filename));
  if (error) throw new Error(`Failed to copy image ${filename}: ${error.message}`);
}

// Missing files are ignored, like rm --force
export async function deleteImages(folder: ImageFolder, filenames: string[]): Promise<void> {
  if (filenames.length === 0) return;
  const { error } = await storage().remove(filenames.map((filename) => objectPath(folder, filename)));
  if (error) throw new Error(`Failed to delete images: ${error.message}`);
}

export async function deleteImage(folder: ImageFolder, filename: string): Promise<void> {
  await deleteImages(folder, [filename]);
}

export async function listImages(folder: ImageFolder): Promise<string[]> {
  const names: string[] = [];
  // Storage lists at most 1000 per call
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage().list(folder, { limit: 1000, offset });
    if (error) throw new Error(`Failed to list images: ${error.message}`);
    names.push(...data.map((file) => file.name));
    if (data.length < 1000) return names;
  }
}

// For scripts setting up a new project; the API itself assumes the bucket exists
export async function ensureImageBucket(): Promise<void> {
  const { data } = await supabase().storage.getBucket(imageBucket());
  if (data) return;
  const { error } = await supabase().storage.createBucket(imageBucket(), {
    public: true,
    allowedMimeTypes: ['image/webp'],
  });
  if (error) throw new Error(`Failed to create bucket ${imageBucket()}: ${error.message}`);
}
