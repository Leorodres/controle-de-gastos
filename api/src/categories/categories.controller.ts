import { Body, Controller, Get, Post } from '@nestjs/common';
import { nameBodySchema, type NameBody } from '../common/field-schemas.js';
import { CategoriesService } from './categories.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body({ schema: nameBodySchema }) body: NameBody) {
    return this.categories.create(body.name);
  }
}
