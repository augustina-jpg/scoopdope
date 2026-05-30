#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec,
};

// =============================================================================
// Storage keys
// =============================================================================

#[contracttype]
pub enum DataKey {
    Admin,
    Config,
    TotalBought,  // i128 — cumulative BST bought & burned
    TotalSpent,   // i128 — cumulative XLM spent
    Count,        // u32  — number of buyback records
    Record(u32),  // BuybackRecord per index (persistent)
    LastLedger,   // u32
    Reserve,      // i128 — XLM held for buybacks
}

// =============================================================================
// Types
// =============================================================================

/// Configurable buyback parameters.
#[contracttype]
#[derive(Clone)]
pub struct BuybackConfig {
    pub enabled: bool,
    /// Minimum XLM reserve that must remain after a buyback.
    pub min_reserve: i128,
    /// Maximum XLM to spend per single buyback execution.
    pub max_spend_per_buyback: i128,
    /// Minimum ledgers between automatic buybacks.
    pub interval_ledgers: u32,
    /// Reserve milestone (XLM above min_reserve) that auto-triggers a buyback.
    pub revenue_threshold: i128,
}

/// Immutable record of a single buyback execution.
#[contracttype]
#[derive(Clone)]
pub struct BuybackRecord {
    pub ledger: u32,
    pub timestamp: u64,
    pub xlm_spent: i128,
    pub bst_bought: i128,
    pub trigger: Symbol, // 'manual' | 'auto'
}

// =============================================================================
// Events
// =============================================================================

const EVT_BUYBACK: Symbol = symbol_short!("buyback");
const EVT_CONFIG: Symbol = symbol_short!("cfg");
const EVT_RESERVE: Symbol = symbol_short!("reserve");

// =============================================================================
// Contract
// =============================================================================

#[contract]
pub struct BuybackContract;

#[contractimpl]
impl BuybackContract {
    // ── Init ──────────────────────────────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);

        let config = BuybackConfig {
            enabled: false,
            min_reserve: 10_000_0000000,
            max_spend_per_buyback: 1_000_0000000,
            interval_ledgers: 17_280,
            revenue_threshold: 5_000_0000000,
        };
        env.storage().persistent().set(&DataKey::Config, &config);
        env.storage().persistent().set(&DataKey::TotalBought, &0_i128);
        env.storage().persistent().set(&DataKey::TotalSpent, &0_i128);
        env.storage().persistent().set(&DataKey::Count, &0_u32);
        env.storage().persistent().set(&DataKey::LastLedger, &0_u32);
        env.storage().persistent().set(&DataKey::Reserve, &0_i128);
    }

    // ── Admin helper ──────────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let stored: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(*caller == stored, "Unauthorized");
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    pub fn set_config(env: Env, admin: Address, config: BuybackConfig) {
        Self::require_admin(&env, &admin);
        assert!(config.min_reserve >= 0, "min_reserve must be non-negative");
        assert!(config.max_spend_per_buyback > 0, "max_spend must be positive");
        assert!(config.revenue_threshold > 0, "threshold must be positive");
        env.storage().persistent().set(&DataKey::Config, &config);
        env.events().publish((EVT_CONFIG, symbol_short!("set")), ());
    }

    pub fn get_config(env: Env) -> BuybackConfig {
        env.storage().persistent().get(&DataKey::Config).unwrap()
    }

    // ── Reserve management ────────────────────────────────────────────────────

    /// Deposit XLM into the buyback reserve (called by platform revenue logic).
    pub fn deposit_reserve(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "Amount must be positive");
        let reserve: i128 = env.storage().persistent().get(&DataKey::Reserve).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Reserve, &(reserve + amount));
        env.events()
            .publish((EVT_RESERVE, symbol_short!("deposit")), (from, amount));
    }

    pub fn get_reserve(env: Env) -> i128 {
        env.storage().persistent().get(&DataKey::Reserve).unwrap_or(0)
    }

    // ── Buyback execution ─────────────────────────────────────────────────────

    /// Manual buyback triggered by admin.
    pub fn execute_buyback(env: Env, admin: Address, xlm_amount: i128) -> BuybackRecord {
        Self::require_admin(&env, &admin);
        Self::run_buyback(&env, xlm_amount, symbol_short!("manual"))
    }

    /// Automatic buyback: checks threshold and interval, executes if conditions met.
    pub fn auto_buyback(env: Env) -> Option<BuybackRecord> {
        let config: BuybackConfig = env.storage().persistent().get(&DataKey::Config).unwrap();
        if !config.enabled {
            return None;
        }

        let reserve: i128 = env.storage().persistent().get(&DataKey::Reserve).unwrap_or(0);
        if reserve < config.revenue_threshold + config.min_reserve {
            return None;
        }

        let last_ledger: u32 = env.storage().persistent().get(&DataKey::LastLedger).unwrap_or(0);
        if env.ledger().sequence() - last_ledger < config.interval_ledgers {
            return None;
        }

        let spend = config
            .max_spend_per_buyback
            .min(reserve - config.min_reserve);
        Some(Self::run_buyback(&env, spend, symbol_short!("auto")))
    }

    fn run_buyback(env: &Env, xlm_amount: i128, trigger: Symbol) -> BuybackRecord {
        assert!(xlm_amount > 0, "Amount must be positive");

        let config: BuybackConfig = env.storage().persistent().get(&DataKey::Config).unwrap();
        let reserve: i128 = env.storage().persistent().get(&DataKey::Reserve).unwrap_or(0);

        assert!(
            reserve - xlm_amount >= config.min_reserve,
            "Would breach min_reserve"
        );
        assert!(
            xlm_amount <= config.max_spend_per_buyback,
            "Exceeds max_spend_per_buyback"
        );

        // Simulate DEX swap: 1 XLM = 50 BST (placeholder; real impl calls DEX contract)
        let bst_bought = xlm_amount * 50;

        // Deduct from reserve
        env.storage()
            .persistent()
            .set(&DataKey::Reserve, &(reserve - xlm_amount));

        // Accumulate totals
        let total_bought: i128 = env.storage().persistent().get(&DataKey::TotalBought).unwrap_or(0);
        let total_spent: i128 = env.storage().persistent().get(&DataKey::TotalSpent).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::TotalBought, &(total_bought + bst_bought));
        env.storage()
            .persistent()
            .set(&DataKey::TotalSpent, &(total_spent + xlm_amount));

        // Persist record
        let count: u32 = env.storage().persistent().get(&DataKey::Count).unwrap_or(0);
        let record = BuybackRecord {
            ledger: env.ledger().sequence(),
            timestamp: env.ledger().timestamp(),
            xlm_spent: xlm_amount,
            bst_bought,
            trigger: trigger.clone(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Record(count), &record);
        env.storage()
            .persistent()
            .set(&DataKey::Count, &(count + 1));
        env.storage()
            .persistent()
            .set(&DataKey::LastLedger, &env.ledger().sequence());

        env.events().publish(
            (EVT_BUYBACK, symbol_short!("exec")),
            (xlm_amount, bst_bought, trigger),
        );

        record
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /// Returns (count, total_bst_bought, total_xlm_spent).
    pub fn get_stats(env: Env) -> (u32, i128, i128) {
        let count: u32 = env.storage().persistent().get(&DataKey::Count).unwrap_or(0);
        let total_bought: i128 = env.storage().persistent().get(&DataKey::TotalBought).unwrap_or(0);
        let total_spent: i128 = env.storage().persistent().get(&DataKey::TotalSpent).unwrap_or(0);
        (count, total_bought, total_spent)
    }

    pub fn get_history(env: Env, offset: u32, limit: u32) -> Vec<BuybackRecord> {
        let count: u32 = env.storage().persistent().get(&DataKey::Count).unwrap_or(0);
        let mut out = Vec::new(&env);
        let end = (offset + limit).min(count);
        for i in offset..end {
            if let Some(r) = env.storage().persistent().get(&DataKey::Record(i)) {
                out.push_back(r);
            }
        }
        out
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, BuybackContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, BuybackContract);
        let client = BuybackContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, client, admin)
    }

    fn small_config(enabled: bool) -> BuybackConfig {
        BuybackConfig {
            enabled,
            min_reserve: 100,
            max_spend_per_buyback: 500,
            interval_ledgers: 10,
            revenue_threshold: 200,
        }
    }

    #[test]
    fn test_initialize() {
        let (_, client, _) = setup();
        assert!(!client.get_config().enabled);
        assert_eq!(client.get_reserve(), 0);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_init_panics() {
        let (_, client, admin) = setup();
        client.initialize(&admin);
    }

    #[test]
    fn test_set_config() {
        let (_, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let cfg = client.get_config();
        assert!(cfg.enabled);
        assert_eq!(cfg.min_reserve, 100);
    }

    #[test]
    fn test_deposit_reserve() {
        let (env, client, _) = setup();
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &1000_i128);
        assert_eq!(client.get_reserve(), 1000);
    }

    #[test]
    fn test_manual_buyback() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &1000_i128);

        let record = client.execute_buyback(&admin, &300_i128);
        assert_eq!(record.xlm_spent, 300);
        assert_eq!(record.bst_bought, 300 * 50);
        assert_eq!(client.get_reserve(), 700);
    }

    #[test]
    #[should_panic(expected = "Would breach min_reserve")]
    fn test_buyback_respects_min_reserve() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &150_i128); // only 50 above min
        client.execute_buyback(&admin, &200_i128);
    }

    #[test]
    #[should_panic(expected = "Exceeds max_spend_per_buyback")]
    fn test_buyback_respects_max_spend() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &2000_i128);
        client.execute_buyback(&admin, &600_i128); // max is 500
    }

    #[test]
    fn test_auto_buyback_executes() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        // reserve >= revenue_threshold(200) + min_reserve(100) = 300
        client.deposit_reserve(&depositor, &500_i128);

        let result = client.auto_buyback();
        assert!(result.is_some());
        let record = result.unwrap();
        // spend = min(max=500, reserve-min=500-100=400) = 400
        assert_eq!(record.xlm_spent, 400);
        assert_eq!(record.bst_bought, 400 * 50);
    }

    #[test]
    fn test_auto_buyback_skips_when_disabled() {
        let (env, client, _) = setup();
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &5000_i128);
        assert!(client.auto_buyback().is_none());
    }

    #[test]
    fn test_auto_buyback_skips_insufficient_reserve() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &250_i128); // < 300 required
        assert!(client.auto_buyback().is_none());
    }

    #[test]
    fn test_stats_and_history() {
        let (env, client, admin) = setup();
        client.set_config(&admin, &small_config(true));
        let depositor = Address::generate(&env);
        client.deposit_reserve(&depositor, &2000_i128);

        client.execute_buyback(&admin, &100_i128);
        client.execute_buyback(&admin, &200_i128);

        let (count, total_bought, total_spent) = client.get_stats();
        assert_eq!(count, 2);
        assert_eq!(total_spent, 300);
        assert_eq!(total_bought, 300 * 50);

        let history = client.get_history(&0, &10);
        assert_eq!(history.len(), 2);
    }
}
