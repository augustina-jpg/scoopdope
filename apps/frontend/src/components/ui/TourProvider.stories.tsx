import type { Meta, StoryObj } from '@storybook/react';
import { TourProvider } from './TourProvider';
import { Button } from './Button';

const meta = {
  title: 'UI/TourProvider',
  component: TourProvider,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Provider component that conditionally renders the onboarding Tour for authenticated users. Wraps application content and manages tour lifecycle.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TourProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-4">Welcome to Scoopdope</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Your blockchain learning platform.</p>
        <Button>Get Started</Button>
      </div>
    ),
  },
};
