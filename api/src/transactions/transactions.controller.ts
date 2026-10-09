import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import {
  createTransactionSchema,
  deleteQuerySchema,
  idParamSchema,
  listQuerySchema,
  patchTransactionSchema,
  type CreateTransactionInput,
  type DeleteQuery,
  type IdParam,
  type ListQuery,
  type PatchTransactionInput,
} from './transactions.schemas.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Query({ schema: listQuerySchema }) query: ListQuery) {
    return this.transactions.list(query);
  }

  @Get(':id')
  get(@Param({ schema: idParamSchema }) params: IdParam) {
    return this.transactions.get(params.id);
  }

  @Post()
  create(@Body({ schema: createTransactionSchema }) body: CreateTransactionInput) {
    return this.transactions.create(body);
  }

  @Patch(':id')
  patch(
    @Param({ schema: idParamSchema }) params: IdParam,
    @Body({ schema: patchTransactionSchema }) body: PatchTransactionInput,
  ) {
    return this.transactions.patch(params.id, body);
  }

  // ?scope=following apaga esta parcela e as seguintes do mesmo parcelamento
  @Delete(':id')
  remove(@Param({ schema: idParamSchema }) params: IdParam, @Query({ schema: deleteQuerySchema }) query: DeleteQuery) {
    return this.transactions.remove(params.id, query.scope);
  }
}
