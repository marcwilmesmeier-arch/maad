# maad – Hinweise für Claude

maad ist eine Planungs-Webanwendung (Grundstücke, Gebäude, 3D, Analyse, Export), ausgeliefert als **eine**
HTML-Datei. Diese Datei wird gebaut; bearbeitet wird der Quelltext unter `src/`.

## Grundregeln

1. **Nie `dist/maad.html` oder eine ausgelieferte `maad.html` bearbeiten.** Änderungen gehören nach `src/`
   (`src/js/NN-bereich/NNN-thema.js`, `src/styles/app.css`, `src/index.html`). Danach neu bauen.
2. **Reihenfolge ist Verhalten.** Alle Dateien unter `src/js` werden in Pfadreihenfolge zu einem einzigen
   klassischen `<script>` zusammengesetzt, ohne Module und mit einem gemeinsamen globalen Gültigkeitsbereich.
   Neue Datei = freie Nummer an der passenden Stelle. Bestehende Dateien nicht umnummerieren.
3. **Funktionen direkt ändern.** Keine Laufzeit-Umschreibungen wie `const _f = f; f = function () { … }` und kein
   `window.name = function`. Eine Funktion ist genau einmal definiert. Erweiterungen aus anderen Bereichen stehen
   darin als `// ── Erweiterung aus <datei>`.
4. **Startcode gehört in `start()`** (`src/js/29-start/010-start-projekt-oeffnen.js`). Bereichsdateien definieren
   nur Funktionen und Daten. Code, der beim Laden läuft, darf nur Werte aus derselben oder früheren Dateien benutzen.
5. **Keine leeren `catch`-Blöcke.** Bewusst ignorierte Fehler: `catch (e) { logErr(e, 'ort'); }`.
6. **Externe Skripte** nur mit exakter Version (z. B. `maplibre-gl@5.24.0`), nie `@5` oder ohne Version.

## Befehle

```bash
npm install                       # einmalig (Prettier, ESLint, Playwright)
npm run build                     # baut dist/maad.html (braucht keine Abhängigkeiten: node tools/build.mjs)
npm run format                    # Formatierung
npm run check                     # Formatierung + Lint + Rauchtest – vor jeder Auslieferung
npm run vergleich -- <alt.html>   # Verhalten alt/neu vergleichen (bei Umbauten, ca. 15 Min.)
node tools/umbenennen.mjs <alt> <neu> [--auch-strings]   # globalen Namen sicher umbenennen
```

Ohne installierten Browser: `npx playwright install chromium` oder `CHROMIUM_PATH=/pfad/zu/chrome npm test`.

## Arbeitsablauf

1. Passende Datei finden: Bereichsübersicht in `docs/ARCHITEKTUR.md`, sonst mit `grep -rn "function name(" src/js`.
2. Ändern, `npm run format`, `npm run check`. Lint-Fehler und ein roter Rauchtest werden behoben, nicht umgangen.
3. Bei größeren Umbauten vorher `dist/maad.html` sichern und danach `npm run vergleich -- <gesicherte Datei>`.
4. Ausliefern: `dist/maad.html` (an den Nutzer weitergeben, nicht im Projekt bearbeiten).
5. Neue Erkenntnisse und offene Punkte in `docs/TECHNISCHE-SCHULDEN.md` eintragen. Änderungen am Aufbau in
   `docs/ARCHITEKTUR.md` festhalten.

## Wichtige Stellen

- Zustand: `S` (`00-kern/010-kern.js`), Szene `G`/`V` (`01-modell-3d/010-szene.js`), Geodaten `GEO`.
- Menüs: Registries `BA` (Gebäude-Aktionen) und `SHP` (Zeichenformen) in `00-kern`. Neue Aktion = Eintrag dort.
- Panel rechts neu zeichnen: `rr()`. Rückgängig-Punkt: `hist()`. Werkzeug wechseln: `tool(k)`.
- Sprache in Oberfläche, Kommentaren und Commits: Deutsch.
