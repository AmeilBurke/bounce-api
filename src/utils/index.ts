import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaClient, Role, Staff } from '../generated/prisma/client';

export * from './images';

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
        .join('-'),
    )
    .join(' ');
}

export function capitalize(input: string): string {
  const trimmed = input.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function getBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

// Removes duplicate ids; undefined stays undefined so "not sent" can mean "leave untouched"
export function uniqueIds(ids: string[] | undefined): string[] | undefined {
  return ids === undefined ? undefined : [...new Set(ids)];
}

export async function isAccountAdmin(prisma: PrismaClient, staffId: Staff['id']): Promise<boolean> {
  const requestFrom = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { role: true },
  });

  return requestFrom?.role === Role.ADMIN;
}

export async function assertAdmin(prisma: PrismaClient, staffId: Staff['id']): Promise<void> {
  if (!(await isAccountAdmin(prisma, staffId))) {
    throw new ForbiddenException();
  }
}
