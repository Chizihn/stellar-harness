import { z } from 'zod';

export const ApiErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
