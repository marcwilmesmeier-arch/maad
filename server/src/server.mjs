// maad-Server: Mandanten, Nutzer, Gruppen, Rechte; Auslieferung des Tools; Projekte; Geodienst-Weiterleitung.
// Start: node server/src/server.mjs <konfig.json>
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladeKonfig } from './konfig.mjs';
import { oeffneDatenbank } from './datenbank.mjs';
import {
  Router,
  sende,
  json,
  weiter,
  cookies,
  jsonRumpf,
  schreibschutz,
  ipVon,
  CSP_SEITEN,
} from './http.mjs';
import { Anmeldung } from './anmeldung.mjs';
import { Werkzeug } from './werkzeug.mjs';
import { proxyAbruf } from './proxy.mjs';
import { Begrenzer } from './sicherheit.mjs';
import { RECHTE, ABOS, ROLLEN } from './rechte.mjs';
import * as V from './verwaltung.mjs';
import { Projekte } from './projekte.mjs';

const SEITEN = join(dirname(fileURLToPath(import.meta.url)), '..', 'seiten');
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export function erstelleServer(konfig = ladeKonfig()) {
  const db = oeffneDatenbank(konfig.data_dir);
  const anm = new Anmeldung(db, konfig);
  anm.betreiberAbgleichen();
  const werkzeug = new Werkzeug(konfig, db);
  const projekte = new Projekte(db, konfig);
  const begrenzer = new Begrenzer();
  const r = new Router();

  // Hilfen für Routen
  const angemeldet = (req) => anm.nutzerAus(cookies(req));
  const pflicht = (req) => {
    const n = angemeldet(req);
    if (!n) throw new V.Fehler(401, 'Nicht angemeldet');
    return n;
  };
  const verwalter = (req) => {
    const n = pflicht(req);
    if (n.rolle !== 'betreiber' && n.rolle !== 'admin') throw new V.Fehler(403, 'Keine Berechtigung');
    return n;
  };
  const seite = (res, datei) =>
    sende(res, 200, readFileSync(join(SEITEN, datei)), TYPEN['.html'], {
      'Content-Security-Policy': CSP_SEITEN,
    });
  const toolCfg = () => {
    const x = db.prepare("SELECT v FROM kv WHERE k = 'toolcfg'").get();
    return x ? JSON.parse(x.v) : null;
  };

  // ---------- Seiten ----------
  r.add('GET', '/', (req, res) => {
    const n = angemeldet(req);
    const m = n ? V.mandant(db, n.mandant_id) : null;
    const body = werkzeug.seite({
      nutzer: n,
      rechte: n ? V.rechteVon(db, n) : [],
      mandantName: m ? m.name : '',
      cfg: toolCfg(),
    });
    sende(res, 200, body, 'text/html; charset=utf-8');
  });
  r.add('GET', '/anmelden', (req, res) => seite(res, 'anmelden.html'));
  r.add('GET', '/passwort', (req, res) => seite(res, 'passwort.html'));
  r.add('GET', '/verwaltung', (req, res) => {
    const n = angemeldet(req);
    if (!n || (n.rolle !== 'betreiber' && n.rolle !== 'admin')) return weiter(res, '/anmelden');
    seite(res, 'verwaltung.html');
  });
  r.add('GET', '/login', (req, res) => weiter(res, '/anmelden')); // alte Adresse aus dem Tool
  r.add('GET', '/admin', (req, res) => weiter(res, '/verwaltung'));
  r.add('GET', '/seiten/:datei', (req, res, p) => {
    const d = p.datei;
    const typ = TYPEN[d.slice(d.lastIndexOf('.'))];
    if (!/^[a-z0-9-]+\.(js|css)$/.test(d) || !typ || !existsSync(join(SEITEN, d)))
      return sende(res, 404, 'Nicht gefunden');
    sende(res, 200, readFileSync(join(SEITEN, d)), typ, { 'Cache-Control': 'no-cache' });
  });
  r.add('GET', '/healthz', (req, res) => sende(res, 200, 'ok'));
  r.add('GET', '/favicon.ico', (req, res) => sende(res, 204, ''));

  // ---------- Anmeldung ----------
  r.add('POST', '/api/anmelden', async (req, res) => {
    const d = await jsonRumpf(req);
    const ck = await anm.anmelden(d.email, d.passwort, ipVon(req));
    json(res, 200, { ok: true }, { 'Set-Cookie': ck });
  });
  r.add('POST', '/api/abmelden', (req, res) =>
    json(res, 200, { ok: true }, { 'Set-Cookie': anm.abmelden(cookies(req)) }),
  );
  r.add('POST', '/api/logout', (req, res) =>
    json(res, 200, { ok: true }, { 'Set-Cookie': anm.abmelden(cookies(req)) }),
  ); // alte Adresse aus dem Tool
  r.add('POST', '/api/passwort-vergessen', async (req, res) => {
    const d = await jsonRumpf(req);
    await anm.passwortVergessen(d.email, ipVon(req));
    json(res, 200, { ok: true });
  });
  r.add('GET', '/api/passwort-link', (req, res, p, q) => {
    const n = anm.tokenNutzer(q.get('t'));
    json(
      res,
      200,
      n
        ? { gueltig: true, email: n.email, neu: n.status === 'eingeladen', min: konfig.passwort_min }
        : { gueltig: false },
    );
  });
  r.add('POST', '/api/passwort-setzen', async (req, res) => {
    const d = await jsonRumpf(req);
    const ck = await anm.passwortSetzen(d.t, d.passwort, ipVon(req));
    json(res, 200, { ok: true }, { 'Set-Cookie': ck });
  });
  r.add('POST', '/api/passwort-aendern', async (req, res) => {
    const n = pflicht(req);
    const d = await jsonRumpf(req);
    const ck = await anm.passwortAendern(n, d.alt, d.neu, ipVon(req));
    json(res, 200, { ok: true }, { 'Set-Cookie': ck });
  });
  r.add('GET', '/api/ich', (req, res) => {
    const n = angemeldet(req);
    if (!n) return json(res, 200, { nutzer: null });
    const m = V.mandant(db, n.mandant_id);
    json(res, 200, { nutzer: V.oeffentlicherNutzer(db, n), mandant: m ? { id: m.id, name: m.name } : null });
  });

  // ---------- Verwaltung ----------
  r.add('GET', '/api/verwaltung/stammdaten', (req, res) => {
    const n = verwalter(req);
    json(res, 200, {
      rechte: RECHTE,
      abos: ABOS,
      rollen: ROLLEN,
      ich: V.oeffentlicherNutzer(db, n),
      passwort_min: konfig.passwort_min,
    });
  });
  r.add('GET', '/api/verwaltung/mandanten', (req, res) =>
    json(res, 200, { mandanten: V.mandantenListe(db, verwalter(req)) }),
  );
  r.add('POST', '/api/verwaltung/mandanten', async (req, res) =>
    json(res, 200, { mandant: V.mandantAnlegen(db, verwalter(req), await jsonRumpf(req)) }),
  );
  r.add('POST', '/api/verwaltung/mandanten/:id', async (req, res, p) =>
    json(res, 200, { mandant: V.mandantAendern(db, verwalter(req), p.id, await jsonRumpf(req)) }),
  );
  r.add('POST', '/api/verwaltung/mandanten/:id/loeschen', (req, res, p) => {
    const m = V.mandantLoeschen(db, verwalter(req), p.id);
    projekte.mandantDateienLoeschen(m.id);
    json(res, 200, { ok: true });
  });
  r.add('GET', '/api/verwaltung/nutzer', (req, res, p, q) =>
    json(res, 200, { nutzer: V.nutzerListe(db, verwalter(req), q.get('mandant')) }),
  );
  r.add('POST', '/api/verwaltung/nutzer', async (req, res) => {
    const a = verwalter(req);
    const d = await jsonRumpf(req);
    const n = V.nutzerAnlegen(db, a, d.mandant, d);
    const mail = d.einladen === false ? null : await anm.linkSenden(n, 'einladung');
    json(res, 200, { nutzer: V.oeffentlicherNutzer(db, n), mail });
  });
  r.add('POST', '/api/verwaltung/nutzer/:id', async (req, res, p) =>
    json(res, 200, { nutzer: V.nutzerAendern(db, verwalter(req), p.id, await jsonRumpf(req)) }),
  );
  r.add('POST', '/api/verwaltung/nutzer/:id/loeschen', (req, res, p) => {
    V.nutzerLoeschen(db, verwalter(req), p.id);
    json(res, 200, { ok: true });
  });
  r.add('POST', '/api/verwaltung/nutzer/:id/einladen', async (req, res, p) => {
    const n = V.nutzerFuerAktion(db, verwalter(req), p.id);
    if (n.status === 'gesperrt') throw new V.Fehler(400, 'Gesperrte Nutzer bitte zuerst entsperren');
    const mail = await anm.linkSenden(n, n.status === 'eingeladen' ? 'einladung' : 'zuruecksetzen');
    json(res, 200, { mail });
  });
  r.add('GET', '/api/verwaltung/gruppen', (req, res, p, q) =>
    json(res, 200, { gruppen: V.gruppenListe(db, verwalter(req), q.get('mandant')) }),
  );
  r.add('POST', '/api/verwaltung/gruppen', async (req, res) => {
    const d = await jsonRumpf(req);
    json(res, 200, { gruppe: V.gruppeAnlegen(db, verwalter(req), d.mandant, d) });
  });
  r.add('POST', '/api/verwaltung/gruppen/:id', async (req, res, p) =>
    json(res, 200, { gruppe: V.gruppeAendern(db, verwalter(req), p.id, await jsonRumpf(req)) }),
  );
  r.add('POST', '/api/verwaltung/gruppen/:id/loeschen', (req, res, p) => {
    V.gruppeLoeschen(db, verwalter(req), p.id);
    json(res, 200, { ok: true });
  });
  r.add('GET', '/api/verwaltung/protokoll', (req, res, p, q) =>
    json(res, 200, { protokoll: V.protokoll(db, verwalter(req), q.get('mandant')) }),
  );
  r.add('GET', '/api/verwaltung/kennung', (req, res, p, q) => {
    const n = verwalter(req);
    if (n.rolle !== 'betreiber') throw new V.Fehler(403, 'Keine Berechtigung');
    const x = db.prepare('SELECT v FROM kv WHERE k = ?').get('kennung:' + String(q.get('id') || '').trim());
    json(res, 200, { email: x ? x.v : null });
  });
  // Voreinstellungen für alle Anwender (Admin-Ansicht im Tool) – nur Betreiber
  r.add('POST', '/api/admin/cfg', async (req, res) => {
    const n = pflicht(req);
    if (n.rolle !== 'betreiber') throw new V.Fehler(403, 'Keine Berechtigung');
    const d = await jsonRumpf(req, 2_100_000);
    if (!d.cfg || typeof d.cfg !== 'object') throw new V.Fehler(400, 'Ungültige Konfiguration');
    const roh = JSON.stringify(d.cfg);
    db.prepare("INSERT INTO kv(k, v) VALUES ('toolcfg', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(
      roh,
    );
    V.protokolliere(db, null, n.email, 'voreinstellungen', roh.length + ' Bytes');
    json(res, 200, { ok: true });
  });

  // ---------- Projekte ----------
  projekte.routen(r, pflicht);

  // ---------- Geodienst-Weiterleitung ----------
  r.add('GET', '/api/proxy', async (req, res, p, q) => {
    const n = pflicht(req);
    if (!konfig.proxy) throw new V.Fehler(404, 'Weiterleitung abgeschaltet');
    if (!begrenzer.erlaubt('px:' + n.id, 1500, 600)) throw new V.Fehler(429, 'Zu viele Anfragen');
    const kopf = {
      'User-Agent': 'maad-proxy',
      Accept: req.headers.accept || '*/*',
      'Accept-Encoding': 'identity',
    };
    if (req.headers.range) kopf.Range = req.headers.range;
    let a;
    try {
      a = await proxyAbruf(String(q.get('url') || ''), kopf, konfig.proxy_max_mb * 1048576);
    } catch {
      throw new V.Fehler(502, 'Dienst nicht erreichbar');
    }
    const { 'content-type': typ, ...rest } = a.kopf;
    sende(res, a.status, a.daten, typ || 'application/octet-stream', rest);
  });

  // ---------- Verteiler ----------
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') schreibschutz(req, konfig.base_url);
      const t = r.finde(req.method, u.pathname);
      if (t === 'methode') return sende(res, 405, 'Methode nicht erlaubt');
      if (!t) return sende(res, 404, 'Nicht gefunden');
      await t.fn(req, res, t.p, u.searchParams);
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (e instanceof V.Fehler) return json(res, e.status, { error: e.message });
      V.protokolliere(
        db,
        null,
        '',
        'serverfehler',
        `${req.method} ${u.pathname}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e}`,
      );
      json(res, 500, { error: 'Serverfehler' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const konfig = ladeKonfig();
  // Hinweise auf unvollständige Einstellungen
  if (!konfig.betreiber.length)
    console.warn(
      'Hinweis: Keine Betreiber in der Konfiguration („betreiber“) – niemand kann Mandanten anlegen.',
    );
  if (!konfig.smtp.host)
    console.warn(`Hinweis: Kein Mailserver eingetragen – E-Mails landen in ${konfig.data_dir}/outbox.log.`);
  if (!konfig.maptiler_key)
    console.warn(
      'Hinweis: Kein MapTiler-Schlüssel – Karten und Gelände von MapTiler fehlen in der Vollversion.',
    );
  if (/HIER-/.test(JSON.stringify(konfig)))
    console.warn('Hinweis: In der Konfiguration stehen noch Platzhalter (HIER-…).');
  const srv = erstelleServer(konfig);
  srv.headersTimeout = 30000;
  srv.requestTimeout = 300000;
  srv.listen(konfig.port, konfig.host, () =>
    console.log(
      `maad-Server läuft auf http://${konfig.host}:${konfig.port} (öffentlich: ${konfig.base_url})`,
    ),
  );
}
