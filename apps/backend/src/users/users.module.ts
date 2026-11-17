import { Module } from '@nestjs/common';
import { DrizzleUsersRepository, UsersRepository } from '../db';
import { CsvParserService } from './csv-parser.service';

@Module({
  providers: [
    CsvParserService,
    {
      provide: UsersRepository,
      useClass: DrizzleUsersRepository,
    },
  ],
  exports: [CsvParserService, UsersRepository],
})
export class UsersModule {}
