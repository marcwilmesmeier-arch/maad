// Vergleichslauf zweier Builds: spielt in beiden denselben Ablauf durch (Demokarte öffnen,
// Grundstück und Gebäude anlegen, Reiter, Darstellungen, Layer, Werkzeuge …) und vergleicht
// nach jedem Schritt Anwendungszustand und sichtbare Texte. Für Umbauten, die das Verhalten
// nicht ändern sollen.
//
// Aufruf: node tools/vergleich.mjs <referenz.html> [kandidat.html=dist/maad.html]
//
// Zufall und Uhrzeit sind festgelegt. Werte, die sich schon zwischen zwei Läufen derselben
// Datei unterscheiden (Animationen), werden ignoriert.

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [refFile, candFile = join(ROOT, 'dist/maad.html')] = process.argv.slice(2);
if (!refFile) {
  console.error('Aufruf: node tools/vergleich.mjs <referenz.html> [kandidat.html]');
  process.exit(2);
}
const lib = (p) => readFileSync(join(ROOT, 'node_modules', p));
const LIBS = [
  [/three\.min\.js$/, 'three/build/three.min.js', 'text/javascript'],
  [/maplibre-gl\.js$/, 'maplibre-gl/dist/maplibre-gl.js', 'text/javascript'],
  [/maplibre-gl\.css$/, 'maplibre-gl/dist/maplibre-gl.css', 'text/css'],
];

/** Läuft im Browser vor dem App-Skript: Zufall und Zeit deterministisch machen. */
function deterministic() {
  let seed = 42;
  Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let t = 1_790_000_000_000;
  Date.now = () => (t += 7);
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;
}

/** Läuft im Browser: Ablauf mit Momentaufnahmen. */
async function scenario() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = () => {
    const seen = new WeakSet();
    const plain = (v, d) => {
      if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
      if (d > 6 || seen.has(v)) return '…';
      if (v.isObject3D || v.isMaterial || v.isBufferGeometry || v.isTexture || v instanceof Node)
        return '[3d/dom]';
      seen.add(v);
      if (v instanceof Map) return plain([...v.entries()], d + 1);
      if (v instanceof Set) return plain([...v], d + 1);
      if (ArrayBuffer.isView(v)) return `[${v.constructor.name} ${v.length}]`;
      if (Array.isArray(v)) return v.slice(0, 200).map((x) => plain(x, d + 1));
      const o = {};
      for (const k of Object.keys(v).slice(0, 300)) o[k] = plain(v[k], d + 1);
      return o;
    };
    const txt = (id) => {
      const e = document.getElementById(id);
      return e ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000) : null;
    };
    let meshes = 0;
    sc.traverse((o) => o.isMesh && o.visible && meshes++);
    return {
      S: plain(S, 0),
      ui: {
        pc: txt('pc'),
        tabs: txt('tabs'),
        hud: txt('hud'),
        lyp: txt('lyp'),
        lc: txt('lc'),
        vc: txt('vc'),
      },
      szene: {
        sichtbareNetze: meshes,
        gruppen: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.children.length])),
      },
    };
  };
  const out = [];
  const errs = [];
  // Schritt ausführen; Momentaufnahme nur, wenn gewünscht (sonst Fehler sammeln bis zur nächsten)
  const step = async (name, fn, ms = 300, aufnahme = true) => {
    console.log('[schritt] ' + name);
    try {
      await fn();
    } catch (e) {
      errs.push(name + ': ' + String((e && e.message) || e));
    }
    await wait(ms);
    if (aufnahme) out.push({ name, err: errs.splice(0).join(' | ') || null, ...snap() });
  };

  await step('geladen', () => {}, 500);
  await step('Demokarte öffnen', () => homeDemoOpen(), 3000);
  const c = [GEO.N ? 0 : 0, 0];
  await step('Grundstück anlegen', () =>
    siteMake(
      [
        [c[0] - 25, c[1] - 20],
        [c[0] + 25, c[1] - 20],
        [c[0] + 25, c[1] + 20],
        [c[0] - 25, c[1] + 20],
      ],
      'Test',
    ),
  );
  await step('Zeichenform Rechteck', () => setShape('rect', 'bld'));
  await step('Grundfläche zeichnen', () =>
    finish([
      [-10, -8],
      [10, -8],
      [10, 8],
      [-10, 8],
    ]),
  );
  await step('Gebäude erzeugen', () => mk(), 800);
  for (const tab of ['Planen', 'Analyse', 'Import', 'Planen'])
    await step('Reiter ' + tab, () => {
      S.tab = tab;
      rr();
    });
  for (const m of DAR.map((d) => d[0])) await step('Darstellung ' + m, () => drSet(m), 400);
  await step('Darstellung sch', () => drSet('sch'), 400);
  for (let i = 0; i < LY.length; i++) await step('Layer aus ' + LY[i][1], () => lvis(i, false), 20, false);
  await step('alle Layer aus', () => {}, 300);
  for (let i = 0; i < LY.length; i++) await step('Layer an ' + LY[i][1], () => lvis(i, true), 20, false);
  await step('alle Layer an', () => {}, 300);
  for (const t of ['v', 'f', 'm', 't', 'v']) await step('Werkzeug ' + t, () => tool(t));
  for (const k of BA.map((a) => a.k))
    await step(
      'Aktion ' + k,
      () => {
        baDo(k);
        tool('v');
      },
      50,
      false,
    );
  await step('alle Aktionen', () => {}, 300);
  await step('2D', () => setMode(0), 600);
  await step('3D', () => setMode(1), 600);
  await step('Variante speichern', () => sv('Test'));
  await step('Rückgängig', () => undo());
  await step('Escape', () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  return out;
}

async function run(file) {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(deterministic);
  await page.route(/^https?:\/\//, (route) => {
    const hit = LIBS.find(([re]) => re.test(route.request().url()));
    return hit ? route.fulfill({ body: lib(hit[1]), contentType: hit[2] }) : route.abort();
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text().split('\n')[0];
    if (t.startsWith('[schritt]')) {
      if (process.env.VERBOSE) console.log(new Date().toISOString().slice(11, 19), t);
      return;
    }
    if (
      (m.type() === 'error' || t.startsWith('[maad]')) &&
      !/Failed to (load resource|fetch)|ERR_FAILED/.test(t)
    )
      errors.push(m.type() + ': ' + t);
  });
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForTimeout(1500);
  const steps = await page.evaluate(scenario);
  await browser.close();
  return { steps, errors };
}

const IGNORE = [/^\.S\.project\._last$/];

/** Pfade, an denen sich a und b unterscheiden. */
function diffs(a, b, p = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffs(a[k], b[k], p + '.' + k, out);
  } else out.push(p);
  return out;
}

console.log('Referenz und Kandidat laufen je zweimal parallel …');
const [ref1, ref2, cand, cand2] = await Promise.all([
  run(refFile),
  run(refFile),
  run(candFile),
  run(candFile),
]);

let bad = 0;
for (let i = 0; i < ref1.steps.length; i++) {
  const noise = new Set([...diffs(ref1.steps[i], ref2.steps[i]), ...diffs(cand.steps[i], cand2.steps[i])]);
  // S.project._last: Zwischenstand der automatischen Sicherung, hängt vom Zeitpunkt ab
  const d = diffs(ref1.steps[i], cand.steps[i]).filter(
    (p) => !noise.has(p) && !IGNORE.some((re) => re.test(p)),
  );
  if (d.length) {
    bad++;
    console.log(`✗ ${ref1.steps[i].name}: ${d.length} Abweichungen`);
    for (const p of d.slice(0, 8)) {
      const get = (o) =>
        p
          .split('.')
          .slice(1)
          .reduce((x, k) => (x == null ? x : x[k]), o);
      console.log(
        `    ${p}\n      Referenz: ${JSON.stringify(get(ref1.steps[i]))?.slice(0, 160)}\n      Kandidat: ${JSON.stringify(get(cand.steps[i]))?.slice(0, 160)}`,
      );
    }
  }
}
const stepErr = (r) => r.steps.filter((s) => s.err).map((s) => s.name + ': ' + s.err);
console.log(`\n${ref1.steps.length} Schritte, ${bad} mit Abweichungen.`);
console.log('Schrittfehler Referenz:', stepErr(ref1), '\nSchrittfehler Kandidat:', stepErr(cand));
console.log('Konsolenfehler Referenz:', [...new Set(ref1.errors)], '\nKonsolenfehler Kandidat:', [
  ...new Set(cand.errors),
]);
process.exit(bad ? 1 : 0);
