#!/bin/sh
# Als root auf dem Server ausführen, im entpackten Ordner:  sh install.sh
set -e
apt-get update
apt-get install -y python3 caddy
id maad >/dev/null 2>&1 || useradd --system --home /opt/maad --shell /usr/sbin/nologin maad
mkdir -p /opt/maad /etc/maad /var/lib/maad
cp maadserver.py login.html admin.html /opt/maad/
[ -f maad.html ] && cp maad.html /opt/maad/maad.html
[ -f maad-demo.html ] && cp maad-demo.html /opt/maad/maad-demo.html
[ -f /etc/maad/config.json ] || { cp config.example.json /etc/maad/config.json; echo ">>> /etc/maad/config.json anpassen!"; }
chown -R maad:maad /var/lib/maad
chmod 640 /etc/maad/config.json; chgrp maad /etc/maad/config.json
cp maadserver.service /etc/systemd/system/maadserver.service
systemctl daemon-reload
systemctl enable maadserver
echo "Fertig. Danach: Caddyfile anpassen (cp Caddyfile /etc/caddy/Caddyfile), systemctl restart maadserver caddy"
