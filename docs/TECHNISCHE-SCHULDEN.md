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
8. ~~three.js r128 veraltet~~ – erledigt: Update auf 0.187.0 mit unverändertem Aussehen. Offen: maad nutzt weiter die
   alte lineare Farbausgabe statt sRGB-Farbverwaltung; `PCFSoftShadowMap` gibt es nicht mehr (jetzt `PCFShadowMap`,
   Schattenkanten minimal anders). Eine Umstellung auf sRGB würde alle Farben verändern und braucht Abstimmung.

## Server

1. **Zwei-Faktor-Anmeldung** (Code-App) für Betreiber und Mandanten-Admins ergänzen.
2. **node:sqlite** ist in Node.js noch als „experimentell“ gekennzeichnet (funktioniert stabil; die Warnung ist im
   Dienst abgeschaltet). Bei Node-Updates die Tests laufen lassen.
3. **Rechte `lod` und `own_sources`** sind im Server vorhanden, im Tool aber noch nicht an Funktionen gebunden
   (`team` wirkt auf das Teilen von Projekten).
4. **Nie auf echtem Server getestet:** IONOS-VPS, Mailversand über smtp.ionos.de, Caddy-Zertifikat, echter
   MapTiler-Schlüssel, Geodienste hinter dem Proxy. Lokal getestet: alles andere (`npm run test:server`).
5. **Rechtliches:** Impressum, Datenschutzerklärung, Auftragsverarbeitung (IONOS, MapTiler), Nutzungsbedingungen.
6. **Mehrere Bearbeiter gleichzeitig:** Konflikte werden erkannt (Hinweis, kein Überschreiben), aber nicht
   zusammengeführt.

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
- Der MapTiler-Schlüssel steht im Code (`02-geodaten/010-kontextdaten.js`). Im MapTiler-Konto auf die eigene
  Domain beschränken.

## Realistisch+ (Himmel, Atmosphäre, Wolken)

- Getestet nur ohne Grafikkarte (Software-Rendering); Abnahme im Browser des Nutzers.
- Exporte (PDF/Excel) rendern ein Einzelbild: Wolken brauchen mehrere Bilder zum Glätten – noch offen.
- `op()` (Deckkraft der Ebenen) setzt Materialien auch bei 100 % auf transparent; allgemein ändern verschiebt die
  Zeichenreihenfolge (Bäume blasser). Realistisch+ umgeht das (Schattenmaske blendet Auflagen aus).
- Wasserflächen: nur Himmelsspiegelung, keine Spiegelung der Gebäude.
- GeometryPass (MRT) scheitert an maads eigenen Shadern, deshalb eigene Hilfsdurchgänge.

## Wind & Rauch (Analyse)

- Planungshilfe, kein Windgutachten: grobes Gitter (3–5 m), Boden reibungsfrei mit Anströmprofil, Gebäude als
  Klötze aus Grundriss und Höhe (keine Dachformen, keine Bäume als Hindernis).
- Rechenzeit im Browser (JavaScript, 1 Thread): ca. 20–60 s für 240 m / 4 m. Schneller ginge es auf der Grafikkarte
  (WebGL2) oder mit mehreren Threads.
- Komfortklassen nach mittlerer Geschwindigkeit bei einer Windrichtung; eine Bewertung über die Windstatistik des
  Standorts (Windrose, Überschreitungshäufigkeit nach Lawson) fehlt noch.
- Emissionen: konstanter Wind, keine Abgasfahnenüberhöhung, keine Chemie/Ablagerung; Zusatzbelastung, kein Jahresmittel.
- Straßenverkehr: Verkehrsaufkommen nach Straßenart (Voreinstellung) oder je Straße per Klick, ein Emissionsfaktor
  für alle Straßen (Richtwert NOx); genauere Werte (Lkw-Anteil, Stau, HBEFA) noch nicht.
- Qualm: Darstellung aus Teilchen im gemittelten Windfeld plus wanderndes Wirbelfeld nach örtlicher Turbulenz – zeigt
  das Verhalten anschaulich, die Wirbel sind aber nicht einzeln berechnet (dafür bräuchte es eine zeitaufgelöste
  Strömung).
- Noch nicht im PDF-/Excel-Export und ohne eigenes Recht im Server (Freischaltung je Abo).
- Windklima (Häufigkeit der Richtungen) kommt von Bright Sky (api.brightsky.dev, DWD-Stationsdaten, letztes volles
  Jahr). Der Abruf ist in der Entwicklungsumgebung gesperrt und nur mit Testdaten geprüft; im Browser des Nutzers
  ungeprüft. Der Dienst ist ein freies Angebot ohne Zusagen; für den Betrieb ggf. über den eigenen Server spiegeln.
- Die Komfortbewertung nutzt die Häufigkeit nur für die Vorwahl der Richtung; eine Bewertung über alle Richtungen
  (gewichtete Überschreitungshäufigkeit) fehlt noch.

## Landesdaten Rheinland-Pfalz

- DGM1/DOM1-Kacheln heißen `dgm1_32_{E}_{N}_1_rp_{Jahr}.tif`; das Erfassungsjahr ist je Kachel verschieden und nicht
  aus der Lage ableitbar. `rpKacheln()` probiert die Jahre absteigend (zuletzt gefundenes Jahr zuerst), fehlende Jahre
  kosten je einen schnellen 404-Abruf. Besser wäre ein kleines Verzeichnis Kachel → Jahr (z. B. aus dem
  Landes-Metalink `dgm1_tif_07.meta4`, 12 MB) über den eigenen Server.
- LoD2-Kacheln (2 km, unkomprimiertes CityGML) sind in Innenstädten sehr groß (Mainz 446/5538: 163 MB); sie werden als
  Datenstrom gelesen, das Laden dauert entsprechend.

## Landesdaten Baden-Württemberg

- DGM1/DOM1 kommen aus dem Open-Data-Download (opengeodata.lgl-bw.de, 2-km-ZIP mit vier 1-km-Teilen). Der Server
  erlaubt CORS nur für die eigene Seite; maad lädt über den CORS-Proxy, der Host muss dort freigegeben sein. Ohne
  Proxy greift der INSPIRE-WCS als Ersatz (`ersatz` in `TERR.bw`): DGM nur in ganzen Metern (16 Bit), DOM nur als
  DOM5. Der WCS verlangt beim Ausschnitt die Achsen E/N, beim Skalieren x/y (`sax`).
- LoD2 BW kommt aus demselben Portal (`/data/lod2/…_2_bw.zip`, E ungerade → `versatz: [1, 0]` in `CG.bw`), ebenfalls
  nur über den Proxy. Schlägt der Abruf fehl, greift „Gebäude Deutschland“ (Grundriss + Höhe, ohne Dachformen).

## Analyseansicht und gespeicherte Analysen

- Gespeichert wird nur die Windanalyse (Feld als 16 Bit, gzip, Base64 im Projekt: ca. 160 KB bei 200 m Bereich und
  5 m Raster, bei 3 m Raster und großem Radius deutlich mehr). Emissionen werden noch nicht gespeichert.
- „Anzeigen“ baut das Rechengitter aus der aktuellen Planung neu auf; passt es in der Größe nicht mehr (anderes
  Gelände), muss neu gerechnet werden. Bei veralteter Analyse liegen Gebäude und Strömung ggf. nicht mehr deckungsgleich.

## Site & Context

- Landmarks kommen allein aus OSM-Merkmalen; die Auswahl hängt von der Pflege vor Ort ab. Denkmallisten der Länder
  sind noch nicht angebunden. Baujahre nur, wenn `start_date`/`construction_date` gepflegt ist.
- Zuordnung Landmark → Umgebungsgebäude: Punkt im Grundriss bzw. Gebäudemitte in der OSM-Fläche. Bei abweichenden
  Grundrissen (LoD2 vs. OSM) kann ein Gebäude fehlen oder ein Nachbar mitgefärbt werden.
- Im Test nur mit nachgestellten OSM-Daten geprüft (Overpass in der Entwicklungsumgebung gesperrt).

## Erreichbarkeit zu Fuß

- Gehgeschwindigkeit fest 4,8 km/h, Ampeln/Steigungen nicht berücksichtigt; Wege ohne Fußverbot zählen (auch Straßen
  ohne Gehweg-Erfassung). Abseits der Wege höchstens 40 m mit 70 % Tempo.
- Ergebnis wird nicht mit dem Projekt gespeichert (Netz neu laden); Haltestellen gleicher Art und gleichen Namens
  innerhalb 250 m werden zusammengefasst. Flughäfen nur mit IATA-Code im Umkreis von 60 km (Luftlinie).
- Nur mit nachgestellten OSM-Daten im Browser geprüft (Overpass in der Entwicklungsumgebung gesperrt).
