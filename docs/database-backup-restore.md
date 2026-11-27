# Database Backup & Restore Procedure

Automated daily backups protect the production PostgreSQL database against
failed deployments and accidental migration rollbacks.

## What is backed up

- **Frequency:** daily at 02:00 UTC (`.github/workflows/db-backup.yml`).
- **Format:** `pg_dump` plain SQL, encrypted with GPG before upload.
- **Storage:** S3 bucket configured via the `BACKUP_S3_BUCKET` secret.
- **Retention:** 30 days, enforced by an S3 lifecycle rule.
- **Freshness check:** hourly workflow (`.github/workflows/db-backup-healthcheck.yml`)
  alerts if the newest backup is older than 25 hours.

## Required secrets

| Secret                | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string             |
| `GPG_PRIVATE_KEY`     | Private key used to import for encryption|
| `GPG_RECIPIENT`       | Recipient key id/email for encryption    |
| `BACKUP_S3_BUCKET`    | Destination bucket, e.g. `s3://acme/db-backups` |
| `AWS_ACCESS_KEY_ID`   | AWS credentials with S3 write access     |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                         |
| `AWS_REGION`          | AWS region                               |

## Restore procedure

> Run these steps against a **staging** database first. Always confirm the
> target before restoring into production.

1. **Locate the latest encrypted dump.**

   ```bash
   aws s3 ls "${BACKUP_S3_BUCKET}/" --recursive | sort | tail -n 1
   ```

2. **Download the dump.**

   ```bash
   aws s3 cp "${BACKUP_S3_BUCKET}/scoopdope-<timestamp>.sql.gpg" ./restore.sql.gpg
   ```

3. **Decrypt it with the private key.**

   ```bash
   gpg --batch --yes --decrypt ./restore.sql.gpg > ./restore.sql
   ```

4. **Restore into the target database.**

   ```bash
   psql "${DATABASE_URL}" --set ON_ERROR_STOP=on -f ./restore.sql
   ```

5. **Verify.** Confirm row counts and run the application health check
   (`./scripts/health-check.sh`) against the restored environment.

6. **Clean up** the local plaintext files (`restore.sql`, `restore.sql.gpg`)
   once the restore is verified.

## Manual restore test

The restore procedure must be exercised manually on a schedule (at minimum
quarterly) against a staging database to satisfy the acceptance criteria.
Record the result (date, dump used, duration, outcome) in the operations log.