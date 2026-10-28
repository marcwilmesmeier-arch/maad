// Lint für das zusammengesetzte Skript; Meldungen werden auf src/js/<datei>:<zeile> zurückgeführt.
// Funktionen, die per `window.name = …` bereitgestellt werden, gelten automatisch als bekannt.
//
// Aufruf: npm run lint   (baut vorher dist/bundle.js)

import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'dist/bundle.js'), 'utf8');
const map = JSON.parse(readFileSync(join(ROOT, 'dist/bundle.map.json'), 'utf8'));

const windowGlobals = Object.fromEntries(
  [...bundle.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => [m[1], 'writable']),
);

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: { files: ['dist/bundle.js'], languageOptions: { globals: windowGlobals } },
});
const [result] = await eslint.lintText(bundle, { filePath: join(ROOT, 'dist/bundle.js') });

/** Bündelzeile -> { file, line } in der Quelldatei. */
function locate(line) {
  let hit = map[0];
  for (const m of map) if (m.startLine <= line) hit = m;
  return { file: hit.file, line: line - hit.startLine + 1 };
}

let errors = 0;
let warnings = 0;
const byRule = {};
for (const m of result.messages) {
  const { file, line } = locate(m.line);
  const level = m.severity === 2 ? 'Fehler ' : 'Hinweis';
  if (m.severity === 2) errors++;
  else warnings++;
  byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
  if (m.severity === 2 || process.argv.includes('--alle')) {
    console.log(`${file}:${line}:${m.column}  ${level}  ${m.message}  (${m.ruleId})`);
  }
}
console.log(`\n${errors} Fehler, ${warnings} Hinweise`, byRule);
if (!process.argv.includes('--alle') && warnings)
  console.log('Alle Hinweise anzeigen: node tools/lint.mjs --alle');
process.exit(errors ? 1 : 0);
