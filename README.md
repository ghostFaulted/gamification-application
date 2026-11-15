# Grywalizacja (Gamification Application)

Webowa aplikacja wspomagająca grywalizację zajęć dydaktycznych na Wydziale Matematyki i Informatyki UAM (`wmi.amu.edu.pl`).

## Główne moduły (Epiki)

1. **Zarządzanie tożsamością i integracja danych** — logowanie przez wydziałowy serwer LDAP (domena LABS), kontrola ról (`Student`, `Prowadzący`, `Administrator`) oraz import/eksport danych w formacie CSV (USOS / Moodle).
2. **Silnik grywalizacji i logiki biznesowej** — konfiguracja waluty fabularnej, rang, odznak, serii aktywności (strików) oraz przeliczanie punktów na oceny.
3. **Panel studenta i sklep (Student Dashboard & Store)** — podgląd postępów, anonimowy ranking oparty na pseudonimach i awatarach oraz wymiana waluty na bonusy.
4. **Quizy na żywo** — interaktywne quizy w czasie rzeczywistym (kod PIN / QR) z automatycznym naliczaniem punktów.

## Struktura repozytorium

```
apps/
  frontend/     # SPA: React + TypeScript + Vite
  backend/      # API: NestJS + Drizzle
packages/
  shared/       # wspólne typy TS (role, DTO, zdarzenia quizów) dla frontendu i backendu
```

## Wymagania

- Node.js 24+ (zalecana wersja w `.nvmrc`)
- pnpm 12: `npm i -g pnpm` (wersja z pola `packageManager` w `package.json`)
- Docker Desktop (do uruchomienia przez Compose)

## Uruchomienie lokalne (pnpm)

```bash
pnpm install          # instaluje zależności i buduje packages/shared
pnpm dev              # frontend: http://localhost:5173 , API: http://localhost:3000
```

Frontend przekierowuje zapytania `/api/*` do backendu na `http://localhost:3000` (proxy Vite).

Lokalna baza: `docker compose up database` (albo pełny stack poniżej). Backend uruchomiony na hoście nie czyta `.env`; bez `DATABASE_URL` łączy się domyślnie z `postgresql://postgres:postgres@localhost:5432/gamification`. Przy innym `POSTGRES_PORT` wyeksportuj `DATABASE_URL` z `localhost` i tym portem (host `database` działa tylko wewnątrz Compose).

## Uruchomienie przez Docker Compose

Pełny stack: PostgreSQL + API + frontend.

```bash
cp .env.example .env   # raz; pliku .env nie commitujemy
docker compose up --build
```

| Usługa     | URL                                           |
| ---------- | --------------------------------------------- |
| Frontend   | http://localhost:5173                         |
| API health | http://localhost:3000/api/health              |
| Postgres   | `localhost:${POSTGRES_PORT}` (domyślnie 5432) |

Kontener API przy starcie uruchamia migracje Drizzle (`db:migrate`), potem NestJS.

Zatrzymanie: `Ctrl+C` albo `docker compose down`. Dane Postgresa zostają w volume (`docker compose down -v` usuwa volume).

## Skrypty

| Komenda             | Opis                                         |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | uruchamia wszystkie aplikacje w trybie dev   |
| `pnpm build`        | buduje `shared`, `backend` i `frontend`      |
| `pnpm typecheck`    | sprawdzanie typów TS we wszystkich pakietach |
| `pnpm lint`         | ESLint dla całego repozytorium               |
| `pnpm format`       | formatowanie kodu (Prettier)                 |
| `pnpm format:check` | sprawdzenie formatowania bez zmian           |

Backend (przykłady):

```bash
pnpm --filter @gamification/backend db:generate
pnpm --filter @gamification/backend db:migrate
```

## Praca z pnpm

```bash
pnpm --filter @gamification/frontend add axios
pnpm --filter @gamification/frontend dev
```

Po zmianach w `packages/shared` poza `pnpm dev` uruchom `pnpm --filter @gamification/shared build`.

## Konwencje zespołu (skrót)

- Gałąź → PR → **squash merge** do `main` (bez merge commitów).
- CI (lint, typecheck, build) musi być zielone; wymagane jest też review.
- Tytuły commitów/PR po angielsku z kluczem Jiry, np. `SCRUM-43: add Docker Compose stack`.
- Opisy PR i komentarze review po polsku; kod i identyfikatory po angielsku.
- Nie edytujemy migracji już obecnych na `main`; każda zmiana schematu = nowa migracja Drizzle (`generate`, nie `push`).
