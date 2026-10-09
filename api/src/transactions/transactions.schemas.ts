import { z } from 'zod';
import { amountField, descriptionField, idField, isoDate, nameField } from '../common/field-schemas.js';
import { PAYMENT_METHODS, TX_KINDS } from '../lib/types.js';

const kind = z.enum(TX_KINDS);
const paymentMethod = z.enum(PAYMENT_METHODS);

export const createTransactionSchema = z
  .object({
    occurredOn: isoDate,
    name: nameField,
    amount: amountField,
    kind,
    paymentMethod: paymentMethod.nullish(),
    isFixed: z.boolean().default(false),
    categoryId: idField.nullish(),
    personId: idField.nullish(),
    description: descriptionField.nullish(),
    /** Compra parcelada: cria as parcelas de `current` (padrão 1) até `total`, uma por mês. */
    installments: z
      .object({ total: z.number().int().min(2).max(60), current: z.number().int().min(1).optional() })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.installments) {
      if ((v.installments.current ?? 1) > v.installments.total) {
        ctx.addIssue({ code: 'custom', path: ['installments', 'current'], message: 'current não pode ser maior que total' });
      }
      if (v.kind !== 'expense') {
        ctx.addIssue({ code: 'custom', path: ['installments'], message: 'parcelamento só vale para gastos (expense)' });
      }
    }
  });
export type CreateTransactionInput = z.output<typeof createTransactionSchema>;

export const patchTransactionSchema = z
  .object({
    occurredOn: isoDate.optional(),
    name: nameField.optional(),
    amount: amountField.optional(),
    kind: kind.optional(),
    paymentMethod: paymentMethod.nullable().optional(),
    isFixed: z.boolean().optional(),
    categoryId: idField.nullable().optional(),
    personId: idField.nullable().optional(),
    description: descriptionField.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'envie ao menos um campo para alterar');
export type PatchTransactionInput = z.output<typeof patchTransactionSchema>;

export const listQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  kind: kind.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  personId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  uncategorized: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.output<typeof listQuerySchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export type IdParam = z.output<typeof idParamSchema>;

export const deleteQuerySchema = z.object({ scope: z.enum(['this', 'following']).default('this') });
export type DeleteQuery = z.output<typeof deleteQuerySchema>;
