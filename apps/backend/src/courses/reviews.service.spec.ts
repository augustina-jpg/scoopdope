import { ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const reviewQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const reviewRepo = {
    findOne: jest.fn(),
    create: jest.fn((review) => review),
    save: jest.fn((review) => Promise.resolve({ id: 'review-1', ...review })),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => reviewQueryBuilder),
  };
  const enrollmentRepo = { findOne: jest.fn() };
  const progressRepo = { findOne: jest.fn() };
  const courseRepo = { findOne: jest.fn() };
  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(
      reviewRepo as never,
      enrollmentRepo as never,
      progressRepo as never,
      courseRepo as never
    );
    courseRepo.findOne.mockResolvedValue({ id: 'course-1' });
    reviewRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.findOne.mockResolvedValue({ courseId: 'course-1', userId: 'user-1' });
  });

  it('rejects reviews when course progress is below 50 percent', async () => {
    progressRepo.findOne.mockResolvedValue({ progressPct: 49 });

    await expect(
      service.create('course-1', 'user-1', { rating: 4, text: 'Helpful course' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reviewRepo.save).not.toHaveBeenCalled();
  });

  it('accepts a review at 50 percent and stores its text', async () => {
    progressRepo.findOne.mockResolvedValue({ progressPct: 50 });

    await expect(
      service.create('course-1', 'user-1', { rating: 4, text: ' Helpful course ' })
    ).resolves.toMatchObject({ comment: 'Helpful course', rating: 4 });
  });

  it('returns review pages of ten and the overall average rating', async () => {
    reviewRepo.findAndCount.mockResolvedValue([[{ id: 'review-1', rating: 4 }], 21]);
    reviewQueryBuilder.getRawOne.mockResolvedValue({ averageRating: '4.25' });

    await expect(service.findByCourse('course-1')).resolves.toMatchObject({
      total: 21,
      page: 1,
      limit: 10,
      averageRating: 4.25,
    });
    expect(reviewRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
  });
});
