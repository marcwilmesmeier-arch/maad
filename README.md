# maad

Browserbasiertes Planungswerkzeug für Grundstücke und Gebäude: 3D-Modell auf amtlichen Geodaten,
Gebäude zeichnen und bearbeiten, Flächen- und Rauminhalte auswerten, Export nach PDF, Excel und IFC.

Das Tool ist **eine einzige HTML-Datei** (`dist/maad.html`), gebaut aus den Quellen unter `src/`. Für Kunden liefert
der **maad-Server** (`server/`) es aus: Mandanten mit eigenen Admins, Nutzer, Gruppen und Rechte, Anmeldung mit
E-Mail und Passwort, Projekte auf dem Server. Einrichtung: [docs/BETRIEB.md](docs/BETRIEB.md).

## Schnellstart

```bash
npm install          # einmalig: Werkzeuge (Prettier, ESLint, Playwright) installieren
npm run build        # erzeugt dist/maad.html
```

`dist/maad.html` lässt sich direkt im Browser öffnen (Internetzugang für three.js, MapLibre und Kartendienste nötig).

| Befehl                                  | Zweck                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `npm run build`                         | Einzeldatei bauen (`dist/maad.html`, dazu `dist/bundle.js` zur Analyse)   |
| `npm run format`                        | Quellen einheitlich formatieren (Prettier)                                |
| `npm run lint`                          | Statische Prüfung; Meldungen zeigen auf `src/js/<datei>:<zeile>`          |
| `npm test`                              | Rauchtest im Browser (lädt die App, bedient die Hauptbereiche)            |
| `npm run check`                         | alles zusammen – vor jedem Commit ausführen                               |
| `npm run vergleich -- <alt.html>`       | Verhaltensvergleich mit einem älteren Build (für Umbauten; ca. 15 Min.)   |
| `node tools/umbenennen.mjs <alt> <neu>` | globalen Namen in allen Dateien umbenennen (nur echte Bezüge)             |
| `npm start -- <konfig.json>`            | Server lokal starten                                                      |
| `npm run test:server`                   | Server-Tests: API (u. a. Mandantentrennung) und Browser-Ablauf            |
| `npm run paket`                         | Installationspaket für den Server bauen (`dist/maad-server-paket.tar.gz`) |

Für `npm test` einmalig den Browser installieren: `npx playwright install chromium`
(oder einen vorhandenen nutzen: `CHROMIUM_PATH=/pfad/zu/chrome npm test`).

## Aufbau

```
src/
  index.html            HTML-Gerüst mit Platzhaltern (@@include:…@@, @@scripts@@)
  styles/               CSS (app.css) und eingebettete Schrift
  data/                 eingebettete Daten (Demokarte, Deutschlandkarte; gzip + Base64)
  assets/               Favicon
  js/NN-bereich/NNN-thema.js   Anwendungscode, nach Fachbereichen geordnet
server/
  src/                  Server (Node.js, ohne externe Bibliotheken; SQLite über node:sqlite)
  seiten/               Anmeldung, Passwort, Verwaltung (HTML/JS/CSS)
  betrieb/              Installation, systemd-Dienste, Caddy (HTTPS), Sicherung
tools/
  build.mjs             setzt alles zu dist/maad.html zusammen
  demo.mjs              Sperrstellen je Recht (dist/maad.sperren.json) und Demo zum Ansehen
  lint.mjs              ESLint auf dem Gesamtskript, Meldungen je Quelldatei
tests/
  smoke.test.mjs        Rauchtest (Playwright)
  server/api.test.mjs   API-Tests des Servers
  server.test.mjs       Browser-Ablauf mit Server
docs/
  ARCHITEKTUR.md        wie der Code zusammenhängt, Regeln für Änderungen
  BETRIEB.md            Server einrichten und betreiben (IONOS)
  TECHNISCHE-SCHULDEN.md   bekannte Baustellen, priorisiert
CLAUDE.md               Regeln für Claude (Cowork / Claude Code) beim Weiterentwickeln
```

Eine Übersicht aller Bereiche und die Regeln für Änderungen stehen in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

## Die drei wichtigsten Regeln

1. **Reihenfolge ist Verhalten.** Alle Dateien unter `src/js` werden in Pfadreihenfolge zu _einem_ Skript
   zusammengesetzt; Code, der beim Laden läuft, steht in `start()` am Ende. Dateien nicht umnummerieren,
   ohne die Abhängigkeiten zu prüfen.
2. **Nie direkt `dist/maad.html` bearbeiten** – sie wird bei jedem Build überschrieben.
3. **Vor jedem Commit `npm run check`.** Lint-Fehler und ein roter Rauchtest blockieren.
