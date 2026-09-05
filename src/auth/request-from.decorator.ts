import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffPayload } from './staff-payload.interface';

export const RequestFrom = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): StaffPayload | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.staff;
  },
);