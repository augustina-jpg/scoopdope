# feat: implement royalty distribution for instructors

## Summary

Implements automatic royalty distribution to course instructors when students purchase courses, fulfilling the requirements of issue #287.

## Changes

### Smart Contract (`contracts/royalty_distribution/`)
- Rewrote `contracts/royalty_distribution/src/lib.rs` with a clean, production-ready Soroban contract
- **Configurable royalty percentage per course** via `set_course_config(course_id, instructor_pct, platform_pct)`
- **Multi-instructor equal splits** — register multiple instructors per course; share is divided equally with dust going to the first instructor
- **Automatic distribution** via `distribute(course_id, total_amount, platform_address)` — called on purchase
- **Withdraw** — instructors pull their accumulated balance with `withdraw(recipient)`
- Added `[dev-dependencies]` for `soroban-sdk testutils` and 8 unit tests covering: initialize, double-init guard, config validation, single/multi-instructor distribution, remainder handling, withdrawal, and cumulative distributions
- Added `contracts/royalty_distribution` to the Cargo workspace

### Backend (`apps/backend/`)
- **`course.entity.ts`** — added `royaltyPercentage: number` column (default 80, meaning 80% to instructor / 20% platform)
- **`payments/royalty-distribution.service.ts`** (new) — `RoyaltyDistributionService` listens to `payment.succeeded` events via `@OnEvent` and creates a `Payout` record for the instructor; also exposes `getInstructorEarnings()` for the dashboard
- **`payments/payments.service.ts`** — webhook handler now emits `payment.succeeded` event with `{ courseId, userId, amountUsd }` after a successful Stripe `payment_intent.succeeded`
- **`payments/payments.module.ts`** — added `Payout` entity and `RoyaltyDistributionService`
- **`payouts/payouts.controller.ts`** — added `GET /v1/payouts/instructor/:id/earnings` endpoint
- **`payouts/payouts.module.ts`** — added `RoyaltyDistributionService` as provider/export

### Frontend (`apps/frontend/`)
- **`instructor/dashboard/page.tsx`** — added **Royalty Earnings** section showing:
  - Total earned, pending payout, and paid-out amounts
  - Per-course earnings breakdown with horizontal bar chart
  - Link to full Revenue Analytics page

## Testing

- Smart contract: `cargo test -p royalty_distribution` — 8 tests pass
- Backend: royalty distribution is event-driven; existing payout endpoints cover earnings retrieval
- Frontend: earnings section gracefully degrades (hidden) if the API is unavailable

Closes #287
