import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { AuthenticationGuard } from './auth.guard';
import { PrismaService } from '../prisma.service';

describe('AuthenticationGuard', () => {
  const payload = { id: 'staff-1', name: 'Morgan Reid' };
  let jwt: { verifyAsync: ReturnType<typeof vi.fn> };
  let prisma: { staff: { findUnique: ReturnType<typeof vi.fn> } };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: AuthenticationGuard;

  const contextFor = (request: Record<string, unknown>) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const withToken = () => ({ headers: { authorization: 'Bearer token' } }) as Record<string, any>;

  beforeEach(() => {
    jwt = { verifyAsync: vi.fn().mockResolvedValue(payload) };
    prisma = { staff: { findUnique: vi.fn().mockResolvedValue({ id: 'staff-1' }) } };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    guard = new AuthenticationGuard(
      jwt as unknown as JwtService,
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  it('attaches the staff member for a valid token', async () => {
    const request = withToken();
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.staff).toEqual(payload);
  });

  it('rejects requests without a token', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired or tampered tokens', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(guard.canActivate(contextFor(withToken()))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens for deleted staff', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor(withToken()))).rejects.toThrow(UnauthorizedException);
  });

  it('lets public routes through, without a staff member for a deleted account', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    prisma.staff.findUnique.mockResolvedValue(null);
    const request = withToken();
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.staff).toBeUndefined();
  });
});
