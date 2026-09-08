import { BadRequestException } from "@nestjs/common";
import { Request } from 'express';
import { PrismaClient, Roles, Staff } from "../generated/prisma/client";

export function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-')
    )
    .join(' ');
}

export function capitalize(input: string): string {
  const trimmed = input.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export const getBaseUrl = (req: Request) => {
  return `${req.protocol}://${req.get('host')}`;
};

export const imageFileValidator = (file: { fieldname?: string; originalname?: string; encoding?: string; mimetype: any; size?: number; destination?: string; filename?: string; path?: string; buffer?: Buffer<ArrayBufferLike>; }, callback: { (error: Error | null, acceptFile: boolean): void; (arg0: BadRequestException | null, arg1: boolean): void; }) => {
  if (
    file &&
    (file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp' ||
      file.mimetype === 'image/jpeg')
  ) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException('File given is not a png, webp or jpeg'),
      false,
    );
  }
}

export async function isAccountAdmin(
  prisma: PrismaClient,
  staffId: Staff["id"]
): Promise<boolean> {
  const requestFrom = await prisma.staff.findUnique({
    where: { id: staffId },
  });

  return requestFrom?.role === Roles.ADMIN;
}