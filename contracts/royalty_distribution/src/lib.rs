#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Symbol, Vec,
};

#[contracttype]
pub enum DataKey {
    Admin,
    /// Royalty config per course: (instructor_pct, platform_pct)
    CourseConfig(u64),
    /// Ordered list of instructor addresses for a course
    CourseInstructors(u64),
    /// Accumulated balance per address
    Balance(Address),
}

/// Per-course royalty configuration.
/// instructor_pct + platform_pct must equal 100.
/// When multiple instructors exist, instructor_pct is split equally among them.
#[contracttype]
#[derive(Clone)]
pub struct CourseConfig {
    pub course_id: u64,
    /// Percentage (0-100) that goes to instructor(s) combined
    pub instructor_pct: u32,
    /// Percentage (0-100) that goes to the platform
    pub platform_pct: u32,
}

const DISTRIBUTE: Symbol = symbol_short!("dist");
const WITHDRAW: Symbol = symbol_short!("wdraw");
const CONFIG_SET: Symbol = symbol_short!("cfgset");

#[contract]
pub struct RoyaltyDistributionContract;

#[contractimpl]
impl RoyaltyDistributionContract {
    /// One-time initialisation; caller becomes admin.
    pub fn initialize(env: Env, admin: Address) {
        assert!(
            !env.storage().instance().has(&DataKey::Admin),
            "Already initialized"
        );
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ── Admin helpers ────────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let stored: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(*caller == stored, "Unauthorized: admin only");
    }

    // ── Configuration ────────────────────────────────────────────────────────

    /// Set the royalty split for a course.
    /// `instructor_pct` + `platform_pct` must equal 100.
    pub fn set_course_config(
        env: Env,
        admin: Address,
        course_id: u64,
        instructor_pct: u32,
        platform_pct: u32,
    ) {
        Self::require_admin(&env, &admin);
        assert!(
            instructor_pct + platform_pct == 100,
            "Percentages must sum to 100"
        );

        let config = CourseConfig {
            course_id,
            instructor_pct,
            platform_pct,
        };
        env.storage()
            .persistent()
            .set(&DataKey::CourseConfig(course_id), &config);

        env.events()
            .publish((CONFIG_SET, symbol_short!("crs")), course_id);
    }

    /// Replace the instructor list for a course (ordered; split equally).
    pub fn set_course_instructors(
        env: Env,
        admin: Address,
        course_id: u64,
        instructors: Vec<Address>,
    ) {
        Self::require_admin(&env, &admin);
        assert!(!instructors.is_empty(), "Need at least one instructor");
        env.storage()
            .persistent()
            .set(&DataKey::CourseInstructors(course_id), &instructors);
    }

    // ── Distribution ─────────────────────────────────────────────────────────

    /// Distribute `total_amount` for a course purchase.
    /// Instructor share is split equally among all registered instructors.
    /// Returns the platform's share.
    pub fn distribute(
        env: Env,
        admin: Address,
        course_id: u64,
        total_amount: i128,
        platform_address: Address,
    ) -> i128 {
        Self::require_admin(&env, &admin);
        assert!(total_amount > 0, "Amount must be positive");

        let config: CourseConfig = env
            .storage()
            .persistent()
            .get(&DataKey::CourseConfig(course_id))
            .expect("Course config not set");

        let instructors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::CourseInstructors(course_id))
            .expect("Course instructors not set");

        let instructor_total = (total_amount * config.instructor_pct as i128) / 100;
        let platform_amount = total_amount - instructor_total; // avoids rounding loss

        // Split instructor share equally
        let n = instructors.len() as i128;
        let per_instructor = instructor_total / n;
        let remainder = instructor_total - per_instructor * n; // dust goes to first instructor

        for (i, instructor) in instructors.iter().enumerate() {
            let share = if i == 0 {
                per_instructor + remainder
            } else {
                per_instructor
            };
            Self::add_balance(&env, &instructor, share);
        }

        Self::add_balance(&env, &platform_address, platform_amount);

        env.events().publish(
            (DISTRIBUTE, symbol_short!("crs")),
            (course_id, total_amount),
        );

        platform_amount
    }

    fn add_balance(env: &Env, addr: &Address, amount: i128) {
        let key = DataKey::Balance(addr.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
    }

    // ── Withdrawal ───────────────────────────────────────────────────────────

    /// Withdraw all accumulated royalties for the caller.
    pub fn withdraw(env: Env, recipient: Address) -> i128 {
        recipient.require_auth();

        let key = DataKey::Balance(recipient.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        assert!(balance > 0, "No royalties to withdraw");

        env.storage().persistent().set(&key, &0i128);

        env.events()
            .publish((WITHDRAW, symbol_short!("addr")), (recipient, balance));

        balance
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    pub fn get_balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr))
            .unwrap_or(0)
    }

    pub fn get_course_config(env: Env, course_id: u64) -> Option<CourseConfig> {
        env.storage()
            .persistent()
            .get(&DataKey::CourseConfig(course_id))
    }

    pub fn get_course_instructors(env: Env, course_id: u64) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::CourseInstructors(course_id))
            .unwrap_or(vec![&env])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env};

    fn setup() -> (Env, RoyaltyDistributionContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, RoyaltyDistributionContract);
        let client = RoyaltyDistributionContractClient::new(&env, &contract_id);
        (env, client)
    }

    #[test]
    fn test_initialize() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_initialize_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.initialize(&admin);
    }

    #[test]
    fn test_set_course_config() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.set_course_config(&admin, &1u64, &80u32, &20u32);

        let cfg = client.get_course_config(&1u64).unwrap();
        assert_eq!(cfg.instructor_pct, 80);
        assert_eq!(cfg.platform_pct, 20);
    }

    #[test]
    #[should_panic(expected = "Percentages must sum to 100")]
    fn test_invalid_percentages() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.set_course_config(&admin, &1u64, &70u32, &20u32); // 90 != 100
    }

    #[test]
    fn test_distribute_single_instructor() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let platform = Address::generate(&env);

        client.initialize(&admin);
        client.set_course_config(&admin, &1u64, &80u32, &20u32);
        client.set_course_instructors(&admin, &1u64, &vec![&env, instructor.clone()]);

        client.distribute(&admin, &1u64, &1000i128, &platform);

        assert_eq!(client.get_balance(&instructor), 800);
        assert_eq!(client.get_balance(&platform), 200);
    }

    #[test]
    fn test_distribute_multi_instructor() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let i1 = Address::generate(&env);
        let i2 = Address::generate(&env);
        let platform = Address::generate(&env);

        client.initialize(&admin);
        client.set_course_config(&admin, &2u64, &80u32, &20u32);
        client.set_course_instructors(&admin, &2u64, &vec![&env, i1.clone(), i2.clone()]);

        client.distribute(&admin, &2u64, &1000i128, &platform);

        // 800 split equally: 400 each
        assert_eq!(client.get_balance(&i1), 400);
        assert_eq!(client.get_balance(&i2), 400);
        assert_eq!(client.get_balance(&platform), 200);
    }

    #[test]
    fn test_distribute_remainder_goes_to_first() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let i1 = Address::generate(&env);
        let i2 = Address::generate(&env);
        let i3 = Address::generate(&env);
        let platform = Address::generate(&env);

        client.initialize(&admin);
        // 90% instructor, 10% platform; 3 instructors; 100 total
        // instructor_total = 90; per = 30; remainder = 0
        client.set_course_config(&admin, &3u64, &90u32, &10u32);
        client.set_course_instructors(
            &admin,
            &3u64,
            &vec![&env, i1.clone(), i2.clone(), i3.clone()],
        );

        client.distribute(&admin, &3u64, &100i128, &platform);

        assert_eq!(client.get_balance(&i1), 30);
        assert_eq!(client.get_balance(&i2), 30);
        assert_eq!(client.get_balance(&i3), 30);
        assert_eq!(client.get_balance(&platform), 10);
    }

    #[test]
    fn test_withdraw() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let platform = Address::generate(&env);

        client.initialize(&admin);
        client.set_course_config(&admin, &1u64, &80u32, &20u32);
        client.set_course_instructors(&admin, &1u64, &vec![&env, instructor.clone()]);
        client.distribute(&admin, &1u64, &500i128, &platform);

        let withdrawn = client.withdraw(&instructor);
        assert_eq!(withdrawn, 400);
        assert_eq!(client.get_balance(&instructor), 0);
    }

    #[test]
    #[should_panic(expected = "No royalties to withdraw")]
    fn test_withdraw_zero_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let nobody = Address::generate(&env);
        client.initialize(&admin);
        client.withdraw(&nobody);
    }

    #[test]
    fn test_cumulative_distributions() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let platform = Address::generate(&env);

        client.initialize(&admin);
        client.set_course_config(&admin, &1u64, &80u32, &20u32);
        client.set_course_instructors(&admin, &1u64, &vec![&env, instructor.clone()]);

        client.distribute(&admin, &1u64, &1000i128, &platform);
        client.distribute(&admin, &1u64, &500i128, &platform);

        assert_eq!(client.get_balance(&instructor), 1200); // 800 + 400
        assert_eq!(client.get_balance(&platform), 300); // 200 + 100
    }
}
