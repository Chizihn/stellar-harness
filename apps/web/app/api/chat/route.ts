import { createOpenAI } from '@ai-sdk/openai';
import { orgBrief, SYSTEM_PROMPT } from '@harness/agent';
import { appError } from '@harness/schema';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { getChatEnv } from '@/lib/env';
import { ORG, tools } from '@/lib/harness';
import { logger } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const INSTRUCTIONS = `${SYSTEM_PROMPT}\n${orgBrief(ORG)}`;

const ChatBody = z.object({ messages: z.array(z.custom<UIMessage>()).min(1) });

const loadChatEnv = () => {
  try {
    return getChatEnv();
  } catch (error) {
    throw appError('INTERNAL', error instanceof Error ? error.message : 'Chat is not configured');
  }
};

export const POST = apiHandler({
  name: 'chat.stream',
  schema: { body: ChatBody },
  rateLimit: { limit: 30, windowSeconds: 60 },
  handler: async ({ body, requestId }) => {
    const env = loadChatEnv();
    const result = streamText({
      model: createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.OPENAI_MODEL),
      instructions: INSTRUCTIONS,
      messages: await convertToModelMessages(body.messages, { tools }),
      tools,
      stopWhen: stepCountIs(5),
    });
    return result.toUIMessageStreamResponse({
      onError: (error) => {
        logger.error({ requestId, error }, 'chat stream failed');
        return error instanceof Error ? error.message : 'The agent stream failed.';
      },
    });
  },
});
