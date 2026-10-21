import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: vi.fn(),
    staff: { count: vi.fn().mockResolvedValue(8) },
    venue: { count: vi.fn().mockResolvedValue(5) },
    bannedPerson: { count: vi.fn().mockResolvedValue(42) },
    ban: { count: vi.fn().mockResolvedValue(3) },
    alert: { count: vi.fn().mockResolvedValue(6) },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('serves the status page', () => {
      expect(appController.getStatusPage()).toContain('<title>Bounce API</title>');
    });
  });

  describe('status', () => {
    it('reports ok with counts when the database is reachable', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([1]);
      const status = await appController.getStatus();
      expect(status.status).toBe('ok');
      expect(status.database.connected).toBe(true);
      expect(status.counts).toMatchObject({ venues: 5, bannedPeople: 42, alerts: 6 });
    });

    it('reports degraded without counts when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('down'));
      const status = await appController.getStatus();
      expect(status.status).toBe('degraded');
      expect(status.counts).toBeNull();
    });
  });
});
