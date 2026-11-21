#!/bin/sh
set -e
pnpm --filter @gamification/backend db:migrate
if [ "$NODE_ENV" != "production" ] && [ "${SEED_ON_START:-true}" = "true" ]; then
  node apps/backend/dist/db/seed.js
fi
exec node apps/backend/dist/main.js