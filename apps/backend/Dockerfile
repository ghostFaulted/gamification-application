FROM node:26-alpine
WORKDIR /app

RUN npm install -g pnpm@12.18.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY tsconfig.base.json ./

RUN pnpm --filter @gamification/shared build \
    && pnpm --filter @gamification/backend build

RUN chmod +x apps/backend/docker-entrypoint.sh

EXPOSE 3000
CMD ["apps/backend/docker-entrypoint.sh"]

