use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

const ACCESS_TOKEN_TTL_MINUTES: i64 = 15;
const REFRESH_TOKEN_TTL_DAYS: i64 = 30;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub token_type: String,
    pub family_id: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Debug, FromRow)]
struct RefreshTokenRow {
    id: Uuid,
    user_id: Uuid,
    family_id: Uuid,
    revoked: bool,
    expires_at: chrono::DateTime<Utc>,
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn issue_access_token(
    user_id: Uuid,
    family_id: Uuid,
    secret: &[u8],
) -> Result<String, AuthError> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        iat: now.timestamp() as usize,
        exp: (now + Duration::minutes(ACCESS_TOKEN_TTL_MINUTES)).timestamp() as usize,
        token_type: "access".to_string(),
        family_id: family_id.to_string(),
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret))
        .map_err(|_| AuthError::Internal)
}

async fn issue_refresh_token(
    state: &AppState,
    user_id: Uuid,
    family_id: Uuid,
) -> Result<String, AuthError> {
    let raw = format!("{}{}", Uuid::new_v4(), Uuid::new_v4());
    let token_hash = hash_token(&raw);
    let expires_at = Utc::now() + Duration::days(REFRESH_TOKEN_TTL_DAYS);

    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, revoked) \
         VALUES ($1, $2, $3, $4, $5, false)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(family_id)
    .bind(token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await
    .map_err(|_| AuthError::Internal)?;

    Ok(raw)
}

pub async fn refresh(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<TokenPair>, AuthError> {
    let token_hash = hash_token(&payload.refresh_token);

    let row: Option<RefreshTokenRow> = sqlx::query_as(
        "SELECT id, user_id, family_id, revoked, expires_at FROM refresh_tokens WHERE token_hash = $1",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AuthError::Internal)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AuthError::InvalidToken),
    };

    if row.revoked {
        // Reuse of a revoked token: invalidate the entire token family.
        tracing::warn!(
            security_event = "refresh_token_reuse",
            user_id = %row.user_id,
            family_id = %row.family_id,
            "Revoked refresh token reused; revoking token family"
        );
        sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE family_id = $1")
            .bind(row.family_id)
            .execute(&state.db)
            .await
            .map_err(|_| AuthError::Internal)?;
        return Err(AuthError::InvalidToken);
    }

    if row.expires_at < Utc::now() {
        return Err(AuthError::InvalidToken);
    }

    // Rotate: revoke the presented token before issuing a new pair.
    sqlx::query("UPDATE refresh_tokens SET revoked = true WHERE id = $1")
        .bind(row.id)
        .execute(&state.db)
        .await
        .map_err(|_| AuthError::Internal)?;

    let access_token = issue_access_token(row.user_id, row.family_id, &state.jwt_secret)?;
    let refresh_token = issue_refresh_token(&state, row.user_id, row.family_id).await?;

    Ok(Json(TokenPair {
        access_token,
        refresh_token,
    }))
}

pub enum AuthError {
    InvalidToken,
    Internal,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        match self {
            AuthError::InvalidToken => {
                (StatusCode::UNAUTHORIZED, "invalid refresh token").into_response()
            }
            AuthError::Internal => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_token_is_deterministic_and_distinct() {
        let a = hash_token("token-a");
        let b = hash_token("token-a");
        let c = hash_token("token-b");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn access_token_roundtrip() {
        let secret = b"test-secret";
        let user_id = Uuid::new_v4();
        let family_id = Uuid::new_v4();
        let token = issue_access_token(user_id, family_id, secret).unwrap();
        let data = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(secret),
            &Validation::default(),
        )
        .unwrap();
        assert_eq!(data.claims.sub, user_id.to_string());
        assert_eq!(data.claims.family_id, family_id.to_string());
        assert_eq!(data.claims.token_type, "access");
    }
}
