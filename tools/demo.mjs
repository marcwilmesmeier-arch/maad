// Erzeugt aus dist/maad.html die Demo dist/maad-demo.html: Funktionen, die ein Recht voraussetzen, werden im
// Code durch einen Sperrhinweis ersetzt (nicht nur ausgeblendet). Die Demo enthält damit weder Projektablage
// noch Excel-/IFC-Export. MapTiler-Schlüssel und Proxy-Adresse entfernt der Server beim Ausliefern.
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

/** Ersetzt die Rümpfe der Funktionen zu den gesperrten Rechten; liefert neues HTML. */
export function sperren(html, rechte) {
  const a = html.indexOf('// ── src/js/');
  const b = html.lastIndexOf('</script></body>');
  if (a < 0 || b < 0) throw new Error('Skriptbereich in maad.html nicht gefunden');
  const js = html.slice(a, b);
  const ast = espree.parse(js, { ecmaVersion: 'latest', range: true });
  const ziel = new Map();
  for (const r of rechte) for (const f of SPERREN[r]) ziel.set(f, r);
  const edits = [];
  for (const s of ast.body) {
    let name = null,
      fn = null;
    if (s.type === 'FunctionDeclaration') ((name = s.id.name), (fn = s));
    if (!name || !ziel.has(name)) continue;
    edits.push({ a: fn.body.range[0], b: fn.body.range[1], t: `{ return accDeny('demo'); }`, name });
  }
  const fehlt = [...ziel.keys()].filter((n) => !edits.some((e) => e.name === n));
  if (fehlt.length) throw new Error('Zu sperrende Funktionen nicht gefunden: ' + fehlt.join(', '));
  let out = js;
  for (const e of edits.sort((x, y) => y.a - x.a)) out = out.slice(0, e.a) + e.t + out.slice(e.b);
  return html.slice(0, a) + out + html.slice(b);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const full = readFileSync(join(ROOT, 'dist/maad.html'), 'utf8');
  const demo = sperren(full, Object.keys(SPERREN));
  writeFileSync(join(ROOT, 'dist/maad-demo.html'), demo);
  const n = Object.values(SPERREN).flat().length;
  console.log(
    `dist/maad-demo.html gebaut: ${n} Funktionen gesperrt, ${(Buffer.byteLength(demo) / 1e6).toFixed(2)} MB`,
  );
}
