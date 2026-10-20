import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

// Each kind of image lives in its own folder under uploads/compressed
export const ImageFolder = {
  ALERTS: 'alerts',
  PEOPLE: 'people',
} as const;
export type ImageFolder = (typeof ImageFolder)[keyof typeof ImageFolder];

const COMPRESSED_FOLDER = path.join(process.cwd(), 'uploads', 'compressed');
const ALLOWED_MIME_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
// Images only ever show as cards, so anything bigger is wasted download
export const MAX_IMAGE_SIZE = 800;

// check over all controllers & functions to make sure its still readable

// Accepts a single 'image' field and stores it uncompressed until saveImage converts it
export const ImageUpload = () =>
  FileInterceptor('image', {
    limits: { files: 1 },
    storage: multer.diskStorage({
      destination: 'uploads/uncompressed',
      filename: (req, file, callback) => callback(null, uuidv4()),
    }),
    fileFilter: (req, file, callback) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('File given is not a png, webp or jpeg'), false);
      }
    },
  });

export async function createImageFolders(): Promise<void> {
  await Promise.all(
    Object.values(ImageFolder).map((folder) =>
      fs.promises.mkdir(path.join(COMPRESSED_FOLDER, folder), { recursive: true }),
    ),
  );
}

export function imagePath(folder: ImageFolder, filename: string): string {
  return path.join(COMPRESSED_FOLDER, folder, filename);
}

export function imageUrl(baseUrl: string, folder: ImageFolder, filename: string): string {
  return `${baseUrl}/uploads/compressed/${folder}/${filename}`;
}

// Converts an uploaded image to webp in the given folder and returns the new filename
export async function saveImage(file: Express.Multer.File, folder: ImageFolder): Promise<string> {
  const filename = `${file.filename}.webp`;
  await sharp(file.path)
    .rotate()
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toFile(imagePath(folder, filename));
  return filename;
}

export async function deleteImage(folder: ImageFolder, filename: string): Promise<void> {
  await fs.promises.rm(imagePath(folder, filename), { force: true });
}

// The uncompressed upload is only needed until saveImage has run
export async function deleteUpload(file: Express.Multer.File | undefined): Promise<void> {
  if (file) await fs.promises.unlink(file.path).catch(() => {});
}
