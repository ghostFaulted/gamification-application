import { Module, type OnModuleInit } from '@nestjs/common';
import { LdapModule } from '../ldap/ldap.module';
import { UsersModule } from '../users/users.module';
import { getJwtExpiresInSeconds, getJwtSecret } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  DrizzleRevokedTokensRepository,
  RevokedTokensRepository,
} from './revoked-tokens.repository';
import { TokenService } from './token.service';

@Module({
  imports: [LdapModule, UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
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
