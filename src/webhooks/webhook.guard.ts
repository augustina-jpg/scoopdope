import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';

@Injectable()
export class WebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = process.env.WEBHOOK_SECRET;

    if (!secret) {
      throw new UnauthorizedException('Webhook secret is not configured');
    }

    const header = request.headers[WEBHOOK_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const payload = this.getRawPayload(request);
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    if (!this.safeCompare(signature, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }

  private getRawPayload(request: Request): string {
    const rawBody = (request as Request & { rawBody?: Buffer | string }).rawBody;

    if (Buffer.isBuffer(rawBody)) {
      return rawBody.toString('utf8');
    }

    if (typeof rawBody === 'string') {
      return rawBody;
    }

    return JSON.stringify(request.body ?? {});
  }

  private safeCompare(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
