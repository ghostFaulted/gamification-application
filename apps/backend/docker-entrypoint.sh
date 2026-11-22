#!/bin/sh
set -e
pnpm --filter @gamification/backend db:migrate
if [ "$NODE_ENV" = "development" ] && [ "${SEED_ON_START:-true}" = "true" ]; then
  node apps/backend/dist/db/seed.js
fi
exec node apps/backend/dist/main.js