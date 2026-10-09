import { Controller, Get, Query } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service.js';
import { suggestionsQuerySchema, type SuggestionsQuery } from './suggestions.schemas.js';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  // GET /suggestions?q=ube
  @Get()
  suggest(@Query({ schema: suggestionsQuerySchema }) query: SuggestionsQuery) {
    return this.suggestions.suggest(query.q, query.limit);
  }
}
