import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb, CompactBreadcrumb } from './Breadcrumb';

const meta = {
  title: 'UI/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Courses', href: '/courses' },
      { label: 'Blockchain 101', href: '/courses/blockchain-101', current: true },
    ],
  },
};

export const TwoLevels: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Dashboard', href: '/dashboard', current: true },
    ],
  },
};

export const SinglePage: Story = {
  args: {
    items: [{ label: 'Home', href: '/', current: true }],
  },
};

export const CompactVariant: Story = {
  render: () => (
    <CompactBreadcrumb
      items={[
        { label: 'Home', href: '/' },
        { label: 'Courses', href: '/courses' },
        { label: 'Blockchain 101', href: '/courses/blockchain-101', current: true },
      ]}
    />
  ),
};
