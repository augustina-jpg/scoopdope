import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true })
  stellarPublicKey: string;

  @Column({ default: 'student' })
  role: string;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  deletedAt: Date;

  @Column({ nullable: true, type: 'varchar' })
  verificationToken: string | null;

  @Column({ nullable: true, type: 'datetime' })
  verificationTokenExpiresAt: Date | null;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true })
  mfaSecret: string | null;

  @Column({ type: 'simple-array', nullable: true, default: null })
  mfaBackupCodes: string[] | null;

  @Column({ unique: true, nullable: true })
  referralCode: string;

  @Column({ nullable: true, type: 'varchar' })
  referredBy: string | null;

  @Column({ default: 0 })
  currentStreak: number;

  @Column({ default: 0 })
  longestStreak: number;

  @Column({ nullable: true, type: 'datetime' })
  lastActivityAt: Date | null;

  /** #872: Set to true when the account is auto-deactivated due to inactivity. */
  @Column({ default: false })
  isDeactivated: boolean;

  /** #872: Single-use token emailed to the user to reactivate their account. */
  @Column({ nullable: true, type: 'varchar' })
  deactivationToken: string | null;

  /** #872: Expiry for the reactivation token (48-hour window). */
  @Column({ nullable: true, type: 'datetime' })
  deactivationTokenExpiresAt: Date | null;

  /** #872: Timestamp when the inactivity warning email was sent. */
  @Column({ nullable: true, type: 'datetime' })
  deactivationNotifiedAt: Date | null;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true, type: 'datetime' })
  subscriptionExpiresAt: Date | null;

  @Column('simple-json', {
    nullable: true,
    default: {
      courseUpdates: true,
      liveSessions: true,
      tokenRewards: true,
      pushEnabled: false,
    },
  })
  notificationPreferences: {
    courseUpdates: boolean;
    liveSessions: boolean;
    tokenRewards: boolean;
    pushEnabled: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;
}
