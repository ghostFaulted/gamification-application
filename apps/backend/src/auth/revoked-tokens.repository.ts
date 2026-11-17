import { Injectable, Logger } from '@nestjs/common';
import { eq, lte } from 'drizzle-orm';
import { db, revokedTokens } from '../db';

export abstract class RevokedTokensRepository {
  abstract revoke(jti: string, expiresAt: Date): Promise<void>;
  abstract isRevoked(jti: string): Promise<boolean>;
}

@Injectable()
export class DrizzleRevokedTokensRepository extends RevokedTokensRepository {
  private readonly logger = new Logger(DrizzleRevokedTokensRepository.name);

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    await db
      .insert(revokedTokens)
      .values({ jti, expiresAt })
      .onConflictDoNothing({ target: revokedTokens.jti });

    // Opportunistically prune already expired records to keep the table bounded.
    // Best-effort: the token is already revoked, so a failed cleanup must not fail the caller.
    try {
      await db.delete(revokedTokens).where(lte(revokedTokens.expiresAt, new Date()));
    } catch (error) {
      this.logger.warn(`Pruning expired revoked tokens failed: ${(error as Error).name}`);
    }
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
