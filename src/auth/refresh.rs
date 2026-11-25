use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// Access token lifetime.
const ACCESS_TOKEN_TTL_SECS: i64 = 15 * 60;
/// Refresh token lifetime.
const REFRESH_TOKEN_TTL_SECS: i64 = 30 * 24 * 60 * 60;

#[derive(Debug, Clone, FromRow)]
pub struct RefreshTokenRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub family_id: Uuid,
    pub expires_at: chrono::DateTime<Utc>,
    pub revoked: bool,
}

#[derive(Debug, Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

#[derive(Debug)]
pub enum RefreshError {
    /// Token is unknown, expired, or otherwise invalid.
    Invalid,
    /// Token was already revoked and is being replayed.
    Reuse,
    /// Underlying storage failure.
    Internal(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub event: String,
    pub user_id: Uuid,
    pub family_id: Uuid,
    pub token_id: Uuid,
}

/// Hash a raw refresh token so only the digest is persisted.
pub fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_raw_token() -> String {
    // Two UUIDv4 values give 256 bits of entropy.
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

/// Issue a brand new refresh token family (used on login).
pub async fn issue_new_family(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<TokenPair, RefreshError> {
    let family_id = Uuid::new_v4();
    let raw = generate_raw_token();
    let token_hash = hash_token(&raw);
    let expires_at = Utc::now() + Duration::seconds(REFRESH_TOKEN_TTL_SECS);

    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, revoked) \
         VALUES ($1, $2, $3, $4, $5, false)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(family_id)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| RefreshError::Internal(e.to_string()))?;

    Ok(TokenPair {
        access_token: issue_access_token(user_id),
        refresh_token: raw,
        expires_in: ACCESS_TOKEN_TTL_SECS,
    })
}

/// Rotate a refresh token: validate, revoke the old one, and issue a new pair.
/// Reuse of an already-revoked token revokes the whole family and returns `Reuse`.
pub async fn rotate(
    pool: &PgPool,
    raw_refresh_token: &str,
) -> Result<TokenPair, RefreshError> {
    let token_hash = hash_token(raw_refresh_token);

    let existing: Option<RefreshTokenRow> = sqlx::query_as(
        "SELECT id, user_id, token_hash, family_id, expires_at, revoked \
         FROM refresh_tokens WHERE token_hash = $1",
    )
    .bind(&token_hash)
    .fetch_optional(pool)
    .await
    .map_err(|e| RefreshError::Internal(e.to_string()))?;

    let existing = match existing {
        Some(row) => row,
        None => return Err(RefreshError::Invalid),
    };

    if existing.revoked {
        // Replay of a revoked token: nuke the entire family.
        revoke_family(pool, existing.family_id).await?;
        log_security_event(&SecurityEvent {
            event: "refresh_token_reuse".to_string(),
            user_id: existing.user_id,
            family_id: existing.family_id,
            token_id: existing.id,
        });
        return Err(RefreshError::Reuse);
    }

    if existing.expires_at <= Utc::now() {
        return Err(RefreshError::Invalid);
    }

    // Atomically revoke the old token; if it was already revoked concurrently,
    // treat it as reuse.
    let revoked = sqlx::query(
        "UPDATE refresh_tokens SET revoked = true \
         WHERE id = $1 AND revoked = false",
    )
    .bind(existing.id)
    .execute(pool)
    .await
    .map_err(|e| RefreshError::Internal(e.to_string()))?;

    if revoked.rows_affected() == 0 {
        revoke_family(pool, existing.family_id).await?;
        log_security_event(&SecurityEvent {
            event: "refresh_token_reuse".to_string(),
            user_id: existing.user_id,
            family_id: existing.family_id,
            token_id: existing.id,
        });
        return Err(RefreshError::Reuse);
    }

    let raw = generate_raw_token();
    let new_hash = hash_token(&raw);
    let expires_at = Utc::now() + Duration::seconds(REFRESH_TOKEN_TTL_SECS);

    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, revoked) \
         VALUES ($1, $2, $3, $4, $5, false)",
    )
    .bind(Uuid::new_v4())
    .bind(existing.user_id)
    .bind(&new_hash)
    .bind(existing.family_id)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| RefreshError::Internal(e.to_string()))?;

    Ok(TokenPair {
        access_token: issue_access_token(existing.user_id),
        refresh_token: raw,
        expires_in: ACCESS_TOKEN_TTL_SECS,
    })
}

async fn revoke_family(pool: &PgPool, family_id: Uuid) -> Result<(), RefreshError> {
    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE family_id = $1")
        .bind(family_id)
        .execute(pool)
        .await
        .map_err(|e| RefreshError::Internal(e.to_string()))?;
    Ok(())
}

fn log_security_event(event: &SecurityEvent) {
    // Structured security log; consumed by the audit pipeline.
    tracing::warn!(
        event = %event.event,
        user_id = %event.user_id,
        family_id = %event.family_id,
        token_id = %event.token_id,
        "security event"
    );
}

fn issue_access_token(user_id: Uuid) -> String {
    // Delegates to the existing JWT signer used elsewhere in the auth module.
    crate::auth::jwt::sign_access_token(user_id, ACCESS_TOKEN_TTL_SECS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_and_hides_raw() {
        let raw = "some-refresh-token";
        let h1 = hash_token(raw);
        let h2 = hash_token(raw);
        assert_eq!(h1, h2);
        assert_ne!(h1, raw);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn generated_tokens_are_unique() {
        assert_ne!(generate_raw_token(), generate_raw_token());
    }

    #[test]
    fn reuse_error_is_distinct_from_invalid() {
        assert!(matches!(RefreshError::Reuse, RefreshError::Reuse));
        assert!(!matches!(RefreshError::Invalid, RefreshError::Reuse));
    }
}
