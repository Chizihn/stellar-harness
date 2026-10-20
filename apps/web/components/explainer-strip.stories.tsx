import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { EXPLAINER_COOKIE } from '@/lib/explainer';
import { ExplainerStrip, explainerText } from './explainer-strip';

const meta: Meta<typeof ExplainerStrip> = {
  component: ExplainerStrip,
  title: 'components/ExplainerStrip',
  args: { network: 'testnet' },
};
export default meta;

type Story = StoryObj<typeof ExplainerStrip>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(explainerText('testnet'), { exact: false })).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: /See what's breaking on mainnet now/ }),
    ).toHaveAttribute('href', '/report');
  },
};

export const Dismisses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(canvas.queryByRole('complementary')).not.toBeInTheDocument();
    await expect(document.cookie).toContain(EXPLAINER_COOKIE);
    // biome-ignore lint/suspicious/noDocumentCookie: clears the cookie this story set
    document.cookie = `${EXPLAINER_COOKIE}=; path=/; max-age=0`;
  },
};
