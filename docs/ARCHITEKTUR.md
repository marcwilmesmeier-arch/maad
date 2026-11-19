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
- Fassadentypen in 3D (`110-fassadentypen-3d.js`, eingeschaltet: `FT3.aktiv = true`, mit Schraffur): nur ab LOD 200 (LOD 100: nur Auswertung). Ebene „Fassadentypen“
  (`G.fdt`), farbige Flächen 4 cm vor der Außenwand mit ausgesparten Öffnungen, Laibungen in derselben Farbe
  (senkrecht zur tatsächlichen Wand); `ftSync` im Takt von `l2Vis`, je Gebäude nur bei Änderung neu.
- LOD-200-Zeichnung (`22-lod200-waende/140-zeichnung.js`, Schalter `S.l2zs` in der LOD-Leiste, mit dem Projekt
  gespeichert): Kantenlinien des geplanten Gebäudes im Bild – G.l2 allein als Normalen- und Tiefenbild, danach ein
  bildschirmfüllendes Rechteck mit Kantenerkennung (Knick > ~25°, Tiefensprung), das seine Tiefe schreibt und so von
  Umgebung und Gelände verdeckt wird. Aufruf in `mkRender` nach dem Hauptbild; nicht in Realistisch+.
- Vorgaben Raster-Fassade: Typen `r3` (Rasterfenster 3-teilig), `sf` (Schaufenster EG), `gt` (Glastür mit Oberlicht),
  Gruppen `g5`–`g7` (1,80 m).
- Innenhöfe in den Fassadenansichten: `fdPieces` nimmt die Hofwände (`b.voids`, Normale in den Hof) mit `hof` auf,
  `fdViews` bildet je Hof und Richtung eigene Ansichten (Schlüssel `H1N` …, Name „Innenhof 1 · Nord“), verdeckt nur
  durch Wände desselben Hofs. Gruppen, Fassadendesigner und LOD-200-Öffnungen gelten damit auch dort; in der
  Kontextleiste wählt `skKlHofAnsicht` die Hofansicht einer Hofwand (Abschnitt wie eine Flucht).
- Navigationswürfel (`16-darstellung-erweitert/070-navigationswuerfel.js`, Start in `start()`): CSS-3D-Würfel unten
  rechts (nur 3D), Seiten O/V/R/H/L (Oben, Vorne = Süd, Rechts = Ost …), Kompassring N/O/S/W. Klick = Kamerafahrt über
  `S.vanim`, Rand einer Seite = Kante/Ecke, Ziehen = drehen.
- Schnittlinien (Punkte auf gerader Wand, `skSchnittPunkt` in `26-modellier-modus/150-ecken.js`) sind wie Ecken wählbar
  und ziehbar; „Schnitt entfernen“ (`skSchnittWeg`) nimmt sie aus den Grundrissen.
- Loggien als Grundriss-Einschnitt (LOD 200, `oeWelt` → `LG`, `oeLoggiaEinschnitte`): Rücksprünge ab Geschossboden
  (Art Loggia, Balkon + Loggia oder tiefer als 0,5 m) schneiden in `l2GeoStufe1` die Raumflächen des Geschosses aus
  (`oeFlaechenKappen`, Umriss `lv.fp` und Decken bleiben). So entstehen echte Außenwände in normaler Stärke, wählbar
  und mit Innenwänden verbunden; Fenster in der Loggia werden auf die Rückwand versetzt; Loggia-Wände (`r.lg`) ohne
  Attika; Sturz über niedrigeren Loggien in `l2Balkone`; im Grundriss wird die Loggiafläche freigestellt. Der frühere
  Rücksprungkörper (`oeLoggia`) gilt nur noch für tiefe Nischen, die nicht am Boden beginnen.
- Loggien in LOD 200 (`22-lod200-waende/100-oeffnungen-3d.js`): Rücksprünge tiefer als die Wand (`oeLoggia`) bekommen
  Rückwand und Seitenwände in Außenwandstärke statt eines vollen Körpers; Fenster darin messen Einbautiefe und Laibung
  an der Rückwand (`oeInnenseite`). Rück- und Seitenwände werden an den Loggia-Räumen des ganzen Gebäudes beschnitten
  (`oeLoggiaBeschnitt`, Ecken). Feldtiefen bis ±3 m.
- Feldart „Balkon + Loggia“ (`a: 'bl'`): Rücksprung `d` wie eine Loggia (Wandableitung) und Auskragung `tb` der
  Balkonplatte mit Geländer davor (`130-balkone.js`); Fläche = Breite × (Auskragung + Rücksprung).
- Gruppen-Konfigurator: Teilungslinien ziehen (`okGrLinieGreifen`/`okGrLinieSchieben`) verschiebt die ganze Linie,
  Feldeinstellungen und verbundene Felder wandern mit; Maßketten der Teilungen oben und links.
- Geländer an Loggia und Balkon (Feld `ga` Art, `gh` Höhe, `gc` Farbe, `gm` Montage, `oegGel` mit Vorgaben;
  `OEG_GEL` Arten): Ansichtssymbol `oegArtZeichnen`, LOD 200 `l2Gelaender` (`22-lod200-waende/130-balkone.js`).
- Terrassenfläche (`bM`, `07-analyse/020-flaechen-rauminhalte.js`): Absätze der Geschosse (`terrOf`) plus Loggien und
  Balkone der Fassadengruppen (`lbFlaechen`: Breite × Rücksprung bzw. Auskragung); im Excel-Blatt Terrassen je
  Geschoss und Art.
- Riegel (`11-bearbeiten/030-riegel.js`, Zeichenform `rieg` in `SHP`): Mittellinie wie die Freiform zeichnen (gleiche
  Fänge, Abschluss in `draftClose` → `rgFertig`), Umriss `rgBand` (Breite, Gehrung, Ausrichtung mittig/linksbündig/rechtsbündig in Zeichenrichtung). Gebäude merkt sich `b.riegel =
{ pts, w }` (Verlauf, Speichern, Kopie); gewählt: Mittellinie mit ziehbaren Punkten (`rgTakt`, DOM über der Ansicht),
  Karte „Riegel“ (Breite, Geschosse, Geschosshöhe). `rgAbgleich` nimmt die Linie bei Verschieben/Drehen mit und löst
  sie, wenn der Umriss anders verändert wurde.
- Fassadengruppen je Abschnitt: Fläche/Flucht in der Kontextleiste schreibt `b.fk.abU['Seite|Geschoss'] =
[{ u0, u1, R, au, vs }]` (Bereich entlang der Ansicht, Geschoss `*` = Flucht). `fkAnwenden` teilt jedes Band an
  diesen Grenzen und füllt die Teile einzeln – so tragen die Hälften einer geschnittenen Flucht eigene Gruppen.
- Bibliothek (`19-fassadendesigner/130-bibliothek.js`): eigene oder geänderte Öffnungstypen und Gruppen werden bei jeder
  Änderung (`oeAktualisieren`) in `localStorage` `maad.bib.v1` gemerkt. Neues Projekt: Bibliothek ersetzt gleiche
  Schlüssel. Projekt öffnen: Projekt gewinnt, Bibliothek ergänzt fehlende. Löschen im Konfigurator entfernt auch dort.
- Gruppen reichen an der Fassade immer über das ganze Geschoss (`oegHoehe`); `G.h` ist nur die Zeichenhöhe. Mit
  `G.sz.an` wachsen Fenster (Sturz bleibt wie gezeichnet, `oegTyp`), sonst wächst der Sturz (`oegYAbb`).
- Öffnungstypen: `pb` Rahmenbreite, `pp` Pfosten und Riegel (ohne Angabe wie `pb`, `oeAufteilung`).
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
  ums Gebäude (Fassade, Dach, Fassade). `skSchnittDo` fügt in jedem Geschoss Teilungspunkte in die Kontur ein (wie
  Teilen) und trennt die freien Dach- und Terrassenflächen in Teilflächen (`l.faces`). Es bleibt ein Gebäude, Decken
  und Grundrisse bleiben ganz.
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

## Pfosten-Riegel-Fassade in Gruppen

- Material der Gruppe `G.t = 'pr'` (Fassadentyp „Pfosten-Riegel-Fassade“) schaltet sie ein (`oegPr`, `19-…/097-oeffnungsgruppen.js`),
  `G.pr = { pb, pt, rt, rf }` hält Ansichtsbreite, Bautiefe Pfosten/Riegel und Farbe. Randprofile an
  anschließenden Pfosten-Riegel-Gruppen derselben Ansicht sind halb so breit (`oegPrRand` → `T._rd`), an Wänden voll. Die Gruppe wird eine Glasfassade. Senkrechte
  Teilungen = Pfosten, waagerechte = Riegel (Tiefe 80 %), außen Rahmen; verbundene Felder ohne Profil dazwischen.
- Felder: `fe[].pf` Füllung (`g` Glas, `p` Paneel, `e` Einsatz) und `fe[].pe` Öffnungstyp des Einsatzes (auf das
  Lichtmaß des Feldes gebracht, Rahmen mittig in der Profiltiefe).
- Umsetzung als eine Öffnung der Art `pr` über die ganze Gruppe (`oegPrTyp`, `oegElemente`): `oeAufteilung` gibt für
  `pr` `oegPrAufteilung` zurück (Steg mit 5. Wert = Tiefenanteil, Feld `fu: 'l'` = leer). Damit laufen Wandausschnitt,
  Ansicht, 3D (`oeKoerper`, Tiefe `T.pt`) und Grundriss über die Wege der Fenster. `oegFlaechenG` liefert bei
  Pfosten-Riegel keine Flächen (keine Rück-/Vorsprünge).
- Aufbau wie im Feld (`OE_PR_LAGE`, `oeKoerper`): außen Deckleiste, dahinter Glas bzw. Paneel, dann das Profil bis zur
  Bautiefe; im Grundriss-Schnitt ebenso. Einsätze sitzen in der Glasebene.
- Randfelder einer Reihe (`oegReihe`, Füllen und Gebäudekonfigurator): Pfosten-Riegel füllt die Fläche bis zu beiden
  Enden; den Rest nehmen je nach Ausrichtung das letzte Feld (links), das erste Feld (rechts) oder beide je zur Hälfte
  (mittig) auf – länger oder kürzer. Am Verweis: `I.l` Länge, `I.lv` Änderung am linken Rand (`oegL`/`oegAngepasst`).
- Über Eck (`oeEckenFinden` in `oeWelt`): an Außenecken entfallen die Randprofile (`T._rd`), die Fassaden enden am
  Eckpfosten (`T._ek`); der Eckpfosten ist ein Parallelogramm zwischen beiden Ebenen (passt zu jedem Winkel), verbindet beide
  Fassaden (3D in `l2Balkone`, Grundriss in `l2BalkonGrundriss`).
- Über mehrere Geschosse (`oeDeckenZonen`, `oeDeckeAussparen`): die Geschossdecke springt dort um Bautiefe + 10 cm
  zurück (in `l2GeoStufe1`, Teil des Schlüssels), die Fassaden der Geschosse treffen sich davor.
- Konfigurator: Material „Pfosten-Riegel-Fassade“, darunter Maße im Abschnitt „Gruppe“ (ältere Gruppen mit `G.pr.an` werden beim Laden auf das Material umgestellt), `okGrRaster` teilt in gleiche Achsen.

## Schraffuren der Fassadentypen

- `19-…/150-schraffuren.js`: Muster als PAT-Linienscharen (`schParse`, UTF-8 oder Latin-1). Mitgeliefert: deutsche
  Muster als PAT-Text (`SCH_DE`, aus den Vorlagen des Nutzers); eigene einfache Muster (`ein`: waagerecht, senkrecht,
  Kreuz, diagonal, Diagonalkreuz mit Abständen) und importierte .pat in `S.sch` (Projekt `x.sch`, Browser `maad.sch.v1`).
- Fassadentyp `t.sch = { k, e, w, c }` (Muster, Meter je Einheit, Winkel, Linienfarbe), bearbeitet unter „Typen
  bearbeiten“ (`schTypHtml`, `schMusterHtml`). `schKachel` sucht die kleinste Wiederholung, `schCanvas` zeichnet sie
  (2D in Bildschirmauflösung, zu dichte Muster entfallen; 3D als Textur).
- LOD 200: die Außenwände tragen die Farbe ihres Fassadentyps selbst (`ftWandAbschnitte`, in `l2MeshOrig` nur in der
  Darstellung an Typwechseln geschnitten, die Wand bleibt ein Bauteil); die Attika übernimmt den Typ der Wand darunter
  (`l2AttikaTyp`), außer die Ansicht setzt ihn gezielt (`d.at`, Inspektor „Attika“).
- 2D: `schFuellen2D` nach dem Füllen in `fdDrawView`. 3D: die Fassadentyp-Schicht (`110-fassadentypen-3d.js`, wieder
  eingeschaltet, 1 cm vor der Wand, Öffnungen ausgespart) zeigt nur noch die Schraffurlinien (`schMaterial(…, nurLinien)`);
  Gruppenfelder mit eigenem Material dort mit Farbe. In der Explosion ausgeblendet.

## Ansichten: Fluchtlinien und Geländeschnitt

- `19-…/140-fluchten-gelaende.js` (aus `fdDrawView`): Umriss je Fassadenebene gleicher Tiefe (`fdFluchtUmrisse`,
  vereinigt mit `boolOp`, an der Ansicht zwischengespeichert), zurückliegende Ebenen mit Rücksprungmaß.
- Geländeschnitt (`fdGelaendeLinie`): Gelände (`gh`) entlang der vordersten Fassadenebene (`V.cut − 0,5`), Fläche
  darunter weiß, Linie kräftig.
- Gelände unter dem EG: in LOD 200 schneidet bei Gebäuden mit Öffnungen auch der EG-Grundriss das Gelände aus
  (`plmFoot`), damit man durch Glas auf die Bodenplatte sieht.

## Auswertung je Darstellung (LOD)

- Die Auswertung folgt der eingeschalteten Darstellung: in LOD 100 das einfache Modell, in LOD 200 zusätzlich Balkone
  und Loggien. `lbFlaechen`/`lbBoeden` liefern nur bei `l2on()`, die Loggia-Einschnitte der Wandableitung (NGF, KF)
  ebenso. Beim Wechsel (`lotlod`) werden Kennzahlen (`rr`) und Hervorhebung (`hlApply`) neu aufgebaut.

## LOD 200: Attika als eigene Wand

- Flachdach, oberstes Geschoss: `l2AttikaRing` (`22-…/130-balkone.js`) baut die Attika als durchgehenden Ring entlang
  des Umrisses des obersten Geschosses (und um Innenhöfe bis zum Dach), in Außenwandstärke nach innen, auf Gehrung an
  jeder Ecke, Höhe `L2_ATTIKA`; in der Balkongruppe (Geschoss 'roof'). Die Außenwände dieses Geschosses tragen in LOD 200
  keine eigene Attika mehr (`r.atR`); LOD 300 behält `r.hAt`. Terrassen-Attiken tieferer Geschosse bleiben an der Wand.
- Loggien: Sturz an der Fassadenlinie bis Oberkante Decke; Loggia-Wände enden unter der Decke (`r.lg`, ohne `quads2`);
  die Gehrungsdreiecke der Nachbarwände im Deckenbereich werden ergänzt.

## LOD 200: Anbauten in Explosion und Isolieren

- `l2Balkone`/`l2Terrassen` (`22-…/130-balkone.js`) legen je Geschoss eine Untergruppe an (`userData.k`, Geschoss des
  Bodens); `exApply` verschiebt sie mit `exOff` wie die Wände. `l2IsoAnbauten` (`080-isolieren…`) blendet Balkone,
  Geländer und Außenkontur beim Isolieren mit aus.

## Grundriss: Balkone

- `l2BalkonGrundriss` (`22-…/130-balkone.js`, aus `l2Draw`): Balkonplatte mit Geländer im Geschoss auf Plattenhöhe,
  Balkon des Geschosses darüber gestrichelt, Loggia-Geländer in der Fassadenebene.

## LOD 200: einfache Darstellung in Bewegung

- `l2Einfach(b)` (`22-…/030-aktionen.js`) = in Bewegung (`l2Unruhig`): solche Gebäude zeigen den Körper wie in LOD 100;
  `l2Sync`, `l2Vis`, `l2Kontur`, `l2Balkone`, `l2Terrassen` lassen sie aus. (Die Umschaltung gewählter Gebäude auf LOD 100
  wurde auf Wunsch zurückgenommen – beim Modellieren war das Gebäude nicht mehr zu sehen.)
- Bibliothek: Einträge tragen `zt` (Zeitpunkt der letzten Änderung, `bibMerken`); beim Öffnen eines Projekts gilt
  je Schlüssel die jüngere Fassung (`bibErgaenzen`).

## LOD 200: Ruhephase bei Bewegung

- `l2Unruhig(b)` (`22-lod200-waende/030-aktionen.js`): ändert sich Grundriss/Lage eines Gebäudes (`skSig(b)` + `b._y`),
  gilt es `L2RUHE` = 1000 ms als unruhig. In dieser Zeit baut `l2Sync` keine Wände, Öffnungen und Gruppen dafür (alte
  Teile werden entfernt), `l2Vis` zeigt den einfachen Körper, `l2Kontur`, `l2Balkone`, `l2Terrassen` und `fkSync`
  setzen aus. Nach 1 s ohne Änderung entsteht alles neu.

## LOD 200: Terrassen

`l2Els` gibt Außenwänden ohne Geschoss darüber (mindestens 3 von 5 Prüfpunkten frei) eine Attika (`r.hAt = 0,30 m`)
und `r.gel`. Das Geländer setzt `l2Terrassen` (130-balkone) auf die Terrassenfläche (innen vor der Attika, Stäbe alle 0,24 m, Fußleiste, Handlauf, Oberkante
1,00 m über der Geschossoberkante). Die LOD-200-Außenkontur hebt Terrassenränder und -ecken um die Attika an.

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

## Schatten und Fassadengruppen (Ergänzungen)

- `shFit` (24-…/020-kamera) führt die Schattenkarte auch in der normalen 3D-Ansicht dem Blickpunkt nach, nicht nur im
  Kamera-Modus. Außerhalb davon rasten Ausschnittgröße (Stufen ×1,25) und Mittelpunkt (Raster R/6) ein; die
  Schattenkarte wird nur bei deutlicher Bewegung neu gerechnet (`SHC`).
- `fkAnwenden`: Reihen (Ansichtsfläche + Höhe), in denen eine Gruppe von Hand getauscht oder verschoben wurde, bleiben
  komplett erhalten, auch mit den automatisch gesetzten Nachbarn. Eigene Anordnungen (`b.fk.ab`) haben Vorrang vor
  der Gebäudeeinstellung.

## Geneigte Dächer bei zusammengesetzten Grundrissen

`roofRects` (01-modell-3d/020-mehrkoerper) zerlegt rechtwinklige Grundrisse in Rechtecke (Einzelkörper):

- Hauptkörper ist der breiteste Körper (größte kürzere Seite), bei gleicher Breite der größte.
- Jeder Körper bekommt einen eigenen First auf seiner Mittellinie, längs seiner längeren Seite.
- Zerlegt wird in den Achsen der Gebäudekanten. Passt die Firstrichtung (auch eine von Hand gesetzte) nicht dazu,
  nimmt `roofField` die Achsen der längsten Kante.
- Eine Firstrichtung von Hand (`b.roof.dir`) gilt nur für einfache Körper. Bei mehreren Flügeln (`_rp.mehr`) zeigt
  das Panel statt des Feldes einen Hinweis.
- Ein angeschlossener Flügel hat seinen First immer quer zu dem Körper, an dem er hängt (Zwerchgiebel), auch wenn er
  breiter als lang ist. Nur frei stehende Körper richten sich nach ihrer längeren Seite.
- Die Dachhöhe ist das Maximum der Einzeldächer. Schmalere Flügel haben bei gleicher Neigung einen niedrigeren First
  und laufen mit einer Kehle ins Hauptdach.
- Dachkanten (`roofKanten`) werden aus der Dachform bestimmt, nicht aus den Dreiecken: Neigungswechsel über 15° oder
  Rand des Grundrisses, dazu der Umriss der Giebelwände. Das gilt für LOD 100 und die LOD-200-Kontur.
