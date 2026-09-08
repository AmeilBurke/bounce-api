import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffPayload } from './staff-payload.interface';

export const RequestFrom = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): StaffPayload | undefined => {
    if (ctx.getType() === 'ws') {
      const client = ctx.switchToWs().getClient();
      return client.data.staff;
    }

    const request = ctx.switchToHttp().getRequest();
    return request.staff;
  },
);