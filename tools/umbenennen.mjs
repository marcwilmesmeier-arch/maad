// Benennt einen globalen Namen in allen Dateien unter src/js um – nur echte Bezüge auf die globale
// Deklaration (lokale Variablen gleichen Namens bleiben unberührt). Vorkommen in Zeichenketten
// (z. B. onclick="alt()" in HTML-Strings) werden nicht geändert, sondern gemeldet.
//
// Aufruf: node tools/umbenennen.mjs <alt> <neu> [--auch-strings]
//   --auch-strings  ersetzt zusätzlich "alt(" in Zeichenketten und src/index.html durch "neu("

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import * as escope from 'eslint-scope';
import { bundleScripts } from './build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [alt, neu] = process.argv.slice(2);
const strings = process.argv.includes('--auch-strings');
const ID = /^[A-Za-z_$][\w$]*$/;
if (!ID.test(alt || '') || !ID.test(neu || '')) {
  console.error('Aufruf: node tools/umbenennen.mjs <alt> <neu> [--auch-strings]');
  process.exit(2);
}

// Gesamtskript mit Dateimarken (wie im Build) analysieren
const { text } = bundleScripts();
const ast = espree.parse(text, { ecmaVersion: 'latest', range: true, loc: true });
const scopes = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
const g = scopes.globalScope;
if (!g.set.has(alt)) {
  console.error(`„${alt}“ ist auf oberster Ebene nicht deklariert.`);
  process.exit(1);
}
if (g.set.has(neu) || g.through.some((r) => r.identifier.name === neu)) {
  console.error(`„${neu}“ wird bereits verwendet.`);
  process.exit(1);
}
// Würde der neue Name irgendwo durch eine lokale Variable verdeckt, an Stellen, die alt benutzen?
const v = g.set.get(alt);
// In klassischen Skripten löst eslint-scope Bezüge auf globale Namen nicht auf (sie landen in "through").
const refs = [...v.references, ...g.through.filter((r) => r.identifier.name === alt)];
const conflicts = refs.filter((r) => {
  for (let s = r.from; s && s !== g; s = s.upper) if (s.set.has(neu)) return true;
  return false;
});
if (conflicts.length) {
  console.error(`„${neu}“ ist an ${conflicts.length} Stelle(n) lokal vergeben, wo „${alt}“ benutzt wird.`);
  process.exit(1);
}

const edits = [...v.identifiers, ...refs.map((r) => r.identifier)]
  .filter((id, i, a) => a.indexOf(id) === i)
  .map((id) => ({ a: id.range[0], b: id.range[1], t: neu }));

// Zeichenketten und Kommentare mit "alt(" melden bzw. ersetzen
const found = [];
const re = new RegExp(`(?<![\\w$.])${alt.replace(/\$/g, '\\$')}\\(`, 'g');
(function walk(n) {
  if (!n || typeof n.type !== 'string') return;
  if ((n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateElement') {
    const raw = text.slice(n.range[0], n.range[1]);
    for (const m of raw.matchAll(re)) {
      found.push(n.range[0] + m.index);
      if (strings) edits.push({ a: n.range[0] + m.index, b: n.range[0] + m.index + alt.length, t: neu });
    }
  }
  for (const k in n) {
    if (k === 'range' || k === 'loc') continue;
    const c = n[k];
    if (Array.isArray(c)) c.forEach(walk);
    else if (c && typeof c.type === 'string') walk(c);
  }
})(ast);

edits.sort((x, y) => y.a - x.a);
let out = text;
for (const e of edits) out = out.slice(0, e.a) + e.t + out.slice(e.b);

// zurück in die Dateien (Dateimarken trennen)
const parts = out.split(/^\/\/ ── (src\/js\/[^ ]+) ──\n/m);
let files = 0;
for (let i = 1; i < parts.length; i += 2) {
  const p = join(ROOT, parts[i]);
  const before = readFileSync(p, 'utf8');
  // der Build ergänzt fehlende Zeilenenden; diese nicht in die Datei zurückschreiben
  const after =
    !before.endsWith('\n') && parts[i + 1].endsWith('\n') ? parts[i + 1].slice(0, -1) : parts[i + 1];
  if (before !== after) {
    writeFileSync(p, after);
    files++;
  }
}
// index.html (onclick-Attribute)
const htmlPath = join(ROOT, 'src/index.html');
const html = readFileSync(htmlPath, 'utf8');
const inHtml = [...html.matchAll(re)].length;
if (strings && inHtml) writeFileSync(htmlPath, html.replace(re, neu + '('));

console.log(`${alt} -> ${neu}: ${refs.length} Bezüge in ${files} Datei(en) geändert.`);
const lineOf = (p) => text.slice(0, p).split('\n').length;
if (found.length || inHtml) {
  const verb = strings ? 'ersetzt' : 'NICHT geändert – prüfen oder mit --auch-strings wiederholen';
  console.log(`Vorkommen in Zeichenketten: ${found.length}, in src/index.html: ${inHtml} (${verb})`);
  if (!strings) for (const p of found.slice(0, 10)) console.log('  Bündelzeile', lineOf(p));
}
