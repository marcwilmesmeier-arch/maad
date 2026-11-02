// Ende-zu-Ende-Test im Browser: startet den Server (server/src/server.mjs) mit Testkonfiguration und prüft
// Demo, Passwort festlegen über den Link, Vollversion im Tool, Verwaltungsseite und Abmelden.
// Aufruf: npm run test:server
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const BETREIBER = 'betrieb@test.invalid';
const PW = 'Sicheres-Passwort-123';

const dir = mkdtempSync(join(tmpdir(), 'maad-e2e-'));
const cfg = join(dir, 'konfig.json');
writeFileSync(
  cfg,
  JSON.stringify({
    base_url: BASE,
    port: PORT,
    data_dir: join(dir, 'daten'),
    betreiber: [BETREIBER],
    maptiler_key: 'SERVERKEY',
  }),
);
const srv = spawn(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', join(ROOT, 'server/src/server.mjs'), cfg],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let srvAus = '';
srv.stdout.on('data', (d) => (srvAus += d));
srv.stderr.on('data', (d) => (srvAus += d));

const fehler = [];
const ok = (bed, text) => {
  console.log(`${bed ? '✓' : '✗'} ${text}`);
  if (!bed) fehler.push(text);
};
const link = () => {
  const p = join(dir, 'daten', 'outbox.log');
  const m = existsSync(p) && readFileSync(p, 'utf8').match(/https?:\/\/\S+\/passwort\?t=[\w-]+/g);
  return m ? m.at(-1) : null;
};
const lib = (p) => readFileSync(join(ROOT, 'node_modules', p));
const LIBS = [
  [/three\.min\.js$/, 'three/build/three.min.js', 'text/javascript'],
  [/maplibre-gl\.js$/, 'maplibre-gl/dist/maplibre-gl.js', 'text/javascript'],
  [/maplibre-gl\.css$/, 'maplibre-gl/dist/maplibre-gl.css', 'text/css'],
];

let browser;
try {
  for (
    let i = 0;
    i < 50 &&
    !(await fetch(BASE + '/healthz').then(
      (r) => r.ok,
      () => false,
    ));
    i++
  )
    await new Promise((r) => setTimeout(r, 200));
  browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    const hit = LIBS.find(([re]) => re.test(url));
    return hit ? route.fulfill({ body: lib(hit[1]), contentType: hit[2] }) : route.abort();
  });
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  page.on(
    'console',
    (m) => m.type() === 'error' && /Content Security Policy/.test(m.text()) && seitenfehler.push(m.text()),
  );

  // Demo
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  ok((await page.evaluate(() => window.MAAD_ACC.mode)) === 'demo', 'Ohne Anmeldung: Demo');
  ok(seitenfehler.length === 0, 'Demo lädt ohne Fehler ' + seitenfehler.join(' | '));

  // Anmeldeseite → Passwort vergessen → Link → Passwort festlegen
  await page.goto(BASE + '/anmelden', { waitUntil: 'load' });
  await page.click('#zu-vergessen');
  await page.fill('#email2', BETREIBER);
  await page.click('#f-vergessen button[type=submit]');
  await page.waitForSelector('#k-gesendet:not(.hide)');
  ok(!!link(), 'Link per E-Mail (Testmodus) erzeugt');
  await page.goto(link(), { waitUntil: 'load' });
  await page.waitForSelector('#k-setzen:not(.hide)');
  ok(page.url().endsWith('/passwort'), 'Link-Kennung aus der Adresszeile entfernt');
  await page.fill('#pw1', PW);
  await page.fill('#pw2', PW);
  await page.click('#f-setzen button[type=submit]');
  await page.waitForURL(BASE + '/', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const acc = await page.evaluate(() => window.MAAD_ACC);
  ok(acc.mode === 'full' && acc.user.role === 'betreiber', 'Nach Passwort: Vollversion als Betreiber');
  ok(
    await page.evaluate(() => !!document.getElementById('accChip')),
    'Leiste mit Abmelden/Verwaltung sichtbar',
  );

  // Verwaltung erreichbar
  await page.goto(BASE + '/verwaltung', { waitUntil: 'load' });
  ok(page.url().endsWith('/verwaltung'), 'Verwaltung für Betreiber erreichbar');

  // Abmelden und erneut mit Passwort anmelden
  await page.evaluate(() => fetch('/api/abmelden', { method: 'POST', headers: { 'X-Maad': '1' } }));
  await page.goto(BASE + '/verwaltung', { waitUntil: 'load' });
  ok(page.url().endsWith('/anmelden'), 'Nach Abmelden: Verwaltung leitet zur Anmeldung');
  await page.fill('#email', BETREIBER);
  await page.fill('#passwort', 'falsches-passwort');
  await page.click('#f-anmelden button[type=submit]');
  await page.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
  ok((await page.textContent('#fehler')).includes('falsch'), 'Falsches Passwort: Hinweis');
  await page.fill('#passwort', PW);
  await page.click('#f-anmelden button[type=submit]');
  await page.waitForURL(BASE + '/', { timeout: 30000 });
  ok((await page.evaluate(() => window.MAAD_ACC.mode)) === 'full', 'Anmeldung mit Passwort');
  ok(seitenfehler.length === 0, 'Keine Seitenfehler ' + seitenfehler.join(' | '));
} catch (e) {
  fehler.push(String(e));
  console.log('✗', e, srvAus);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(
  fehler.length ? `\nBrowsertest Server FEHLGESCHLAGEN (${fehler.length})` : '\nBrowsertest Server bestanden',
);
process.exit(fehler.length ? 1 : 0);
