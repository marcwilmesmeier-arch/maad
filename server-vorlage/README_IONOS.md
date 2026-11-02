# maad-Server auf einem IONOS VPS – Schritt für Schritt

Dieses Paket stellt `maad.html` für freigegebene Kunden bereit:
Anmeldung per E-Mail-Link (ohne Passwort), Freigabe und Berechtigungen durch Sie, Demo ohne Anmeldung.
Es braucht nur Python 3 und Caddy (für HTTPS). Keine weiteren Programme.

## Inhalt

| Datei | Zweck |
|---|---|
| `maadserver.py` | Der Server (nur Python-Standardbibliothek, Daten in SQLite) |
| `login.html`, `admin.html` | Anmeldeseite und Administration |
| `maad.html` | Das Tool selbst (Vollversion, wird **nur nach Anmeldung** ausgeliefert) |
| `maad-demo.html` | Abgespeckte Demo für Besucher ohne Anmeldung: die gesperrten Funktionen (Neues Projekt, Projekt öffnen, Excel-/IFC-Export) sind im Code entfernt |
| `config.example.json` | Vorlage der Einstellungen |
| `maadserver.service` | Autostart (systemd) |
| `Caddyfile` | HTTPS und Weiterleitung |
| `install.sh` | Richtet alles auf dem Server ein |
| `backup.sh` | Tägliche Sicherung der Kundendatenbank |

## 1. Server und Domain bestellen

1. Bei IONOS einen **VPS** bestellen (kleinster Tarif genügt), Betriebssystem **Ubuntu 24.04** (oder 22.04).
2. Eine **Domain oder Subdomain** wählen, z. B. `getmaad.de`. Im DNS einen **A-Record** auf die IPv4-Adresse des VPS setzen.
3. Ein **E-Mail-Postfach** für den Versand anlegen, z. B. `zugang@getmaad.de` (IONOS Mail Basic genügt). SMTP: `smtp.ionos.de`, Port 587, Benutzer = die volle Adresse.
4. Im IONOS-Panel unter *Netzwerk → Firewall* Ports **22, 80, 443** freigeben (alles andere zu).

## 2. Dateien auf den Server

Auf Ihrem Rechner (Windows: PowerShell, Mac/Linux: Terminal), im entpackten Ordner:

```
scp -r . root@SERVER-IP:/root/maad-paket
ssh root@SERVER-IP
```

## 3. Installieren

```
cd /root/maad-paket
sh install.sh
nano /etc/maad/config.json
```

In `config.json` anpassen:

- `base_url`: `https://getmaad.de`
- `admin_emails`: Ihre Adresse(n) – diese sind Administratoren
- `smtp.user`, `smtp.password`, `smtp.from`: Zugang des Postfachs aus Schritt 1
- `maptiler_key`: Ihr MapTiler-Schlüssel (siehe „Karten und Geodienste“ unten)

Dann HTTPS einrichten (Domain in der `Caddyfile` ersetzen) und starten:

```
nano Caddyfile
cp Caddyfile /etc/caddy/Caddyfile
systemctl restart maadserver caddy
systemctl status maadserver
```

Caddy besorgt das HTTPS-Zertifikat automatisch (Domain muss bereits auf den Server zeigen).

## 4. Erster Start

1. `https://getmaad.de/login` öffnen, Administrator-Adresse eingeben, Link aus der E-Mail anklicken.
2. Oben rechts erscheint „Administration“. Dort unter **Freigeben** Kunden eintragen: Abo, Rolle, Gültigkeit, Berechtigungen. Die Einladung geht per E-Mail raus.
3. Ohne Anmeldung sieht jeder die **Demo**: Demogrundstück ja, „Neues Projekt“ und „Projekt öffnen“ gesperrt.

Kommt keine E-Mail an: `journalctl -u maadserver -n 50` und Reiter **Protokoll** in der Administration. Häufig ist es das Mailpasswort oder der Spam-Ordner.

## 5. Betrieb

- **Tool aktualisieren:** neue `maad.html` **und** `maad-demo.html` nach `/opt/maad/` kopieren (immer beide, sie gehören zusammen). Neustart nicht nötig.
- **Server aktualisieren:** `maadserver.py`, `login.html`, `admin.html` nach `/opt/maad/` kopieren, dann `systemctl restart maadserver`.
- **Sicherung:** `crontab -e` und eintragen: `0 3 * * * sh /opt/maad/backup.sh` (kopiert `backup.sh` vorher nach `/opt/maad/`). Dazu zusätzlich ab und zu `/var/backups/maad` auf den eigenen Rechner holen.
- **Updates des Systems:** gelegentlich `apt update && apt upgrade`.
- Daten liegen in `/var/lib/maad/maad.db` (SQLite).

## Karten und Geodienste (Kunden müssen nichts einrichten)

- **MapTiler:** Gelände und Karten kommen von MapTiler. Den Schlüssel tragen Sie nur in `/etc/maad/config.json` (`maptiler_key`) ein. Der Server setzt ihn beim Ausliefern in die Vollversion ein; die Demo enthält keinen Schlüssel. Legen Sie im MapTiler-Konto den Schlüssel auf Ihre Domain fest („Allowed HTTP origins“), dann ist er außerhalb Ihrer Seite wertlos. Die Nutzung läuft über Ihr Kontingent: bei mehreren Kunden einen passenden MapTiler-Tarif wählen und die Nutzungsbedingungen prüfen.
- **Weiterleitung für Geodienste:** Einige Landesdienste (z. B. Bayern, Hamburg) erlauben keinen direkten Abruf aus dem Browser. Der Server leitet diese Abrufe unter `/api/proxy` weiter, **nur für angemeldete Nutzer**, nur über https, nur an öffentliche Adressen (keine internen Dienste), mit Mengen- und Größenbegrenzung (`proxy_max_mb`, Standard 80). Abschalten: `"proxy": false`. Der bisherige Cloudflare-Proxy wird nicht mehr gebraucht.
- Voraussetzung für die Kunden: Internetzugang und ein aktueller Browser (Chrome, Edge, Firefox).

## Voreinstellungen für alle Anwender (Admin-Ansicht im Tool)

Angemeldete Administratoren sehen im Tool den Reiter **Admin** (Zahnrad). Dort lassen sich Grafik- und Metrik-Einstellungen einzeln für alle Anwender übernehmen, Ansichten speichern, eine **Startansicht** festlegen und der Ausschnitt als Demokarte sichern. Die Voreinstellungen liegen in der Datenbank (Tabelle `kv`) und werden mit dem Tool ausgeliefert, auch in der Demo. Wirkung: neue Projekte. Bestehende Projekte behalten ihre eigenen Werte, Anwender können Farben und Grafik im Projekt weiter ändern.

## Sicherheit – was das Paket leistet und was nicht

Geleistet: Anmeldelinks gelten 15 Minuten und einmal; sie werden nur als Prüfsumme gespeichert; die Anmeldung zeigt nie, ob eine Adresse bekannt ist; Begrenzung der Anfragen; Cookies sind `HttpOnly`/`SameSite`; Schreibzugriffe brauchen einen Kopfzeilen-Schutz; Sperren wirkt sofort.

**Schutz des Tools (ab v330):** Besucher ohne Anmeldung bekommen nur `maad-demo.html`, in der die gesperrten Funktionen im Code fehlen (nicht nur ausgeblendet). Die Vollversion wird erst nach Anmeldung ausgeliefert. Fehlt die Demo-Datei, liefert der Server niemals ersatzweise die Vollversion aus (Fehlermeldung). Jede ausgelieferte Vollversion enthält eine unsichtbare Kennung des Kunden (Kommentare im Quelltext und Nullbreite-Zeichen im Seitentitel). Taucht eine Kopie auf, die Kennung (12 Zeichen, z. B. in `<!--maad-lizenz:...-->`) abfragen: `https://getmaad.de/api/admin/wm?id=KENNUNG` (als angemeldeter Administrator) nennt den Kunden.

**Grenze:** Ein angemeldeter Kunde erhält den Code der Vollversion im Browser und kann ihn speichern; das lässt sich bei einer Browser-Anwendung nicht verhindern. Die Kennung macht Weitergabe nachvollziehbar, ersetzt aber keine Nutzungsbedingungen. Die Demo enthält weiterhin den Rest des Tools (Ansicht, Planen, Auswertung), nur die gesperrten Funktionen fehlen.

Außerdem liegen Projekte bisher nur im Browser (IndexedDB) der Kunden, nicht auf dem Server.

## Lokal ausprobieren (ohne Server)

```
cp config.example.json config.json   # base_url auf http://127.0.0.1:8080 setzen, smtp leer lassen
python3 maadserver.py config.json
```

Ohne SMTP-Eintrag schreibt der Server die E-Mails in `data/outbox.log`. Dort steht der Anmeldelink.
