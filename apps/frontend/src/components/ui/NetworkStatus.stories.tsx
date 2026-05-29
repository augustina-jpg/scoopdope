import type { Meta, StoryObj } from '@storybook/react';
import NetworkStatus from './NetworkStatus';

const meta = {
  title: 'UI/NetworkStatus',
  component: NetworkStatus,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NetworkStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
