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
2. **Funktionen über `window.name = function` (rund 20)** durch normale Funktionsdeklarationen ersetzen. Dabei
   die `typeof name === 'function'`-Abfragen der Aufrufer entfernen. Seit es `start()` gibt, laufen die
   meisten Aufrufe erst nach dem Laden. Trotzdem jede Abfrage einzeln prüfen.
3. **Benannte Teilfassungen auflösen.** Es gibt rund 30 Hilfsfassungen (`<name>Basis`, `<name>Stufe<n>` sowie
   übernommene Namen wie `tool0`, `l2MeshOrig`), weil eine Erweiterung die alte Fassung gezielt aufruft. Fachlich prüfen, ob sich das vereinfachen lässt.
4. **ES-Module.** Wenn 2 und 3 erledigt sind, Bereich für Bereich auf `import`/`export` umstellen (z. B. mit Vite
   und `vite-plugin-singlefile`, damit weiterhin eine Einzeldatei entsteht). Inline-`onclick` in HTML-Strings
   durch `addEventListener` ersetzen.
5. **Sprechende Namen.** Viele Namen sind Kürzel (`lop`, `sv`, `fdE`, `SGK`). Beim Bearbeiten einer Datei die
   dort definierten Namen ausschreiben. Vorher nach Vorkommen in HTML-Strings suchen.
6. **Große Dateien teilen**, z. B. `13-geometrie-und-nutzung/010-hilfen-geometrie.js` (über 2000 Zeilen).
7. **`function close()`** in `05-projekt-und-bedienung` überdeckt `window.close`. Umbenennen, dabei die Aufrufe
   aus HTML-Strings mitziehen.
8. **three.js r128** (2021) ist veraltet. Ein Update bringt API-Änderungen mit sich, dafür einen eigenen Schritt planen.

## C – Aufräumen (Lint-Hinweise, `node tools/lint.mjs --alle`)

- 74 × `==` statt `===`: einzeln prüfen, ob die Typen sicher gleich sind.
- 73 unbenutzte lokale Variablen: entfernen, wenn die Initialisierung keine Nebenwirkung hat.
- 11 × `var`: durch `let`/`const` ersetzen.
- `treePruneB()` ist eine leere Funktion (Baumzuschnitt abgeschaltet): Aufrufer entfernen oder Funktion wiederherstellen.
- Der MapTiler-Schlüssel steht im Code (`02-geodaten/010-kontextdaten.js`). Im MapTiler-Konto auf die eigene
  Domain beschränken.
