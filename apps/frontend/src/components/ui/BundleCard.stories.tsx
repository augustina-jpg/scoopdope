import type { Meta, StoryObj } from '@storybook/react';
import { BundleCard } from './BundleCard';

interface Course {
  id: string;
  title: string;
}

interface Bundle {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  courses: Course[];
  thumbnailUrl?: string;
}

const sampleBundle: Bundle = {
  id: 'bundle-1',
  title: 'Blockchain Developer Mastery',
  description:
    'Complete blockchain development track covering Stellar fundamentals, Soroban smart contracts, and dApp development.',
  price: 299,
  discountPrice: 199,
  courses: [
    { id: 'c1', title: 'Stellar Fundamentals' },
    { id: 'c2', title: 'Soroban Smart Contracts' },
    { id: 'c3', title: 'dApp Development with React' },
    { id: 'c4', title: 'Blockchain Security' },
    { id: 'c5', title: 'Advanced Soroban Patterns' },
  ],
};

const meta = {
  title: 'UI/BundleCard',
  component: BundleCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BundleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    bundle: sampleBundle,
    onViewDetails: () => alert('View details clicked'),
    onPurchase: () => alert('Purchase clicked'),
    isPurchased: false,
  },
};

export const Purchased: Story = {
  args: {
    bundle: { ...sampleBundle, discountPrice: null },
    onViewDetails: () => alert('View details clicked'),
    onPurchase: () => alert('Purchase clicked'),
    isPurchased: true,
  },
};

export const NoDiscount: Story = {
  args: {
    bundle: { ...sampleBundle, discountPrice: null },
    onViewDetails: () => alert('View details clicked'),
    onPurchase: () => alert('Purchase clicked'),
    isPurchased: false,
  },
};

export const FewCourses: Story = {
  args: {
    bundle: {
      ...sampleBundle,
      courses: [
        { id: 'c1', title: 'Stellar Fundamentals' },
        { id: 'c2', title: 'Soroban Smart Contracts' },
      ],
    },
    onViewDetails: () => alert('View details clicked'),
    onPurchase: () => alert('Purchase clicked'),
    isPurchased: false,
  },
};
