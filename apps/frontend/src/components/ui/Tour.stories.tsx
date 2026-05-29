import type { Meta, StoryObj } from '@storybook/react';
import { Tour } from './Tour';

const meta = {
  title: 'UI/Tour',
  component: Tour,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Onboarding tour that walks users through the platform. Requires specific DOM elements (nav links, data attributes) to be present for targeting.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tour>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onComplete: () => alert('Tour completed'),
    onSkip: () => alert('Tour skipped'),
    forceStart: true,
  },
};
