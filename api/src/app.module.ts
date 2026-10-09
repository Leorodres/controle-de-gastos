import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { validationPipe } from './common/validation.js';
import { CategoriesModule } from './categories/categories.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { PeopleModule } from './people/people.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, PeopleModule, CategoriesModule, TransactionsModule, SuggestionsModule],
  providers: [
    { provide: APP_PIPE, useValue: validationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
