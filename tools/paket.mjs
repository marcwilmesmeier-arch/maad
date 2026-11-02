// Baut das Installationspaket für den Server: dist/maad-server-paket.tar.gz
// Inhalt: Server (Quelltext, Seiten, Betriebsdateien), das gebaute Tool und die Anleitung.
// Aufruf: npm run paket   (baut vorher das Tool)
import { mkdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = join(ROOT, 'dist', 'paket', 'maad-server');
rmSync(join(ROOT, 'dist', 'paket'), { recursive: true, force: true });
mkdirSync(join(ZIEL, 'dist'), { recursive: true });
for (const d of ['src', 'seiten', 'betrieb'])
  cpSync(join(ROOT, 'server', d), join(ZIEL, 'server', d), { recursive: true });
for (const f of ['maad.html', 'maad.sperren.json']) cpSync(join(ROOT, 'dist', f), join(ZIEL, 'dist', f));
cpSync(join(ROOT, 'docs', 'BETRIEB.md'), join(ZIEL, 'ANLEITUNG.md'));
const tgz = join(ROOT, 'dist', 'maad-server-paket.tar.gz');
execFileSync('tar', ['-czf', tgz, '-C', join(ROOT, 'dist', 'paket'), 'maad-server']);
console.log('Paket gebaut:', tgz);
