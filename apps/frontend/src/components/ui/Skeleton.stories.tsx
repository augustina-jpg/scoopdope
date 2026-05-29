import type { Meta, StoryObj } from '@storybook/react';
import {
  Skeleton,
  CourseCardSkeleton,
  CourseListSkeleton,
  CourseDetailSkeleton,
  DashboardSkeleton,
} from './Skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    variant: 'text',
    width: 200,
    height: 16,
  },
};

export const Rectangular: Story = {
  args: {
    variant: 'rectangular',
    width: 300,
    height: 200,
  },
};

export const Circular: Story = {
  args: {
    variant: 'circular',
    width: 48,
    height: 48,
  },
};

export const PulseAnimation: Story = {
  args: {
    variant: 'rectangular',
    width: 300,
    height: 200,
    animation: 'pulse',
  },
};

export const NoAnimation: Story = {
  args: {
    variant: 'rectangular',
    width: 300,
    height: 200,
    animation: 'none',
  },
};

export const TextLines: Story = {
  render: () => (
    <div className="space-y-3 w-80">
      <Skeleton variant="text" width="80%" height={24} />
      <Skeleton variant="text" width="60%" height={16} />
      <Skeleton variant="text" width="100%" height={16} />
      <Skeleton variant="text" width="90%" height={16} />
    </div>
  ),
};

export const CourseCard: Story = {
  render: () => <CourseCardSkeleton />,
  parameters: { layout: 'centered' },
};

export const CourseList: Story = {
  render: () => <CourseListSkeleton count={3} />,
  parameters: { layout: 'fullscreen' },
};

export const CourseDetail: Story = {
  render: () => <CourseDetailSkeleton />,
  parameters: { layout: 'fullscreen' },
};

export const Dashboard: Story = {
  render: () => <DashboardSkeleton />,
  parameters: { layout: 'fullscreen' },
};
