import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { z } from 'zod';
import { FieldStory } from './story-utils';
import { TextField } from './text-field';

const meta: Meta = {
  title: 'components/forms/TextField',
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <FieldStory schema={z.object({ tag: z.string() })} defaultValues={{ tag: '' }}>
      {(control) => <TextField control={control} name="tag" label="tag" placeholder="scf_funded" />}
    </FieldStory>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <FieldStory schema={z.object({ tag: z.string() })} defaultValues={{ tag: 'treasury' }}>
      {(control) => (
        <TextField
          control={control}
          name="tag"
          label="tag"
          description="Exact tag match, for example country:ng."
        />
      )}
    </FieldStory>
  ),
};

export const Sans: Story = {
  render: () => (
    <FieldStory schema={z.object({ note: z.string() })} defaultValues={{ note: '' }}>
      {(control) => <TextField control={control} name="note" label="note" mono={false} />}
    </FieldStory>
  ),
};

export const Email: Story = {
  render: () => (
    <FieldStory schema={z.object({ email: z.email() })} defaultValues={{ email: '' }}>
      {(control) => (
        <TextField
          control={control}
          name="email"
          label="email"
          type="email"
          autoComplete="email"
          placeholder="ops@example.org"
          mono={false}
        />
      )}
    </FieldStory>
  ),
};
