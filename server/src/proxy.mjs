// Weiterleitung für Geodienste ohne Browser-Freigabe (nur für angemeldete Nutzer).
// Schutz: nur https auf Port 443, nur öffentliche Adressen (DNS wird einmal aufgelöst und die Verbindung an
// genau diese Adresse gebunden), höchstens 4 Weiterleitungen, Größengrenze.
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';

const NICHT_OEFFENTLICH = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  NICHT_OEFFENTLICH.addSubnet(a, p, 'ipv4');
for (const [a, p] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
])
  NICHT_OEFFENTLICH.addSubnet(a, p, 'ipv6');

export function oeffentlich(ip) {
  const typ = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : null;
  return !!typ && !NICHT_OEFFENTLICH.check(ip, typ);
}

async function oeffentlicheAdresse(host) {
  if (net.isIP(host)) return oeffentlich(host) ? host : null;
  let L;
  try {
    L = await dns.lookup(host, { all: true });
  } catch {
    return null;
  }
  return L.length && L.every((a) => oeffentlich(a.address)) ? L[0] : null;
}

function abruf(url, adresse, kopf, maxBytes) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: kopf,
        timeout: 120000,
        // Verbindung nur an die geprüfte Adresse (Zertifikat wird weiter gegen den Hostnamen geprüft)
        lookup: (_h, opt, cb) =>
          opt && opt.all ? cb(null, [adresse]) : cb(null, adresse.address, adresse.family),
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve({ weiter: new URL(res.headers.location, url).href });
        }
        const teile = [];
        let n = 0;
        res.on('data', (d) => {
          n += d.length;
          if (n > maxBytes) {
            req.destroy();
            resolve({ status: 413, kopf: {}, daten: Buffer.from('Antwort zu groß') });
          } else teile.push(d);
        });
        res.on('end', () => {
          const kopfAus = {};
          for (const h of ['content-type', 'content-range', 'content-encoding', 'last-modified', 'etag'])
            if (res.headers[h]) kopfAus[h] = res.headers[h];
          resolve({ status: res.statusCode, kopf: kopfAus, daten: Buffer.concat(teile) });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
    req.end();
  });
}

/** Holt eine https-Adresse; liefert { status, kopf, daten }. */
export async function proxyAbruf(url, kopf, maxBytes) {
  for (let i = 0; i < 5; i++) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return { status: 400, kopf: {}, daten: Buffer.from('Ungültige Adresse') };
    }
    if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password)
      return { status: 400, kopf: {}, daten: Buffer.from('Nur https auf Port 443 erlaubt') };
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const adresse = await oeffentlicheAdresse(host);
    if (!adresse) return { status: 403, kopf: {}, daten: Buffer.from('Adresse nicht erlaubt') };
    const a =
      typeof adresse === 'string' ? { address: adresse, family: net.isIPv6(adresse) ? 6 : 4 } : adresse;
    const r = await abruf(u.href, a, kopf, maxBytes);
    if (r.weiter) {
      url = r.weiter;
      continue;
    }
    return r;
  }
  return { status: 508, kopf: {}, daten: Buffer.from('Zu viele Weiterleitungen') };
}
