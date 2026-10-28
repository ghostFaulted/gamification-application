# Grywalizacja (Gamification Application)

Webowa aplikacja wspomagająca grywalizację zajęć dydaktycznych na Wydziale Matematyki i Informatyki UAM (`wmi.amu.edu.pl`).

## Główne moduły (Epiki)
1. **Zarządzanie tożsamością i integracja danych** — logowanie przez wydziałowy serwer LDAP (domena LABS), kontrola ról (`Student`, `Prowadzący`, `Administrator`) oraz import/eksport danych w formacie CSV (USOS / Moodle).
2. **Silnik grywalizacji i logiki biznesowej** — konfiguracja waluty fabularnej, rang, odznak, serii aktywności (strików) oraz przeliczanie punktów na oceny.
3. **Panel studenta i sklep (Student Dashboard & Store)** — podgląd postępów, anonimowy ranking oparty na pseudonimach i awatarach oraz wymiana waluty na bonusy.
4. **Quizy na żywo** — interaktywne quizy w czasie rzeczywistym (kod PIN / QR) z automatycznym naliczaniem punktów.
