import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LdapModule } from './ldap/ldap.module';

@Module({
  imports: [HealthModule, AuthModule, LdapModule],
})
export class AppModule {}
