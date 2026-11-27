import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookGuard } from './webhook.guard';

const SECRET = 'test-webhook-secret';

function sign(payload: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function buildContext(headers: Record<string, string | undefined>, rawBody: string) {
  const request = { headers, rawBody };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('WebhookGuard', () => {
  let guard: WebhookGuard;

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = SECRET;
    guard = new WebhookGuard();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  it('allows a request with a valid signature', () => {
    const payload = JSON.stringify({ event: 'payment.confirmed', amount: 100 });
    const context = buildContext({ 'x-webhook-signature': sign(payload) }, payload);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with a tampered payload', () => {
    const original = JSON.stringify({ event: 'payment.confirmed', amount: 100 });
    const tampered = JSON.stringify({ event: 'payment.confirmed', amount: 1000000 });
    const context = buildContext({ 'x-webhook-signature': sign(original) }, tampered);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request missing the signature header', () => {
    const payload = JSON.stringify({ event: 'payment.confirmed', amount: 100 });
    const context = buildContext({}, payload);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
