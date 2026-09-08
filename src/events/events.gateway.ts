import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { UseGuards } from '@nestjs/common';
import { extractWsToken } from '../auth/extract-ws-token.util';
import { WsAuthenticationGuard } from './ws-jwt.guard';

@WebSocketGateway({
    cors: {
        origin: '*', // tighten this for production
    },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    @WebSocketServer()
    server: Server;

    async handleConnection(client: Socket) {
        try {
            const token = extractWsToken(client);
            if (token) {
                const payload: StaffPayload = await this.jwtService.verifyAsync(token);
                client.data.staff = payload;
                console.log(`${payload.name} has connected with ID: ${client.id}`);
            }
        } catch (err: unknown) {
            console.log('Auth error:', err);
            console.log(`Unauthenticated connection rejected - ${client.id}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('message')
    handleMessage(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
        @RequestFrom() staff: StaffPayload,
    ): void {
        this.server.emit('message', data);
    }
}