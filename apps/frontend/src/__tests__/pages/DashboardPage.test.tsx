import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      welcome: `Welcome back, ${values?.name ?? 'Student'}`,
      learningStreak: 'Learning Streak',
      tokenBalance: 'BST Token Balance',
      enrolledCourses: 'Enrolled Courses',
      recentCredentials: 'Recent Credentials',
      completed: 'Completed',
      emptyEnrollments: 'You have not enrolled in any courses yet.',
      browseCourses: 'Browse Courses',
      emptyCredentials: 'You have not earned any credentials yet.',
      courseFallback: `Course ${values?.id ?? ''}`,
      progressComplete: `${values?.percent}% complete`,
      progressForCourse: `Progress for ${values?.title}`,
      coursesCount: `${values?.count} Courses`,
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'en',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/dashboard/UserActivityDashboard', () => ({
  UserActivityDashboard: () => null,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    state: {
      user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
      token: 'fake-token',
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
}));

import DashboardPage from '@/app/dashboard/page';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DashboardPage', () => {
  it('renders welcome section and data from API', async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();

    expect(await screen.findAllByText('Intro to Stellar Blockchain')).not.toHaveLength(0);
    expect(await screen.findAllByText('Soroban Smart Contracts')).not.toHaveLength(0);

    expect(screen.getByText(/Recent Credentials/i)).toBeInTheDocument();
  });

  it('shows a browse-courses call to action when there are no enrollments', async () => {
    server.use(http.get(`${API_BASE}/users/user-1/enrollments`, () => HttpResponse.json([])));

    render(<DashboardPage />);

    expect(
      await screen.findByText('You have not enrolled in any courses yet.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse Courses' })).toHaveAttribute(
      'href',
      '/courses'
    );
  });

  it('renders progress for a single enrolled course', async () => {
    server.use(
      http.get(`${API_BASE}/users/user-1/enrollments`, () =>
        HttpResponse.json([
          {
            id: 'enrollment-1',
            courseId: '1',
            course: { id: '1', title: 'Intro to Stellar Blockchain' },
          },
        ])
      )
    );

    render(<DashboardPage />);

    expect(
      await screen.findByRole('progressbar', {
        name: 'Progress for Intro to Stellar Blockchain',
      })
    ).toHaveAttribute('aria-valuenow', '45');
  });

  it('renders more than five enrolled courses', async () => {
    const enrollments = Array.from({ length: 6 }, (_, index) => ({
      id: `enrollment-${index + 1}`,
      courseId: `course-${index + 1}`,
      course: { id: `course-${index + 1}`, title: `Course title ${index + 1}` },
    }));
    server.use(
      http.get(`${API_BASE}/users/user-1/enrollments`, () => HttpResponse.json(enrollments))
    );

    render(<DashboardPage />);

    expect(await screen.findByText('Course title 6')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(6);
  });
});
