import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Access JWT содержит только `{ sub: customerId }` (как на feature/backend).
 * В `validate` стратегии дублируем в userId для кода, ожидающего userId.
 */
export interface JwtPayload {
  sub: string;
  userId: string;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
