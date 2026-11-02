#!/bin/sh
# Tägliche Sicherung der Kundendatenbank (per cron: 0 3 * * * sh /opt/maad/backup.sh)
mkdir -p /var/backups/maad
python3 - <<'P'
import sqlite3,time
s=sqlite3.connect('/var/lib/maad/maad.db');d=sqlite3.connect('/var/backups/maad/maad-%s.db'%time.strftime('%Y%m%d'))
s.backup(d);d.close();s.close()
P
find /var/backups/maad -name 'maad-*.db' -mtime +30 -delete
