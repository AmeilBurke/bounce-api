import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AppStatus {
  status: 'ok' | 'degraded';
  startedAt: string;
  uptimeSeconds: number;
  nodeVersion: string;
  database: { connected: boolean; latencyMs: number | null };
  // Only filled in while the database is reachable
  counts: {
    staff: number;
    venues: number;
    bannedPeople: number;
    activeBans: number;
    pendingBans: number;
    alerts: number;
  } | null;
}

@Injectable()
export class AppService {
  private readonly startedAt = new Date();

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<AppStatus> {
    const database = await this.checkDatabase();
    return {
      status: database.connected ? 'ok' : 'degraded',
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      nodeVersion: process.version,
      database,
      counts: database.connected ? await this.getCounts() : null,
    };
  }

  private async checkDatabase(): Promise<AppStatus['database']> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { connected: true, latencyMs: Date.now() - start };
    } catch {
      return { connected: false, latencyMs: null };
    }
  }

  private async getCounts(): Promise<AppStatus['counts']> {
    const now = new Date();
    const [staff, venues, bannedPeople, activeBans, pendingBans, alerts] = await Promise.all([
      this.prisma.staff.count(),
      this.prisma.venue.count(),
      this.prisma.bannedPerson.count(),
      this.prisma.ban.count({ where: { isPending: false, startDate: { lte: now }, endDate: { gt: now } } }),
      this.prisma.ban.count({ where: { isPending: true } }),
      this.prisma.alert.count(),
    ]);
    return { staff, venues, bannedPeople, activeBans, pendingBans, alerts };
  }
}
