import { z } from 'zod';
import { isValidIsoDate } from '../lib/installments.js';
import { parseAmount } from '../lib/money.js';

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD')
  .refine(isValidIsoDate, 'data inválida');

/** Aceita número ou texto ("116,66") e entrega texto com 2 casas ("116.66"). */
export const amountField = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const parsed = parseAmount(v);
  if (parsed === null) {
    ctx.addIssue({ code: 'custom', message: 'valor deve ser maior que zero, com no máximo 2 casas decimais' });
    return z.NEVER;
  }
  return parsed;
});

export const idField = z.number().int().positive();
export const nameField = z.string().trim().min(1, 'nome obrigatório').max(200);

/** Descrição curta e opcional. Texto vazio vira null. */
export const descriptionField = z
  .string()
  .trim()
  .max(200, 'descrição com no máximo 200 caracteres')
  .transform((v) => (v === '' ? null : v));

export const nameBodySchema = z.object({ name: nameField }).strict();
export type NameBody = z.output<typeof nameBodySchema>;
