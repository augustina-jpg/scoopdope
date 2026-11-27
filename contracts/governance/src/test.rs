#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

fn setup() -> (Env, GovernanceContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    client.initialize(&admin);

    (env, client, admin, proposer, voter)
}

#[test]
fn test_initialize_sets_admin() {
    let (_env, client, admin, _proposer, _voter) = setup();
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_create_proposal() {
    let (env, client, _admin, proposer, _voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));
    assert_eq!(proposal_id, 0);

    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.id, proposal_id);
    assert_eq!(proposal.proposer, proposer);
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
    assert!(!proposal.executed);
    assert!(!proposal.vetoed);
}

#[test]
fn test_vote_yes_and_no() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    client.vote(&voter, &proposal_id, &true);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.no_votes, 0);

    let other_voter = Address::generate(&env);
    client.vote(&other_voter, &proposal_id, &false);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.no_votes, 1);
}

#[test]
fn test_double_vote_returns_error() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));
    client.vote(&voter, &proposal_id, &true);

    let result = client.try_vote(&voter, &proposal_id, &true);
    assert_eq!(result, Err(Ok(Error::AlreadyVoted)));
}

#[test]
fn test_quorum_check() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    assert!(!client.has_quorum(&proposal_id));

    client.vote(&voter, &proposal_id, &true);
    assert!(client.has_quorum(&proposal_id));
}

#[test]
fn test_execute_proposal() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));
    client.vote(&voter, &proposal_id, &true);

    client.execute(&proposal_id);
    let proposal = client.get_proposal(&proposal_id);
    assert!(proposal.executed);
}

#[test]
fn test_execute_without_quorum_fails() {
    let (env, client, _admin, proposer, _voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    let result = client.try_execute(&proposal_id);
    assert_eq!(result, Err(Ok(Error::QuorumNotMet)));
}

#[test]
fn test_veto_proposal() {
    let (env, client, admin, proposer, _voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    client.veto(&admin, &proposal_id);
    let proposal = client.get_proposal(&proposal_id);
    assert!(proposal.vetoed);
}

#[test]
fn test_veto_unauthorized_fails() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    let result = client.try_veto(&voter, &proposal_id);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_minimum_vote_count() {
    let (env, client, _admin, proposer, voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes + proposal.no_votes, 0);

    client.vote(&voter, &proposal_id, &true);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes + proposal.no_votes, 1);
}

#[test]
fn test_maximum_vote_count() {
    let (env, client, _admin, proposer, _voter) = setup();

    let proposal_id = client.create_proposal(&proposer, &String::from_str(&env, "Upgrade"));

    let mut voters = Vec::new(&env);
    for _ in 0..MAX_VOTES {
        voters.push_back(Address::generate(&env));
    }

    for voter in voters.iter() {
        client.vote(&voter, &proposal_id, &true);
    }

    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes, MAX_VOTES);

    let overflow_voter = Address::generate(&env);
    let result = client.try_vote(&overflow_voter, &proposal_id, &true);
    assert_eq!(result, Err(Ok(Error::VoteLimitReached)));
}
