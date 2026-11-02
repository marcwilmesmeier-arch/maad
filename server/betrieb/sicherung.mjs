// Sicherung: Datenbank konsistent (VACUUM INTO, auch während der Server läuft) und Projektdateien in einen
// Ordner je Tag; ältere Sicherungen als <tage> Tage werden gelöscht.
// Aufruf: node sicherung.mjs <data_dir> <ziel> [tage=30]
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, cpSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [daten, ziel, tageArg] = process.argv.slice(2);
if (!daten || !ziel) {
  console.error('Aufruf: node sicherung.mjs <data_dir> <ziel> [tage]');
  process.exit(2);
}
const tage = Number(tageArg) || 30;
const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const ordner = join(ziel, 'maad-' + stempel);
mkdirSync(ordner, { recursive: true });

const db = new DatabaseSync(join(daten, 'maad.db'), { readOnly: true });
db.exec(`VACUUM INTO '${join(ordner, 'maad.db').replace(/'/g, "''")}'`);
db.close();
if (existsSync(join(daten, 'projekte')))
  cpSync(join(daten, 'projekte'), join(ordner, 'projekte'), { recursive: true });

const grenze = Date.now() - tage * 86400000;
for (const n of readdirSync(ziel))
  if (n.startsWith('maad-') && statSync(join(ziel, n)).mtimeMs < grenze)
    rmSync(join(ziel, n), { recursive: true, force: true });
console.log('Sicherung erstellt:', ordner);
