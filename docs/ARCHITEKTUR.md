# Architektur

## Laufzeitmodell

maad ist eine klassische Browser-Anwendung ohne Framework. `tools/build.mjs` setzt alle Dateien unter
`src/js` **in Pfadreihenfolge** zu einem einzigen `<script>` zusammen. Daraus folgt:

- **Ein gemeinsamer globaler Gültigkeitsbereich.** Jede Funktion und jede `const` auf oberster Ebene ist in
  allen Dateien sichtbar. Es gibt keine `import`/`export`-Anweisungen.
- **Funktionsdeklarationen gelten sofort überall** (Hoisting). `const`/`let` gelten erst ab der Zeile, in der sie
  stehen. Wer beim Laden auf eine `const` aus einer späteren Datei zugreift, löst einen `ReferenceError` aus.
- **HTML-Ereignisse rufen globale Funktionen auf**, z. B. `onclick="baDo('mv')"` in `src/index.html` oder in
  HTML-Strings im Code. Eine solche Funktion umzubenennen heißt: alle Strings mitzuändern (`grep`).
- Externe Bibliotheken kommen per CDN: three.js r128 (`THREE`, im Code meist als `T`) und MapLibre GL 5.24.0.

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
| `06-darstellung`             | Weißmodell/Schattiert/Realistisch, Sonnenstand, Himmel                            |
| `07-analyse`                 | Kennwerte, Flächen/Rauminhalte, Beschriftungen in Ansichten                       |
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

## Muster: Funktionen erweitern

Viele spätere Dateien erweitern eine bestehende Funktion, statt sie zu ändern:

```js
{
  const _tool = tool;
  tool = function (t) {
    /* zusätzliches Verhalten */
    return _tool.apply(this, arguments);
  };
}
```

Etwa 130 Funktionen sind so in bis zu sieben Schichten erweitert (z. B. `lvis`, `drSet`, `rr`, `tool`). Was eine
Funktion tatsächlich tut, ergibt sich erst aus allen Schichten in Ladereihenfolge. Zum Nachsehen:

```bash
grep -rn "^\s*tool = function\|const _[a-z]* = tool;" src/js
```

**Für neuen Code gilt:** Bestehende Funktion direkt ändern, statt eine weitere Schicht anzulegen. Die
vorhandenen Schichten werden schrittweise zusammengeführt (siehe [TECHNISCHE-SCHULDEN.md](TECHNISCHE-SCHULDEN.md)).

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
