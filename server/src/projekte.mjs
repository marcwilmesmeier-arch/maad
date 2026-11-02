// Projekte auf dem Server: Datensatz (JSON, wird oft gespeichert) und Kartenausschnitt (Binärdatei, einmalig).
// Zugriff nur innerhalb des eigenen Mandanten: Besitzer, Mandanten-Admin oder per Freigabe (Mandant, Gruppe,
// Nutzer; „lesen“ oder „bearbeiten“). Betreiber sehen keine Kundenprojekte.
import { mkdirSync, writeFileSync, readFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { jetzt, transaktion } from './datenbank.mjs';
import { Fehler, protokolliere, rechteVon } from './verwaltung.mjs';
import { json, sende, jsonRumpf, rumpf } from './http.mjs';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STUFE = { lesen: 1, bearbeiten: 2, besitzer: 3 };

export class Projekte {
  constructor(db, konfig) {
    this.db = db;
    this.k = konfig;
  }

  #ordner(mandantId) {
    const d = join(this.k.data_dir, 'projekte', String(Number(mandantId)));
    mkdirSync(d, { recursive: true });
    return d;
  }
  #datei(p, art) {
    return join(this.#ordner(p.mandant_id), `${p.id}.${art}`);
  }
  #schreiben(pfad, daten) {
    const tmp = pfad + '.tmp';
    writeFileSync(tmp, daten);
    renameSync(tmp, pfad);
  }

  mandantDateienLoeschen(mandantId) {
    rmSync(join(this.k.data_dir, 'projekte', String(Number(mandantId))), { recursive: true, force: true });
  }

  /** Zugriffsstufe des Nutzers auf ein Projekt: 0 (keiner), 1 lesen, 2 bearbeiten, 3 Besitzer/Admin. */
  stufe(nutzer, p) {
    if (!p || nutzer.rolle === 'betreiber' || p.mandant_id !== nutzer.mandant_id) return 0;
    if (p.besitzer_id === nutzer.id || nutzer.rolle === 'admin') return STUFE.besitzer;
    const f = this.db
      .prepare(
        `SELECT recht FROM freigaben WHERE projekt_id = ? AND (
           (art = 'mandant' AND ziel_id = ?) OR (art = 'nutzer' AND ziel_id = ?) OR
           (art = 'gruppe' AND ziel_id IN (SELECT gruppe_id FROM mitglieder WHERE nutzer_id = ?)))`,
      )
      .all(p.id, nutzer.mandant_id, nutzer.id, nutzer.id);
    return Math.max(0, ...f.map((x) => STUFE[x.recht]));
  }

  #projekt(id) {
    if (!ID.test(String(id))) throw new Fehler(400, 'Ungültige Projektkennung');
    return this.db.prepare('SELECT * FROM projekte WHERE id = ?').get(id) || null;
  }

  /** Projekt mit Mindest-Zugriffsstufe; sonst 404 (auch bei fehlendem Recht – verrät nicht, dass es existiert). */
  #mit(nutzer, id, mind) {
    const p = this.#projekt(id);
    const s = this.stufe(nutzer, p);
    if (!p || s === 0) throw new Fehler(404, 'Projekt nicht gefunden');
    if (s < mind) throw new Fehler(403, 'Für dieses Projekt fehlt die Berechtigung');
    return { p, s };
  }

  #rechtPflicht(nutzer, recht) {
    if (nutzer.rolle === 'betreiber')
      throw new Fehler(400, 'Betreiber speichern Projekte nur im eigenen Browser');
    if (!rechteVon(this.db, nutzer).includes(recht)) throw new Fehler(403, 'Recht fehlt: ' + recht);
  }

  liste(nutzer) {
    this.#rechtPflicht(nutzer, 'project_open');
    const alle = this.db
      .prepare(
        'SELECT p.*, n.email besitzer FROM projekte p LEFT JOIN nutzer n ON n.id = p.besitzer_id WHERE p.mandant_id = ? ORDER BY p.geaendert DESC',
      )
      .all(nutzer.mandant_id);
    return alle
      .map((p) => ({ p, s: this.stufe(nutzer, p) }))
      .filter((x) => x.s > 0)
      .map(({ p, s }) => ({
        ...JSON.parse(p.meta),
        id: p.id,
        name: p.name,
        version: p.version,
        geaendert: p.geaendert,
        besitzer: p.besitzer,
        eigenes: p.besitzer_id === nutzer.id,
        zugriff: s >= STUFE.bearbeiten ? 'bearbeiten' : 'lesen',
        karte: existsSync(this.#datei(p, 'karte')),
      }));
  }

  /**
   * Speichert den Datensatz. Neues Projekt: braucht project_new. Bestehendes: Stufe „bearbeiten“.
   * d.basis = Version, auf der die Änderung beruht; ist inzwischen jemand anderes gespeichert → 409.
   */
  speichern(nutzer, id, d) {
    this.#rechtPflicht(nutzer, 'project_open');
    const rec = d.rec;
    if (!rec || typeof rec !== 'object') throw new Fehler(400, 'Projektdaten fehlen');
    const meta = JSON.stringify({
      label: String(rec.label || '').slice(0, 200),
      t: Number(rec.t) || Date.now(),
      n: Number(rec.n) || 0,
      thumb: typeof rec.thumb === 'string' && rec.thumb.length < 400_000 ? rec.thumb : null,
      lon: Number(rec.lon) || null,
      lat: Number(rec.lat) || null,
      size: Number(rec.size) || null,
    });
    const name = String(rec.name || 'Projekt').slice(0, 200);
    const daten = Buffer.from(JSON.stringify(rec));
    return transaktion(this.db, () => {
      let p = this.#projekt(id);
      if (!p) {
        this.#rechtPflicht(nutzer, 'project_new');
        this.db
          .prepare(
            'INSERT INTO projekte(id, mandant_id, besitzer_id, name, meta, groesse, version, angelegt, geaendert, geaendert_von) VALUES (?,?,?,?,?,?,1,?,?,?)',
          )
          .run(id, nutzer.mandant_id, nutzer.id, name, meta, daten.length, jetzt(), jetzt(), nutzer.id);
        p = this.#projekt(id);
        protokolliere(this.db, nutzer.mandant_id, nutzer.email, 'projekt_angelegt', `${id} ${name}`);
      } else {
        this.#mit(nutzer, id, STUFE.bearbeiten);
        if (d.basis != null && Number(d.basis) !== p.version && p.geaendert_von !== nutzer.id)
          throw new Fehler(409, 'Das Projekt wurde inzwischen von jemand anderem gespeichert.');
        this.db
          .prepare(
            'UPDATE projekte SET name = ?, meta = ?, groesse = ?, version = version + 1, geaendert = ?, geaendert_von = ? WHERE id = ?',
          )
          .run(name, meta, daten.length, jetzt(), nutzer.id, id);
        p = this.#projekt(id);
      }
      this.#schreiben(this.#datei(p, 'json'), daten);
      return { version: p.version };
    });
  }

  karteSpeichern(nutzer, id, daten) {
    const { p } = this.#mit(nutzer, id, STUFE.bearbeiten);
    if (!daten.length) throw new Fehler(400, 'Kartendaten fehlen');
    this.#schreiben(this.#datei(p, 'karte'), daten);
  }

  laden(nutzer, id) {
    this.#rechtPflicht(nutzer, 'project_open');
    const { p, s } = this.#mit(nutzer, id, STUFE.lesen);
    return {
      daten: readFileSync(this.#datei(p, 'json')),
      version: p.version,
      zugriff: s >= STUFE.bearbeiten ? 'bearbeiten' : 'lesen',
    };
  }

  karte(nutzer, id) {
    this.#rechtPflicht(nutzer, 'project_open');
    const { p } = this.#mit(nutzer, id, STUFE.lesen);
    const f = this.#datei(p, 'karte');
    if (!existsSync(f)) throw new Fehler(404, 'Kartenausschnitt fehlt');
    return readFileSync(f);
  }

  loeschen(nutzer, id) {
    const { p } = this.#mit(nutzer, id, STUFE.besitzer);
    this.db.prepare('DELETE FROM projekte WHERE id = ?').run(p.id);
    for (const art of ['json', 'karte']) rmSync(this.#datei(p, art), { force: true });
    protokolliere(this.db, nutzer.mandant_id, nutzer.email, 'projekt_geloescht', `${p.id} ${p.name}`);
  }

  freigaben(nutzer, id) {
    const { p } = this.#mit(nutzer, id, STUFE.lesen);
    return this.db.prepare('SELECT art, ziel_id, recht FROM freigaben WHERE projekt_id = ?').all(p.id);
  }

  /** Freigaben ersetzen (Besitzer oder Mandanten-Admin, Recht „team“). Ziele müssen zum eigenen Mandanten gehören. */
  freigabenSetzen(nutzer, id, liste) {
    const { p } = this.#mit(nutzer, id, STUFE.besitzer);
    this.#rechtPflicht(nutzer, 'team');
    if (!Array.isArray(liste) || liste.length > 200) throw new Fehler(400, 'Ungültige Freigaben');
    const gruppen = new Set(
      this.db
        .prepare('SELECT id FROM gruppen WHERE mandant_id = ?')
        .all(p.mandant_id)
        .map((g) => g.id),
    );
    const nutzerIds = new Set(
      this.db
        .prepare('SELECT id FROM nutzer WHERE mandant_id = ?')
        .all(p.mandant_id)
        .map((n) => n.id),
    );
    const sauber = liste.map((f) => {
      const art = f.art,
        recht = f.recht,
        ziel = Number(f.ziel_id);
      if (!['mandant', 'gruppe', 'nutzer'].includes(art) || !['lesen', 'bearbeiten'].includes(recht))
        throw new Fehler(400, 'Ungültige Freigabe');
      if (art === 'mandant' && ziel !== p.mandant_id) throw new Fehler(400, 'Ungültige Freigabe');
      if (art === 'gruppe' && !gruppen.has(ziel)) throw new Fehler(400, 'Unbekannte Gruppe');
      if (art === 'nutzer' && !nutzerIds.has(ziel)) throw new Fehler(400, 'Unbekannter Nutzer');
      return [art, ziel, recht];
    });
    transaktion(this.db, () => {
      this.db.prepare('DELETE FROM freigaben WHERE projekt_id = ?').run(p.id);
      const ins = this.db.prepare(
        'INSERT OR REPLACE INTO freigaben(projekt_id, art, ziel_id, recht) VALUES (?,?,?,?)',
      );
      for (const [a, z, r] of sauber) ins.run(p.id, a, z, r);
    });
    protokolliere(this.db, p.mandant_id, nutzer.email, 'freigaben', `${p.id}: ${JSON.stringify(sauber)}`);
  }

  routen(r, pflicht) {
    const MB = this.k.projekt_max_mb * 1048576;
    r.add('GET', '/api/projekte', (req, res) => json(res, 200, { projekte: this.liste(pflicht(req)) }));
    r.add('GET', '/api/projekte/:id', (req, res, p) => {
      const x = this.laden(pflicht(req), p.id);
      sende(res, 200, x.daten, 'application/json; charset=utf-8', {
        'X-Version': String(x.version),
        'X-Zugriff': x.zugriff,
      });
    });
    r.add('POST', '/api/projekte/:id', async (req, res, p) => {
      const n = pflicht(req);
      json(res, 200, this.speichern(n, p.id, await jsonRumpf(req, 50 * 1048576)));
    });
    r.add('GET', '/api/projekte/:id/karte', (req, res, p) =>
      sende(res, 200, this.karte(pflicht(req), p.id), 'application/octet-stream'),
    );
    r.add('POST', '/api/projekte/:id/karte', async (req, res, p) => {
      const n = pflicht(req);
      this.karteSpeichern(n, p.id, await rumpf(req, MB));
      json(res, 200, { ok: true });
    });
    r.add('POST', '/api/projekte/:id/loeschen', (req, res, p) => {
      this.loeschen(pflicht(req), p.id);
      json(res, 200, { ok: true });
    });
    r.add('GET', '/api/projekte/:id/freigaben', (req, res, p) =>
      json(res, 200, { freigaben: this.freigaben(pflicht(req), p.id) }),
    );
    r.add('POST', '/api/projekte/:id/freigaben', async (req, res, p) => {
      const n = pflicht(req);
      this.freigabenSetzen(n, p.id, (await jsonRumpf(req)).freigaben);
      json(res, 200, { ok: true });
    });
  }
}
