import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    size: 'sm',
    label: 'Loading...',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
    label: 'Loading...',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    label: 'Loading...',
  },
};

export const CustomLabel: Story = {
  args: {
    size: 'md',
    label: 'Saving changes...',
  },
};

export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      <Spinner size="sm" />
      <span className="text-gray-600 dark:text-gray-400">Loading course content...</span>
    </div>
  ),
};
