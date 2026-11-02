// Auslieferung des Tools: Fassung je Rechte-Satz (fehlende Funktionen im Code ersetzt), Server-Schlüssel,
// Proxy-Adresse, Kundenkennung und window.MAAD_ACC.
import { readFileSync, statSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';

// Platzhalter im gebauten Tool, die der Server ersetzt
const ALT_SCHLUESSEL = '0jnOTw9obPwX3gZ4OJSu';
const ALT_PROXY = 'https://lot-cors.marc-wilmesmeier.workers.dev/?url=';

/** Text als unsichtbare Zeichen (Nullbreite) – Teil der Kundenkennung im Seitentitel. */
const unsichtbar = (s) =>
  '⁠' +
  [...Buffer.from(s)]
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('')
    .replace(/0/g, '​')
    .replace(/1/g, '‌') +
  '⁠';

export class Werkzeug {
  #stand = '';
  #html = '';
  #stellen = {};
  #cache = new Map();

  constructor(konfig, db) {
    this.k = konfig;
    this.db = db;
  }

  #laden() {
    const s = `${statSync(this.k.tool_file).mtimeMs}|${statSync(this.k.sperren_file).mtimeMs}`;
    if (s === this.#stand) return;
    this.#html = readFileSync(this.k.tool_file, 'utf8');
    this.#stellen = JSON.parse(readFileSync(this.k.sperren_file, 'utf8'));
    for (const L of Object.values(this.#stellen))
      for (const [von, bis] of L)
        if (!(von >= 0 && bis <= this.#html.length && von < bis))
          throw new Error('Sperrstellen passen nicht zu maad.html – beide Dateien zusammen aktualisieren');
    this.#cache.clear();
    this.#stand = s;
  }

  get gesperrteRechte() {
    this.#laden();
    return Object.keys(this.#stellen);
  }

  /** Fassung ohne die Funktionen der fehlenden Rechte; voll = mit Server-Schlüssel und Proxy. */
  #fassung(fehlend, voll) {
    const key = fehlend.join(',') + '|' + voll;
    if (this.#cache.has(key)) return this.#cache.get(key);
    let h = this.#html;
    const L = fehlend.flatMap((r) => this.#stellen[r] || []).sort((x, y) => y[0] - x[0]);
    for (const [von, bis, ersatz] of L) h = h.slice(0, von) + ersatz + h.slice(bis);
    h = h.replaceAll(ALT_PROXY, voll && this.k.proxy ? '/api/proxy?url=' : '');
    h = h.replaceAll(ALT_SCHLUESSEL, voll ? this.k.maptiler_key || '' : '');
    if (this.#cache.size > 40) this.#cache.clear();
    this.#cache.set(key, h);
    return h;
  }

  /** Kennung je Nutzer (12 Zeichen); Rückfrage über /api/verwaltung/kennung. */
  kennung(email) {
    let sec = this.db.prepare("SELECT v FROM kv WHERE k = 'kennung_geheimnis'").get();
    if (!sec) {
      const v = randomBytes(32).toString('hex');
      this.db.prepare("INSERT OR IGNORE INTO kv(k, v) VALUES ('kennung_geheimnis', ?)").run(v);
      sec = this.db.prepare("SELECT v FROM kv WHERE k = 'kennung_geheimnis'").get();
    }
    const w = createHmac('sha256', sec.v).update(email.toLowerCase()).digest('hex').slice(0, 12);
    this.db.prepare('INSERT OR IGNORE INTO kv(k, v) VALUES (?, ?)').run('kennung:' + w, email.toLowerCase());
    return w;
  }

  /**
   * Seite für einen angemeldeten Nutzer (nutzer, rechte, mandantName) oder die Demo (nutzer = null).
   * cfg: Voreinstellungen für alle Anwender.
   */
  seite({ nutzer = null, rechte = [], mandantName = '', cfg = null }) {
    this.#laden();
    const fehlend = nutzer ? this.gesperrteRechte.filter((r) => !rechte.includes(r)) : this.gesperrteRechte;
    let h = this.#fassung(fehlend, !!nutzer);
    const acc = { server: true, mode: nutzer ? 'full' : 'demo', cfg };
    if (nutzer) {
      const w = this.kennung(nutzer.email);
      acc.user = {
        email: nutzer.email,
        name: nutzer.name,
        role: nutzer.rolle,
        perms: rechte,
        org: mandantName,
      };
      acc.wm = w;
      h = h.replace('</title>', unsichtbar(w) + '</title>');
      const i = h.lastIndexOf('</body>');
      h = h.slice(0, i) + `<!--maad-lizenz:${w}-->` + h.slice(i);
    }
    const daten = JSON.stringify(acc)
      .replace(/</g, '\\u003c')
      .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
    const m = /<head[^>]*>/i.exec(h);
    const inj = `<script>window.MAAD_ACC=${daten};</script>`;
    h = m ? h.slice(0, m.index + m[0].length) + inj + h.slice(m.index + m[0].length) : inj + h;
    return Buffer.from(h);
  }
}
