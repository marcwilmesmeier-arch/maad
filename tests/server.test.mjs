// Ende-zu-Ende-Test für den Server: startet server/maadserver.py mit einer Testkonfiguration (eigener
// Datenordner, kein Mailversand – Mails landen in outbox.log) und prüft im Browser:
// Demo ohne Anmeldung, Anmeldung per Link, Vollversion mit Kennung, Administration, Abmelden.
//
// Aufruf: npm run test:server   (baut vorher dist/maad.html und dist/maad-demo.html)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'admin@test.invalid';
const KUNDE = 'kunde@test.invalid';
const FAKE_KEY = 'TESTSCHLUESSEL123';

const dir = mkdtempSync(join(tmpdir(), 'maad-server-test-'));
const cfgPath = join(dir, 'config.json');
writeFileSync(
  cfgPath,
  JSON.stringify({
    base_url: BASE,
    host: '127.0.0.1',
    port: PORT,
    data_dir: join(dir, 'data'),
    tool_file: join(ROOT, 'dist/maad.html'),
    demo_file: join(ROOT, 'dist/maad-demo.html'),
    admin_emails: [ADMIN],
    maptiler_key: FAKE_KEY,
  }),
);

const srv = spawn('python3', [join(ROOT, 'server/maadserver.py'), cfgPath], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let srvErr = '';
srv.stderr.on('data', (d) => (srvErr += d));
const fehler = [];
const ok = (bed, text) => {
  console.log(`${bed ? '✓' : '✗'} ${text}`);
  if (!bed) fehler.push(text);
};

async function warteAufServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE + '/healthz')).ok) return;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server startet nicht: ' + srvErr);
}

/** Letzter Anmeldelink für eine Adresse aus outbox.log. */
function linkFuer(email) {
  const p = join(dir, 'data', 'outbox.log');
  if (!existsSync(p)) return null;
  const teile = readFileSync(p, 'utf8')
    .split('--- ')
    .filter((t) => t.includes('an ' + email));
  const m = teile.at(-1)?.match(/https?:\/\/\S+\/auth\?t=\S+/);
  return m ? m[0] : null;
}

const lib = (p) => readFileSync(join(ROOT, 'node_modules', p));
const LIBS = [
  [/three\.min\.js$/, 'three/build/three.min.js', 'text/javascript'],
  [/maplibre-gl\.js$/, 'maplibre-gl/dist/maplibre-gl.js', 'text/javascript'],
  [/maplibre-gl\.css$/, 'maplibre-gl/dist/maplibre-gl.css', 'text/css'],
];

let browser;
try {
  await warteAufServer();
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

  // 1. Demo ohne Anmeldung
  const roh = await (await fetch(BASE + '/')).text();
  ok(
    !roh.includes(FAKE_KEY) && !roh.includes('0jnOTw9obPwX3gZ4OJSu'),
    'Demo enthält keinen MapTiler-Schlüssel',
  );
  ok(!roh.includes('lot-cors.marc-wilmesmeier.workers.dev'), 'Demo enthält keine Proxy-Adresse');
  ok((roh.match(/accDeny\('demo'\)/g) || []).length === 78, 'Demo: 78 Funktionen im Code gesperrt');
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  ok((await page.evaluate(() => window.MAAD_ACC && window.MAAD_ACC.mode)) === 'demo', 'Demo-Modus aktiv');
  ok(seitenfehler.length === 0, 'Demo lädt ohne Fehler ' + seitenfehler.join(' | '));

  // 2. Anmeldung Kunde, der nicht freigegeben ist: gleiche Antwort, aber kein Link
  const r1 = await fetch(BASE + '/api/login-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Maad': '1' },
    body: JSON.stringify({ email: KUNDE }),
  });
  ok(r1.ok && !linkFuer(KUNDE), 'Unbekannte Adresse: gleiche Antwort, kein Link');
  const r2 = await fetch(BASE + '/api/login-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN }),
  });
  ok(r2.status === 400, 'Schreibzugriff ohne X-Maad-Kopfzeile wird abgelehnt');

  // 3. Admin meldet sich an
  await page.goto(BASE + '/login');
  await page.fill('#m', ADMIN);
  await page.click('#b');
  await page.waitForTimeout(500);
  const link = linkFuer(ADMIN);
  ok(!!link, 'Anmeldelink für Admin erzeugt');
  await page.goto(link, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const acc = await page.evaluate(() => window.MAAD_ACC);
  ok(
    acc && acc.mode === 'full' && acc.user && acc.user.role === 'admin',
    'Vollversion nach Anmeldung (Admin)',
  );
  const html = await page.content();
  ok(html.includes(FAKE_KEY), 'Vollversion enthält den Server-Schlüssel');
  ok(/maad-lizenz:[0-9a-f]{12}/.test(html), 'Vollversion enthält Kundenkennung');
  ok(
    !(await page.evaluate(() => String(xlExport).includes("accDeny('demo')"))),
    'Vollversion: Excel-Export vorhanden',
  );
  const cookies = await ctx.cookies();
  const sid = cookies.find((c) => c.name === 'maad_sid');
  ok(sid && sid.httpOnly, 'Sitzungs-Cookie ist HttpOnly');

  // 4. Administration
  await page.goto(BASE + '/admin', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  ok((await page.textContent('#rows')).includes(ADMIN), 'Administration zeigt Nutzerliste');
  const inv = await page.evaluate(async (k) => {
    const r = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Maad': '1' },
      body: JSON.stringify({ email: k, plan: 'starter', role: 'user', send: true }),
    });
    return r.ok;
  }, KUNDE);
  ok(inv && !!linkFuer(KUNDE), 'Kunde freigegeben, Einladung erzeugt');

  // 5. Kunde meldet sich an (eigener Browser-Kontext)
  const ctx2 = await browser.newContext();
  await ctx2.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    const hit = LIBS.find(([re]) => re.test(url));
    return hit ? route.fulfill({ body: lib(hit[1]), contentType: hit[2] }) : route.abort();
  });
  const p2 = await ctx2.newPage();
  await p2.goto(linkFuer(KUNDE), { waitUntil: 'load' });
  await p2.waitForTimeout(2500);
  const acc2 = await p2.evaluate(() => window.MAAD_ACC);
  ok(
    acc2 && acc2.mode === 'full' && acc2.user.plan === 'starter',
    'Kunde erhält Vollversion mit Abo „Starter“',
  );
  ok(!acc2.user.perms.includes('export_ifc'), 'Kunde hat kein IFC-Recht');
  const adm = await p2.evaluate(async () => (await fetch('/api/admin/users')).status);
  ok(adm === 403, 'Kunde hat keinen Zugriff auf die Administration');
  const wm1 = acc.wm,
    wm2 = acc2.wm;
  ok(wm1 && wm2 && wm1 !== wm2, 'Kennungen unterscheiden sich je Kunde');

  // 6. Abmelden (über die schlanke Admin-Seite, damit nicht erneut das ganze Tool geladen werden muss)
  await page.evaluate(async () => {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'X-Maad': '1', 'Content-Type': 'application/json' },
      body: '{}',
    });
  });
  const nachher = await page.evaluate(async () => (await (await fetch('/api/me')).json()).user);
  ok(nachher === null, 'Nach Abmelden keine Sitzung mehr');
  const roh2 = await (await page.request.get(BASE + '/')).text();
  ok(roh2.includes('"mode": "demo"'), 'Nach Abmelden wird wieder die Demo ausgeliefert');
  ok(seitenfehler.length === 0, 'Keine Seitenfehler ' + seitenfehler.join(' | '));
} catch (e) {
  fehler.push(String(e));
  console.log('✗', e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(fehler.length ? `\nServertest FEHLGESCHLAGEN (${fehler.length})` : '\nServertest bestanden');
process.exit(fehler.length ? 1 : 0);
