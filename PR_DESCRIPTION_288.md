# feat: implement buyback contract for token price stability

## Summary

Implements the BST buyback and burn mechanism using platform revenue, fulfilling the requirements of issue #288.

## Changes

### Smart Contract (`contracts/buyback/`)
- Rewrote `contracts/buyback/src/lib.rs` with clean, correct Soroban patterns
- **Configurable buyback threshold** via `set_config()` — `revenue_threshold`, `min_reserve`, `max_spend_per_buyback`, `interval_ledgers`, `enabled`
- **Automatic trigger** via `auto_buyback()` — checks reserve ≥ threshold + min_reserve and ledger interval before executing
- **Manual trigger** via `execute_buyback(admin, xlm_amount)` for admin-initiated buybacks
- **Reserve management** via `deposit_reserve(from, amount)` — platform revenue flows in here
- **Burn mechanism** — `bst_bought` represents tokens bought and burned (reduces supply); recorded per execution
- **Persistent storage** for all history records (not instance storage)
- **Events emitted** for every buyback execution, config change, and reserve deposit
- Fixed `Cargo.toml`: moved `testutils` from `[dependencies]` to `[dev-dependencies]`
- 10 unit tests covering: initialize, double-init guard, config set, deposit, manual buyback, min_reserve guard, max_spend guard, auto-buyback execution, auto-buyback skip (disabled), auto-buyback skip (insufficient reserve), stats & history

### Frontend (`apps/frontend/`)
- **`src/components/admin/BuybackStats.tsx`** (new) — admin component showing:
  - Auto-buyback on/off status badge with config summary
  - Stats cards: total buybacks, BST bought & burned, XLM spent, reserve balance
  - Reserve utilisation progress bar
  - Recent buybacks history table (ledger, date, XLM spent, BST bought, trigger type)
  - Graceful fallback to mock data when API unavailable
- **`src/app/admin/page.tsx`** — added `Buyback` tab wired to `<BuybackStats />`

Closes #288
