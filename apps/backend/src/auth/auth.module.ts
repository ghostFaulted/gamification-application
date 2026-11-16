import { Module, type OnModuleInit } from '@nestjs/common';
import { getJwtExpiresInSeconds, getJwtSecret } from './auth.constants';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  DrizzleRevokedTokensRepository,
  RevokedTokensRepository,
} from './revoked-tokens.repository';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [
    TokenService,
    JwtAuthGuard,
    {
      provide: RevokedTokensRepository,
      useClass: DrizzleRevokedTokensRepository,
    },
  ],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule implements OnModuleInit {
  onModuleInit(): void {
    getJwtSecret();
    getJwtExpiresInSeconds();
  }
}
