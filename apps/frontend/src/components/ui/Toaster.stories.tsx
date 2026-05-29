import type { Meta, StoryObj } from '@storybook/react';
import { Toaster } from './Toaster';
import { useToastStore } from '@/lib/toast';
import { Button } from './Button';

const meta = {
  title: 'UI/Toaster',
  component: Toaster,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <>
      <div className="flex items-center justify-center min-h-[400px]">
        <Button
          onClick={() =>
            useToastStore.getState().add('Operation completed successfully!', 'success')
          }
        >
          Show Success Toast
        </Button>
      </div>
      <Toaster />
    </>
  ),
};

export const MultipleToasts: Story = {
  render: () => {
    const store = useToastStore.getState();
    store.add('Course published successfully!', 'success');
    store.add('Unable to save changes.', 'error');
    store.add('New course materials available.', 'info');
    return <Toaster />;
  },
};

export const SuccessOnly: Story = {
  render: () => {
    useToastStore.getState().add('Changes saved successfully!', 'success');
    return <Toaster />;
  },
};

export const ErrorOnly: Story = {
  render: () => {
    useToastStore.getState().add('Failed to load course data.', 'error');
    return <Toaster />;
  },
};

export const InfoOnly: Story = {
  render: () => {
    useToastStore.getState().add('Your certificate is ready for download.', 'info');
    return <Toaster />;
  },
};
