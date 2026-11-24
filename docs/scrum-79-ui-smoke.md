# SCRUM-79: checklista ręcznego testu UI

Krótki smoke test panelu prowadzącego (Figma: ekrany 02–06). Środowisko: `docker compose up --build`, konto prowadzącego z lokalnego LDAP (hasło = login). Przed testem musi istnieć przynajmniej jeden przedmiot — seed go nie tworzy, więc przedmiot trzeba dodać przez `POST /api/courses`.

## 02. Panel prowadzącego — lista grup (`/lecturer`)

- [ ] Po zalogowaniu prowadzący ląduje na „Moje grupy”.
- [ ] Stan pusty: komunikat „Nie masz jeszcze żadnych grup” i przycisk „Utwórz pierwszą grupę”.
- [ ] „Nowa grupa” otwiera formularz tworzenia.
- [ ] Po utworzeniu grupy karta pokazuje nazwę, przedmiot (i kod, jeśli jest), semestr i opis.
- [ ] Pusta grupa ma wezwanie „Brak studentów w grupie” i przycisk importu do tej grupy (`/lecturer/groups/:id/import`).
- [ ] „Edytuj” otwiera formularz edycji tej grupy.
- [ ] Prowadzący A nie widzi grup prowadzącego B.
- [ ] Student nie wchodzi na `/lecturer` (przekierowanie / brak dostępu).
- [ ] Przy błędzie pobierania listy widać alert i działa „Spróbuj ponownie”.

## Formularz tworzenia i edycji (SCRUM-77)

- [ ] Tworzenie: przedmiot (lista), nazwa (wymagana), semestr i opis (opcjonalne).
- [ ] Puste pole nazwy: „Podaj nazwę grupy.” — bez żądania do API.
- [ ] Brak przedmiotu: „Wybierz przedmiot.”
- [ ] „Utwórz grupę” wraca do listy; nowa grupa jest widoczna.
- [ ] Druga grupa o tej samej nazwie w tym samym przedmiocie: „Grupa o tej nazwie już istnieje w tym przedmiocie.”
- [ ] Edycja: pola są wypełnione, przedmiot jest tylko do odczytu („Przedmiotu nie można zmienić po utworzeniu grupy.”).
- [ ] „Zapisz zmiany” aktualizuje kartę na liście; „Anuluj” nic nie zapisuje.
- [ ] Nieistniejąca lub cudza grupa: komunikat o braku grupy / braku dostępu i powrót do listy.

## Import CSV do grupy

- [ ] Z karty pustej grupy: tytuł dotyczy wybranej grupy, nie ogólnego importu kont (`/import`).
- [ ] Poprawny plik CSV (kolumna `login`) dodaje studentów i pokazuje podsumowanie (dodani, nowe konta, już w grupie, błędy).
- [ ] Ponowny import tego samego pliku: nikt nowy nie zostaje dodany; raport pokazuje już obecnych w grupie.
- [ ] Błędny plik (brak kolumny `login`, złe rozszerzenie, pusty plik): błąd walidacji, bez zmian w grupie.
- [ ] Po udanym imporcie lista pokazuje liczbę studentów na karcie grupy.

## 06. Widok grupy po imporcie (SCRUM-78, PR #29)

Na `main` nie ma jeszcze osobnego widoku grupy (`/groups/:id`). Po scaleniu PR #29:

- [ ] Z karty grupy można wejść w widok grupy.
- [ ] Nagłówek: nazwa, przedmiot, semestr, liczba studentów.
- [ ] Po imporcie lista studentów jest zgodna z raportem (ekran 06).
- [ ] Stan pusty, 404 i 403 mają czytelne komunikaty.
- [ ] Import z widoku grupy odświeża listę studentów.

## Uwagi z przeglądu UI (nie blokują testów E2E)

- W interfejsie nie ma przycisku usuwania grupy, choć API ma `DELETE /api/groups/:id`.
- Górny przycisk „Import studentów z CSV” na liście grup otwiera ogólny import kont (`/import`), a nie import do wybranej grupy.
- Nie ma ekranu tworzenia przedmiotu; bez wcześniejszego `POST /api/courses` formularz grupy pokazuje prośbę o dodanie przedmiotu przez administratora.
