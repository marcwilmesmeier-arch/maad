// Baut aus src/ wieder eine einzelne, eigenständige HTML-Datei (dist/maad.html).
//
// Die Quelldateien unter src/js werden in Pfadreihenfolge zu EINEM klassischen
// <script> zusammengesetzt. Die Reihenfolge ist Teil des Verhaltens (spätere
// Dateien erweitern Funktionen früherer Dateien) – deshalb tragen Ordner und
// Dateien Nummern. Neue Datei = passende Nummer wählen, sonst nichts.
//
// Aufruf: node tools/build.mjs [--raw]
//   --raw  ohne Dateimarken (nur zum Vergleich mit einer Referenzdatei)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const raw = process.argv.includes('--raw');

/** Alle Dateien unter dir, rekursiv, sortiert nach Pfad. */
function listFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? listFiles(p) : [p];
    });
}

/** Setzt alle Skriptdateien zusammen; liefert Text und eine Zeilenzuordnung für Werkzeuge. */
export function bundleScripts() {
  const files = listFiles(join(SRC, 'js')).filter((f) => f.endsWith('.js'));
  let text = '';
  const map = []; // [{ file, startLine }] – 1-basierte Zeile im Bündel, ab der die Datei beginnt
  for (const f of files) {
    const rel = relative(ROOT, f).replaceAll('\\', '/');
    let body = readFileSync(f, 'utf8');
    if (!raw) {
      if (!body.endsWith('\n')) body += '\n';
      text += `// ── ${rel} ──\n`;
    }
    map.push({ file: rel, startLine: text.split('\n').length });
    text += body;
  }
  return { text, map, files };
}

export function build() {
  const { text: js, map, files } = bundleScripts();
  let html = readFileSync(join(SRC, 'index.html'), 'utf8');
  html = html.replace(/@@include:([^@]+)@@/g, (_, p) => {
    const t = readFileSync(join(SRC, p), 'utf8');
    return raw ? t : t.replace(/\n$/, '');
  });
  if (!html.includes('@@scripts@@\n')) throw new Error('Platzhalter @@scripts@@ fehlt in src/index.html');
  html = html.replace('@@scripts@@\n', () => js);
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, 'maad.html'), html);
  writeFileSync(join(DIST, 'bundle.js'), js); // für Lint und Fehlersuche
  writeFileSync(join(DIST, 'bundle.map.json'), JSON.stringify(map, null, 1));
  return { files: files.length, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = build();
  console.log(`dist/maad.html gebaut: ${r.files} Skriptdateien, ${(r.bytes / 1e6).toFixed(2)} MB`);
}
