# AGENTS.md

Context and rules for AI agents (and humans) working in this repository.

## Project

"Grywalizacja" (Gamification): a web app for gamifying classes at WMiI UAM Poznań. University team project.

- Client/supervisor: dr Marcin Szczepański.
- Target deployment: a single faculty server (`wmi.amu.edu.pl` domain).
- Open source: https://github.com/ghostFaulted/gamification-application
- Work is tracked in Jira project `SCRUM` (https://yaroslavzamorsky.atlassian.net/browse/SCRUM), in weekly sprints.
- Scale: up to a few hundred students. Keep it simple, no microservices.

## Product scope

Epics:

1. Identity and data: LDAP login with roles (Student, Lecturer, Admin), CSV import/export of students and groups.
2. Gamification engine: currency, ranks, badges, streaks (attendance/activity), points-to-grade conversion.
3. Student dashboard and store: progress, deadlines, anonymous ranking (nicknames/avatars), spending currency on bonuses.
4. Live quizzes: join by PIN or QR code, automatic points.

MVP boundaries:

- Responsive web SPA (PWA/RWD), no native mobile apps.
- Auth via faculty LDAP (LABS domain) only: no local passwords, no OAuth.
- One-way CSV import/export for USOS/Moodle (done manually by the lecturer), no direct API integration.
- No chat module, no push notifications, no automatic emails.

## Architecture

Agreed in the C4 container diagram. Inside the system boundary:

1. Frontend SPA: React + TypeScript + Vite. UI for Student, Lecturer, Admin.
2. Backend API: Node.js + NestJS + Socket.IO (modular monolith). Business logic, gamification engine, CSV import/export, live quizzes.
3. Database: PostgreSQL via Drizzle ORM (typed queries, migrations kept in the repo).

External: faculty LDAP server (LABS), USOS/Moodle (CSV files only).

Communication:

- SPA -> API: REST/JSON over HTTPS.
- SPA <-> API: WebSocket/WSS (Socket.IO) for live quizzes.
- API -> DB: SQL/TCP (Drizzle).
- API -> LDAP: LDAPS.

No Nginx and no Redis unless a real need appears at deployment.

## Repository layout

```
apps/
  frontend/     # @gamification/frontend: React + TS + Vite SPA
  backend/      # @gamification/backend: NestJS API + Drizzle
packages/
  shared/       # @gamification/shared: types shared by both apps (roles, DTOs, API responses, quiz events)
tests/          # cross-app tests (e.g. smoke tests of the whole stack)
```

- Package manager: pnpm workspaces. Versions are pinned in `package.json` (`packageManager`) and `.nvmrc`.
- `packages/shared` is consumed from `dist/`; root `postinstall` builds it. After changing it outside `pnpm dev`, run `pnpm --filter @gamification/shared build`.
- Local Vite proxies `/api/*` to `http://localhost:3000`. In Docker Compose the web service sets `API_PROXY_TARGET=http://api:3000`.

## Commands

```bash
pnpm install        # install deps and build packages/shared
pnpm dev            # run all apps in dev mode (frontend: http://localhost:5173)
pnpm build          # build all packages
pnpm typecheck      # TS type check in all packages
pnpm lint           # ESLint for the whole repo
pnpm format         # Prettier write
pnpm format:check   # Prettier check
```

Docker Compose (database + ldap + api + web):

```bash
cp .env.example .env   # once; never commit .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API health: http://localhost:3000/api/health
- OpenLDAP (local test directory): `localhost:${LDAP_PORT}` (default 389); seed in `docker/ldap/bootstrap/`
- API container runs Drizzle migrations on start, then NestJS.
- Faculty LABS is LDAPS on deploy; local Compose uses plain LDAP for the test container.

Before finishing a change, `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm build` must pass from a clean clone.

## Database

- Drizzle schema lives in `apps/backend/src/db/schema/`, one file per area, re-exported from `index.ts`.
- Migrations are generated from the schema with `pnpm --filter @gamification/backend db:generate` and applied with `db:migrate`. Commit the whole `apps/backend/drizzle/` folder (SQL + `meta/`).
- Never edit or delete a migration that is already on `main`; every change is a new migration. Do not use `drizzle-kit push`.
- Prefer `apps/backend/drizzle/meta/` in `.prettierignore` so generated JSON does not break `format:check`.
- Database row types stay in the backend. `packages/shared` must not depend on Drizzle; it only holds API-facing types.
- Local DB credentials for Compose live in `.env` (from `.env.example`). Inside Compose, the DB hostname is the service name `database`, not `localhost`.

## GitHub workflow (do not break these)

- Every change goes through a pull request into `main`. **No direct pushes to `main`.**
- **Squash merge only.** Do not use "Create a merge commit" or rebase-merge. One commit on `main` per PR; title becomes the commit message.
- Branch protection on `main`: require a PR, require at least one approval, require the GitHub Actions check named `build` (lint + typecheck + build).
- Author opens the PR; another teammate reviews; author squash-merges after CI is green and the review is approved.
- Branch names, commit messages and PR titles are in **English** and start with the Jira key, e.g. `SCRUM-43: add Docker Compose stack for local development`.
- PR descriptions and review comments are in **Polish**. README and user-facing docs are in Polish. Code, identifiers and comments are in English.
- Keep PRs on-ticket. Do not implement teammates' tasks in the same PR.
- Do not commit secrets: `.env` is gitignored; commit `.env.example` only.
- Do not commit `node_modules/` or `dist/`.

## Other conventions

- TypeScript everywhere (frontend, backend, scripts, tests).
- Types shared between apps go into `packages/shared`, not duplicated.
- Stay inside the scope of the current ticket; later epics should not be blocked by current work.
