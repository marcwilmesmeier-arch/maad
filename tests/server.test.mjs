// Ende-zu-Ende-Test im Browser: startet den Server (server/src/server.mjs) mit Testkonfiguration und prüft
// Demo, Passwort festlegen über den Link, Vollversion im Tool, Verwaltungsseite und Abmelden.
// Aufruf: npm run test:server
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bibliothek } from './bibliotheken.mjs';

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
    const hit = bibliothek(url);
    return hit ? route.fulfill(hit) : route.abort();
  });
  const seitenfehler = [];
  // Jede Ansicht in einem eigenen Tab: der Tool-Tab rendert laufend 3D (im Testbrowser ohne Grafikkarte
  // sehr langsam), Wegnavigieren davon läuft dort oft in Zeitüberschreitungen.
  const neu = async (c = ctx, wer = '') => {
    const p = await c.newPage();
    p.on('pageerror', (e) => seitenfehler.push(wer + e.message));
    p.on(
      'console',
      (m) =>
        m.type() === 'error' && /Content Security Policy/.test(m.text()) && seitenfehler.push(wer + m.text()),
    );
    return p;
  };

  // Demo
  const pd = await neu();
  await pd.goto(BASE + '/', { waitUntil: 'load' });
  await pd.waitForTimeout(2500);
  ok((await pd.evaluate(() => window.MAAD_ACC.mode)) === 'demo', 'Ohne Anmeldung: Demo');
  ok(seitenfehler.length === 0, 'Demo lädt ohne Fehler ' + seitenfehler.join(' | '));
  await pd.close();
  const page = await neu();

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

  // Verwaltung: Betreiber legt Mandanten an und lädt einen Admin ein
  await page.close();
  const pv = await neu(ctx, 'Verwaltung: ');
  await pv.goto(BASE + '/verwaltung', { waitUntil: 'load' });
  ok(pv.url().endsWith('/verwaltung'), 'Verwaltung für Betreiber erreichbar');
  await pv.waitForSelector('#bereich-mandanten:not(.hide)');
  await pv.click('#mandant-neu');
  await pv.fill('#m-name', 'Testbüro');
  await pv.selectOption('#m-abo', 'buero');
  await pv.fill('#m-max', '5');
  await pv.click('#f-mandant button[type=submit]');
  await pv.waitForFunction(() => document.getElementById('mandanten').textContent.includes('Testbüro'));
  ok(true, 'Mandant über die Oberfläche angelegt');
  await pv.click('#mandanten button:has-text("Öffnen")');
  await pv.waitForSelector('#bereich-mandant:not(.hide)');
  await pv.fill('#n-email', 'chef@testbuero.invalid');
  await pv.selectOption('#n-rolle', 'admin');
  await pv.click('#n-einladen');
  await pv.waitForFunction(() =>
    document.getElementById('nutzer').textContent.includes('chef@testbuero.invalid'),
  );
  ok((await pv.textContent('#m-nutzer')).includes('Einladung'), 'Admin des Mandanten eingeladen');

  // Mandanten-Admin in eigenem Browser-Kontext: Passwort setzen, nur eigener Mandant sichtbar
  const ctx2 = await browser.newContext();
  await ctx2.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    const hit = bibliothek(url);
    return hit ? route.fulfill(hit) : route.abort();
  });
  const p2 = await neu(ctx2, 'Admin: ');
  await p2.goto(link(), { waitUntil: 'load' });
  await p2.waitForSelector('#k-setzen:not(.hide)');
  await p2.fill('#pw1', PW);
  await p2.fill('#pw2', PW);
  await p2.click('#f-setzen button[type=submit]');
  await p2.waitForURL(BASE + '/', { timeout: 30000 });
  await p2.close();
  const p3 = await neu(ctx2, 'Admin: ');
  await p3.goto(BASE + '/verwaltung', { waitUntil: 'load' });
  await p3.waitForSelector('#bereich-mandant:not(.hide)');
  ok(await p3.isHidden('#bereich-mandanten'), 'Mandanten-Admin sieht keine Mandantenliste');
  ok((await p3.textContent('#mandant-titel')) === 'Testbüro', 'Mandanten-Admin sieht seinen Mandanten');
  await p3.click('.tabs button[data-tab=gruppen]');
  await p3.click('#gruppe-neu');
  await p3.fill('#g-name', 'Zeichner');
  const angeboten = await p3.$$eval('#g-rechte input', (L) => L.map((i) => i.value));
  ok(!angeboten.includes('own_sources'), 'Gruppenrechte nur innerhalb des Abos angeboten');
  await p3.check('#g-rechte input[value=project_open]');
  await p3.click('#f-gruppe button[type=submit]');
  await p3.waitForFunction(() => document.getElementById('gruppen').textContent.includes('Zeichner'));
  ok(true, 'Gruppe angelegt');
  await p3.click('.tabs button[data-tab=nutzer]');
  await p3.fill('#n-email', 'zeichner@testbuero.invalid');
  await p3.uncheck('#n-gruppen input >> nth=0');
  await p3.check('#n-gruppen label:has-text("Zeichner") input');
  await p3.click('#n-einladen');
  await p3.waitForFunction(() =>
    document.getElementById('nutzer').textContent.includes('zeichner@testbuero.invalid'),
  );
  const zeile = await p3.textContent('#nutzer tr:has-text("zeichner@testbuero.invalid")');
  ok(
    zeile.includes('Zeichner') && zeile.includes('Projekte öffnen'),
    'Nutzer mit Gruppe und Rechten angelegt',
  );
  await p3.close();

  // Projektablage im Tool: speichern auf dem Server, Liste, in neuem Tab wieder öffnen
  const t1 = await neu(ctx2, 'Tool Admin: ');
  await t1.goto(BASE + '/', { waitUntil: 'load' });
  await t1.waitForFunction(() => GEO.snap && S.geo, null, { timeout: 120000 });
  const gespeichert = await t1.evaluate(async () => {
    S.project = {
      id: projId(),
      name: 'Serverprojekt',
      label: 'Test',
      size: GEO.size,
      lon: GEO.lon,
      lat: GEO.lat,
    };
    await projSave();
    const L = await projList();
    return { id: S.project.id, version: S.project._version, liste: L.map((x) => [x.id, x.name, x.eigenes]) };
  });
  ok(gespeichert.version === 1, 'Tool speichert Projekt auf dem Server (Version 1)');
  ok(
    gespeichert.liste.some(([id, n, e]) => id === gespeichert.id && n === 'Serverprojekt' && e),
    'Projekt in der Liste (eigenes)',
  );
  await t1.close();
  const t2 = await neu(ctx2, 'Tool Admin 2: ');
  await t2.goto(BASE + '/', { waitUntil: 'load' });
  await t2.waitForFunction(() => GEO.snap, null, { timeout: 120000 });
  const geoeffnet = await t2.evaluate(async (id) => {
    await projOpen(id);
    return { name: S.project && S.project.name, version: S.project && S.project._version };
  }, gespeichert.id);
  ok(
    geoeffnet.name === 'Serverprojekt' && geoeffnet.version === 1,
    'Projekt in neuem Tab vom Server geöffnet',
  );
  await t2.close();
  await ctx2.close();

  // Abmelden und erneut mit Passwort anmelden
  await pv.evaluate(() => fetch('/api/abmelden', { method: 'POST', headers: { 'X-Maad': '1' } }));
  await pv.goto(BASE + '/verwaltung', { waitUntil: 'load' });
  ok(pv.url().endsWith('/anmelden'), 'Nach Abmelden: Verwaltung leitet zur Anmeldung');
  await pv.fill('#email', BETREIBER);
  await pv.fill('#passwort', 'falsches-passwort');
  await pv.click('#f-anmelden button[type=submit]');
  await pv.waitForFunction(() => document.getElementById('fehler').textContent.length > 0);
  ok((await pv.textContent('#fehler')).includes('falsch'), 'Falsches Passwort: Hinweis');
  await pv.fill('#passwort', PW);
  await pv.click('#f-anmelden button[type=submit]');
  await pv.waitForURL(BASE + '/', { timeout: 30000 });
  ok((await pv.evaluate(() => window.MAAD_ACC && window.MAAD_ACC.mode)) === 'full', 'Anmeldung mit Passwort');
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
