#!/bin/sh
# maad-Server auf Ubuntu 24.04 einrichten. Als root im entpackten Paketordner ausführen:  sh betrieb/install.sh
# Wiederholbar: aktualisiert Programmdateien, lässt Konfiguration und Daten unverändert.
set -eu

if [ "$(id -u)" != 0 ]; then echo "Bitte als root ausführen (sudo sh betrieb/install.sh)."; exit 1; fi
cd "$(dirname "$0")/.."

echo ">>> Pakete"
apt-get update
apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades

# Node.js 24 (LTS) aus dem offiziellen NodeSource-Paketquelle
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

# Caddy (HTTPS mit automatischem Zertifikat)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo ">>> Benutzer und Verzeichnisse"
id maad >/dev/null 2>&1 || useradd --system --home /opt/maad --shell /usr/sbin/nologin maad
mkdir -p /opt/maad /etc/maad /var/lib/maad /var/backups/maad
rm -rf /opt/maad/server /opt/maad/dist
cp -r server dist /opt/maad/
chown -R root:root /opt/maad
chmod -R a+rX,go-w /opt/maad
chown maad:maad /var/lib/maad /var/backups/maad
chmod 750 /var/lib/maad /var/backups/maad

if [ ! -f /etc/maad/konfig.json ]; then
  cp server/betrieb/konfig.beispiel.json /etc/maad/konfig.json
  echo ">>> /etc/maad/konfig.json anlegen: Domain, Betreiber-Adresse, Mailzugang, MapTiler-Schlüssel eintragen!"
fi
chown root:maad /etc/maad/konfig.json
chmod 640 /etc/maad/konfig.json

echo ">>> Dienste"
cp server/betrieb/maad.service server/betrieb/maad-sicherung.service server/betrieb/maad-sicherung.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable maad.service maad-sicherung.timer
systemctl restart maad.service
systemctl start maad-sicherung.timer

echo ">>> Automatische Sicherheitsupdates des Systems"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Fertig. Als Nächstes:"
echo "  1. nano /etc/maad/konfig.json   (falls noch nicht geschehen), danach: systemctl restart maad"
echo "  2. Domain in server/betrieb/Caddyfile prüfen, dann: cp server/betrieb/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy"
echo "  3. Status: systemctl status maad  ·  Protokoll: journalctl -u maad -n 50"
