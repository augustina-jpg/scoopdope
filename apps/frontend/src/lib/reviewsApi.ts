import api from './api';

export interface Review {
  id: string;
  courseId: string;
  authorId?: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  upvotes?: number;
  instructorReply?: { text: string; createdAt: string };
}

export interface ReviewsResponse {
  data: Review[];
  averageRating: number | null;
  total: number;
  page: number;
  limit: number;
}

interface ReviewApiPayload extends Omit<Review, 'text' | 'authorName'> {
  comment?: string | null;
  user?: { username?: string; email?: string };
  text?: string;
  authorName?: string;
}

interface ReviewsApiPayload {
  data: ReviewApiPayload[];
  averageRating: number | null;
  total: number;
  page: number;
  limit: number;
}

export type SortCriterion = 'helpful' | 'recent' | 'highest';

function unwrapReviewsResponse(response: unknown): ReviewsApiPayload {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    !Array.isArray((response as { data: unknown }).data)
  ) {
    return unwrapReviewsResponse((response as { data: unknown }).data);
  }
  return response as ReviewsApiPayload;
}

export const reviewsApi = {
  getReviews: async (
    courseId: string,
    sort: SortCriterion = 'recent',
    page = 1,
    limit = 10
  ): Promise<ReviewsResponse> => {
    const response = await api.get<unknown>(`/courses/${courseId}/reviews`, {
      params: { sort, page, limit },
    });
    const result = unwrapReviewsResponse(response.data);
    return {
      ...result,
      data: result.data.map((review) => ({
        ...review,
        text: review.text ?? review.comment ?? '',
        authorName: review.authorName ?? review.user?.username ?? review.user?.email ?? '',
      })),
    };
  },

  submitReview: (courseId: string, rating: number, text: string) =>
    api.post<Review>(`/courses/${courseId}/reviews`, { rating, text }).then((r) => {
      const response = r.data as Review | { data: Review };
      return 'data' in response ? response.data : response;
    }),

  submitInstructorReply: (courseId: string, reviewId: string, text: string) =>
    api.post(`/courses/${courseId}/reviews/${reviewId}/reply`, { text }).then((r) => r.data),

  flagReview: (courseId: string, reviewId: string) =>
    api.patch(`/courses/${courseId}/reviews/${reviewId}/flag`).then((r) => r.data),
};
