#!/usr/bin/env bash
#
# Daily PostgreSQL backup: pg_dump -> GPG encrypt -> upload to S3.
#
# Required environment variables:
#   DATABASE_URL        PostgreSQL connection string (postgres://user:pass@host:5432/db)
#   GPG_RECIPIENT       GPG key id / email used to encrypt the dump
#   S3_BUCKET           Destination bucket (e.g. s3://my-bucket/backups)
#
# Optional:
#   BACKUP_DIR          Local staging directory (default: /tmp/db-backups)
#   AWS_REGION          AWS region for the S3 upload
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/db-backups}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
PLAIN_FILE="${BACKUP_DIR}/scoopdope-${TIMESTAMP}.sql"
ENC_FILE="${PLAIN_FILE}.gpg"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GPG_RECIPIENT:?GPG_RECIPIENT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Dumping database -> ${PLAIN_FILE}"
pg_dump --dbname="${DATABASE_URL}" --format=plain --no-owner --no-privileges > "${PLAIN_FILE}"

echo "[backup] Encrypting dump with GPG for ${GPG_RECIPIENT}"
gpg --batch --yes --trust-model always --recipient "${GPG_RECIPIENT}" \
    --encrypt "${PLAIN_FILE}"

# Never leave the plaintext dump on disk.
rm -f "${PLAIN_FILE}"

echo "[backup] Uploading ${ENC_FILE} to ${S3_BUCKET}"
aws s3 cp "${ENC_FILE}" "${S3_BUCKET}/" \
    --only-show-errors

echo "[backup] Applying 30-day retention policy"
aws s3api put-bucket-lifecycle-configuration \
    --bucket "${S3_BUCKET#*://*/}" \
    --lifecycle-configuration '{
      "Rules": [{
        "ID": "expire-backups-30d",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "Expiration": {"Days": 30}
      }]
    }' >/dev/null 2>&1 || true

echo "[backup] Done: ${ENC_FILE}"