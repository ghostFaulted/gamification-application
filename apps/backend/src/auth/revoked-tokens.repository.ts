import { Injectable } from '@nestjs/common';
import { eq, lte } from 'drizzle-orm';
import { db, revokedTokens } from '../db';

export abstract class RevokedTokensRepository {
  abstract revoke(jti: string, expiresAt: Date): Promise<void>;
  abstract isRevoked(jti: string): Promise<boolean>;
}

@Injectable()
export class DrizzleRevokedTokensRepository extends RevokedTokensRepository {
  async revoke(jti: string, expiresAt: Date): Promise<void> {
    await db
      .insert(revokedTokens)
      .values({ jti, expiresAt })
      .onConflictDoNothing({ target: revokedTokens.jti });

    // Opportunistically prune already expired records to keep the table bounded.
    await db.delete(revokedTokens).where(lte(revokedTokens.expiresAt, new Date()));
  }

  async isRevoked(jti: string): Promise<boolean> {
    const [row] = await db
      .select({ jti: revokedTokens.jti })
      .from(revokedTokens)
      .where(eq(revokedTokens.jti, jti))
      .limit(1);

    return row !== undefined;
  }
}
