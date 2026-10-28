# Technische Schulden

Stand: 28.10.2026. Priorität: **A** = Fehler im Verhalten, **B** = erschwert Änderungen, **C** = Aufräumen.

## A – Fehler im Verhalten

Derzeit keine bekannten. Erledigt am 28.10.2026: vier Startfehler (Zugriff auf `clr`, `GA`, `DR` und `IDLE`,
bevor sie angelegt waren), siehe Git-Verlauf. Der Rauchtest schlägt jetzt bei solchen Fehlern fehl.

## B – Struktur

1. ~~Erweiterungsschichten zusammenführen~~ – erledigt am 28.10.2026 (126 Funktionen, 219 Schichten; Startcode
   nach `start()` verlegt). Übrig sind bewusst bedingte Erweiterungen im Kundenzugang
   (`18-…/100-kundenzugang.js`, nur aktiv mit `window.MAAD_ACC`) sowie die Haken-Variablen `layersHtml` und
   `homeHook`.
2. ~~Funktionen über `window.name = function`~~ – erledigt am 28.10.2026: 18 Funktionen sind normale
   Deklarationen, das Datenebenen-Modul ist nicht mehr in einer IIFE gekapselt, 44 überflüssige
   `typeof name === 'function'`-Abfragen sind entfernt. Bewusst auf `window` bleiben `lotAccent`/`lotFx`
   (Konsolen-Schnittstelle). Übrige `typeof`-Abfragen betreffen `const`-Funktionen oder lokale Werte.
3. **Benannte Teilfassungen auflösen.** Es gibt rund 30 Hilfsfassungen (`<name>Basis`, `<name>Stufe<n>` sowie
   übernommene Namen wie `tool0`, `l2MeshOrig`), weil eine Erweiterung die alte Fassung gezielt aufruft. Fachlich prüfen, ob sich das vereinfachen lässt.
4. **ES-Module.** Wenn 3 erledigt ist, Bereich für Bereich auf `import`/`export` umstellen (z. B. mit Vite
   und `vite-plugin-singlefile`, damit weiterhin eine Einzeldatei entsteht). Inline-`onclick` in HTML-Strings
   durch `addEventListener` ersetzen.
5. **Sprechende Namen.** Viele Namen sind Kürzel (`lop`, `sv`, `fdE`, `SGK`). Beim Bearbeiten einer Datei die
   dort definierten Namen ausschreiben, mit `node tools/umbenennen.mjs <alt> <neu>`. Das Werkzeug ändert nur echte
   Bezüge und meldet Vorkommen in HTML-Strings (`onclick="…"`); diese mit `--auch-strings` mitändern.
6. **Große Dateien teilen**, z. B. `13-geometrie-und-nutzung/010-hilfen-geometrie.js` (über 2000 Zeilen).
7. ~~`function close()` überdeckt `window.close`~~ – erledigt am 28.10.2026: heißt jetzt `draftClose()`.
   Für weitere Umbenennungen: `node tools/umbenennen.mjs <alt> <neu>` (siehe Punkt 5).
8. **three.js r128** (2021) ist veraltet. Ein Update bringt API-Änderungen mit sich, dafür einen eigenen Schritt planen.

## C – Aufräumen (Lint-Hinweise, `node tools/lint.mjs --alle`)

Erledigt am 28.10.2026: 70 × `==` → `===`, 49 unbenutzte Variablen entfernt, 8 × `var` → `let`/`const`.

- 3 × `==` bleiben bewusst: `x.j == k` (`26-modellier-modus/030-leiste.js`, Schlüssel ist Text), `e[k] == v`
  (Auswahllisten im Layout-Panel, Text gegen Zahl) und `k == b.levels.length - 1` (`05-…/030-mini.js`, Typ von
  `k` nicht eindeutig).
- 3 × `var` bleiben bewusst (`SK`, `SKLN`, `SZ` in `26-modellier-modus`): werden aus früheren Dateien schon vor
  ihrer Definition gelesen (dann `undefined`); mit `let`/`const` wäre das ein Fehler.
- 23 unbenutzte Variablen bleiben: Sie werden später noch zugewiesen (`pages++`, `moved = …`) oder stehen mit
  einem Funktionsaufruf in einer Mehrfachdeklaration. Einzeln prüfen.
- In der Bilanz-/Mengenausgabe wird ein Abschnitt mit `zoD(…)` erzeugt, aber nie angezeigt (früher Variable
  `fl`). Fachlich klären: vergessen oder absichtlich ausgeblendet?
- `treePruneB()` ist eine leere Funktion (Baumzuschnitt abgeschaltet): Aufrufer entfernen oder Funktion wiederherstellen.
- Der MapTiler-Schlüssel steht im Code (`02-geodaten/010-kontextdaten.js`). Im MapTiler-Konto auf die eigene
  Domain beschränken.
