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
  backend/      # API: TypeScript (szkielet API w SCRUM-46)
packages/
  shared/       # wspólne typy TS (role, DTO, zdarzenia quizów) dla frontendu i backendu
```

## Wymagania

- Node.js 24+ (zalecana wersja w `.nvmrc`)
- pnpm 12: `npm i -g pnpm`

## Uruchomienie lokalne

```bash
pnpm install          # instaluje zależności i buduje packages/shared
pnpm dev              # frontend: http://localhost:5173
```

Frontend przekierowuje zapytania `/api/*` do backendu na `http://localhost:3000` (proxy Vite).

## Skrypty

| Komenda             | Opis                                         |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | uruchamia wszystkie aplikacje w trybie dev   |
| `pnpm build`        | buduje `shared`, `backend` i `frontend`      |
| `pnpm typecheck`    | sprawdzanie typów TS we wszystkich pakietach |
| `pnpm lint`         | ESLint dla całego repozytorium               |
| `pnpm format`       | formatowanie kodu (Prettier)                 |
| `pnpm format:check` | sprawdzenie formatowania bez zmian           |

## Praca z pnpm

```bash
pnpm --filter frontend add axios      # dodanie zależności do jednej aplikacji
pnpm --filter frontend dev            # uruchomienie jednej aplikacji
```

Po zmianach w `packages/shared` poza `pnpm dev` uruchom `pnpm --filter shared build`.

Commity zaczynamy od klucza z Jiry, np. `SCRUM-62: init monorepo structure`.
