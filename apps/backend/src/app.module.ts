import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LdapModule } from './ldap/ldap.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [HealthModule, AuthModule, LdapModule, UsersModule],
})
export class AppModule {}