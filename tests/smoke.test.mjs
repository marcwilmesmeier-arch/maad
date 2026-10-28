// Rauchtest: lädt dist/maad.html in Chromium und bedient die Hauptbereiche einmal.
// Schlägt fehl, wenn ein unbehandelter Fehler auftritt. Von logErr protokollierte,
// abgefangene Fehler werden aufgelistet, lassen den Test aber bestehen.
//
// three.js und MapLibre kommen aus node_modules (gleiche Versionen wie im CDN-Link),
// damit der Test ohne Netz läuft. Alle übrigen Netzabrufe werden blockiert.
// Eigener Browser: CHROMIUM_PATH=/pfad/zu/chrome npm test

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = (p) => readFileSync(join(ROOT, 'node_modules', p));
const LIBS = [
  [/three\.min\.js$/, 'three/build/three.min.js', 'text/javascript'],
  [/maplibre-gl\.js$/, 'maplibre-gl/dist/maplibre-gl.js', 'text/javascript'],
  [/maplibre-gl\.css$/, 'maplibre-gl/dist/maplibre-gl.css', 'text/css'],
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.route(/^https?:\/\//, (route) => {
  const hit = LIBS.find(([re]) => re.test(route.request().url()));
  return hit ? route.fulfill({ body: lib(hit[1]), contentType: hit[2] }) : route.abort();
});

const pageErrors = [];
const caught = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.text().startsWith('[maad]') && caught.push(m.text().split('\n')[0]));

await page.goto(pathToFileURL(join(ROOT, 'dist/maad.html')).href, { waitUntil: 'load', timeout: 90_000 });
await page.waitForTimeout(4000);

const steps = await page.evaluate(async () => {
  const out = {};
  const run = async (name, fn) => {
    try {
      await fn();
      out[name] = 'ok';
    } catch (e) {
      out[name] = 'FEHLER: ' + e.message;
    }
  };
  for (const tab of ['Planen', 'Analyse', 'Import']) {
    await run('Reiter ' + tab, () => {
      S.tab = tab;
      rr();
    });
  }
  await run('Werkzeuge', () => ['v', 'f', 't', 'v'].forEach((t) => tool(t)));
  await run('3D/2D', async () => {
    setMode(1);
    await new Promise((r) => setTimeout(r, 500));
    setMode(0);
  });
  await run('Projektpanel', () => geoPanel());
  return out;
});

await browser.close();

let failed = pageErrors.length > 0;
for (const [step, res] of Object.entries(steps)) {
  console.log(`${res === 'ok' ? '✓' : '✗'} ${step}${res === 'ok' ? '' : ' – ' + res}`);
  if (res !== 'ok') failed = true;
}
for (const e of pageErrors) console.log('✗ Unbehandelter Fehler:', e);
if (caught.length) {
  console.log(`\nAbgefangene Fehler (logErr, ${caught.length}) – prüfen, Test besteht trotzdem:`);
  for (const c of caught) console.log('  ' + c);
}
console.log(failed ? '\nRauchtest FEHLGESCHLAGEN' : '\nRauchtest bestanden');
process.exit(failed ? 1 : 0);
