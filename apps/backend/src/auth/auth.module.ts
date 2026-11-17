import { Module, type OnModuleInit } from '@nestjs/common';
import { DrizzleUsersRepository, UsersRepository } from '../db/users.repository';
import { LdapModule } from '../ldap/ldap.module';
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
  imports: [LdapModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    {
      provide: RevokedTokensRepository,
      useClass: DrizzleRevokedTokensRepository,
    },
    {
      provide: UsersRepository,
      useClass: DrizzleUsersRepository,
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
