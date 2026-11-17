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
  und ist von der Nachbeleuchtung ausgenommen; Tiefenversatz (`polygonOffset` −4/−8) in allen Durchgängen wie beim
  Wasser in Realistisch, sonst sticht das Gelände in der Ferne durch. Eigene Objekte mit Sondershadern können über `userData.atmVar`
  eigene Ersatzmaterialien mitgeben.
- Wohnungsmix (`15-grundriss/055-wohnungsmix.js`, aus v545 zurückgeholt): Wohnungstypen = Flächenarten mit Nutzung
  Wohnen (ohne die allgemeine, `df`). Einstellung im Fenster „Flächenarten“ (`wmxEinstellungHtml`, aufgerufen in
  `grFaHtml`), Auswertung in Gebäudemetrik → Einheiten (`wmxHtml`, aufgerufen in `zoRender`). `S.wmx` {p Vorlage,
  m Anteil % je Flächenart, s Zielgröße m² je Flächenart} wird mit dem Projekt gespeichert (ältere Projekte: aus
  `S.gen.cat.Wohnen` des früheren Generators). Ist aus den Grundriss-Einheiten, ohne Einheiten Schätzung aus BGF
  Wohnen × 75 %.
- Öffnungen (Fenster, Türen): Katalog `S.oet` (`19-fassadendesigner/090-oeffnungen.js`, mit dem Projekt gespeichert),
  bearbeitet im Konfigurator (`095-konfigurator.js`, eigenes Fenster: Name, Maße, Brüstung, Rahmenfarbe, Aufteilung –
  zeichnerisch: Werkzeuge Senkrecht teilen (Pfosten), Waagerecht teilen (Ober-/Unterlicht), Felder als Fenster oder
  Paneel in Rahmenfarbe).
  Einteilung einheitlich über `oeAufteilung(T)` (Stege und Felder) für Ansicht, Symbol und 3D. Gesetzte Öffnungen in
  `b.fd[Ansicht].oe = [{id, t, u, v, q}]` (Ansichtskoordinaten; q = Herkunft, heute 'frei'); alle Verbraucher lesen über
  `oeListe(b, V)` – dort kommen später automatisch platzierte Öffnungsgruppen dazu. 3D nur ab LOD 200
  (`22-lod200-waende/100-oeffnungen-3d.js`): `oeWelt` rechnet in Weltkoordinaten um, `oeWandOeffnungen` ordnet jede
  Öffnung genau einer Außenwand zu, `oeWandTeilen` teilt die Wand in Streifen (echte Laibungen), `oeKoerper` baut Rahmen,
  Glas (weiß, 80 % durchsichtig), Paneele und Sprossen (keine Fensterbank). Grundriss LOD 200: `oeGrundriss` (aus
  `l2Draw`) mit derselben Zuordnung – geschnittene Öffnungen (Schnitthöhe `S.gro.sh`) ausgespart mit Laibung,
  Rahmen, Glas bzw. Türblatt mit Aufschlag, höhere gestrichelt; Rück-/Vorsprünge ändern die Wandkontur. Die Wandableitung (`l2Els`) ignoriert `oe`/`gr`.
- Öffnungsgruppen (`097-oeffnungsgruppen.js`, Konfigurator-Reiter `098-konfigurator-gruppen.js`): Bibliothek `S.oeg`
  (Länge, Höhe, Öffnungen mit Lage), an der Fassade nur Verweise `b.fd[Ansicht].gr = [{id, g, u, v}]`. `oeListe`
  erzeugt daraus die Öffnungen (q = Verweis) – eine geänderte Gruppe ändert alle Stellen. Fassadendesigner: Werkzeug
  „Gruppe“ (setzen, ziehen, tauschen), „Gewählte Felder füllen“ (je Geschoss, Rest gleichmäßig an den Enden).
  „Fensterhöhe über festen Sturz“ (`G.sz = {an, s}`): `oegTyp` liefert je Verweis die Fensterhöhe bis s unter die
  Geschossoberkante (Geschosshöhe aus `fdStoreys`), Türen/Tore unverändert. Flächen der Gruppe: Teilungslinien `G.xs`/`G.ys` (zeichnerisch im Konfigurator oder „An Fenstern teilen“), Felder
  `G.fe = [{p, d, k, t}]` mit Tiefe (positiv zurück, negativ vor), Verlauf k (gleichmäßig oder schräg: eine Seite
  bündig) und Material; `G.t` = Material der Gruppe. `oegFlaechenG` fasst gleiche Felder zu Rechtecken zusammen
  (dl/dr = Tiefe links/rechts). LOD 200: `oeWandOeffnungen` (ra/re) → Wand ausgespart, `oeRuecksprungKoerper` schließt
  mit (schräger) Fläche bzw. Vorsprungkörper; Fassadenfarbe: Felder in ihrer Tiefe, Seitenflächen nur an Kanten mit
  Tiefenunterschied, Aussparungen über `ftVereinigung` vereinigt. Alte `G.rs` werden beim Laden übernommen.
- Fassadendesigner-Oberfläche (`19-fassadendesigner/030`, `060`): unten angedockt (Höhe am Griff, `maad.fdH`),
  Kopf mit Ansichten als Reitern, Werkzeugleiste (Auswählen V, Teilen T mit Linie/Rechteck/Geschoss, Öffnung O,
  Gruppe G), Optionsleiste über der Zeichnung, Inspektor `fdInspektor` (zeigt nur das Gewählte bzw. die Bibliothek des
  Werkzeugs), Fußleiste mit Hinweis und Kennwerten. Esc führt stufenweise zurück zu „Auswählen“. Zahlenfelder
  `fdZahl` (Einheit im Feld, Komma, Pfeiltasten).
- Fassadentypen in 3D (`110-fassadentypen-3d.js`, derzeit abgeschaltet: `FT3.aktiv = false`): nur ab LOD 200 (LOD 100: nur Auswertung). Ebene „Fassadentypen“
  (`G.fdt`), farbige Flächen 4 cm vor der Außenwand mit ausgesparten Öffnungen, Laibungen in derselben Farbe
  (senkrecht zur tatsächlichen Wand); `ftSync` im Takt von `l2Vis`, je Gebäude nur bei Änderung neu.
- Gebäudekonfigurator (`19-fassadendesigner/120-gebaeudekonfigurator.js`, Karte „Fassade“ im Gebäudepanel): Stapel
  `b.fk.st` (Gruppe je Geschoss ab EG, oberste gilt darüber), Abweichungen `b.fk.ab` ('Ansicht|Geschoss', 'Ansicht|_',
  '_|Geschoss'). `fkSync` (Takt von `l2Vis`) platziert bei Änderung automatisch Verweise mit `a: 1` in allen Feldern
  aller Ansichten; von Hand verschobene/getauschte Verweise verlieren `a` und bleiben erhalten. `b.fk` wird wie `b.fd`
  in Rückgängig, Speicherstand und Modellier-Modus mitgeführt.
- Tests und Werkzeuge liefern alle externen Bibliotheken über `tests/bibliotheken.mjs` lokal aus.
- Wind & Rauch (Analyse-Reiter `wi`, `07-analyse/100–150`): Strömungslöser `wiLoeser` (Gitter-Boltzmann D3Q19,
  Smagorinsky) und Teilchenausbreitung `wiAusbreitung` sind reine Rechenfunktionen. Sie laufen als Blob-Worker
  (Quelltext per `toString()`) und werden in `tests/wind.test.mjs` direkt aus der Quelldatei getestet. Einblendungen
  liegen in der Gruppe `WI_G` (nur im Reiter sichtbar, `userData.nurFarbe`); Stromlinien mit Lichtpulsen
  (`wiPulsMaterial`, Ebenen „Windlinien“/„Windlinien – Pulse“), bewegter Rauch (`150-wind-dynamisch.js`). „Berechnen“
  öffnet die Analyseansicht (`AV`, Weißmodell, Leiste unten; „Schließen“ stellt die Darstellung wieder her).
  Gespeicherte Analysen (`S.analysen`, `160-analyse-ansicht-speichern.js`) hängen an einer Variante (`varId`), stehen
  im Reiter „Varianten“ und werden mit dem Projekt gespeichert; „veraltet“ über den Vergleich mit `vSig()`.
- Site & Context (Analyse-Reiter `sc`, `07-analyse/170-site-context.js`): Landmarks und Plätze per Overpass aus OSM
  (`scLaden`, gewichtet nach Wikidata/Wikipedia, Denkmal, Art). Landmark-Gebäude in Akzentfarbe über `scPaint()` (aus
  `rfUp()`), Nummernmarker in `SC_G` (= `G.scl`, Ebene „Landmarks“), Plätze als Karten-Ebene `scp` im Geländebild,
  Legende über `LGD`. Ergebnis wird mit dem Projekt gespeichert (`x.sc`).
- Erreichbarkeit (Analyse-Reiter `er`): Rechnung browserfrei in `180-erreichbarkeit-rechnen.js` (`erNetz`, `erZeiten`
  ab allen Grundstücksecken, `erRaster` mit begrenztem Weg abseits des Netzes; Test `tests/erreichbarkeit.test.mjs`),
  Abruf und Darstellung in `190-erreichbarkeit.js`: Bodenbild als Karten-Ebene `erg` (Bild-Element in `ovRepaint`),
  Gebäude über `erPaint()` aus `rfUp()`, Haltestellen-Symbole in `ER_G` (= `G.erh`). Sprite-Größe in 2D über
  `spriteFesteGroesse()` (170-site-context.js).
- Symbole: `185-symbole.js` (Satz „Mobility & Access“ für Erreichbarkeit: SVG, Glyphe, Canvas-Textur) und
  `186-symbole-bibliothek.js` (120 Symbole in vier Gruppen wie auf der Symboltafel, je 24 Symbole + 6 Füllungen;
  Schlüssel „gruppe:name“ bzw. „gruppe:f:art“). `symPfadLinien()` zerlegt SVG-Pfade in Linienzüge, damit
  `anSym()` sie wie die übrigen Beschriftungen in Ansicht, Layout und PDF als Vektor ausgibt.
- Sonnenstunden (Analyse-Reiter `so`, `07-analyse/200-sonnenstunden.js`): je Zeitschritt ein Tiefenbild aus
  Sonnenrichtung (`soTiefenbild`, Parallelprojektion, `MeshDepthMaterial` in Float-Rendertarget, Auslesen auf die CPU),
  Schattentest je Messpunkt (`soZaehlen`). Messpunkte: Außenflächen der Planungsgebäude (unterteilt, Innen-/Unterseiten
  und Untergeschosse entfernt; Haut in `SO_G` = `G.son`) und Boden im Umkreis (Karten-Ebene `son`, Bild mit Bereich
  `it.b` in `ovRepaint`). Analysepunkte (`SO.punkte`) mit Zeitfenstern.
  Analysebereich ist ein Kreis (Radius, platziert wie in Forma), gerechnet wird im Quadrat mit 40 m Rand. Windklima
  des Standorts (`125-windklima.js`, Bright Sky/DWD) bestimmt die Länge der Sektoren der Windrose und die Vorwahl.

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

| Ordner                       | Inhalt                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `00-kern`                    | Hilfsfunktionen, Fehlerprotokoll, Registries `BA`/`SHP`, Zustand `S`                                   |
| `01-modell-3d`               | Szene, Gebäude, Dachformen, Wandflächen, Auswahl, Layer                                                |
| `02-geodaten`                | Vektorkacheln, Gelände (DGM/DOM), LoD2/LoD3-Gebäude, Bäume, ALKIS, Bebauungspläne                      |
| `03-startseite`              | Demokarte, Startseite, Wolken, 3D-Beschriftungen, Planungsbeispiel                                     |
| `04-datenquellen`            | Datenquellen je Bundesland, Einzel-Nachladen, Metalink-Download                                        |
| `05-projekt-und-bedienung`   | Projekt-Assistent, Kamera, Ansichten, Interaktion, Zeichenformen                                       |
| `06-darstellung`             | Weißmodell/Schattiert/Realistisch, Sonnenstand, Himmel, Atmosphäre und Wolken                          |
| `07-analyse`                 | Kennwerte, Flächen/Rauminhalte, Beschriftungen, Wind & Rauch (100–150)                                 |
| `08-layout-pdf`              | Seitenlayout und eigener PDF-Writer                                                                    |
| `09-umgebung-und-flaechen`   | Rundflug, freie und eigene Flächen, Straßen, Maske                                                     |
| `10-excel-export`            | XLSX-Export (eigener ZIP-/Tabellen-Writer)                                                             |
| `11-bearbeiten`              | Werkzeuggruppen, Abstandsflächen, Verschieben/Drehen, Kontextmenü                                      |
| `12-ifc-export`              | IFC4/STEP-Export mit Prüfer                                                                            |
| `13-geometrie-und-nutzung`   | Geometrie-Hilfen, Nutzungen je Geschoss                                                                |
| `14-projekt-speicherstand`   | vollständiger Projekt-Speicherstand (Laden/Speichern)                                                  |
| `15-grundriss`               | Grundriss/Einheiten, Flächenarten, Bilanz, Explosionsansicht, Grundriss-Fenster                        |
| `16-darstellung-erweitert`   | Silhouetten, Auswahlfarben, Himmelfarbe, Zeichenfang                                                   |
| `17-erweiterungen-v253-v280` | Analyse-Reiter, Umwelt-/Klimadaten, Risikogebiete, Legende, Dachfarben                                 |
| `18-erweiterungen-v280-v325` | Grün/Wasser-Shader, Layer je Darstellung, USA-Daten, Kundenzugang, Administration                      |
| `19-fassadendesigner`        | 2D-Fassadendesigner                                                                                    |
| `20-geodaten-international`  | Frankreich, Österreich                                                                                 |
| `21-gelaendeplanum`          | Geländeplanum, Böschungen, Baugrube, Mauern                                                            |
| `22-lod200-waende`           | LOD 200: Wände und Decken aus dem Grundriss                                                            |
| `23-bauteilkonfigurator`     | Bauteilkonfigurator (Wand, Decke, Dach) und LOD 300                                                    |
| `24-erweiterungen-v344-v436` | Fokus-Ansicht, Kamera, Vollgeschoss-Regel, Gebäudeklasse, Varianten, Layouter                          |
| `25-polygon-operationen`     | Vereinigung/Differenz/Schnitt, Innenhöfe                                                               |
| `26-modellier-modus`         | Modellier-Modus (Ziehen & Schieben, Teilen, Versatz, Dach bearbeiten, Auswahlfilter und Kontextleiste) |
| `27-skizze`                  | Skizzenmodus, Kantennetz, Fang                                                                         |
| `28-erweiterungen-v486-v519` | Menügruppen, Bäume setzen, Import-Tab, Detailbäume                                                     |
| `29-start`                   | Start und Projekt öffnen                                                                               |

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

## Modellieren: Auswahlmatrix und Kontextleiste

`26-modellier-modus/140-kontextleiste.js` legt fest, was ein Klick wählt und welche Aktionen dazu angeboten werden:

- `SK.flt` ist der Auswahlfilter: `a` Auto, `g` Gebäude, `s` Geschoss, `f` Fläche, `r` Flucht. Die Chips stehen unten
  in der 3D-Ansicht (`#skflt`). Ist von einem Gebäude noch nichts gewählt, wählt der erste Klick immer das ganze
  Gebäude. Erst weitere Klicks in dasselbe Gebäude folgen dem Filter. Bei Auto wählt ein weiterer Klick die Fläche;
  Doppel-, Dreifach- und Vierfachklick bleiben erhalten.
- `skKlickListe(en, n, m)` liefert die Auswahl für einen Klick und wird auch für die Hover-Vorschau genutzt
  (`skHoverListe`). So zeigt der Hover immer genau das, was der Klick oder das Werkzeug trifft.
- `skAuswTyp()` ordnet die Auswahl einer Zeile der Matrix zu (`g`, `s`, `f`, `r`, `d`, `tf`, `hof`, `m`). `SKKL`
  enthält je Zeile die angebotenen Aktionen (BA-Schlüssel und `h` für die Geschosshöhe, `bst` für „Bestand
  ausblenden“).
- `skKontext()` zeichnet die Kontextleiste `#skkl` über der Auswahl. Sie wird aus `placeHc` aufgerufen, also jedes
  Bild. Der Inhalt wird nur neu gebaut, wenn sich die Auswahl ändert.
- Farben der Hervorhebung stehen in `SKC`, Orange und damit unabhängig von der Nutzungsfarbe. Kanten liegen obenauf.
  Ein ganz gewähltes Gebäude ist nur leicht getönt.
- Fassadengruppen aus der Kontextleiste (`skKlGruppen`): Am Gebäude ist es die Grundeinstellung (`b.fk.st`, eine
  Zeile für alle Geschosse). Geschoss, Wand und Flucht bekommen eine eigene Anordnung als Abweichung
  (`b.fk.ab['Seite|Geschoss']` mit Rhythmus als Liste, Ausrichtung in `b.fk.auA` mit demselben Schlüssel, ausgewertet
  in `fkAusr`). Abweichungen bleiben bestehen, wenn sich die Grundeinstellung ändert. Das Fenster ist `#fkWahl` des
  Gebäudekonfigurators (`fkWahlEl`).
- Schneiden (`skx`, Modus `SK.schnitt` des Werkzeugs Teilen): Der Schnitt läuft senkrecht zur angeklickten Wand rund
  ums Gebäude (Fassade, Dach, Fassade). `skSchnittDo` teilt jedes Geschoss mit `szSplitPoly` und legt den zweiten Teil
  als eigenes Gebäude an (`skCloneB`).
- Seitenecken (`26-modellier-modus/150-ecken.js`): Im Auswahl-Werkzeug ist ein Klick nahe einer senkrechten Ecke der
  Eintrag `{ b, j, ek }`. `skEckGruppe` bildet daraus die Konturflucht über alle Geschosse. Eine gewählte Ecke
  anfassen und ziehen ist der Vorgang `SK.op.kind === 'e'` (Fang auf die Richtungen der angrenzenden Wände).
  `skEckRunden(r)` ersetzt die Ecke durch einen Bogen.
- Nach jeder abgeschlossenen Aktion (Ziehen, Verschieben, Teilen, Schneiden, Ecke) ruft maad `skNachAktion(b)` auf:
  zurück ins Auswahl-Werkzeug, das Gebäude bleibt gewählt. Die alten weißen Kugelgriffe, die weiße Hover-Kontur und
  der Fang-Marker sind im Auswahl-Werkzeug ausgeblendet.
- LOD-200-Außenkontur (`22-lod200-waende/110-aussenkontur.js`): `l2KonturPunkte(b)` berechnet aus den Grundrissen nur
  die echten Außenkanten. Das sind Ecken über 20° Knick, Fuß, Dachrand, Auskragungen und Rücksprünge zwischen den
  Geschossen sowie die Dachkanten geneigter Dächer. Unterteilungen von Wänden und Decken sind nicht dabei. Die Linien
  sind `kont`-Linien (Layer „Gebäudekontur“, unabhängig von der „Fetten Außenkontur“). Die fette Kontur ist wie bei Umgebungsgebäuden nur die Silhouette. `l2KonturSil(cm)` (aus `konPre`) sucht je Bild
  die Kanten, an denen eine angrenzende Fläche zur Kamera und die andere weg zeigt. Diese werden als breite Linie leicht
  hinter dem Gebäude gezeichnet. Eine Hülle schiene durch die Fensterlöcher.

## Konfigurator: feldweise Teilungen

- Fenster und Türen: `T.ut` enthält je oberstem Feld (Flügel `0…`, `ol`, `ul`) einen Teilungsbaum. Ein Knoten ist
  `{ a: 'x'|'y', r: Lage 0–1, k: [Kind, Kind] }`, ein Blatt `{ fu: 'g'|'p' }`. `oeAufteilung` liefert weiterhin
  `felder` und `stege`, dazu `oben` (oberste Felder für Flügelbreiten und Pfosten) und `ns` (ziehbare Stege der
  Unterteilungen). Teilfelder heißen `oben.pfad`. „Senkrecht/Waagerecht teilen“ teilt nur das angeklickte Feld
  (`okFeldTeilen`).
- Gruppen: `G.vb` enthält verbundene Felder als Rechtecke auf Teilungslinien. `oegZellen` fasst die Rasterfelder
  darin zu einem Feld zusammen. Eine Teilung anklicken wählt nur das Stück zwischen zwei Feldern, Entf verbindet sie
  (`okGrSegmentLoeschen`). „Ganze Linie entfernen“, „Felder verbinden“ und „Verbindung lösen“ ergänzen das.
- Gruppen lassen sich auch über das × in der Liste löschen. Dabei werden Verweise und die Gebäudekonfiguration
  (`b.fk`) bereinigt.

## LOD 200: Innenhöfe

`l2Els` (`22-lod200-waende/020-ableitung…`) spart Innenhöfe (`b.voids`, `znVoidsAt`) aus der Geschossdecke aus, wenn
der Hof über dem Geschoss weiterläuft oder es das oberste Geschoss ist (offen zum Himmel). Die Decke unter dem
untersten Hofgeschoss bleibt als Hofboden. Beginnt der Hof im untersten Geschoss, fehlt dort auch die Bodenplatte.

## Gebäudekonfigurator: Material je Geschoss und Versatz

- Karte „Fassade“ (Planen): Stapel der Öffnungsgruppen mit Ausrichtung und Versatz je Zeile (`b.fk.vs`, m). Darunter
  liegt der Stapel „Fassadenmaterial je Geschoss“ (`b.fk.mt`, Fassadentyp je Geschoss, die oberste Zeile gilt darüber).
  Ausrichtung je Seite und Abweichungen sind nicht mehr in der Karte; Abweichungen setzt man im Modell (Kontextleiste
  „Gruppen“, mit Versatz in `b.fk.vsA`).
- Versatz (`fkVersatz`): Links bzw. rechts ist er der Abstand vom Rand, positiv nach innen. Mittig ist er eine
  Verschiebung, positiv nach rechts.
- Material je Geschoss ist die Voreinstellung für Ansichtsflächen ohne eigenen Fassadentyp. Es wird in der
  Fassadenansicht geschossweise gezeichnet und in `fdStats` anteilig gezählt (`fkMaterialAnteile`).
- Außenwandstärke in der Karte „Fassade“ (`fkWandstaerke`): setzt `b.l2.c.AW` (Standardstärke LOD 200 wie im
  Bauteilkonfigurator) und setzt Einzelwerte der Außenwände zurück.

## LOD 200: Terrassen

`l2Els` gibt Außenwänden ohne Geschoss darüber (mindestens 3 von 5 Prüfpunkten frei) eine Attika (`r.hAt = 0,30 m`)
und `r.gel`. `l2Gelaender(e)` (030-aktionen) setzt darauf ein Stabgeländer (innen vor der Attika, Stäbe alle 0,24 m, Fußleiste, Handlauf, Oberkante
1,00 m über der Geschossoberkante). Die LOD-200-Außenkontur hebt Terrassenränder und -ecken um die Attika an.

## LOD 200: Innenlicht

`22-lod200-waende/120-innenlicht.js`: `l2InnenMarkieren` (aus `l2MeshOrig`) markiert je Dreieck Flächen, die ins
Gebäudeinnere zeigen. Dazu geht es einen Schritt (0,60 m) entlang der Normalen und prüft mit `l2ImGebaeude`, ob der
Punkt im Geschoss liegt (nicht im Innenhof, mindestens 0,45 m vom Rand). Das Ergebnis steht im Attribut `aInnen`. Im
Material wird dort das Himmels- und Umgebungslicht (`irradiance`) auf `L2IN.k` (30 %) reduziert. Die Sonne bleibt
voll, so wird das Licht sichtbar, das durch die Fenster fällt.

## Balkone und Loggien

- In den Öffnungsgruppen haben Felder eine Art `a` (Konfigurator › Gruppen › Feld › „Art“): `''` Fläche, `'lo'`
  Loggia, `'ba'` Balkon. Gezeichnet wird wie bei Rücksprüngen: teilen, Feld wählen, Art und Tiefe setzen.
- Eine Loggia ist ein Rücksprung um `d` (Wandaussparung wie bisher) mit Geländer in der Fassadenebene.
- Bei einem Balkon ist `d` die Auskragung (`tb` in `oegFlaechen`); die Wand bleibt bündig.
- In den Ansichten zeichnet `oegArtZeichnen` das Symbol: Geländer 1,00 m, beim Balkon die Platte.
- In LOD 200 baut `22-lod200-waende/130-balkone.js` (`l2Balkone`, Takt aus 030-aktionen) je Gebäude die Platten
  (0,20 m) und die Stabgeländer (`l2Stabgelaender`).

## Zugänglichkeit

`16-darstellung-erweitert/060-zugaenglichkeit.js` (`uiZugang`, aus `start()`) beschriftet Symbol-Buttons mit ihrem
`title` als `aria-label`. Anklickbare `div`/`span` macht es per Tastatur bedienbar (`role="button"`, `tabindex`,
Enter/Leertaste). Ein MutationObserver erfasst auch alles, was die Panels später neu zeichnen. Die CSS liefert einen
sichtbaren Tastaturfokus, `color-scheme` und reduzierte Bewegung.
