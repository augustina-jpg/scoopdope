#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, String,
};

use crate::{GovernanceContract, GovernanceContractClient};
use scoopdope_token::{TokenContract, TokenContractClient};

fn default_ledger_info(sequence_number: u32) -> LedgerInfo {
    LedgerInfo {
        sequence_number,
        timestamp: sequence_number as u64 * 5,
        protocol_version: 21,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        max_entry_ttl: 100_000,
    }
}

/// Set up governance + token contracts. Returns (env, gov_client, token_client, admin).
fn setup() -> (
    Env,
    GovernanceContractClient<'static>,
    TokenContractClient<'static>,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_contract(None, TokenContract);
    let token_client = TokenContractClient::new(&env, &token_id);

    let gov_id = env.register_contract(None, GovernanceContract);
    let gov_client = GovernanceContractClient::new(&env, &gov_id);

    let admin = Address::generate(&env);
    token_client.initialize(&admin);
    gov_client.initialize(&admin, &token_id);

    (env, gov_client, token_client, admin)
}

proptest! {
    // ── create_proposal ───────────────────────────────────────────────────────

    #[test]
    fn fuzz_create_proposal_increments_id(count in 1u32..=20u32) {
        let (env, gov, _, _) = setup();
        let proposer = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 100;

        for expected_id in 1..=(count as u64) {
            let id = gov.create_proposal(&proposer, &title, &desc, &end);
            prop_assert_eq!(id, expected_id);
        }
    }

    #[test]
    fn fuzz_create_proposal_past_end_panics(offset in 0u32..=100u32) {
        let (env, gov, _, _) = setup();
        let proposer = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");

        // Advance ledger so current sequence > 0
        let current = 200u32;
        env.ledger().set(default_ledger_info(current));
        let end = current - offset; // end <= current → invalid

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.create_proposal(&proposer, &title, &desc, &end);
        }));
        prop_assert!(result.is_err(), "proposal with past end should panic");
    }

    // ── vote ──────────────────────────────────────────────────────────────────

    #[test]
    fn fuzz_vote_for_accumulates_votes_for(
        balance in 1i128..=1_000_000i128,
        voter_count in 1u32..=5u32,
    ) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 100;

        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);

        let mut expected_votes_for = 0i128;
        for _ in 0..voter_count {
            let voter = Address::generate(&env);
            token.mint(&admin, &voter, &balance);
            gov.vote(&voter, &proposal_id, &true);
            expected_votes_for += balance;
        }

        let proposal = gov.get_proposal(&proposal_id).unwrap();
        prop_assert_eq!(proposal.votes_for, expected_votes_for);
        prop_assert_eq!(proposal.votes_against, 0);
    }

    #[test]
    fn fuzz_vote_against_accumulates_votes_against(
        balance in 1i128..=1_000_000i128,
        voter_count in 1u32..=5u32,
    ) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 100;

        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);

        let mut expected_votes_against = 0i128;
        for _ in 0..voter_count {
            let voter = Address::generate(&env);
            token.mint(&admin, &voter, &balance);
            gov.vote(&voter, &proposal_id, &false);
            expected_votes_against += balance;
        }

        let proposal = gov.get_proposal(&proposal_id).unwrap();
        prop_assert_eq!(proposal.votes_against, expected_votes_against);
        prop_assert_eq!(proposal.votes_for, 0);
    }

    #[test]
    fn fuzz_double_vote_panics(balance in 1i128..=1_000_000i128) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 100;

        token.mint(&admin, &voter, &balance);
        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);
        gov.vote(&voter, &proposal_id, &true);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.vote(&voter, &proposal_id, &false);
        }));
        prop_assert!(result.is_err(), "double vote should panic");
    }

    #[test]
    fn fuzz_vote_without_balance_panics() {
        let (env, gov, _, _) = setup();
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env); // no tokens minted
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 100;

        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.vote(&voter, &proposal_id, &true);
        }));
        prop_assert!(result.is_err(), "vote with zero balance should panic");
    }

    #[test]
    fn fuzz_vote_after_end_panics(balance in 1i128..=1_000_000i128) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 10;

        token.mint(&admin, &voter, &balance);
        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);

        env.ledger().set(default_ledger_info(end + 1));

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.vote(&voter, &proposal_id, &true);
        }));
        prop_assert!(result.is_err(), "vote after voting end should panic");
    }

    // ── execute_proposal ──────────────────────────────────────────────────────

    #[test]
    fn fuzz_execute_passes_when_votes_for_wins(
        balance in 1i128..=1_000_000i128,
    ) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let voter_for = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 10;

        token.mint(&admin, &voter_for, &balance);
        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);
        gov.vote(&voter_for, &proposal_id, &true);

        env.ledger().set(default_ledger_info(end + 1));
        gov.execute_proposal(&proposal_id);

        let proposal = gov.get_proposal(&proposal_id).unwrap();
        prop_assert!(proposal.executed);
    }

    #[test]
    fn fuzz_execute_fails_when_votes_against_wins(
        balance in 1i128..=1_000_000i128,
    ) {
        let (env, gov, token, admin) = setup();
        let proposer = Address::generate(&env);
        let voter_against = Address::generate(&env);
        let title = String::from_str(&env, "T");
        let desc = String::from_str(&env, "D");
        let end = env.ledger().sequence() + 10;

        token.mint(&admin, &voter_against, &balance);
        let proposal_id = gov.create_proposal(&proposer, &title, &desc, &end);
        gov.vote(&voter_against, &proposal_id, &false);

        env.ledger().set(default_ledger_info(end + 1));

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute_proposal(&proposal_id);
        }));
        prop_assert!(result.is_err(), "execute should fail when against > for");
    }
}
