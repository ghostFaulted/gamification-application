FROM node:26-alpine
WORKDIR /app

RUN npm install -g pnpm@12.18.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
COPY tsconfig.base.json ./

RUN pnpm --filter @gamification/shared build

EXPOSE 5173
CMD ["pnpm", "--filter", "@gamification/frontend", "exec", "vite", "--host", "0.0.0.0", "--port", "5173"]
