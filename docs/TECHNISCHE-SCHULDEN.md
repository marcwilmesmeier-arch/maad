# Technische Schulden

Stand: 28.10.2026. Priorität: **A** = Fehler im Verhalten, **B** = erschwert Änderungen, **C** = Aufräumen.

## A – Fehler, die das neue Fehlerprotokoll sichtbar gemacht hat

Diese Fehler wurden früher von leeren `catch`-Blöcken verschluckt. Sie treten beim Start auf
(siehe Ausgabe von `npm test`):

| Meldung                                                                    | Ursache (vermutet)                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Fehler in ocApply: Cannot access 'clr' before initialization`             | `patchViz` greift beim Laden auf eine `const` zu, die erst in einer späteren Datei definiert wird |
| `Fehler in demoOff: Cannot access 'GA' before initialization`              | wie oben, in `areaSelDraw`                                                                        |
| `Fehler in mkRender: Cannot read properties of undefined (reading 'skyM')` | `drTick` läuft, bevor die Darstellungs-Einstellungen angelegt sind                                |

Vorgehen: die betroffene `const` nach vorn ziehen oder den Aufruf erst nach dem Start ausführen.
Danach prüfen, ob die übersprungenen Schritte (Farben, Himmel) jetzt anders aussehen.

## B – Struktur

1. **Erweiterungsschichten zusammenführen.** Rund 130 Funktionen werden nachträglich umgeschrieben
   (`const _f = f; f = function () { … _f.apply(this, arguments) … }`), insgesamt über 220 Stellen. Funktion für
   Funktion: alle Schichten in die Originaldatei übernehmen, die Schichten löschen, mit `npm test` und von Hand
   prüfen. Mit den häufig erweiterten Funktionen anfangen: `lvis`, `drSet`, `lyRender`, `snap`, `projExtra`,
   `baDo`, `skTool`, `tool`, `rr`.
2. **Funktionen über `window.name = function` (rund 20)** durch normale Funktionsdeklarationen ersetzen. Dabei
   die `typeof name === 'function'`-Abfragen der Aufrufer entfernen. Achtung: Manche Abfragen schützen vor
   Aufrufen während des Ladens (siehe A). Erst danach umstellen.
3. **ES-Module.** Wenn 1 und 2 erledigt sind, Bereich für Bereich auf `import`/`export` umstellen (z. B. mit Vite
   und `vite-plugin-singlefile`, damit weiterhin eine Einzeldatei entsteht). Inline-`onclick` in HTML-Strings
   durch `addEventListener` ersetzen.
4. **Sprechende Namen.** Viele Namen sind Kürzel (`lop`, `sv`, `fdE`, `SGK`). Beim Bearbeiten einer Datei die
   dort definierten Namen ausschreiben. Vorher nach Vorkommen in HTML-Strings suchen.
5. **Große Dateien teilen**, z. B. `13-geometrie-und-nutzung/010-hilfen-geometrie.js` (über 2000 Zeilen).
6. **`function close()`** in `05-projekt-und-bedienung` überdeckt `window.close`. Umbenennen, dabei die Aufrufe
   aus HTML-Strings mitziehen.
7. **three.js r128** (2021) ist veraltet. Ein Update bringt API-Änderungen mit sich, dafür einen eigenen Schritt planen.

## C – Aufräumen (Lint-Hinweise, `node tools/lint.mjs --alle`)

- 74 × `==` statt `===`: einzeln prüfen, ob die Typen sicher gleich sind.
- 73 unbenutzte lokale Variablen: entfernen, wenn die Initialisierung keine Nebenwirkung hat.
- 12 × `var`: durch `let`/`const` ersetzen.
- `treePruneB()` ist eine leere Funktion (Baumzuschnitt abgeschaltet): Aufrufer entfernen oder Funktion wiederherstellen.
- Der MapTiler-Schlüssel steht im Code (`02-geodaten/010-kontextdaten.js`). Im MapTiler-Konto auf die eigene
  Domain beschränken.
