import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { extractWsToken } from '../auth/extract-ws-token.util';
import { Staff } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';

export interface AlertCreatedPayload {
  id: string;
  title: string;
  createdBy: string;
}

// CORS is set by CorsIoAdapter in main.ts, once .env has been loaded
@WebSocketGateway()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        const token = extractWsToken(client);
        if (!token) throw new Error('missing token');

        const staff = await this.jwtService.verifyAsync<StaffPayload>(token);
        // Tokens outlive deleted accounts, so make sure the account is still there
        const exists = await this.prisma.staff.findUnique({
          where: { id: staff.id },
          select: { id: true },
        });
        if (!exists) throw new Error('staff not found');

        client.data.staff = staff;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(client: Socket) {
    const staff: StaffPayload = client.data.staff;
    client.join(`staff:${staff.id}`);
    this.logger.debug(`${staff.name} has connected with ID: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // notifyAlertCreated(staffId: Staff['id']) {
  //     // this.server.except(`staff:${staffId}`).emit('alert_created');
  //     this.server.emit('alert_created');
  // }

  notifyAlertsChanged() {
    this.server.emit('alert');
  }

  notifyStaffChanged() {
    this.server.emit('staff');
  }

  notifyBansChanged() {
    this.server.emit('ban');
  }

  notifyBannedPeopleChanged() {
    this.server.emit('bannedPerson');
  }

  notifyVenuesChanged() {
    this.server.emit('venue');
  }

  notifyStaffDeleted(staffToDelete: Staff['id']) {
    this.server.to(`staff:${staffToDelete}`).emit('delete');
  }
}
