import { appError, err, ok } from '@harness/schema';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/use-zod-form';
import { Form } from './form';
import { TextField } from './text-field';

const Wallet = z.object({ address: z.string().min(1, 'Enter an address.') });
type Wallet = z.infer<typeof Wallet>;

function WalletForm({ fail }: { fail?: boolean }) {
  const form = useZodForm(Wallet, { defaultValues: { address: '' } });
  const submit = async (_values: Wallet) =>
    fail ? err(appError('UPSTREAM_FAILED', 'The request did not go through.')) : ok(null);
  return (
    <Form form={form} onSubmit={submit} className="max-w-sm">
      <TextField control={form.control} name="address" label="address" />
      <Button type="submit">Save</Button>
    </Form>
  );
}

const meta: Meta<typeof WalletForm> = {
  component: WalletForm,
  title: 'components/forms/Form',
};
export default meta;

type Story = StoryObj<typeof WalletForm>;

export const Default: Story = {};

export const ShowsTheRootError: Story = {
  args: { fail: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('address'), 'GABC');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText('The request did not go through.')).toBeVisible();
  },
};
