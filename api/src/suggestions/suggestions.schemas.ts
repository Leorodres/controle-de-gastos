import { z } from 'zod';

export const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(1, 'informe parte do nome').max(100),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
export type SuggestionsQuery = z.output<typeof suggestionsQuerySchema>;
