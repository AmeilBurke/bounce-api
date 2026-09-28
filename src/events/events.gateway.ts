import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { extractWsToken } from '../auth/extract-ws-token.util';
import { Staff } from '../generated/prisma/client';

export interface AlertCreatedPayload {
    id: string;
    title: string;
    createdBy: string;
}

@WebSocketGateway({
    cors: {
        origin: '*', // tighten this for production
    },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    constructor(private jwtService: JwtService) { }

    @WebSocketServer()
    server: Server;

    afterInit(server: Server) {
        server.use(async (client, next) => {
            try {
                const token = extractWsToken(client);
                if (!token) throw new Error('missing token');

                client.data.staff = await this.jwtService.verifyAsync<StaffPayload>(token);
                next();
            } catch {
                next(new Error('unauthorized'));
            }
        });
    }

    handleConnection(client: Socket) {
        const staff: StaffPayload = client.data.staff;
        client.join(`staff:${staff.id}`); // assumes StaffPayload has an id, use whichever field identifies them
        console.log(`${staff.name} has connected with ID: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    notifyAlertCreated(staffId: Staff['id']) {
        // this.server.except(`staff:${staffId}`).emit('alert_created');
        this.server.emit('alert_created');
    }

    notifyAlertDeleted() {
        this.server.emit('alert_deleted');
    }
}
