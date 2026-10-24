import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationAppeals1792627200000 implements MigrationInterface {
  name = 'AddModerationAppeals1792627200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "moderation_items_contentType_enum" AS ENUM ('course', 'post', 'reply', 'review');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "moderation_items_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'appealed', 'hidden');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "moderation_logs_contentType_enum" AS ENUM ('course', 'post', 'reply', 'review');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "moderation_logs_action_enum" AS ENUM (
          'flag', 'approve', 'reject', 'auto_hide', 'appeal_submitted', 'appeal_approved', 'appeal_rejected'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "moderation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "contentType" "moderation_items_contentType_enum" NOT NULL,
        "contentId" character varying NOT NULL,
        "reportedByUserId" character varying NOT NULL,
        "contentOwnerUserId" uuid NULL,
        "status" "moderation_items_status_enum" NOT NULL DEFAULT 'pending',
        "flagReason" text NULL,
        "flagCount" integer NOT NULL DEFAULT 1,
        "isHidden" boolean NOT NULL DEFAULT false,
        "toxicityScore" double precision NULL,
        "comprehendResult" jsonb NULL,
        "reviewedByUserId" character varying NULL,
        "reviewNote" text NULL,
        "appealReason" text NULL,
        "appealedByUserId" character varying NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "moderation_items"
      ADD COLUMN IF NOT EXISTS "contentOwnerUserId" uuid NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "moderation_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "moderationItemId" character varying NOT NULL,
        "contentType" "moderation_logs_contentType_enum" NOT NULL,
        "contentId" character varying NOT NULL,
        "action" "moderation_logs_action_enum" NOT NULL,
        "performedByUserId" character varying NULL,
        "note" text NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.courses') IS NOT NULL THEN
          UPDATE "moderation_items" AS item
          SET "contentOwnerUserId" = course."instructorId"::uuid
          FROM "courses" AS course
          WHERE item."contentType" = 'course'
            AND item."contentId" = course."id"::text
            AND item."contentOwnerUserId" IS NULL
            AND course."instructorId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        END IF;
        IF to_regclass('public.posts') IS NOT NULL THEN
          UPDATE "moderation_items" AS item
          SET "contentOwnerUserId" = post."userId"::uuid
          FROM "posts" AS post
          WHERE item."contentType" = 'post'
            AND item."contentId" = post."id"::text
            AND item."contentOwnerUserId" IS NULL
            AND post."userId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        END IF;
        IF to_regclass('public.replies') IS NOT NULL THEN
          UPDATE "moderation_items" AS item
          SET "contentOwnerUserId" = reply."userId"::uuid
          FROM "replies" AS reply
          WHERE item."contentType" = 'reply'
            AND item."contentId" = reply."id"::text
            AND item."contentOwnerUserId" IS NULL
            AND reply."userId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        END IF;
        IF to_regclass('public.reviews') IS NOT NULL THEN
          UPDATE "moderation_items" AS item
          SET "contentOwnerUserId" = review."userId"::uuid
          FROM "reviews" AS review
          WHERE item."contentType" = 'review'
            AND item."contentId" = review."id"::text
            AND item."contentOwnerUserId" IS NULL
            AND review."userId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "moderation_appeals_status_enum" AS ENUM ('pending', 'accepted', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'moderation_appeal'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "moderation_appeals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "moderationItemId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" "moderation_appeals_status_enum" NOT NULL DEFAULT 'pending',
        "resolutionNote" text NULL,
        "resolvedByUserId" uuid NULL,
        "resolvedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moderation_appeals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_moderation_appeals_moderationItemId" UNIQUE ("moderationItemId"),
        CONSTRAINT "FK_moderation_appeals_item"
          FOREIGN KEY ("moderationItemId") REFERENCES "moderation_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_moderation_appeals_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_moderation_appeals_status_createdAt"
      ON "moderation_appeals" ("status", "createdAt")
    `);
    await queryRunner.query(`
      INSERT INTO "moderation_appeals" (
        "moderationItemId", "userId", "reason", "status", "resolvedByUserId", "resolvedAt"
      )
      SELECT
        item."id",
        CASE
          WHEN item."appealedByUserId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN item."appealedByUserId"::text::uuid
          ELSE NULL
        END,
        COALESCE(item."appealReason", 'Previously submitted appeal'),
        CASE item."status"::text
          WHEN 'appealed' THEN 'pending'::"moderation_appeals_status_enum"
          WHEN 'approved' THEN 'accepted'::"moderation_appeals_status_enum"
          ELSE 'rejected'::"moderation_appeals_status_enum"
        END,
        CASE
          WHEN item."status"::text <> 'appealed'
            AND item."reviewedByUserId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN item."reviewedByUserId"::text::uuid
          ELSE NULL
        END,
        CASE WHEN item."status"::text <> 'appealed' THEN item."updatedAt" ELSE NULL END
      FROM "moderation_items" AS item
      WHERE item."appealedByUserId" IS NOT NULL
        AND item."appealedByUserId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ON CONFLICT ("moderationItemId") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "moderation_appeals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "moderation_appeals_status_enum"`);
    await queryRunner.query(`
      ALTER TABLE "moderation_items" DROP COLUMN IF EXISTS "contentOwnerUserId"
    `);
    // PostgreSQL does not support removing enum values from notifications_type_enum.
  }
}