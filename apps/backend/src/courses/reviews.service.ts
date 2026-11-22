import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Progress } from '../progress/progress.entity';
import { Course } from './course.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { Review } from './review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Progress)
    private readonly progressRepo: Repository<Progress>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>
  ) {}

  async create(courseId: string, userId: string, dto: CreateReviewDto) {
    await this.ensureCourseExists(courseId);

    const existing = await this.reviewRepo.findOne({ where: { courseId, userId } });
    if (existing) {
      throw new ConflictException('You have already reviewed this course');
    }

    const enrollment = await this.enrollmentRepo.findOne({
      where: { courseId, userId },
    });

    if (!enrollment) {
      throw new ForbiddenException('You must be enrolled to review this course');
    }

    const progress = await this.progressRepo.findOne({ where: { courseId, userId } });
    if (!progress || progress.progressPct < 50) {
      throw new ForbiddenException('You must complete at least 50% of the course to review it');
    }

    const review = this.reviewRepo.create({
      courseId,
      userId,
      rating: dto.rating,
      comment: dto.text?.trim() || dto.comment?.trim() || null,
    });

    return this.reviewRepo.save(review);
  }

  async findByCourse(courseId: string, query: ReviewQueryDto = {}) {
    await this.ensureCourseExists(courseId);

    const { page = 1, limit = 10, sort = 'recent' } = query;
    const offset = (page - 1) * limit;

    const [data, total] = await this.reviewRepo.findAndCount({
      where: { courseId },
      order: sort === 'highest' ? { rating: 'DESC', createdAt: 'DESC' } : { createdAt: 'DESC' },
      relations: ['user'],
      skip: offset,
      take: limit,
    });

    const ratingSummary = await this.reviewRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'averageRating')
      .where('review.courseId = :courseId', { courseId })
      .getRawOne<{ averageRating: string | null }>();

    return {
      data,
      total,
      page,
      limit,
      averageRating:
        ratingSummary?.averageRating == null ? null : Number(ratingSummary.averageRating),
    };
  }

  async flagReview(courseId: string, reviewId: string) {
    await this.ensureCourseExists(courseId);
    const review = await this.reviewRepo.findOne({ where: { id: reviewId, courseId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    review.flagged = true;
    return this.reviewRepo.save(review);
  }

  private async ensureCourseExists(courseId: string) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId, isDeleted: false },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }
  }
}
