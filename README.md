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

Pełny stack: PostgreSQL + OpenLDAP (konta testowe) + API + frontend.

```bash
cp .env.example .env   # raz; pliku .env nie commitujemy
docker compose up --build
```

| Usługa     | URL                                           |
| ---------- | --------------------------------------------- |
| Frontend   | http://localhost:5173                         |
| API health | http://localhost:3000/api/health              |
| Postgres   | `localhost:${POSTGRES_PORT}` (domyślnie 5432) |
| OpenLDAP   | `localhost:${LDAP_PORT}` (domyślnie 389)      |

Kontener API przy starcie uruchamia migracje Drizzle (`db:migrate`), potem NestJS.

Zatrzymanie: `Ctrl+C` albo `docker compose down`. Dane Postgresa i LDAP zostają w volume (`docker compose down -v` usuwa volume).

### Lokalny OpenLDAP (konta testowe)

Base DN: `dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl` (jak na LABS). Hasła = login. Role wynikają z grup (`member` w `ou=Groups`); backend (SCRUM-49) szuka `(member=<dn użytkownika>)` albo czyta `memberOf`, jeśli overlay jest włączony.

| Login           | Hasło (= login) | OU / DN pattern                                                        | Grupa       |
| --------------- | --------------- | ---------------------------------------------------------------------- | ----------- |
| `student1`…`5`  | `studentN`      | `cn=studentN,ou=Students,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl` | `students`  |
| `lecturer1`…`5` | `lecturerN`     | `cn=lecturerN,ou=Faculty,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl` | `lecturers` |
| `admin1`…`5`    | `adminN`        | `cn=adminN,ou=Faculty,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl`    | `admins`    |

Tylko LDAP (bez API/frontu):

```bash
docker compose up -d ldap
```

Sprawdzenie binda (albo `docker compose exec ldap …`, albo `ldap-utils` na hoście):

```bash
# bind użytkownika (hasło poprawne → Success; złe hasło → Invalid credentials)
docker compose exec ldap ldapsearch -x -H ldap://127.0.0.1:389 \
  -D 'cn=student1,ou=Students,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl' \
  -w student1 \
  -b 'cn=student1,ou=Students,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl' \
  -s base '(objectClass=*)' dn uid mail

# rola: szukaj grup, których member to DN użytkownika (tak powinien robić backend)
# hasło admina z env kontenera (LDAP_ADMIN_PASSWORD z .env), nie wpisuj na sztywno
docker compose exec ldap sh -c \
  'ldapsearch -x -H ldap://127.0.0.1:389 \
  -D cn=admin,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl -w "$LDAP_ADMIN_PASSWORD" \
  -b ou=Groups,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl \
  "(member=cn=student1,ou=Students,ou=People,dc=labs,dc=wmi,dc=amu,dc=edu,dc=pl)" cn'
```

Seed jest wbudowany w obraz (`docker/ldap/Dockerfile` + `bootstrap/50-seed.ldif`). Po zmianie seeda: `docker compose build ldap && docker compose up -d ldap` (przy zmianie danych często też `docker compose down -v`, bo volume trzyma stary katalog).

Wydziałowy LABS (`ldaps://labs.wmi.amu.edu.pl:636`) to osobne środowisko; lokalny kontener jest do codziennej pracy bez VPN/SSH. Backend (SCRUM-49): najpierw wyszukaj DN po `uid` jako admin, potem bind hasłem użytkownika, potem grupa przez `(member=<dn>)`.

### Konfiguracja LDAP w API

| Zmienna                                | Opis                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `LDAP_URL`                             | Adres serwera. Domyślnie akceptowany jest **tylko** `ldaps://`.                                             |
| `LDAP_BASE_DN`                         | Gdzie szukać użytkowników.                                                                                  |
| `LDAP_ADMIN_DN`, `LDAP_ADMIN_PASSWORD` | Konto serwisowe do wyszukiwania (na produkcji: tylko odczyt).                                               |
| `LDAP_ALLOW_INSECURE`                  | `true` pozwala na nieszyfrowane `ldap://`. **Tylko lokalnie**, dla kontenera z Compose (`LDAP_TLS=false`).  |
| `LDAP_LOGIN_ATTRIBUTE`                 | Atrybut z loginem: `uid` (lokalny OpenLDAP), w Active Directory zwykle `sAMAccountName`. Musi być unikalny. |
| `LDAP_TIMEOUT_MS`                      | Timeout połączenia i operacji (domyślnie 5000).                                                             |
| `LDAP_TLS_CA_FILE`                     | Opcjonalny plik PEM z CA serwera LDAPS (ścieżka wewnątrz kontenera `api`, montowana read-only).             |

`LDAP_ALLOW_INSECURE`:

- bez tej zmiennej (albo z wartością inną niż `true`) API odrzuca `ldap://` i logowanie kończy się błędem 503;
- przy `NODE_ENV=production` flaga jest **ignorowana** — `ldap://` jest zawsze odrzucane;
- weryfikacja certyfikatu przy `ldaps://` jest zawsze włączona i nie da się jej wyłączyć konfiguracją.

W `.env.example` jest `LDAP_ALLOW_INSECURE=true`, bo lokalny kontener działa bez TLS. Kto ma starszy `.env`, musi dopisać tę linię. Na serwerze tej zmiennej nie ustawiamy.

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
pnpm --filter @gamification/backend db:seed
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
