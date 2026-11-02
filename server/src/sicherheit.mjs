// Passwörter (scrypt), Zufallswerte, Prüfsummen und Anfragebegrenzung.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

function scryptAsync(pw, salt, opt) {
  return new Promise((res, rej) => scrypt(pw, salt, KEYLEN, opt, (e, k) => (e ? rej(e) : res(k))));
}

/** Passwort -> "scrypt$N$r$p$salt$hash" (alles Base64url). */
export async function passwortHash(pw) {
  const salt = randomBytes(16);
  const k = await scryptAsync(String(pw).normalize('NFKC'), salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), k.toString('base64url')].join(
    '$',
  );
}

export async function passwortPruefen(pw, gespeichert) {
  const t = String(gespeichert || '').split('$');
  if (t.length !== 6 || t[0] !== 'scrypt') {
    // gleiche Rechenzeit wie bei einem echten Vergleich, damit unbekannte Konten nicht auffallen
    await scryptAsync('x', randomBytes(16), SCRYPT);
    return false;
  }
  const opt = { N: +t[1], r: +t[2], p: +t[3], maxmem: SCRYPT.maxmem };
  const soll = Buffer.from(t[5], 'base64url');
  const ist = await scryptAsync(String(pw).normalize('NFKC'), Buffer.from(t[4], 'base64url'), opt);
  return soll.length === ist.length && timingSafeEqual(soll, ist);
}

/** Mindestanforderung an Passwörter; liefert Fehlertext oder null. */
export function passwortRegel(pw, min) {
  pw = String(pw || '');
  if (pw.length < min) return `Das Passwort muss mindestens ${min} Zeichen lang sein.`;
  if (pw.length > 200) return 'Das Passwort ist zu lang.';
  if (new Set(pw).size < 5) return 'Das Passwort ist zu einfach.';
  return null;
}

export const zufall = (n = 32) => randomBytes(n).toString('base64url');
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
export const gueltigeEmail = (e) => typeof e === 'string' && e.length <= 254 && EMAIL.test(e);

/** Gleitendes Fenster: höchstens grenze Ereignisse je sekunden. */
export class Begrenzer {
  #m = new Map();
  erlaubt(schluessel, grenze, sekunden) {
    const t = Date.now() / 1000;
    const L = (this.#m.get(schluessel) || []).filter((x) => t - x < sekunden);
    if (L.length >= grenze) {
      this.#m.set(schluessel, L);
      return false;
    }
    L.push(t);
    this.#m.set(schluessel, L);
    if (this.#m.size > 50000) this.#m.clear(); // Notbremse gegen Speicherwachstum
    return true;
  }
}
