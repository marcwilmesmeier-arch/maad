// Kleiner Router und Hilfen für Anfragen/Antworten.
import { Fehler } from './verwaltung.mjs';

export class Router {
  #routen = [];
  add(methode, muster, fn) {
    const namen = [];
    const re = new RegExp(
      '^' +
        muster.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, n) => {
          namen.push(n);
          return '([^/]+)';
        }) +
        '$',
    );
    this.#routen.push({ methode, re, namen, fn });
  }
  finde(methode, pfad) {
    let pfadPasst = false;
    for (const r of this.#routen) {
      const m = r.re.exec(pfad);
      if (!m) continue;
      pfadPasst = true;
      if (r.methode !== methode && !(methode === 'HEAD' && r.methode === 'GET')) continue;
      const p = {};
      r.namen.forEach((n, i) => (p[n] = decodeURIComponent(m[i + 1])));
      return { fn: r.fn, p };
    }
    return pfadPasst ? 'methode' : null;
  }
}

export const SICHERHEITS_HEADER = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
// Strenge Richtlinie für Anmelde-/Verwaltungsseiten (nur eigene Skripte und Styles)
export const CSP_SEITEN =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

export function sende(res, status, body = '', typ = 'text/plain; charset=utf-8', extra = {}) {
  if (typeof body === 'string') body = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': typ,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...SICHERHEITS_HEADER,
    ...extra,
  });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}
export const json = (res, status, obj, extra) =>
  sende(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', extra);
export const weiter = (res, ziel, extra = {}) =>
  sende(res, 302, '', 'text/plain', { Location: ziel, ...extra });

export function cookies(req) {
  const o = {};
  for (const t of String(req.headers.cookie || '').split(';')) {
    const i = t.indexOf('=');
    if (i > 0) o[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return o;
}

/** Liest den Rumpf bis zur Größengrenze. */
export function rumpf(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const laenge = Number(req.headers['content-length'] || 0);
    if (laenge > maxBytes) return reject(new Fehler(413, 'Anfrage zu groß'));
    const teile = [];
    let n = 0;
    req.on('data', (d) => {
      n += d.length;
      if (n > maxBytes) {
        reject(new Fehler(413, 'Anfrage zu groß'));
        req.destroy();
      } else teile.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(teile)));
    req.on('error', reject);
  });
}

export async function jsonRumpf(req, maxBytes = 100_000) {
  const b = await rumpf(req, maxBytes);
  if (!b.length) return {};
  try {
    const o = JSON.parse(b.toString('utf8'));
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0;
    return o;
  } catch {
    throw new Fehler(400, 'Ungültiges JSON');
  }
}

/**
 * Schutz gegen fremde Seiten (CSRF): Schreibende Anfragen brauchen die Kopfzeile X-Maad: 1 (fremde Seiten können
 * sie ohne CORS-Freigabe nicht setzen) und – falls vorhanden – einen Origin der eigenen Adresse.
 */
export function schreibschutz(req, baseUrl) {
  if (req.headers['x-maad'] !== '1') throw new Fehler(400, 'Ungültige Anfrage');
  const o = req.headers.origin;
  if (o && o !== new URL(baseUrl).origin) throw new Fehler(403, 'Fremde Herkunft');
}

/** IP des Aufrufers; hinter Caddy (lokal) aus X-Forwarded-For. */
export function ipVon(req) {
  const direkt = req.socket.remoteAddress || '';
  const lokal = direkt === '127.0.0.1' || direkt === '::1' || direkt === '::ffff:127.0.0.1';
  const xff = req.headers['x-forwarded-for'];
  return lokal && xff ? String(xff).split(',')[0].trim() : direkt;
}
