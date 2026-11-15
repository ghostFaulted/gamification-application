#!/bin/sh
set -e
pnpm --filter @gamification/backend db:migrate
exec node apps/backend/dist/main.js