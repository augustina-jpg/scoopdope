import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class GdprService {
  constructor(@InjectEntityManager() private em: EntityManager) {}

  async exportUserData(userId: string) {
    const user = await this.em.query(
      `SELECT id, email, username, avatar, bio, "stellarPublicKey", role,
              "isVerified", "referralCode", "referredBy", "currentStreak", "longestStreak",
              "subscriptionTier", "notificationPreferences", "createdAt", "lastActivityAt"
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!user.length) throw new NotFoundException('User not found');

    const [
      enrollments,
      progress,
      certificates,
      credentials,
      reviews,
      forumPosts,
      forumReplies,
    ] = await Promise.all([
      this.em.query(
        `SELECT e.id, e."courseId", e."enrolledAt", e."completedAt",
                c.title AS "courseTitle"
         FROM enrollments e
         LEFT JOIN courses c ON c.id = e."courseId"
         WHERE e."userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", "lessonId", "progressPct", "completedAt", "updatedAt"
         FROM progress WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", "issuedAt", metadata
         FROM certificates WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", "credentialType", "issuedAt", "txHash"
         FROM credentials WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", rating, comment, "createdAt"
         FROM reviews WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", title, content, "isPinned", "createdAt"
         FROM posts WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT r.id, r."postId", r.content, r."createdAt", p.title AS "postTitle"
         FROM replies r
         LEFT JOIN posts p ON p.id = r."postId"
         WHERE r."userId" = $1`,
        [userId],
      ),
    ]);

    const [
      quizAttempts,
      assignments,
      peerReviews,
      notifications,
      notes,
      qaQuestions,
    ] = await Promise.all([
      this.em.query(
        `SELECT qa.id, qa."quizId", qa.score, qa."maxScore", qa.completed, qa."startedAt", qa."completedAt",
                q.title AS "quizTitle"
         FROM quiz_attempts qa
         LEFT JOIN quizzes q ON q.id = qa."quizId"
         WHERE qa."userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT asub.id, asub."assignmentId", asub.content, asub."submittedAt", asub.grade,
                a.title AS "assignmentTitle"
         FROM assignment_submissions asub
         LEFT JOIN assignments a ON a.id = asub."assignmentId"
         WHERE asub."userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT pr.id, pr."submissionId", pr.rating, pr.comment, pr."createdAt"
         FROM peer_reviews pr
         WHERE pr."reviewerId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, type, message, "isRead", "createdAt"
         FROM notifications WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT id, "courseId", "lessonId", content, "createdAt", "updatedAt"
         FROM notes WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT q.id, q."courseId", q.title, q.content, q."createdAt", q.resolved
         FROM qa_questions q WHERE q."userId" = $1`,
        [userId],
      ),
    ]);

    const [
      surveyResponses,
      learningPathEnrollments,
      bundleEnrollments,
      cohortMemberships,
    ] = await Promise.all([
      this.em.query(
        `SELECT id, "surveyId", answers, "submittedAt"
         FROM survey_responses WHERE "userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT lpe.id, lpe."pathId", lpe."enrolledAt", lpe."completedAt",
                lp.title AS "pathTitle"
         FROM learning_path_enrollments lpe
         LEFT JOIN learning_paths lp ON lp.id = lpe."pathId"
         WHERE lpe."userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT be.id, be."bundleId", be."enrolledAt", b.title AS "bundleTitle"
         FROM bundle_enrollments be
         LEFT JOIN bundles b ON b.id = be."bundleId"
         WHERE be."userId" = $1`,
        [userId],
      ),
      this.em.query(
        `SELECT cm.id, cm."cohortId", cm."joinedAt", c.name AS "cohortName"
         FROM cohort_members cm
         LEFT JOIN cohorts c ON c.id = cm."cohortId"
         WHERE cm."userId" = $1`,
        [userId],
      ),
    ]);

    const [downloadItems, waitlistEntries, apiKeys, instructorApplications, reminders] =
      await Promise.all([
        this.em.query(
          `SELECT id, "courseId", "fileName", "downloadedAt"
           FROM download_items WHERE "userId" = $1`,
          [userId],
        ),
        this.em.query(
          `SELECT id, "courseId", "createdAt", notified
           FROM waitlist_entries WHERE "userId" = $1`,
          [userId],
        ),
        this.em.query(
          `SELECT id, name, "isActive", "createdAt", "lastUsedAt"
           FROM api_keys WHERE "userId" = $1`,
          [userId],
        ),
        this.em.query(
          `SELECT id, status, "createdAt", "reviewedAt"
           FROM instructor_applications WHERE "userId" = $1`,
          [userId],
        ),
        this.em.query(
          `SELECT id, "courseId", "remindAt", sent, "createdAt"
           FROM reminders WHERE "userId" = $1`,
          [userId],
        ),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user[0],
      enrollments,
      progress,
      certificates,
      credentials,
      reviews,
      forumPosts,
      forumReplies,
      quizAttempts,
      assignments,
      peerReviews,
      notifications,
      notes,
      qaQuestions,
      surveyResponses,
      learningPathEnrollments,
      bundleEnrollments,
      cohortMemberships,
      downloadItems,
      waitlistEntries,
      apiKeys,
      instructorApplications,
      reminders,
    };
  }

  async deleteUserData(userId: string) {
    const user = await this.em.query(
      `SELECT id, role FROM users WHERE id = $1 AND "deletedAt" IS NULL`,
      [userId],
    );
    if (!user.length) throw new NotFoundException('User not found');

    if (user[0].role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be self-deleted. Contact support.');
    }

    const deletedSuffix = `-deleted-${Date.now()}`;

    await this.em.transaction(async (tx) => {
      // 1. Anonymize user-contributed content (keep records, remove PII link)
      await tx.query(`UPDATE posts SET "userId" = NULL WHERE "userId" = $1`, [userId]);
      await tx.query(`UPDATE replies SET "userId" = NULL WHERE "userId" = $1`, [userId]);
      await tx.query(`UPDATE reviews SET "userId" = NULL WHERE "userId" = $1`, [userId]);
      await tx.query(`UPDATE qa_questions SET "userId" = NULL WHERE "userId" = $1`, [userId]);

      // 2. Hard-delete revocable/sessional data
      await tx.query(`DELETE FROM refresh_tokens WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM password_reset_tokens WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM api_keys WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM notifications WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM push_subscriptions WHERE "userId" = $1`, [userId]);

      // 3. Delete ephemeral records that aren't needed after deletion
      await tx.query(`DELETE FROM reminders WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM waitlist_entries WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM survey_responses WHERE "userId" = $1`, [userId]);
      await tx.query(`DELETE FROM download_items WHERE "userId" = $1`, [userId]);

      // 4. For instructor-owned content, set references to null
      await tx.query(
        `UPDATE courses SET "instructorId" = NULL WHERE "instructorId" = $1`,
        [userId],
      );
      await tx.query(
        `UPDATE course_versions SET "createdById" = NULL WHERE "createdById" = $1`,
        [userId],
      );
      await tx.query(
        `UPDATE announcements SET "instructorId" = NULL WHERE "instructorId" = $1`,
        [userId],
      );
      await tx.query(
        `UPDATE live_sessions SET "instructorId" = NULL WHERE "instructorId" = $1`,
        [userId],
      );

      // 5. Anonymize the user record
      await tx.query(
        `UPDATE users SET
           email = CONCAT('deleted', $2, '@anonymized.com'),
           username = CONCAT('deleted', $2),
           "passwordHash" = '',
           avatar = NULL,
           bio = NULL,
           "stellarPublicKey" = NULL,
           "verificationToken" = NULL,
           "verificationTokenExpiresAt" = NULL,
           "mfaEnabled" = false,
           "mfaSecret" = NULL,
           "mfaBackupCodes" = NULL,
           "referralCode" = NULL,
           "stripeCustomerId" = NULL,
           "stripeSubscriptionId" = NULL,
           "subscriptionExpiresAt" = NULL,
           "notificationPreferences" = NULL,
           "currentStreak" = 0,
           "longestStreak" = 0,
           "deletedAt" = NOW()
         WHERE id = $1`,
        [userId, deletedSuffix],
      );
    });

    return { message: 'Account deleted successfully. Your personal data has been anonymized.' };
  }
}
