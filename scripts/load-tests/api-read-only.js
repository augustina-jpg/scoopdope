import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = (__ENV.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_PREFIX = (__ENV.API_PREFIX || '/v1').replace(/\/$/, '');
const INCLUDE_LEADERBOARD = __ENV.INCLUDE_LEADERBOARD === 'true';
const PROFILES = {
  smoke: [{ duration: '5s', target: 1 }, { duration: '10s', target: 1 }, { duration: '5s', target: 0 }],
  baseline: [{ duration: '10s', target: 5 }, { duration: '30s', target: 5 }, { duration: '10s', target: 0 }],
  stress: [{ duration: '30s', target: 10 }, { duration: '1m', target: 25 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }],
};
const profile = __ENV.LOAD_PROFILE || 'baseline';

if (!PROFILES[profile]) {
  throw new Error(`Unsupported LOAD_PROFILE: ${profile}`);
}

export const options = {
  stages: PROFILES[profile],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:health}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{endpoint:courses}': ['p(95)<500', 'p(99)<1000'],
    ...(INCLUDE_LEADERBOARD
      ? { 'http_req_duration{endpoint:leaderboard}': ['p(95)<1000', 'p(99)<2000'] }
      : {}),
  },
};

function readOnlyGet(path, endpoint, expectedStatus, maxDuration) {
  const response = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint },
  });

  check(response, {
    [`${endpoint} returns ${expectedStatus}`]: (res) => res.status === expectedStatus,
    [`${endpoint} responds within ${maxDuration}ms`]: (res) => res.timings.duration < maxDuration,
    [`${endpoint} returns a body`]: (res) => res.body.length > 0,
  });

  return response;
}

export default function () {
  group('health', () => {
    readOnlyGet('/health/live', 'health', 200, 500);
  });

  group('courses', () => {
    readOnlyGet(`${API_PREFIX}/courses`, 'courses', 200, 1000);
  });

  if (INCLUDE_LEADERBOARD) {
    group('leaderboard', () => {
      readOnlyGet(`${API_PREFIX}/leaderboard`, 'leaderboard', 200, 2000);
    });
  }

  sleep(1);
}
