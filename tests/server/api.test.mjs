// API-Tests des Servers (node:test): Anmeldung, Mandantentrennung, Rechte, Projekte, Schutzmaßnahmen.
// Aufruf: node --test tests/server/   (braucht dist/maad.html und dist/maad.sperren.json → npm run build)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { erstelleServer } from '../../server/src/server.mjs';
import { ladeKonfig } from '../../server/src/konfig.mjs';

const dir = mkdtempSync(join(tmpdir(), 'maad-api-'));
const BETREIBER = 'betrieb@test.invalid';
const PW = 'Sicheres-Passwort-123';
let srv, BASE;

before(async () => {
  const k = ladeKonfig('/nicht/vorhanden.json');
  Object.assign(k, { data_dir: dir, betreiber: [BETREIBER], port: 0, maptiler_key: 'SERVERKEY' });
  srv = erstelleServer(k);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${srv.address().port}`;
  k.base_url = BASE;
});
after(() => {
  srv.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Einfacher Client mit eigenem Cookie. */
function client() {
  let ck = '';
  const c = {
    async req(methode, pfad, body, kopf = {}) {
      const h = { 'X-Maad': '1', ...kopf };
      if (ck) h.Cookie = ck;
      let b = body;
      if (body !== undefined && !(body instanceof Uint8Array)) {
        h['Content-Type'] = 'application/json';
        b = JSON.stringify(body);
      }
      const r = await fetch(BASE + pfad, { method: methode, headers: h, body: b, redirect: 'manual' });
      const sc = r.headers.get('set-cookie');
      if (sc) ck = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
      const typ = r.headers.get('content-type') || '';
      const daten = typ.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
      return { status: r.status, daten, kopf: r.headers };
    },
    get: (p) => c.req('GET', p),
    post: (p, b = {}, k) => c.req('POST', p, b, k),
  };
  return c;
}

/** Letzter Link an eine Adresse aus outbox.log. */
function link(email) {
  const p = join(dir, 'outbox.log');
  if (!existsSync(p)) return null;
  const t = readFileSync(p, 'utf8')
    .split('--- ')
    .filter((x) => x.includes(' an ' + email + '\n'))
    .at(-1);
  const m = t && t.match(/\/passwort\?t=([\w-]+)/);
  return m ? m[1] : null;
}

/** Konto über Einladungs-/Zurücksetzen-Link aktivieren und angemeldeten Client liefern. */
async function aktivieren(email, pw = PW) {
  const c = client();
  const t = link(email);
  assert.ok(t, 'Link für ' + email);
  const r = await c.post('/api/passwort-setzen', { t, passwort: pw });
  assert.equal(r.status, 200, JSON.stringify(r.daten));
  return c;
}

const S = {}; // gemeinsamer Zustand der Tests (laufen nacheinander)

test('Betreiber richtet Zugang über „Passwort vergessen“ ein', async () => {
  const c = client();
  assert.equal((await c.post('/api/passwort-vergessen', { email: BETREIBER })).status, 200);
  S.betrieb = await aktivieren(BETREIBER);
  const ich = await S.betrieb.get('/api/ich');
  assert.equal(ich.daten.nutzer.rolle, 'betreiber');
  // Link ist nur einmal nutzbar
  const c2 = client();
  assert.equal((await c2.post('/api/passwort-setzen', { t: link(BETREIBER), passwort: PW })).status, 400);
});

test('Unbekannte Adresse: gleiche Antwort, kein Link', async () => {
  const r = await client().post('/api/passwort-vergessen', { email: 'niemand@test.invalid' });
  assert.equal(r.status, 200);
  assert.equal(link('niemand@test.invalid'), null);
});

test('Betreiber legt zwei Mandanten mit Admins an', async () => {
  const a = await S.betrieb.post('/api/verwaltung/mandanten', {
    name: 'Büro A',
    abo: 'starter',
    max_nutzer: 3,
  });
  const b = await S.betrieb.post('/api/verwaltung/mandanten', { name: 'Büro B', abo: 'enterprise' });
  assert.equal(a.status, 200);
  S.mA = a.daten.mandant.id;
  S.mB = b.daten.mandant.id;
  assert.deepEqual(a.daten.mandant.rechte, ['project_new', 'project_open', 'export_xlsx']);
  assert.equal(
    (
      await S.betrieb.post('/api/verwaltung/nutzer', {
        mandant: S.mA,
        email: 'admin@a.invalid',
        rolle: 'admin',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await S.betrieb.post('/api/verwaltung/nutzer', {
        mandant: S.mB,
        email: 'admin@b.invalid',
        rolle: 'admin',
      })
    ).status,
    200,
  );
  S.adminA = await aktivieren('admin@a.invalid');
  S.adminB = await aktivieren('admin@b.invalid');
});

test('Mandanten-Admin: Gruppen nur innerhalb der Abo-Rechte', async () => {
  const g = await S.adminA.post('/api/verwaltung/gruppen', {
    name: 'Planer',
    rechte: ['project_open', 'export_ifc', 'export_xlsx'],
  });
  assert.equal(g.status, 200);
  assert.deepEqual(JSON.parse(g.daten.gruppe.rechte), ['project_open', 'export_xlsx']); // export_ifc nicht im Abo
  S.gPlaner = g.daten.gruppe.id;
  const n1 = await S.adminA.post('/api/verwaltung/nutzer', { email: 'n1@a.invalid', gruppen: [S.gPlaner] });
  assert.equal(n1.status, 200);
  assert.deepEqual(n1.daten.nutzer.rechte, ['project_open', 'export_xlsx']);
  S.n1Id = n1.daten.nutzer.id;
  S.n1 = await aktivieren('n1@a.invalid');
  const gAlle = (await S.adminA.get('/api/verwaltung/gruppen')).daten.gruppen.find((x) => x.name === 'Alle');
  S.gAlleA = gAlle.id;
  const n2 = await S.adminA.post('/api/verwaltung/nutzer', { email: 'n2@a.invalid', gruppen: [S.gAlleA] });
  assert.equal(n2.status, 200);
  S.n2Id = n2.daten.nutzer.id;
  S.n2 = await aktivieren('n2@a.invalid');
});

test('Höchstzahl der Nutzer wird eingehalten', async () => {
  const r = await S.adminA.post('/api/verwaltung/nutzer', { email: 'n3@a.invalid' });
  assert.equal(r.status, 400);
  assert.match(r.daten.error, /Höchstzahl/);
});

test('Mandantentrennung: Admin A sieht und ändert nichts von Mandant B', async () => {
  assert.equal((await S.adminA.get('/api/verwaltung/nutzer?mandant=' + S.mB)).status, 403);
  assert.equal((await S.adminA.get('/api/verwaltung/gruppen?mandant=' + S.mB)).status, 403);
  assert.equal((await S.adminA.get('/api/verwaltung/protokoll?mandant=' + S.mB)).status, 403);
  const nb = (await S.adminB.get('/api/verwaltung/nutzer')).daten.nutzer[0];
  assert.equal((await S.adminA.post('/api/verwaltung/nutzer/' + nb.id, { name: 'X' })).status, 403);
  assert.equal((await S.adminA.post('/api/verwaltung/nutzer/' + nb.id + '/loeschen')).status, 403);
  const gb = (await S.adminB.get('/api/verwaltung/gruppen')).daten.gruppen[0];
  assert.equal((await S.adminA.post('/api/verwaltung/gruppen/' + gb.id, { rechte: [] })).status, 403);
  assert.equal(
    (await S.adminA.post('/api/verwaltung/nutzer', { mandant: S.mB, email: 'x@b.invalid' })).status,
    403,
  );
  // eigene Liste enthält nur Mandant A
  const eigene = (await S.adminA.get('/api/verwaltung/nutzer')).daten.nutzer;
  assert.ok(eigene.every((n) => n.mandant_id === S.mA));
  const m = (await S.adminA.get('/api/verwaltung/mandanten')).daten.mandanten;
  assert.deepEqual(
    m.map((x) => x.id),
    [S.mA],
  );
});

test('Nur Betreiber verwalten Mandanten', async () => {
  assert.equal((await S.adminA.post('/api/verwaltung/mandanten', { name: 'X', abo: 'starter' })).status, 403);
  assert.equal((await S.adminA.post('/api/verwaltung/mandanten/' + S.mA, { abo: 'enterprise' })).status, 403);
  assert.equal((await S.n1.get('/api/verwaltung/nutzer')).status, 403);
  assert.equal((await client().get('/api/verwaltung/nutzer')).status, 401);
});

test('Tool: Demo ohne Schlüssel und ohne gesperrte Funktionen, Vollversion je Rechten', async () => {
  const demo = (await client().get('/')).daten.toString();
  assert.ok(demo.includes('"mode":"demo"'));
  assert.ok(!demo.includes('SERVERKEY') && !demo.includes('0jnOTw9obPwX3gZ4OJSu'));
  assert.equal((demo.match(/\{ return accDeny\('/g) || []).length, 78);
  const n1 = (await S.n1.get('/')).daten.toString();
  assert.ok(n1.includes('"mode":"full"') && n1.includes('SERVERKEY'));
  assert.ok(n1.includes("{ return accDeny('export_ifc')") && n1.includes("{ return accDeny('project_new')"));
  assert.ok(!n1.includes("{ return accDeny('export_xlsx')"));
  assert.match(n1, /maad-lizenz:[0-9a-f]{12}/);
  const b = (await S.adminB.get('/')).daten.toString();
  assert.equal((b.match(/\{ return accDeny\('/g) || []).length, 0);
});

test('Projekte: Besitzer, Admin, Freigaben, Trennung, Konflikt', async () => {
  const rec = { name: 'Testprojekt', label: 'Bielefeld', n: 1, bld: [{ id: 'b1' }] };
  // n2 (Gruppe „Alle“: alle Rechte von A) legt an, n1 hat kein project_new
  assert.equal((await S.n1.post('/api/projekte/p1', { rec })).status, 403);
  const neu = await S.n2.post('/api/projekte/p1', { rec });
  assert.equal(neu.status, 200);
  assert.equal(neu.daten.version, 1);
  assert.equal(
    (
      await S.n2.req('POST', '/api/projekte/p1/karte', new Uint8Array([1, 2, 3]), {
        'Content-Type': 'application/octet-stream',
      })
    ).status,
    200,
  );
  // n1 sieht es nicht ohne Freigabe; Mandant B nie
  assert.equal((await S.n1.get('/api/projekte/p1')).status, 404);
  assert.equal((await S.adminB.get('/api/projekte/p1')).status, 404);
  assert.equal((await S.adminB.get('/api/projekte')).daten.projekte.length, 0);
  assert.equal((await S.betrieb.get('/api/projekte/p1')).status, 400);
  // Admin A sieht es
  assert.equal((await S.adminA.get('/api/projekte/p1')).status, 200);
  // Freigabe braucht Recht „team“ – Abo Starter hat es nicht
  assert.equal(
    (
      await S.n2.post('/api/projekte/p1/freigaben', {
        freigaben: [{ art: 'gruppe', ziel_id: S.gPlaner, recht: 'lesen' }],
      })
    ).status,
    403,
  );
  await S.betrieb.post('/api/verwaltung/mandanten/' + S.mA, { abo: 'buero' });
  await S.adminA.post('/api/verwaltung/gruppen/' + S.gAlleA, {
    rechte: ['project_new', 'project_open', 'team'],
  });
  const f = await S.n2.post('/api/projekte/p1/freigaben', {
    freigaben: [{ art: 'gruppe', ziel_id: S.gPlaner, recht: 'lesen' }],
  });
  assert.equal(f.status, 200);
  // Freigabe an Gruppe eines anderen Mandanten wird abgelehnt
  const gb = (await S.adminB.get('/api/verwaltung/gruppen')).daten.gruppen[0];
  assert.equal(
    (
      await S.n2.post('/api/projekte/p1/freigaben', {
        freigaben: [{ art: 'gruppe', ziel_id: gb.id, recht: 'lesen' }],
      })
    ).status,
    400,
  );
  // n1 (Gruppe Planer) darf lesen, aber nicht speichern oder löschen
  const g = await S.n1.get('/api/projekte/p1');
  assert.equal(g.status, 200);
  assert.equal(g.kopf.get('x-zugriff'), 'lesen');
  assert.deepEqual((await S.n1.get('/api/projekte/p1/karte')).daten, Buffer.from([1, 2, 3]));
  assert.equal((await S.n1.post('/api/projekte/p1', { rec })).status, 403);
  assert.equal((await S.n1.post('/api/projekte/p1/loeschen')).status, 403);
  // Konflikt: Admin speichert auf veralteter Basis nach Änderung durch n2
  assert.equal((await S.n2.post('/api/projekte/p1', { rec, basis: 1 })).status, 200);
  assert.equal((await S.adminA.post('/api/projekte/p1', { rec, basis: 1 })).status, 409);
  // Löschen durch Besitzer
  assert.equal((await S.n2.post('/api/projekte/p1/loeschen')).status, 200);
  assert.equal((await S.n2.get('/api/projekte/p1')).status, 404);
});

test('Sperren eines Nutzers beendet seine Sitzung sofort', async () => {
  assert.equal((await S.adminA.post('/api/verwaltung/nutzer/' + S.n1Id, { status: 'gesperrt' })).status, 200);
  assert.equal((await S.n1.get('/api/ich')).daten.nutzer, null);
  await S.adminA.post('/api/verwaltung/nutzer/' + S.n1Id, { status: 'entsperrt' });
});

test('Gesperrter Mandant: alle Nutzer abgemeldet, Anmeldung verweigert', async () => {
  const c = client();
  assert.equal((await c.post('/api/anmelden', { email: 'n2@a.invalid', passwort: PW })).status, 200);
  await S.betrieb.post('/api/verwaltung/mandanten/' + S.mA, { status: 'gesperrt' });
  assert.equal((await c.get('/api/ich')).daten.nutzer, null);
  assert.equal((await client().post('/api/anmelden', { email: 'n2@a.invalid', passwort: PW })).status, 401);
  await S.betrieb.post('/api/verwaltung/mandanten/' + S.mA, { status: 'aktiv' });
});

test('Falsche Passwörter: vorläufige Kontosperre, gleiche Fehlermeldung', async () => {
  let r;
  for (let i = 0; i < 8; i++)
    r = await client().post('/api/anmelden', { email: 'admin@b.invalid', passwort: 'falsch-falsch' });
  assert.equal(r.status, 401);
  r = await client().post('/api/anmelden', { email: 'admin@b.invalid', passwort: PW });
  assert.ok(r.status === 401 || r.status === 429, 'trotz richtigem Passwort gesperrt');
  const unbekannt = await client().post('/api/anmelden', { email: 'unbekannt@test.invalid', passwort: 'x' });
  assert.equal(unbekannt.daten.error, 'E-Mail-Adresse oder Passwort ist falsch.');
});

test('Schutz gegen fremde Seiten und Weiterleitung an interne Adressen', async () => {
  const ohne = await fetch(BASE + '/api/abmelden', { method: 'POST' });
  assert.equal(ohne.status, 400);
  const fremd = await fetch(BASE + '/api/abmelden', {
    method: 'POST',
    headers: { 'X-Maad': '1', Origin: 'https://boese.example' },
  });
  assert.equal(fremd.status, 403);
  assert.equal((await client().get('/api/proxy?url=https://example.com/')).status, 401);
  assert.equal(
    (await S.adminB.get('/api/proxy?url=' + encodeURIComponent('https://127.0.0.1/'))).status,
    403,
  );
  assert.equal((await S.adminB.get('/api/proxy?url=' + encodeURIComponent('https://10.0.0.1/'))).status, 403);
  assert.equal(
    (await S.adminB.get('/api/proxy?url=' + encodeURIComponent('http://example.com/'))).status,
    400,
  );
});

test('Sicherheits-Kopfzeilen und Cookie-Eigenschaften', async () => {
  const r = await fetch(BASE + '/anmelden');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
  const c = await fetch(BASE + '/api/anmelden', {
    method: 'POST',
    headers: { 'X-Maad': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@a.invalid', passwort: PW }),
  });
  assert.match(c.headers.get('set-cookie'), /HttpOnly/);
  assert.match(c.headers.get('set-cookie'), /SameSite=Lax/);
});
