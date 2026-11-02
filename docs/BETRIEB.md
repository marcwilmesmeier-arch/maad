# maad-Server einrichten und betreiben (IONOS VPS, Ubuntu 24.04)

Der Server liefert maad an Kunden aus: Mandanten (Kundenfirmen) mit eigenen Admins, Nutzern, Gruppen und Rechten,
Projekte auf dem Server, Anmeldung mit E-Mail und Passwort. Er braucht nur **Node.js** und **Caddy** (HTTPS), keine
weiteren Programme oder Bibliotheken.

## 1. Vorbereiten (einmalig, bei IONOS)

1. **VPS** bestellen, Betriebssystem **Ubuntu 24.04**. Für rund 30 Nutzer genügt der kleinste Tarif mit 2 GB RAM;
   Speicher nach Projektgröße wählen (Projekte mit Kartenausschnitt: je etwa 2–20 MB).
2. **Domain** (z. B. `getmaad.de`): im DNS einen **A-Record** auf die IPv4-Adresse des VPS setzen.
3. **Postfach** für den Versand (z. B. `zugang@getmaad.de`, IONOS Mail Basic). SMTP: `smtp.ionos.de`, Port 587,
   Benutzer = volle Adresse.
4. **Firewall** (IONOS-Panel → Netzwerk → Firewall): nur Ports **22, 80, 443** offen.
5. **MapTiler**: Schlüssel im MapTiler-Konto auf die Domain beschränken („Allowed HTTP origins“) und einen Tarif
   wählen, der für mehrere Kunden passt.

## 2. Paket bauen und hochladen

Auf dem eigenen Rechner im Projektordner:

```bash
npm run paket
```

Das erzeugt `dist/maad-server-paket.tar.gz`. Hochladen und anmelden:

```bash
scp dist/maad-server-paket.tar.gz root@SERVER-IP:/root/
```

```bash
ssh root@SERVER-IP
```

## 3. Installieren

```bash
cd /root && tar xzf maad-server-paket.tar.gz && cd maad-server && sh server/betrieb/install.sh
```

Das Skript installiert Node.js 24 und Caddy, legt den Systembenutzer `maad` an, kopiert alles nach `/opt/maad`,
richtet den Dienst, die tägliche Sicherung und automatische Sicherheitsupdates ein.

Danach die Einstellungen eintragen:

```bash
nano /etc/maad/konfig.json
```

| Eintrag        | Bedeutung                                                      |
| -------------- | -------------------------------------------------------------- |
| `base_url`     | öffentliche Adresse, z. B. `https://getmaad.de`                |
| `betreiber`    | E-Mail-Adresse(n) der Betreiber – sie verwalten alle Mandanten |
| `smtp.*`       | Zugang des Postfachs (Passwort hier eintragen)                 |
| `maptiler_key` | MapTiler-Schlüssel (steht nur auf dem Server, nie in der Demo) |
| `sitzung_tage` | wie lange eine Anmeldung gilt (Standard 14)                    |
| `passwort_min` | Mindestlänge von Passwörtern (Standard 10)                     |

Dann HTTPS einrichten (Domain in der Datei prüfen) und starten:

```bash
cp server/betrieb/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy && systemctl restart maad
```

```bash
systemctl status maad
```

## 4. Erster Start

1. `https://getmaad.de/anmelden` öffnen → **„Passwort vergessen oder noch keines festgelegt?“** → Betreiber-Adresse
   eingeben. Mit dem Link aus der E-Mail das eigene Passwort festlegen.
2. Oben rechts im Tool **Verwaltung** → **Mandant anlegen** (Name, Abo, Höchstzahl Nutzer, Laufzeit).
3. Mandant **öffnen** → den ersten Nutzer mit Rolle **Mandanten-Admin** einladen. Er erhält eine E-Mail, legt sein
   Passwort fest und verwaltet ab dann Nutzer und Gruppen seiner Firma selbst.

## 5. Rollen und Rechte

| Rolle           | Darf                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Betreiber       | Mandanten anlegen, Abo/Rechte/Laufzeit/Nutzerzahl festlegen, sperren, löschen; in jeden Mandanten schauen; Voreinstellungen des Tools für alle Anwender. Sieht **keine** Kundenprojekte. |
| Mandanten-Admin | Nutzer und Gruppen des eigenen Mandanten; alle Projekte des eigenen Mandanten; hat alle Rechte des Abos.                                                                                 |
| Nutzer          | Rechte seiner Gruppen (nie mehr als das Abo erlaubt).                                                                                                                                    |

Rechte: Neues Projekt, Projekte öffnen/speichern, Excel-Export, IFC-Export, Detailstufen, Projekte im Team teilen,
eigene Datenquellen. Fehlt ein Recht, fehlt die Funktion **im ausgelieferten Code** (nicht nur ausgeblendet).
Ohne Anmeldung sieht jeder die **Demo** (ohne Projektablage und Exporte, ohne Kartenschlüssel).

## 6. Betrieb

- **Tool oder Server aktualisieren:** neues Paket bauen, hochladen, entpacken und `sh server/betrieb/install.sh`
  erneut ausführen. Konfiguration und Daten bleiben erhalten.
- **Sicherung:** täglich 03:15 nach `/var/backups/maad/maad-<Datum>` (Datenbank und Projekte, 30 Tage). Zusätzlich
  regelmäßig auf den eigenen Rechner holen: `scp -r root@SERVER-IP:/var/backups/maad ./sicherung`.
- **Wiederherstellen:** `systemctl stop maad`, Inhalt eines Sicherungsordners nach `/var/lib/maad` kopieren
  (`maad.db` und `projekte/`), `chown -R maad:maad /var/lib/maad`, `systemctl start maad`.
- **Protokoll:** in der Verwaltung je Mandant; technisch `journalctl -u maad -n 100`.
- **Kommen keine E-Mails an:** Protokoll in der Verwaltung (Ereignis `mail_fehler`) und `journalctl -u maad`.
  Häufig: falsches Mailpasswort oder Spam-Ordner.
- **Daten:** `/var/lib/maad/maad.db` (SQLite) und `/var/lib/maad/projekte/<Mandant>/`.

## 7. Sicherheit – was der Server leistet und was nicht

Geleistet:

- Passwörter nur als scrypt-Prüfsumme; Einladungs-/Zurücksetzen-Links einmalig und befristet, nur als Prüfsumme
  gespeichert; nach 8 Fehlversuchen 15 Minuten Kontosperre; Anfragebegrenzung; die Anmeldung verrät nie, ob eine
  Adresse bekannt ist.
- Sitzungs-Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; Schreibzugriffe nur mit Schutz-Kopfzeile aus der eigenen
  Herkunft; Sicherheits-Kopfzeilen; strenge Content-Security-Policy auf Anmelde- und Verwaltungsseiten.
- Mandantentrennung in jeder Abfrage, durch automatische Tests abgesichert (`tests/server/api.test.mjs`).
- Rechte werden auf dem Server geprüft und der Code fehlender Funktionen gar nicht erst ausgeliefert.
- Weiterleitung für Geodienste nur für Angemeldete, nur https und nur an öffentliche Adressen.
- Dienst läuft als eigener Benutzer mit stark eingeschränkten Rechten (systemd-Härtung).

Grenzen:

- Angemeldete Kunden erhalten den Code ihrer Fassung im Browser; eine Kundenkennung macht Weitergabe nachvollziehbar
  (Prüfen: Verwaltung → „Kundenkennung prüfen“). Nutzungsbedingungen bleiben nötig.
- Rechtliches (Impressum, Datenschutzerklärung, Auftragsverarbeitung mit IONOS und MapTiler) ist nicht Teil des
  Servers.
- Eine Zwei-Faktor-Anmeldung ist noch nicht eingebaut (siehe `docs/TECHNISCHE-SCHULDEN.md`).

## Lokal ausprobieren

```bash
npm run build && npm start -- server/betrieb/konfig.lokal.json
```

Mit einer eigenen `konfig.lokal.json` (`base_url` `http://127.0.0.1:8080`, `data_dir` z. B. `./server/daten`,
`betreiber` eintragen, `smtp` weglassen): E-Mails landen dann in `server/daten/outbox.log`, dort steht der Link.
