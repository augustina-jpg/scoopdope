#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, symbol_short, Address, Env};

fn setup_pool() -> (Env, LiquidityPoolContractClient<'static>, Address) {
    let env         = Env::default();
    env.mock_all_auths();
    let id          = env.register(LiquidityPoolContract, ());
    let client      = LiquidityPoolContractClient::new(&env, &id);
    let admin       = Address::generate(&env);
    let bst_token   = Address::generate(&env);
    let fee_coll    = Address::generate(&env);
    client.initialize(&admin, &bst_token, &fee_coll);
    (env, client, admin)
}

#[test]
fn add_liquidity_initial_deposit_returns_nonzero_shares() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    let shares = client.add_liquidity(&provider, &1_000_000, &1_000_000, &0, &0);
    assert!(shares > 0);
    let stats = client.get_pool_stats();
    assert_eq!(stats.reserve_a, 1_000_000);
    assert_eq!(stats.reserve_b, 1_000_000);
}

#[test]
fn remove_liquidity_returns_tokens_proportionally() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    let shares = client.add_liquidity(&provider, &2_000_000, &2_000_000, &0, &0);
    let (out_a, out_b) = client.remove_liquidity(&provider, &(shares / 2));
    assert!(out_a > 0 && out_b > 0);
    assert!(out_a <= 2_000_000 && out_b <= 2_000_000);
}

#[test]
fn swap_bst_to_xlm_with_slippage_protection() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    let trader   = Address::generate(&client.env);
    client.add_liquidity(&provider, &10_000_000, &10_000_000, &0, &0);
    let out = client.swap(&trader, &symbol_short!("bst"), &100_000, &1);
    assert!(out > 0 && out < 100_000);
}

#[test]
#[should_panic]
fn swap_fails_slippage_check_when_min_out_too_high() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    let trader   = Address::generate(&client.env);
    client.add_liquidity(&provider, &1_000_000, &1_000_000, &0, &0);
    client.swap(&trader, &symbol_short!("bst"), &10_000, &999_999);
}

#[test]
fn get_pool_stats_reflects_current_state() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    client.add_liquidity(&provider, &5_000_000, &3_000_000, &0, &0);
    let stats = client.get_pool_stats();
    assert_eq!(stats.reserve_a, 5_000_000);
    assert_eq!(stats.reserve_b, 3_000_000);
}

#[test]
fn get_user_liquidity_tracks_provider_balance() {
    let (_, client, _) = setup_pool();
    let provider = Address::generate(&client.env);
    let shares = client.add_liquidity(&provider, &1_000_000, &1_000_000, &0, &0);
    assert_eq!(client.get_user_liquidity(&provider), shares);
}
