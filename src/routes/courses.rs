use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

const DEFAULT_PAGE: i64 = 1;
const DEFAULT_LIMIT: i64 = 20;
const MAX_LIMIT: i64 = 100;

#[derive(Debug, Deserialize)]
pub struct ListCoursesQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
}

#[derive(Debug, Serialize)]
pub struct ListCoursesResponse {
    pub data: Vec<Course>,
    pub meta: PaginationMeta,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Course {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub fn router() -> Router<PgPool> {
    Router::new().route("/v1/courses", get(list_courses))
}

pub async fn list_courses(
    State(pool): State<PgPool>,
    Query(params): Query<ListCoursesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let page = params.page.unwrap_or(DEFAULT_PAGE).max(1);
    let limit = params
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, MAX_LIMIT);
    let offset = (page - 1) * limit;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM courses")
        .fetch_one(&pool)
        .await
        .map_err(internal_error)?;

    let courses: Vec<Course> = sqlx::query_as(
        "SELECT id, title, description, created_at \
         FROM courses \
         ORDER BY created_at DESC \
         LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(internal_error)?;

    let total_pages = if total == 0 {
        0
    } else {
        (total + limit - 1) / limit
    };

    Ok(Json(ListCoursesResponse {
        data: courses,
        meta: PaginationMeta {
            total,
            page,
            limit,
            total_pages,
        },
    }))
}

fn internal_error(err: sqlx::Error) -> (StatusCode, String) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("database error: {err}"),
    )
}
