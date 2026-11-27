use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::models::{AuthResponse, User};
use crate::error::AppError;
use crate::mail;

#[derive(Debug, Serialize, Deserialize)]
struct VerificationClaims {
    sub: String,
    email: String,
    exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct ResendVerificationRequest {
    pub email: String,
}

fn verification_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret".to_string())
}

fn create_verification_token(user_id: Uuid, email: &str) -> Result<String, AppError> {
    let exp = (Utc::now() + Duration::hours(24)).timestamp();
    let claims = VerificationClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(verification_secret().as_bytes()),
    )
    .map_err(|_| AppError::Internal)
}

async fn send_verification_email(email: &str, token: &str) -> Result<(), AppError> {
    let link = format!("/auth/verify-email?token={}", token);
    mail::send_verification_email(email, &link)
        .await
        .map_err(|_| AppError::Internal)
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    let password_hash = crate::auth::password::hash(&payload.password)?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, false) RETURNING *",
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|_| AppError::Conflict)?;

    let token = create_verification_token(user.id, &user.email)?;
    send_verification_email(&user.email, &token).await?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            user,
            verification_email_sent: true,
        }),
    ))
}

pub async fn verify_email(
    State(pool): State<PgPool>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<impl IntoResponse, AppError> {
    let token_data = decode::<VerificationClaims>(
        &payload.token,
        &DecodingKey::from_secret(verification_secret().as_bytes()),
        &Validation::default(),
    );

    let claims = match token_data {
        Ok(data) => data.claims,
        Err(err) => {
            return match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    Err(AppError::Gone)
                }
                _ => Err(AppError::Unauthorized),
            };
        }
    };

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    sqlx::query("UPDATE users SET email_verified = true WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "email_verified": true }))))
}

pub async fn resend_verification(
    State(pool): State<PgPool>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&pool)
        .await
        .map_err(|_| AppError::Internal)?;

    if let Some(user) = user {
        if !user.email_verified {
            let token = create_verification_token(user.id, &user.email)?;
            send_verification_email(&user.email, &token).await?;
        }
    }

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "verification_email_sent": true })),
    ))
}
