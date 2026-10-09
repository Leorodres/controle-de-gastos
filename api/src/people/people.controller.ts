import { Body, Controller, Get, Post } from '@nestjs/common';
import { nameBodySchema, type NameBody } from '../common/field-schemas.js';
import { PeopleService } from './people.service.js';

@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list() {
    return this.people.list();
  }

  @Post()
  create(@Body({ schema: nameBodySchema }) body: NameBody) {
    return this.people.create(body.name);
  }
}
