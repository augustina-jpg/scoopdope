#!/usr/bin/env bash
#
# Verifies the most recent database backup is no older than 25 hours.
# Exits non-zero (and alerts) when the latest backup is missing or stale.
#
# Required environment variables:
#   S3_BUCKET           Bucket containing the encrypted backups
#
# Optional:
#   MAX_AGE_HOURS       Freshness threshold in hours (default: 25)
#
set -euo pipefail

MAX_AGE_HOURS="${MAX_AGE_HOURS:-25}"
: "${S3_BUCKET:?S3_BUCKET is required}"

echo "[health-check] Looking for latest backup in ${S3_BUCKET}"

LATEST_ISO="$(aws s3 ls "${S3_BUCKET}/" --recursive \
    | sort -k1,2 \
    | tail -n 1 \
    | awk '{print $1" "$2}')"

if [[ -z "${LATEST_ISO}" ]]; then
    echo "[health-check] ALERT: no backups found in ${S3_BUCKET}" >&2
    exit 1
fi

LATEST_EPOCH="$(date -u -d "${LATEST_ISO}" +%s)"
NOW_EPOCH="$(date -u +%s)"
AGE_HOURS=$(( (NOW_EPOCH - LATEST_EPOCH) / 3600 ))

echo "[health-check] Latest backup age: ${AGE_HOURS}h (threshold: ${MAX_AGE_HOURS}h)"

if (( AGE_HOURS > MAX_AGE_HOURS )); then
    echo "[health-check] ALERT: latest backup is ${AGE_HOURS}h old, exceeds ${MAX_AGE_HOURS}h threshold" >&2
    exit 1
fi

echo "[health-check] OK: backup is fresh"