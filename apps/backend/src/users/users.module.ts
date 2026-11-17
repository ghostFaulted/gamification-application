import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleUsersRepository, UsersRepository } from '../db';
import { CsvParserService } from './csv-parser.service';
import { UsersController } from './users.controller';

@Module({
  // forwardRef: AuthModule imports UsersModule too; we need its JwtAuthGuard and TokenService.
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
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
