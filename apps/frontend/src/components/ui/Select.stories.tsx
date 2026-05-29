import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const meta = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ],
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Difficulty Level',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ],
  },
};

export const WithError: Story = {
  args: {
    label: 'Category',
    error: 'Please select a category',
    options: [
      { value: '', label: 'Select an option...' },
      { value: 'blockchain', label: 'Blockchain' },
      { value: 'development', label: 'Development' },
    ],
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Language',
    helperText: 'Choose your preferred learning language',
    options: [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    label: 'Course',
    disabled: true,
    options: [{ value: 'course-1', label: 'Blockchain 101' }],
  },
};

export const ManyOptions: Story = {
  args: {
    label: 'Select Course',
    options: Array.from({ length: 20 }, (_, i) => ({
      value: `course-${i + 1}`,
      label: `Course ${i + 1}: ${['Stellar Basics', 'Soroban Contracts', 'dApp Development', 'Security', 'Advanced Topics'][i % 5]}`,
    })),
  },
};
