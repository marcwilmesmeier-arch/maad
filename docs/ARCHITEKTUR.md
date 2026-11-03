# Architektur

## Laufzeitmodell

maad ist eine klassische Browser-Anwendung ohne Framework. `tools/build.mjs` setzt alle Dateien unter
`src/js` **in Pfadreihenfolge** zu einem einzigen `<script>` zusammen. Daraus folgt:

- **Ein gemeinsamer globaler Gültigkeitsbereich.** Jede Funktion und jede `const` auf oberster Ebene ist in
  allen Dateien sichtbar. Es gibt keine `import`/`export`-Anweisungen.
- **Funktionsdeklarationen gelten sofort überall** (Hoisting). `const`/`let` gelten erst ab der Zeile, in der sie
  stehen. Wer beim Laden auf eine `const` aus einer späteren Datei zugreift, löst einen `ReferenceError` aus.
  Code, der beim Laden läuft, darf deshalb nur Werte aus derselben oder früheren Dateien benutzen. Die
  Render-Schleife `loop()` startet per `requestAnimationFrame` erst nach dem Laden und darf alles benutzen.
- **HTML-Ereignisse rufen globale Funktionen auf**, z. B. `onclick="baDo('mv')"` in `src/index.html` oder in
  HTML-Strings im Code. Eine solche Funktion umzubenennen heißt: alle Strings mitzuändern (`grep`).
- Externe Bibliotheken kommen per CDN: three.js 0.187.0 (`THREE`, im Code meist als `T`) und MapLibre GL 5.24.0.
- three.js gibt es nur noch als ES-Modul. `src/index.html` lädt es deshalb in einem kleinen Modul-Skript, setzt
  `window.THREE` und führt erst danach den Programmcode (Skript `id="maadApp"`, `type="text/plain"`) als klassisches
  Skript aus. `tools/demo.mjs` sucht die Sperrstellen in genau diesem Skript.
- Aussehen wie r128: `T.ColorManagement.enabled = false`, Renderer über `rendererAlt()` mit linearer Ausgabe,
  Lichtstärken mit `LICHT` (= π) multipliziert (alles in `01-modell-3d/010-szene.js`). Neue Renderer und Lichter
  genauso anlegen. `node tools/bildvergleich.mjs <alt.html>` vergleicht das Aussehen zweier Builds pixelweise.
- Darstellung „Realistisch“ mit physikalischem Himmel, Atmosphäre und Wolken (`06-darstellung/030-himmel-atmosphaere.js`):
  Die Bibliotheken (`postprocessing`, `@takram/three-*`) sind mit `npm run vendor` zu `src/vendor/realistisch.js`
  gebündelt (eingecheckt, three.js bleibt extern) und stehen als Skript `id="maadRealLib"` in der HTML-Datei. Geladen
  werden sie erst beim ersten Einschalten (`import()` über eine Blob-Adresse); die Import-Map in `src/index.html` gibt
  ihnen dieselbe three.js-Instanz. `mkRender()` rendert dann über `atmRender()` (Nachbearbeitungskette), sonst wie
  bisher. Wolkentexturen kommen von media.githubusercontent.com (an einen Commit gebunden). Versionen ändern:
  `package.json` anpassen, `npm install`, `npm run vendor`.
- Realistisch+ (`'realp'`, teilt Einstellungen mit Realistisch über `drKey()`): maad rendert die Szene mit
  gleichmäßigem weißem Licht (Bild = Grundfarbe), beleuchtet wird in der Nachbearbeitung (AerialPerspectiveEffect,
  wie im three.js-Beispiel webgl_loader_3dtiles). Zwei Hilfsdurchgänge mit Ersatzmaterialien (`atmDurchgang`,
  übernehmen Seite und `onBeforeCompile` des Originals): Normalenbild und Schattenmaske (Alpha = maads Schatten,
  r = nachbeleuchten ja/nein). Wasser (`040-wasser-realistisch-plus.js`) spiegelt den Himmel aus einer Würfeltextur
  und ist von der Nachbeleuchtung ausgenommen. Eigene Objekte mit Sondershadern können über `userData.atmVar`
  eigene Ersatzmaterialien mitgeben.
- Tests und Werkzeuge liefern alle externen Bibliotheken über `tests/bibliotheken.mjs` lokal aus.
- Wind & Rauch (Analyse-Reiter `wi`, `07-analyse/100–150`): Strömungslöser `wiLoeser` (Gitter-Boltzmann D3Q19,
  Smagorinsky) und Teilchenausbreitung `wiAusbreitung` sind reine Rechenfunktionen. Sie laufen als Blob-Worker
  (Quelltext per `toString()`) und werden in `tests/wind.test.mjs` direkt aus der Quelldatei getestet. Einblendungen
  liegen in der Gruppe `WI_G` (nur im Reiter sichtbar, `userData.nurFarbe`); in Realistisch/Realistisch+ bewegte
  Strömungsstreifen und Rauch (`150-wind-dynamisch.js`).

## Zentrale Objekte

| Name        | Datei                                                      | Inhalt                                                                         |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `S`         | `00-kern/010-kern.js`                                      | Anwendungszustand: Gebäude (`S.bld`), Auswahl, Werkzeug, Reiter …              |
| `BA`, `SHP` | `00-kern/010-kern.js`                                      | Registries für Gebäude-Aktionen und Zeichenformen; Menüs werden daraus erzeugt |
| `V`, `G`    | `01-modell-3d/010-szene.js`                                | Kamera/Ansicht und die three.js-Gruppen der Szene                              |
| `LY`        | `01-modell-3d/030-wandflaechen.js`                         | Layer-Liste (Name, Schlüssel, sichtbar, Deckkraft)                             |
| `GEO`       | `02-geodaten/010-kontextdaten.js`                          | geladener Kartenausschnitt, Gelände, Kontextdaten                              |
| `ADM`       | `18-erweiterungen-v280-v325/110-administrationsansicht.js` | Administrations-Voreinstellungen                                               |

Häufig gebrauchte Funktionen: `$()` (getElementById), `rr()` (rechtes Panel neu zeichnen), `hist()`
(Rückgängig-Punkt setzen), `tool(k)` (Werkzeug wechseln), `logErr(e, wo)` (abgefangenen Fehler protokollieren).

## Bereiche (`src/js`)

Die Nummer bestimmt die Ladereihenfolge. Die Bereiche 00–15 sind thematisch geschnitten. Ab 16 folgt der Code
der Entstehungsgeschichte (Versionen v239 … v519). Wo eine Version ein klar abgegrenztes Modul ist, trägt der
Ordner dessen Namen, sonst `erweiterungen-vAAA-vBBB`.

| Ordner                       | Inhalt                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `00-kern`                    | Hilfsfunktionen, Fehlerprotokoll, Registries `BA`/`SHP`, Zustand `S`              |
| `01-modell-3d`               | Szene, Gebäude, Dachformen, Wandflächen, Auswahl, Layer                           |
| `02-geodaten`                | Vektorkacheln, Gelände (DGM/DOM), LoD2/LoD3-Gebäude, Bäume, ALKIS, Bebauungspläne |
| `03-startseite`              | Demokarte, Startseite, Wolken, 3D-Beschriftungen, Planungsbeispiel                |
| `04-datenquellen`            | Datenquellen je Bundesland, Einzel-Nachladen, Metalink-Download                   |
| `05-projekt-und-bedienung`   | Projekt-Assistent, Kamera, Ansichten, Interaktion, Zeichenformen                  |
| `06-darstellung`             | Weißmodell/Schattiert/Realistisch, Sonnenstand, Himmel, Atmosphäre und Wolken     |
| `07-analyse`                 | Kennwerte, Flächen/Rauminhalte, Beschriftungen, Wind & Rauch (100–150)            |
| `08-layout-pdf`              | Seitenlayout und eigener PDF-Writer                                               |
| `09-umgebung-und-flaechen`   | Rundflug, freie und eigene Flächen, Straßen, Maske                                |
| `10-excel-export`            | XLSX-Export (eigener ZIP-/Tabellen-Writer)                                        |
| `11-bearbeiten`              | Werkzeuggruppen, Abstandsflächen, Verschieben/Drehen, Kontextmenü                 |
| `12-ifc-export`              | IFC4/STEP-Export mit Prüfer                                                       |
| `13-geometrie-und-nutzung`   | Geometrie-Hilfen, Nutzungen je Geschoss                                           |
| `14-projekt-speicherstand`   | vollständiger Projekt-Speicherstand (Laden/Speichern)                             |
| `15-grundriss`               | Grundriss/Einheiten, Flächenarten, Bilanz, Explosionsansicht, Grundriss-Fenster   |
| `16-darstellung-erweitert`   | Silhouetten, Auswahlfarben, Himmelfarbe, Zeichenfang                              |
| `17-erweiterungen-v253-v280` | Analyse-Reiter, Umwelt-/Klimadaten, Risikogebiete, Legende, Dachfarben            |
| `18-erweiterungen-v280-v325` | Grün/Wasser-Shader, Layer je Darstellung, USA-Daten, Kundenzugang, Administration |
| `19-fassadendesigner`        | 2D-Fassadendesigner                                                               |
| `20-geodaten-international`  | Frankreich, Österreich                                                            |
| `21-gelaendeplanum`          | Geländeplanum, Böschungen, Baugrube, Mauern                                       |
| `22-lod200-waende`           | LOD 200: Wände und Decken aus dem Grundriss                                       |
| `23-bauteilkonfigurator`     | Bauteilkonfigurator (Wand, Decke, Dach) und LOD 300                               |
| `24-erweiterungen-v344-v436` | Fokus-Ansicht, Kamera, Vollgeschoss-Regel, Gebäudeklasse, Varianten, Layouter     |
| `25-polygon-operationen`     | Vereinigung/Differenz/Schnitt, Innenhöfe                                          |
| `26-modellier-modus`         | Modellier-Modus (Ziehen & Schieben, Teilen, Versatz, Dach bearbeiten)             |
| `27-skizze`                  | Skizzenmodus, Kantennetz, Fang                                                    |
| `28-erweiterungen-v486-v519` | Menügruppen, Bäume setzen, Import-Tab, Detailbäume                                |
| `29-start`                   | Start und Projekt öffnen                                                          |

Dateien mit der Endung `.daten.js` enthalten nur eingebettete Daten (Schrift, Bild). Sie werden weder
formatiert noch gelesen. Ändern: neu erzeugen statt von Hand bearbeiten.

## Funktionen erweitern

Früher erweiterten spätere Dateien bestehende Funktionen zur Laufzeit
(`const _tool = tool; tool = function () { … _tool.apply(this, arguments) … }`). Diese Schichten sind
zusammengeführt: Jede Funktion ist jetzt **genau einmal** definiert, an ihrem ursprünglichen Ort. Erweiterungen
aus anderen Bereichen stehen darin als markierte Abschnitte, in der Reihenfolge, in der sie laufen:

```js
function tool(t) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/070-import.js
  if (IMP.mode && t !== 'v') { … }          // läuft zuerst
  …                                          // Code der ursprünglichen Funktion
  // ── Erweiterung aus 26-modellier-modus/120-modellier.js (danach)
  skBaSync();                                // läuft zuletzt
}
```

- Wo eine Erweiterung den alten Ablauf vorzeitig mit `return` verlassen kann, steht dieser in einer sofort
  aufgerufenen Pfeilfunktion (`const r = (() => { … })();`). Danach folgt der Teil, der in jedem Fall läuft.
- Ruft eine Erweiterung die alte Fassung gezielt auf (z. B. mit anderen Argumenten), hat diese einen eigenen Namen,
  meist `<name>Basis`, und steht direkt unter der Funktion.
- In der Datei, aus der eine Erweiterung stammt, steht ein Verweis:
  `// tool(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js`.
- Neue Funktionen als normale Deklaration (`function name() {}`), nicht als `window.name = function`. Eine
  Abfrage `typeof name === 'function'` ist dann überflüssig.
- **Für neuen Code gilt:** die Funktion direkt ändern. Keine neuen Laufzeit-Umschreibungen (`f = function`).
  Ausnahme: Erweiterungen, die nur unter einer Bedingung gelten (`if (ACC) { … }` im Kundenzugang).

## Programmstart

Alle Aufrufe, die beim Laden etwas ausführen (Platzhalter-Szene, Darstellung, Reiter, Startseite …), stehen in
`start()` in `29-start/010-start-projekt-oeffnen.js` und laufen erst, wenn alle Dateien geladen sind. Neuer
Startcode gehört dorthin, nicht in die Bereichsdateien.

## Server (`server/`)

Node.js ohne externe Bibliotheken; Daten in SQLite (`node:sqlite`), Projektdateien im Datenordner.

| Datei                                                                       | Aufgabe                                                                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/server.mjs`                                                            | Start, alle Routen, Fehlerbehandlung                                                                                              |
| `src/verwaltung.mjs`                                                        | Mandanten, Nutzer, Gruppen, Protokoll – **jede Funktion prüft mit `bereich()`, ob der Handelnde den Mandanten sehen/ändern darf** |
| `src/rechte.mjs`                                                            | Rechte, Abos, Rollen; `wirksameRechte()`                                                                                          |
| `src/anmeldung.mjs`                                                         | Passwort-Anmeldung, Sitzungen, Einladungs-/Zurücksetzen-Links, Betreiber aus der Konfiguration                                    |
| `src/projekte.mjs`                                                          | Projektablage, Zugriffsstufen (`stufe()`), Freigaben, Konfliktschutz                                                              |
| `src/werkzeug.mjs`                                                          | Auslieferung des Tools je Rechte-Satz (Sperrstellen), Schlüssel, Kennung, `window.MAAD_ACC`                                       |
| `src/proxy.mjs`                                                             | Geodienst-Weiterleitung mit Schutz vor internen Zielen                                                                            |
| `src/http.mjs`, `sicherheit.mjs`, `mail.mjs`, `datenbank.mjs`, `konfig.mjs` | Grundlagen                                                                                                                        |
| `seiten/`                                                                   | Anmeldung, Passwort festlegen, Verwaltung (strenge CSP: keine Inline-Skripte, Texte nur per `textContent`)                        |
| `betrieb/`                                                                  | Installation, systemd, Caddy, Sicherung                                                                                           |

**Regeln für Änderungen am Server:**

- Neue Datenzugriffe mit Kundendaten gehören nach `verwaltung.mjs` bzw. `projekte.mjs` und prüfen den Mandanten
  (`bereich()` bzw. `stufe()`). Nie Daten nur anhand einer Kennung aus der Anfrage laden, ohne den Mandanten zu prüfen.
- Jede schreibende Route liegt hinter `schreibschutz()` (passiert zentral für alle Nicht-GET-Anfragen).
- Neue Rechte in `rechte.mjs` eintragen; sollen Funktionen des Tools ohne das Recht fehlen, in `tools/demo.mjs`
  (`SPERREN`) die Funktionsnamen ergänzen.
- Schema-Änderungen nur als neuer Eintrag am Ende von `SCHEMA` in `datenbank.mjs` (nie bestehende ändern).
- Jede neue Route bekommt einen Test in `tests/server/api.test.mjs`, Trennung zwischen Mandanten eingeschlossen.

**Zusammenspiel mit dem Tool:** Der Server setzt `window.MAAD_ACC` (`mode` `demo`/`full`, `user.role`
`betreiber`/`admin`/`nutzer`, `user.perms`). Im Tool entscheiden `accCan()` (Kundenzugang) und `ablageServer()`
(Projektablage auf dem Server statt im Browser) danach. Ohne Server (Einzeldatei) ist `ACC` `null` und alles
läuft wie bisher im Browser.

## Fehlerbehandlung

- Erwartbare Fehler (Netz, Datenquelle fehlt) dem Nutzer melden, z. B. in der Statuszeile (`gst()`).
- Ein `catch`, das bewusst nicht behandelt, ruft `logErr(e, 'ort')` auf. Das protokolliert jede Kombination aus
  Stelle und Meldung **einmal** als `[maad] Fehler in ort: …` in der Konsole. Leere `catch`-Blöcke sind
  verboten, der Lint meldet sie als Fehler.
- Der Rauchtest listet alle `[maad]`-Meldungen auf. Neue Einträge dort sind ein Hinweis auf echte Fehler.

## Arbeitsablauf

1. Datei im passenden Bereich ändern oder anlegen. Neue Datei = freie Nummer an der richtigen Stelle der Reihenfolge.
2. `npm run format`
3. `npm run check` (Formatierung, Lint, Rauchtest)
4. `dist/maad.html` ausliefern.
