import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRewardEventsTable1792500000001 implements MigrationInterface {
  name = 'CreateRewardEventsTable1792500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reward_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "referenceId" varchar NOT NULL,
        "amount" integer NOT NULL,
        "reason" varchar NOT NULL,
        "txHash" varchar,
        "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reward_events" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reward_events_user_recordedAt"
        ON "reward_events" ("userId", "recordedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reward_events_user_recordedAt";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reward_events";`);
  }
}
