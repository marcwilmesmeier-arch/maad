// Sperrstellen: Funktionen, die ein Recht voraussetzen, werden für Nutzer ohne dieses Recht im ausgelieferten
// Code durch einen Sperrhinweis ersetzt (nicht nur ausgeblendet). Die Demo ist die Fassung ohne alle Rechte.
// Erzeugt dist/maad.sperren.json (für den Server) und zum Ansehen dist/maad-demo.html.
//
// Aufruf: node tools/demo.mjs   (läuft automatisch in npm run build)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Recht -> Funktionen, die ohne dieses Recht im Code fehlen. */
export const SPERREN = {
  project_new: ['homeCreate', 'wzOpen', 'wzNext', 'wzGo'],
  project_open: ['projSave', 'projOpen'],
  export_xlsx: [
    'xlInit',
    'xlSave0',
    'xlSheet',
    'xlSt',
    'xlTbl',
    'xlSumRow',
    'xlVal',
    'xlWalls',
    'xlRoof',
    'xlTerr',
    'xlSel',
    'xlPng',
    'xlDecomp',
    'xlAng',
    'xlPlan',
    'xlAddImg',
    'xlPlace',
    'xlRows',
    'xlPlans',
    'xlTail',
    'xlSitePlan',
    'xlIso',
    'xlBuild',
    'xlExport',
    'xlOpen',
    'xlClose',
    'xlPut',
    'xlRender',
    'xlSelS',
    'xlBld',
    'xlAll',
    'xlReset',
  ],
  export_ifc: [
    'ifcDef',
    'ifcCfgFix',
    'ifcS',
    'ifcR',
    'ifcDms',
    'ifcH128',
    'ifcGuidBytes',
    'ifcGuid',
    'ifcGuidRand',
    'ifcWriter',
    'ifcSplit',
    'ifcCheck',
    'ifcDPoly',
    'ifcSrc',
    'ifcCounts',
    'ifcClean',
    'ifcCCW',
    'ifcInset',
    'ifcSoup',
    'ifcWeld',
    'ifcTriArea',
    'ifcPolyTris',
    'ifcHex',
    'ifcBuild',
    'ifcCfgGet',
    'ifcSave',
    'ifcPut',
    'ifcCatOn',
    'ifcCatCls',
    'ifcCatPre',
    'ifcCatOt',
    'ifcReset',
    'ifcPreOpts',
    'ifcTreeHtml',
    'ifcRender',
    'ifcLogHtml',
    'ifcOpen',
    'ifcClose',
    'ifcExport',
    'ifcRegCheck',
  ],
};

/**
 * Stellen in maad.html, an denen die Funktionen zu jedem Recht stehen: { recht: [[von, bis, ersatz], …] }.
 * Der Server ersetzt diese Bereiche für Nutzer ohne das Recht (und in der Demo für alle Rechte).
 * Positionen sind Zeichenindizes (JavaScript-Strings) in der gesamten HTML-Datei.
 */
export function sperrStellen(html) {
  const a = html.indexOf('// ── src/js/');
  const b = html.indexOf('</script>', a); // Ende des Programmcodes (Skript id="maadApp")
  if (a < 0 || b < 0) throw new Error('Skriptbereich in maad.html nicht gefunden');
  const ast = espree.parse(html.slice(a, b), { ecmaVersion: 'latest', range: true });
  const pos = new Map();
  for (const s of ast.body) if (s.type === 'FunctionDeclaration') pos.set(s.id.name, s.body.range);
  const out = {};
  for (const [recht, namen] of Object.entries(SPERREN)) {
    const fehlt = namen.filter((n) => !pos.has(n));
    if (fehlt.length)
      throw new Error(`Zu sperrende Funktionen (${recht}) nicht gefunden: ${fehlt.join(', ')}`);
    out[recht] = namen.map((n) => [a + pos.get(n)[0], a + pos.get(n)[1], `{ return accDeny('${recht}'); }`]);
  }
  return out;
}

/** Wendet Sperrstellen für die fehlenden Rechte an (gleiche Logik wie im Server). */
export function sperren(html, stellen, fehlendeRechte) {
  const L = fehlendeRechte.flatMap((r) => stellen[r] || []).sort((x, y) => y[0] - x[0]);
  for (const [von, bis, ersatz] of L) html = html.slice(0, von) + ersatz + html.slice(bis);
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const full = readFileSync(join(ROOT, 'dist/maad.html'), 'utf8');
  const stellen = sperrStellen(full);
  writeFileSync(join(ROOT, 'dist/maad.sperren.json'), JSON.stringify(stellen));
  const demo = sperren(full, stellen, Object.keys(SPERREN));
  writeFileSync(join(ROOT, 'dist/maad-demo.html'), demo); // zum Ansehen/Prüfen; der Server erzeugt sie selbst
  const n = Object.values(SPERREN).flat().length;
  console.log(`dist/maad.sperren.json gebaut: ${n} Funktionen zu ${Object.keys(SPERREN).length} Rechten`);
}
