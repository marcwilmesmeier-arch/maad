# maad – Server-Übergabe für Claude Code

Stand: 02.11.2026 · Zielsystem: getmaad.de · Tool-Stand: maad v548 (Mix und Generatives Design seit v546 entfernt)
Hinweis: Alles unten ist nur lokal getestet (Python-Server + Headless-Chromium). **Nie getestet:** echter IONOS-VPS, echter SMTP-Versand, Caddy/HTTPS-Zertifikat, echter MapTiler-Schlüssel, echte Geodienste hinter dem Proxy. Ob VPS/Domain/Postfach schon bestellt sind, weiß ich nicht – bitte bei Marc erfragen. Keine Zugangsdaten in dieser Datei; Passwörter/Schlüssel trägt Marc selbst in `/etc/maad/config.json` ein.

## 1. Ziel
Browser-Tool „maad“ (eine HTML-Datei, ~4,1 MB) für Kunden ausliefern:
- Ohne Anmeldung: `maad-demo.html` (Demo Bielefeld; „Neues Projekt“, „Projekt öffnen“, Excel-/IFC-Export im Code leer).
- Mit Anmeldung (E-Mail-Link, kein Passwort): Vollversion `maad.html`, mit Kundenkennung (Wasserzeichen).
- Admin-Seite: Kunden freigeben, Abo/Rolle/Rechte, Sperren, Protokoll, Voreinstellungen für alle Anwender.
- MapTiler-Schlüssel nur serverseitig; Geodienst-Weiterleitung `/api/proxy` für angemeldete Nutzer (ersetzt Cloudflare-Worker).
Zahlung, Rechnungen, Projektablage auf dem Server: nicht enthalten (Projekte liegen nur in IndexedDB im Browser des Kunden).

## 2. Dateien (Quelle: /tmp/gr/pkg/maad-server, Kopie in /tmp/gr/server; Zip: maad-server-ionos.zip)
| Datei | Zweck |
|---|---|
| maadserver.py | Server, nur Python-Standardbibliothek, SQLite (`maad.db`), ThreadingHTTPServer auf 127.0.0.1:8080 |
| login.html, admin.html | Anmeldeseite, Administration |
| maad.html / maad-demo.html | Vollversion / Demo – **immer beide zusammen** aktualisieren; fehlt die Demo, liefert der Server nie ersatzweise die Vollversion |
| config.example.json | Vorlage → `/etc/maad/config.json` |
| maadserver.service | systemd (User `maad`, ProtectSystem=strict, ReadWritePaths=/var/lib/maad) |
| Caddyfile | HTTPS-Reverse-Proxy auf 127.0.0.1:8080, www → Apex-Redirect, HSTS |
| install.sh | apt: python3, caddy; legt User/Verzeichnisse an, kopiert Dateien, aktiviert Dienst |
| backup.sh | tägliches SQLite-Backup nach /var/backups/maad (30 Tage), per cron `0 3 * * *` |
| README_IONOS.md | Schritt-für-Schritt-Anleitung |

## 3. Zielumgebung
- IONOS VPS, Ubuntu 24.04 (oder 22.04), Ports 22/80/443 offen, A-Record getmaad.de → VPS-IPv4.
- Mail: Postfach `zugang@getmaad.de` (IONOS Mail Basic), SMTP smtp.ionos.de:587 (STARTTLS, `ssl:false`), Benutzer = volle Adresse.
- Pfade: `/opt/maad` (Code + HTML), `/etc/maad/config.json` (chmod 640, Gruppe maad), `/var/lib/maad/maad.db`, `/var/backups/maad`.

## 4. Konfiguration (`config.json`, Vorlage)
```
{ "base_url":"https://getmaad.de","host":"127.0.0.1","port":8080,
  "data_dir":"/var/lib/maad","tool_file":"/opt/maad/maad.html","demo_file":"/opt/maad/maad-demo.html",
  "admin_emails":["marc.wilmesmeier@gmx.de"],"session_days":30,"link_minutes":15,"app_name":"maad",
  "smtp":{"host":"smtp.ionos.de","port":587,"user":"zugang@getmaad.de","password":"<Marc trägt ein>","from":"maad <zugang@getmaad.de>","ssl":false},
  "maptiler_key":"<Marc trägt ein>","proxy":true }
```
Optional: `proxy_max_mb` (Standard 80). Ohne SMTP-Eintrag schreibt der Server Mails nach `data/outbox.log` (Testmodus, dort steht der Anmeldelink).
MapTiler: Schlüssel im MapTiler-Konto auf die Domain beschränken („Allowed HTTP origins“); Tarif/Nutzungsbedingungen bei mehreren Kunden prüfen.

## 5. Funktionsweise
- **Anmeldung:** `POST /api/login-link` → Mail mit Einmal-Link (15 min, nur Hash gespeichert, gleiche Antwort für bekannte/unbekannte Adressen), Cookie `maad_sid` (HttpOnly, SameSite=Lax, 30 Tage). Rate-Limit (429 ab der 6. Anfrage). Schreibzugriffe brauchen Header `X-Maad: 1`.
- **Auslieferung:** Server injiziert `window.MAAD_ACC` (Modus `demo`/`full`, Nutzer, Rechte, Voreinstellungen `cfg`). Vollversion nur mit gültiger Sitzung, sonst Demo. MapTiler-Schlüssel wird beim Ausliefern der Vollversion eingesetzt; alte Cloudflare-Proxy-Adresse wird durch `/api/proxy?url=` ersetzt (Demo: entfernt).
- **Kennung:** HMAC (12 Zeichen) je Kunde in Quelltext-Kommentaren (`<!--maad-lizenz:…-->`) und als Nullbreite-Zeichen im Titel; Secret in Tabelle `kv` (`wm_secret`); Abfrage `GET /api/admin/wm?id=…` (Admin).
- **Rollen:** user/lead/admin. **Abos → Rechte:** demo [] · starter [project_new, project_open, export_xlsx] · büro (siehe PLANS im Code) · enterprise = alle. Rechte: project_new, project_open, export_xlsx, export_ifc, lod, team, own_sources. Je Kunde überschreibbar, „gültig bis“. Im Tool verdrahtet: die ersten vier; lod/team/own_sources nur serverseitig vorgesehen.
- **Tabellen:** users, tokens, sessions, log, kv.
- **Endpunkte:** GET `/`, `/login`, `/admin`, `/api/me`, `/api/admin/users`, `/api/admin/log`, `/api/admin/wm`, `/api/proxy`; POST `/api/login-link`, `/api/logout`, `/api/admin/cfg` (Limit ca. 2,1 MB), `/api/admin/invite`, `/api/admin/user`.
- **Proxy:** nur angemeldet, nur https/443, nur öffentliche IPs (DNS-gebunden gegen Umleitung auf interne Ziele), max. 4 Weiterleitungen, Größenlimit, Rate-Limit je Nutzer. Abschalten mit `"proxy": false`.

## 6. Einrichten (Kurzfassung)
1. Zip entpacken, `scp -r . root@SERVER-IP:/root/maad-paket`, `ssh root@SERVER-IP`.
2. `cd /root/maad-paket && sh install.sh && nano /etc/maad/config.json`
3. Caddyfile prüfen (Domain getmaad.de), `cp Caddyfile /etc/caddy/Caddyfile`, `systemctl restart maadserver caddy`, `systemctl status maadserver`.
4. `https://getmaad.de/login` mit Admin-Adresse; Link aus der Mail; unter „Administration → Freigeben“ Kunden eintragen.
5. Cron-Backup: `cp backup.sh /opt/maad/` und `0 3 * * * sh /opt/maad/backup.sh`.
Fehlersuche Mail: `journalctl -u maadserver -n 50`, Reiter „Protokoll“ in der Administration (häufig Mailpasswort oder Spam-Ordner).

## 7. Tool aktualisieren (bei jeder neuen Version)
Build in /tmp/gr: `build.sh` → `rel.sh NNN` erzeugt `maad.html`, daraus `maad-demo.html` (Node + acorn, `dm/make_demo.js`, 78 Funktionen geleert, Schlüssel/Proxy entfernt) und das Zip `/mnt/user-data/outputs/maad-server-ionos.zip`. Auf dem Server beide HTML-Dateien nach `/opt/maad/` kopieren, kein Neustart nötig. Server-Code (`maadserver.py`, `login.html`, `admin.html`) → `systemctl restart maadserver`.
Hinweis: Die Artifact-/Standalone-Datei behält MapTiler-Schlüssel und Cloudflare-Proxy; nur die vom Server ausgelieferte Vollversion nutzt Server-Schlüssel und `/api/proxy`.

## 8. Bekannte Grenzen / offene Punkte
- Angemeldete Kunden erhalten den Code der Vollversion im Browser (nicht verhinderbar); Kennung macht Weitergabe nur nachvollziehbar → Nutzungsbedingungen nötig.
- Die Demo enthält noch den Rest des Tools (Ansicht, Planen, Auswertung); nur die gesperrten Funktionen fehlen.
- Rechtliches: Impressum, Datenschutzerklärung, Auftragsverarbeitung (IONOS, MapTiler), EU-Serverstandort noch zu klären.
- Interne Browser-Schlüssel heißen weiterhin `lot` (IndexedDB `lot`, localStorage `lot_*`, `lotAdminCfg`) – bewusst nicht umbenannt.
- Demokarte (Bielefeld) liegt im Tool/als Datei, wird nicht über den Server verteilt.
- Voreinstellungen (Admin-Reiter) wirken nur auf neue Projekte.
- Marc hat die Server-Arbeit pausiert („weiter mit dem Server“ = Startsignal); diese Übergabe ist zum Weiterarbeiten in Claude Code gedacht.

## 9. Projekt-Dokumentation (Claude-Projekt „Visualisierung von konzeptzeichnungen“)
Server-relevante Nachträge: v304/v305 (Kundenzugang), v311 (Admin-Ansicht), v319 (Umbenennung lot→maad), v330 (Auslieferung nach Login, Demo, Kennung), v331 (MapTiler + Proxy); Konzept: `lot-konzept-kundenzugang.md`.
