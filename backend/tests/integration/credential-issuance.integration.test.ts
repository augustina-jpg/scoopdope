/**
 * @integration
 *
 * End-to-end credential issuance integration test.
 *
 * Exercises the full path: backend API -> Soroban `analytics` contract -> Stellar testnet.
 *
 * Run with:
 *   STELLAR_NETWORK=testnet \
 *   STELLAR_SECRET_KEY=S... \
 *   API_BASE_URL=http://localhost:3000 \
 *   npx jest --config jest.integration.config.js
 *
 * This suite is tagged `@integration` and is excluded from the unit test run
 * (see `testPathIgnorePatterns` / `--testPathIgnorePatterns` in the unit config).
 */
import { randomUUID } from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? 'testnet';
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY;

// A Stellar transaction hash is the hex-encoded 32-byte hash of the transaction.
const STELLAR_TX_HASH_REGEX = /^[0-9a-f]{64}$/i;

interface CredentialRecord {
  id: string;
  user_id: string;
  course_id: string;
  tx_hash: string | null;
  created_at?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${body}`);
  }

  return (await res.json()) as T;
}

describe('@integration credential issuance (Stellar testnet)', () => {
  beforeAll(() => {
    if (STELLAR_NETWORK !== 'testnet') {
      throw new Error(`Integration tests must run against testnet, got: ${STELLAR_NETWORK}`);
    }
    if (!STELLAR_SECRET_KEY) {
      throw new Error('STELLAR_SECRET_KEY must be set to a funded testnet key');
    }
    if (!StrKey.isValidEd25519SecretSeed(STELLAR_SECRET_KEY)) {
      throw new Error('STELLAR_SECRET_KEY is not a valid Stellar secret seed');
    }
  });

  it('enrolls a user, completes a course, and issues an on-chain credential', async () => {
    const suffix = randomUUID();

    // 1. Enroll a user.
    const user = await api<{ id: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `integration-${suffix}@example.com`,
        name: 'Integration Test User',
      }),
    });
    expect(user.id).toBeDefined();

    const course = await api<{ id: string }>('/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: `Integration Course ${suffix}`,
        description: 'Course used by the credential issuance integration test',
      }),
    });
    expect(course.id).toBeDefined();

    const enrollment = await api<{ id: string }>('/enrollments', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, course_id: course.id }),
    });
    expect(enrollment.id).toBeDefined();

    // 2. Complete the course.
    const completed = await api<{ status: string }>(`/enrollments/${enrollment.id}/complete`, {
      method: 'POST',
    });
    expect(completed.status).toBe('completed');

    // 3. Issue the credential on-chain.
    const issuance = await api<{ tx_hash: string; credential: CredentialRecord }>(
      '/credentials/issue',
      {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, course_id: course.id }),
      },
    );

    // 4. Assert the returned transaction hash is a valid Stellar transaction ID.
    expect(issuance.tx_hash).toBeDefined();
    expect(typeof issuance.tx_hash).toBe('string');
    expect(issuance.tx_hash).toMatch(STELLAR_TX_HASH_REGEX);

    // 5. Assert the credential record is written to the `credentials` table.
    const credentials = await api<CredentialRecord[]>(
      `/credentials?user_id=${encodeURIComponent(user.id)}&course_id=${encodeURIComponent(course.id)}`,
    );
    expect(Array.isArray(credentials)).toBe(true);
    expect(credentials.length).toBeGreaterThan(0);

    const record = credentials.find((c) => c.id === issuance.credential?.id) ?? credentials[0];
    expect(record).toBeDefined();
    expect(record.user_id).toBe(user.id);
    expect(record.course_id).toBe(course.id);
    expect(record.tx_hash).not.toBeNull();
    expect(record.tx_hash).toMatch(STELLAR_TX_HASH_REGEX);
  }, 120_000);
});
