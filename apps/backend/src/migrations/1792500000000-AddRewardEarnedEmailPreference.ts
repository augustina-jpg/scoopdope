import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRewardEarnedEmailPreference1792500000000 implements MigrationInterface {
  name = 'AddRewardEarnedEmailPreference1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_preferences"
        ADD COLUMN IF NOT EXISTS "rewardEarned" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_preferences"
        DROP COLUMN IF EXISTS "rewardEarned";
    `);
  }
}
