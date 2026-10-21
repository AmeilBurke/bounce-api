import { Provider } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { EventsGateway } from '../src/events/events.gateway';

// Stands in for a dependency a test doesn't call
export const mockOf = (token: unknown): Provider => ({ provide: token as string, useValue: {} });

// What every resource service is constructed with
export const serviceDeps: Provider[] = [mockOf(PrismaService), mockOf(EventsGateway)];
