// Anmeldung mit E-Mail und Passwort, Sitzungen, Einladungs- und Zurücksetzen-Links.
import { jetzt, transaktion } from './datenbank.mjs';
import {
  passwortHash,
  passwortPruefen,
  passwortRegel,
  zufall,
  sha256,
  gueltigeEmail,
  Begrenzer,
} from './sicherheit.mjs';
import { Fehler, mandant, zugelassen, protokolliere } from './verwaltung.mjs';
import { sendeMail } from './mail.mjs';

const COOKIE = 'maad_sid';
const MAX_FEHLVERSUCHE = 8;
const SPERRE_MIN = 15;
const ALLGEMEIN = 'E-Mail-Adresse oder Passwort ist falsch.';

export class Anmeldung {
  constructor(db, konfig) {
    this.db = db;
    this.k = konfig;
    this.begrenzer = new Begrenzer();
  }

  // ---------- Sitzungen ----------

  cookie(wert, sekunden) {
    return `${COOKIE}=${wert}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sekunden}${this.k.sicher ? '; Secure' : ''}`;
  }

  neueSitzung(nutzerId, ip) {
    const sid = zufall(32);
    const t = Date.now() / 1000;
    this.db.prepare('DELETE FROM sitzungen WHERE laeuft_ab < ?').run(t);
    this.db
      .prepare('INSERT INTO sitzungen(h, nutzer_id, laeuft_ab, erstellt, ip) VALUES (?,?,?,?,?)')
      .run(sha256(sid), nutzerId, t + this.k.sitzung_tage * 86400, t, ip || '');
    return this.cookie(sid, this.k.sitzung_tage * 86400);
  }

  /** Angemeldeter, zugelassener Nutzer zur Anfrage oder null. */
  nutzerAus(cookies) {
    const sid = cookies[COOKIE];
    if (!sid || sid.length > 100) return null;
    const s = this.db.prepare('SELECT * FROM sitzungen WHERE h = ?').get(sha256(sid));
    if (!s || s.laeuft_ab < Date.now() / 1000) return null;
    const n = this.db.prepare('SELECT * FROM nutzer WHERE id = ?').get(s.nutzer_id);
    return n && n.status === 'aktiv' && zugelassen(n, mandant(this.db, n.mandant_id)) ? n : null;
  }

  abmelden(cookies) {
    const sid = cookies[COOKIE];
    if (sid) this.db.prepare('DELETE FROM sitzungen WHERE h = ?').run(sha256(sid));
    return this.cookie('', 0);
  }

  // ---------- Passwort-Anmeldung ----------

  async anmelden(email, passwort, ip) {
    email = String(email || '')
      .trim()
      .toLowerCase();
    if (!this.begrenzer.erlaubt('ip:' + ip, 30, 600) || !this.begrenzer.erlaubt('em:' + email, 10, 600))
      throw new Fehler(429, 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.');
    const n = gueltigeEmail(email)
      ? this.db.prepare('SELECT * FROM nutzer WHERE email = ?').get(email)
      : null;
    const ok = await passwortPruefen(passwort, n && n.pw_hash);
    const t = Date.now() / 1000;
    if (
      !n ||
      !ok ||
      n.status !== 'aktiv' ||
      n.gesperrt_bis > t ||
      !zugelassen(n, mandant(this.db, n.mandant_id))
    ) {
      if (n && !ok) {
        const f = n.fehlversuche + 1;
        const bis = f >= MAX_FEHLVERSUCHE ? t + SPERRE_MIN * 60 : n.gesperrt_bis;
        this.db
          .prepare('UPDATE nutzer SET fehlversuche = ?, gesperrt_bis = ? WHERE id = ?')
          .run(f >= MAX_FEHLVERSUCHE ? 0 : f, bis, n.id);
        if (f >= MAX_FEHLVERSUCHE)
          protokolliere(this.db, n.mandant_id, email, 'konto_vorlaeufig_gesperrt', ip);
      }
      protokolliere(this.db, n ? n.mandant_id : null, email, 'anmeldung_fehlgeschlagen', ip);
      throw new Fehler(401, ALLGEMEIN);
    }
    this.db
      .prepare('UPDATE nutzer SET fehlversuche = 0, gesperrt_bis = 0, letzte_anmeldung = ? WHERE id = ?')
      .run(jetzt(), n.id);
    protokolliere(this.db, n.mandant_id, email, 'anmeldung', ip);
    return this.neueSitzung(n.id, ip);
  }

  // ---------- Links (Einladung, Passwort zurücksetzen) ----------

  async linkSenden(nutzer, zweck) {
    const tok = zufall(32);
    const dauer = zweck === 'einladung' ? this.k.einladung_stunden * 3600 : this.k.zuruecksetzen_minuten * 60;
    transaktion(this.db, () => {
      this.db.prepare('DELETE FROM tokens WHERE nutzer_id = ? AND zweck = ?').run(nutzer.id, zweck);
      this.db.prepare('DELETE FROM tokens WHERE laeuft_ab < ?').run(Date.now() / 1000 - 86400);
      this.db
        .prepare('INSERT INTO tokens(h, nutzer_id, zweck, laeuft_ab) VALUES (?,?,?,?)')
        .run(sha256(tok), nutzer.id, zweck, Date.now() / 1000 + dauer);
    });
    const url = `${this.k.base_url.replace(/\/$/, '')}/passwort?t=${tok}`;
    const app = this.k.app_name;
    const hallo = `Guten Tag${nutzer.name ? ' ' + nutzer.name : ''},`;
    const [betreff, text] =
      zweck === 'einladung'
        ? [
            `Ihr Zugang zu ${app}`,
            `${hallo}\n\nfür Sie wurde ein Zugang zu ${app} eingerichtet. Mit diesem Link legen Sie Ihr Passwort fest:\n\n${url}\n\nDer Link ist ${this.k.einladung_stunden} Stunden gültig und nur einmal nutzbar.`,
          ]
        : [
            `Passwort für ${app} festlegen`,
            `${hallo}\n\nmit diesem Link legen Sie ein neues Passwort für ${app} fest:\n\n${url}\n\nDer Link ist ${this.k.zuruecksetzen_minuten} Minuten gültig und nur einmal nutzbar. Wenn Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail – Ihr bisheriges Passwort bleibt gültig.`,
          ];
    try {
      await sendeMail(this.k, nutzer.email, betreff, text);
      protokolliere(
        this.db,
        nutzer.mandant_id,
        nutzer.email,
        zweck === 'einladung' ? 'einladung_gesendet' : 'link_gesendet',
      );
      return true;
    } catch (e) {
      protokolliere(this.db, nutzer.mandant_id, nutzer.email, 'mail_fehler', e.message);
      return false;
    }
  }

  /** „Passwort vergessen“: immer gleiche Antwort, Link nur an zugelassene Konten. */
  async passwortVergessen(email, ip) {
    email = String(email || '')
      .trim()
      .toLowerCase();
    if (!this.begrenzer.erlaubt('vg-ip:' + ip, 10, 600) || !this.begrenzer.erlaubt('vg-em:' + email, 3, 600))
      throw new Fehler(429, 'Zu viele Anfragen. Bitte später erneut versuchen.');
    const n = gueltigeEmail(email)
      ? this.db.prepare('SELECT * FROM nutzer WHERE email = ?').get(email)
      : null;
    if (n && n.status !== 'gesperrt' && zugelassen(n, mandant(this.db, n.mandant_id)))
      await this.linkSenden(n, n.status === 'eingeladen' ? 'einladung' : 'zuruecksetzen');
    else protokolliere(this.db, n ? n.mandant_id : null, email, 'link_abgelehnt', ip);
  }

  /** Gültiges Token prüfen (ohne es zu verbrauchen). */
  tokenNutzer(tok) {
    if (!tok || tok.length > 100) return null;
    const t = this.db.prepare('SELECT * FROM tokens WHERE h = ?').get(sha256(tok));
    if (!t || t.benutzt || t.laeuft_ab < Date.now() / 1000) return null;
    const n = this.db.prepare('SELECT * FROM nutzer WHERE id = ?').get(t.nutzer_id);
    return n && n.status !== 'gesperrt' && zugelassen(n, mandant(this.db, n.mandant_id)) ? n : null;
  }

  /** Neues Passwort über Link setzen; beendet alle anderen Sitzungen und meldet an. */
  async passwortSetzen(tok, passwort, ip) {
    if (!this.begrenzer.erlaubt('ps-ip:' + ip, 20, 600)) throw new Fehler(429, 'Zu viele Versuche.');
    const n = this.tokenNutzer(tok);
    if (!n) throw new Fehler(400, 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    const regel = passwortRegel(passwort, this.k.passwort_min);
    if (regel) throw new Fehler(400, regel);
    const hash = await passwortHash(passwort);
    transaktion(this.db, () => {
      this.db.prepare('UPDATE tokens SET benutzt = 1 WHERE h = ?').run(sha256(tok));
      this.db
        .prepare(
          "UPDATE nutzer SET pw_hash = ?, status = 'aktiv', fehlversuche = 0, gesperrt_bis = 0, letzte_anmeldung = ? WHERE id = ?",
        )
        .run(hash, jetzt(), n.id);
      this.db.prepare('DELETE FROM sitzungen WHERE nutzer_id = ?').run(n.id);
    });
    protokolliere(this.db, n.mandant_id, n.email, 'passwort_gesetzt', ip);
    return this.neueSitzung(n.id, ip);
  }

  /** Eigenes Passwort ändern (angemeldet, mit altem Passwort). */
  async passwortAendern(nutzer, alt, neu, ip) {
    if (!(await passwortPruefen(alt, nutzer.pw_hash)))
      throw new Fehler(400, 'Das bisherige Passwort ist falsch.');
    const regel = passwortRegel(neu, this.k.passwort_min);
    if (regel) throw new Fehler(400, regel);
    this.db.prepare('UPDATE nutzer SET pw_hash = ? WHERE id = ?').run(await passwortHash(neu), nutzer.id);
    this.db.prepare('DELETE FROM sitzungen WHERE nutzer_id = ?').run(nutzer.id);
    protokolliere(this.db, nutzer.mandant_id, nutzer.email, 'passwort_geaendert', ip);
    return this.neueSitzung(nutzer.id, ip);
  }

  /** Betreiber aus der Konfiguration anlegen; nicht mehr aufgeführte Betreiber werden gesperrt. */
  betreiberAbgleichen() {
    const liste = this.k.betreiber;
    for (const email of liste) {
      const n = this.db.prepare('SELECT * FROM nutzer WHERE email = ?').get(email);
      if (!n)
        this.db
          .prepare(
            "INSERT INTO nutzer(mandant_id, email, rolle, status, angelegt) VALUES (NULL, ?, 'betreiber', 'eingeladen', ?)",
          )
          .run(email, jetzt());
      else if (n.rolle !== 'betreiber')
        throw new Error(
          `${email} ist bereits Nutzer eines Mandanten und kann nicht zugleich Betreiber sein.`,
        );
      else if (n.status === 'gesperrt')
        this.db
          .prepare('UPDATE nutzer SET status = ? WHERE id = ?')
          .run(n.pw_hash ? 'aktiv' : 'eingeladen', n.id);
    }
    const alle = this.db.prepare("SELECT * FROM nutzer WHERE rolle = 'betreiber'").all();
    for (const n of alle)
      if (!liste.includes(n.email)) {
        this.db.prepare("UPDATE nutzer SET status = 'gesperrt' WHERE id = ?").run(n.id);
        this.db.prepare('DELETE FROM sitzungen WHERE nutzer_id = ?').run(n.id);
      }
  }
}
