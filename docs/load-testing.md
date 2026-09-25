# Load Testing

The repository uses [k6](https://k6.io/) for repeatable API load tests. The
authoritative scenario is `scripts/load-tests/api-read-only.js`. It exercises
read-only endpoints only, so it does not create users, enrollments, payments,
progress records, or Stellar transactions.

## Prerequisites

- A running backend reachable at `API_URL`.
- k6 installed and available on `PATH`.
- A test environment with representative data. Do not point this at production
  without an explicit capacity-testing approval.

Install k6 on Windows with `choco install k6`, on macOS with `brew install k6`,
or on Debian/Ubuntu using the official k6 installation instructions.

## Run

The backend health endpoint is checked before k6 starts. Results are written to
`load-test-results/` as timestamped JSON and text summary files.

```bash
# Fast connectivity check: one VU for 20 seconds
LOAD_PROFILE=smoke API_URL=http://localhost:3000 bash scripts/load-test.sh

# Five VUs for 50 seconds
LOAD_PROFILE=baseline API_URL=http://localhost:3000 bash scripts/load-test.sh

# Windows PowerShell equivalent
.\scripts\run-load-tests.ps1 -Profile smoke -ApiUrl http://localhost:3000
```

The optional leaderboard request is enabled explicitly because it can exercise
database and Stellar-backed work:

```bash
INCLUDE_LEADERBOARD=true LOAD_PROFILE=baseline bash scripts/load-test.sh
```

## Scenarios and thresholds

| Profile | Load shape | Intended use |
| --- | --- | --- |
| `smoke` | 1 VU, 20 seconds | Verify connectivity and script correctness |
| `baseline` | 5 VUs, 50 seconds | Establish a repeatable local/staging baseline |
| `stress` | 10 to 50 VUs over 3 minutes | Find degradation before capacity planning |

Every profile calls `GET /health/live` and `GET /v1/courses`. The optional
leaderboard call uses `GET /v1/leaderboard`. Thresholds are:

- Overall failed request rate below 1%.
- Health p95 below 200 ms and p99 below 500 ms.
- Courses p95 below 500 ms and p99 below 1,000 ms.
- Optional leaderboard p95 below 1,000 ms and p99 below 2,000 ms.

These are initial engineering guardrails, not production capacity claims. Tune
them after collecting results in an environment that matches deployment.

## Results

No measured result is committed yet. k6 was not installed in the development
environment when this suite was added, so reporting numerical latency results
would be fabricated. Run the smoke profile first, then baseline and stress in a
staging environment. Record the generated summary files, environment details,
data volume, commit SHA, profile, and pass/fail status in
`docs/load-testing-results.md`.

## CI guidance

Load tests should run against a started staging service or an explicitly
provisioned test stack. A job that defaults to `localhost` without starting the
backend, or that uses `continue-on-error` for threshold failures, does not
provide meaningful performance evidence. Keep load tests separate from normal
unit-test jobs and run them on demand or on a scheduled staging workflow.
