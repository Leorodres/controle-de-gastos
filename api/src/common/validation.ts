import { BadRequestException, StandardSchemaValidationPipe } from '@nestjs/common';

/**
 * Validação global: qualquer @Body({ schema }), @Query({ schema }) ou @Param({ schema })
 * é checado contra o schema (Zod, via Standard Schema) e o valor já entra transformado no handler.
 */
export const validationPipe = new StandardSchemaValidationPipe({
  exceptionFactory: (issues) =>
    new BadRequestException({
      error: 'validation',
      issues: issues.map((i) => ({
        path: (i.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.'),
        message: i.message,
      })),
    }),
});
