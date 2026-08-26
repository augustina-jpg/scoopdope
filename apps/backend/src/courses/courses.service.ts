import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Course, CourseStatus } from './course.entity';
import { CourseQueryDto } from './dto/course-query.dto';
import { SearchService } from '../search/search.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class CoursesService {
  private readonly CACHE_KEY = 'courses:all';
  /** 5-minute TTL in milliseconds */
  private readonly CACHE_TTL = 300_000;

  constructor(
    @InjectRepository(Course) private repo: Repository<Course>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly searchService: SearchService,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Get average rating for a course from reviews
   */
  async getAverageRating(courseId: string): Promise<number | null> {
    const course = await this.repo
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.reviews', 'review')
      .where('course.id = :courseId', { courseId })
      .getOne();

    if (!course || !course.reviews || course.reviews.length === 0) {
      return null;
    }

    const sum = course.reviews.reduce((acc, review) => acc + (review.rating || 0), 0);
    return parseFloat((sum / course.reviews.length).toFixed(2));
  }

  async findAll(query: CourseQueryDto = {}) {
    const { search, level, language, page = 1, limit = 20 } = query;

    // Cache key encodes all filter params; skip cache for search queries
    const cacheKey = !search
      ? `courses:catalog:${level ?? ''}:${language ?? ''}:${page}:${limit}`
      : null;

    if (cacheKey) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.metricsService.incrementCacheHit('courses');
        return cached;
      }
      this.metricsService.incrementCacheMiss('courses');
    }

    const qb = this.repo
      .createQueryBuilder('course')
      .where('course.isPublished = :isPublished', { isPublished: true })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      qb.andWhere('(course.title ILIKE :search OR course.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (level) {
      qb.andWhere('course.level = :level', { level });
    }

    if (language) {
      qb.andWhere('course.language = :language', { language });
    }

    const total = await qb.clone().getCount();
    const offset = (page - 1) * limit;

    const { raw, entities } = await qb
      .leftJoin('course.reviews', 'review')
      .addSelect('COALESCE(AVG(review.rating), 0)', 'course_averageRating')
      .skip(offset)
      .take(limit)
      .orderBy('course.createdAt', 'DESC')
      .groupBy('course.id')
      .getRawAndEntities();

    const averageRatings = new Map(
      raw.map((item, index) => [entities[index].id, Number(item.course_averageRating) || 0])
    );

    const data = entities.map((course) => ({
      ...course,
      averageRating: averageRatings.get(course.id) ?? 0,
    }));

    const result = { data, total, page, limit };

    if (cacheKey) {
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    }

    return result;
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['prerequisites', 'prerequisites.prerequisite'],
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(data: Partial<Course>) {
    const course = await this.repo.save(this.repo.create(data));
    await this.invalidateCache();
    await this.searchService.indexCourse(course).catch(() => {});
    return course;
  }

  async update(id: string, data: Partial<Course>) {
    const course = await this.findOne(id);
    if (!course) throw new NotFoundException('Course not found');
    const updated = await this.repo.save({ ...course, ...data });
    await this.invalidateCache();
    await this.searchService.indexCourse(updated).catch(() => {});
    return updated;
  }

  async delete(id: string) {
    const course = await this.findOne(id);
    if (!course) throw new NotFoundException('Course not found');
    const removed = await this.repo.remove(course);
    await this.invalidateCache();
    await this.searchService.deleteFromIndex('courses', id).catch(() => {});
    return removed;
  }

  private async invalidateCache() {
    await this.cacheManager.del(this.CACHE_KEY);
    // Invalidate catalog cache entries (pattern-based via store reset)
    await this.cacheManager.reset().catch(() => {});
  }

  async scheduleCourse(id: string, scheduledAt: Date): Promise<Course> {
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }
    const course = await this.findOne(id);
    return this.repo.save({
      ...course,
      status: CourseStatus.SCHEDULED,
      scheduledAt,
      isPublished: false,
    });
  }

  async publishNow(id: string): Promise<Course> {
    const course = await this.findOne(id);
    const now = new Date();

    course.status = CourseStatus.PUBLISHED;
    course.isPublished = true;
    course.publishedAt = now;
    course.scheduledAt = course.scheduledAt ?? null;

    return this.repo.save(course);
  }

  /**
   * Find a course by ID without the published-only filter — used by admin operations.
   */
  async findOneAdmin(id: string): Promise<Course> {
    const course = await this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['instructor'],
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  /**
   * Admin list — returns all courses regardless of status, with optional filters.
   * Also surfaces enrollment counts via a subquery.
   */
  async findAllAdmin(options: {
    status?: CourseStatus;
    instructorId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, instructorId, search, page = 1, limit = 20 } = options;

    const qb = this.repo
      .createQueryBuilder('course')
      .where('course.isDeleted = :isDeleted', { isDeleted: false })
      .leftJoinAndSelect('course.instructor', 'instructor')
      .loadRelationCountAndMap('course.enrollmentCount', 'course.modules', 'modules');

    if (status) {
      qb.andWhere('course.status = :status', { status });
    }

    if (instructorId) {
      qb.andWhere('course.instructorId = :instructorId', { instructorId });
    }

    if (search) {
      qb.andWhere(
        '(course.title ILIKE :search OR course.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.clone().getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('course.createdAt', 'DESC')
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Approve a pending course — moves it to PUBLISHED. */
  async approveCourse(id: string): Promise<Course> {
    const course = await this.findOneAdmin(id);
    const now = new Date();
    const updated = await this.repo.save({
      ...course,
      status: CourseStatus.PUBLISHED,
      isPublished: true,
      publishedAt: course.publishedAt ?? now,
    });
    await this.invalidateCache();
    return updated;
  }

  /** Archive a course — moves any non-deleted course to ARCHIVED. */
  async archiveCourse(id: string): Promise<{ course: Course; previousStatus: CourseStatus }> {
    const course = await this.findOneAdmin(id);
    const previousStatus = course.status;
    const updated = await this.repo.save({
      ...course,
      status: CourseStatus.ARCHIVED,
      isPublished: false,
    });
    await this.invalidateCache();
    return { course: updated, previousStatus };
  }

  /** Unarchive a course — restores it to PUBLISHED. */
  async unarchiveCourse(id: string): Promise<Course> {
    const course = await this.findOneAdmin(id);
    const updated = await this.repo.save({
      ...course,
      status: CourseStatus.PUBLISHED,
      isPublished: true,
    });
    await this.invalidateCache();
    return updated;
  }
}
