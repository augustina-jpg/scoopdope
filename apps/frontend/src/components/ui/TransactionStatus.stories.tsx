import type { Meta, StoryObj } from '@storybook/react';
import { TransactionStatus } from './TransactionStatus';

const meta = {
  title: 'UI/TransactionStatus',
  component: TransactionStatus,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TransactionStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    txHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    label: 'Certificate TX',
  },
};

export const NoLabel: Story = {
  args: {
    txHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  },
};
