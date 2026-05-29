#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{TokenContract, TokenContractClient};

const MAX_SUPPLY: i128 = 10_000_000_000_000_000;

fn setup() -> (Env, Address, TokenContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, admin, client)
}

proptest! {
    // ── mint ─────────────────────────────────────────────────────────────────

    #[test]
    fn fuzz_mint_increases_balance_and_supply(amount in 1i128..=MAX_SUPPLY) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &amount);

        prop_assert_eq!(client.balance(&user), amount);
        prop_assert_eq!(client.total_supply(), amount);
    }

    #[test]
    fn fuzz_mint_zero_panics(amount in i128::MIN..=0i128) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.mint(&admin, &user, &amount);
        }));
        prop_assert!(result.is_err(), "mint of non-positive amount should panic");
    }

    #[test]
    fn fuzz_sequential_mints_accumulate(
        a in 1i128..=1_000_000i128,
        b in 1i128..=1_000_000i128,
    ) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &a);
        client.mint(&admin, &user, &b);

        prop_assert_eq!(client.balance(&user), a + b);
        prop_assert_eq!(client.total_supply(), a + b);
    }

    // ── burn ─────────────────────────────────────────────────────────────────

    #[test]
    fn fuzz_burn_reduces_balance_and_supply(
        mint_amount in 1i128..=MAX_SUPPLY,
        burn_amount in 1i128..=MAX_SUPPLY,
    ) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &mint_amount);

        if burn_amount <= mint_amount {
            client.burn(&user, &burn_amount);
            prop_assert_eq!(client.balance(&user), mint_amount - burn_amount);
            prop_assert_eq!(client.total_supply(), mint_amount - burn_amount);
        }
    }

    #[test]
    fn fuzz_burn_exceeding_balance_panics(
        mint_amount in 1i128..=1_000_000i128,
        extra in 1i128..=1_000_000i128,
    ) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &mint_amount);
        let burn_amount = mint_amount + extra;

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.burn(&user, &burn_amount);
        }));
        prop_assert!(result.is_err(), "burn exceeding balance should panic");
    }

    #[test]
    fn fuzz_burn_zero_panics(amount in i128::MIN..=0i128) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&admin, &user, &1);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.burn(&user, &amount);
        }));
        prop_assert!(result.is_err(), "burn of non-positive amount should panic");
    }

    // ── mint + burn invariant ─────────────────────────────────────────────────

    #[test]
    fn fuzz_mint_then_full_burn_zeroes_supply(amount in 1i128..=MAX_SUPPLY) {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &amount);
        client.burn(&user, &amount);

        prop_assert_eq!(client.balance(&user), 0);
        prop_assert_eq!(client.total_supply(), 0);
    }

    // ── transfer ─────────────────────────────────────────────────────────────

    #[test]
    fn fuzz_transfer_conserves_total_supply(
        mint_amount in 1i128..=1_000_000i128,
        transfer_amount in 1i128..=1_000_000i128,
    ) {
        let (env, admin, client) = setup();
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&admin, &from, &mint_amount);
        let supply_before = client.total_supply();

        if transfer_amount <= mint_amount {
            client.transfer(&from, &to, &transfer_amount);
            prop_assert_eq!(client.total_supply(), supply_before);
            prop_assert!(client.balance(&from) >= 0);
            prop_assert!(client.balance(&to) >= 0);
        }
    }
}
