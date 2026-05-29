import type { Meta, StoryObj } from '@storybook/react';
import { CourseProgress } from './CourseProgress';

const sampleModules = [
  {
    id: 'mod-1',
    title: 'Introduction to Stellar',
    lessons: [
      { id: 'l1', title: 'What is Stellar?', completed: true },
      { id: 'l2', title: 'Stellar Network Overview', completed: true },
      { id: 'l3', title: 'Accounts and Assets', completed: false },
    ],
  },
  {
    id: 'mod-2',
    title: 'Smart Contracts with Soroban',
    lessons: [
      { id: 'l4', title: 'Soroban Basics', completed: false },
      { id: 'l5', title: 'Writing Your First Contract', completed: false },
    ],
  },
  {
    id: 'mod-3',
    title: 'Building dApps',
    lessons: [
      { id: 'l6', title: 'Frontend Integration', completed: false },
      { id: 'l7', title: 'Wallet Connection', completed: false },
      { id: 'l8', title: 'Deployment', completed: false },
    ],
  },
];

const meta = {
  title: 'UI/CourseProgress',
  component: CourseProgress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CourseProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EarlyProgress: Story = {
  args: {
    courseId: 'course-1',
    modules: sampleModules,
    timeSpentMinutes: 45,
    estimatedMinutes: 480,
  },
};

export const HalfComplete: Story = {
  args: {
    courseId: 'course-1',
    modules: sampleModules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((l, i) =>
        mod.id === 'mod-1' ? { ...l, completed: true } : i === 0 ? { ...l, completed: true } : l
      ),
    })),
    timeSpentMinutes: 240,
    estimatedMinutes: 480,
  },
};

export const Complete: Story = {
  args: {
    courseId: 'course-1',
    modules: sampleModules.map((mod) => ({
      ...mod,
      lessons: mod.lessons.map((l) => ({ ...l, completed: true })),
    })),
    timeSpentMinutes: 500,
    estimatedMinutes: 480,
  },
};

export const NoTimeEstimate: Story = {
  args: {
    courseId: 'course-1',
    modules: sampleModules,
  },
};
