// Datenzugriff für Mandanten, Nutzer, Gruppen und Protokoll.
// REGEL: Jede Funktion bekommt den handelnden Nutzer (akteur) und prüft über bereich(), ob er den Mandanten
// sehen bzw. ändern darf. Mandanten-Admins sind dadurch fest auf ihren eigenen Mandanten beschränkt.
import { jetzt, transaktion } from './datenbank.mjs';
import { ABOS, nurBekannte, wirksameRechte, ALLE_RECHTE } from './rechte.mjs';
import { gueltigeEmail } from './sicherheit.mjs';

export class Fehler extends Error {
  constructor(status, text) {
    super(text);
    this.status = status;
  }
}
const verboten = () => new Fehler(403, 'Keine Berechtigung');
const nichtGefunden = () => new Fehler(404, 'Nicht gefunden');

/** Mandant, auf den der Akteur zugreifen darf. Betreiber: jeder; Mandanten-Admin: nur der eigene. */
export function bereich(akteur, mandantId) {
  mandantId = mandantId == null || mandantId === '' ? null : Number(mandantId);
  if (akteur.rolle === 'betreiber') {
    if (!mandantId) throw new Fehler(400, 'Mandant fehlt');
    return mandantId;
  }
  if (akteur.rolle === 'admin') {
    if (mandantId && mandantId !== akteur.mandant_id) throw verboten();
    return akteur.mandant_id;
  }
  throw verboten();
}
const nurBetreiber = (akteur) => {
  if (akteur.rolle !== 'betreiber') throw verboten();
};

export function protokolliere(db, mandantId, wer, ereignis, detail = '') {
  try {
    db.prepare('INSERT INTO protokoll(zeit, mandant_id, nutzer, ereignis, detail) VALUES (?,?,?,?,?)').run(
      jetzt(),
      mandantId ?? null,
      wer || '',
      ereignis,
      String(detail).slice(0, 500),
    );
  } catch {
    // Protokollfehler dürfen den eigentlichen Vorgang nicht abbrechen
  }
}

const datum = (s) => {
  s = String(s || '').slice(0, 10);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Fehler(400, 'Datum bitte als JJJJ-MM-TT');
  return s;
};
const text = (s, max = 120) =>
  String(s ?? '')
    .trim()
    .slice(0, max);

// ---------- Lesen (auch für Anmeldung und Auslieferung) ----------

export function mandant(db, id) {
  return id == null ? null : db.prepare('SELECT * FROM mandanten WHERE id = ?').get(id) || null;
}

/** Ist der Nutzer (samt Mandant) gerade zugelassen? */
export function zugelassen(nutzer, m) {
  if (!nutzer || nutzer.status === 'gesperrt') return false;
  if (nutzer.rolle === 'betreiber') return true;
  if (!m || m.status !== 'aktiv') return false;
  const heute = new Date().toISOString().slice(0, 10);
  return !m.gueltig_bis || m.gueltig_bis >= heute;
}

export function rechteVon(db, nutzer) {
  const m = mandant(db, nutzer.mandant_id);
  const g = db
    .prepare('SELECT g.rechte FROM gruppen g JOIN mitglieder x ON x.gruppe_id = g.id WHERE x.nutzer_id = ?')
    .all(nutzer.id)
    .map((r) => r.rechte);
  return wirksameRechte(nutzer, m, g);
}

function gruppenVon(db, nutzerId) {
  return db
    .prepare(
      'SELECT g.id, g.name FROM gruppen g JOIN mitglieder x ON x.gruppe_id = g.id WHERE x.nutzer_id = ? ORDER BY g.name',
    )
    .all(nutzerId);
}

export function oeffentlicherNutzer(db, n) {
  return {
    id: n.id,
    email: n.email,
    name: n.name,
    rolle: n.rolle,
    status: n.status,
    mandant_id: n.mandant_id,
    gruppen: gruppenVon(db, n.id),
    rechte: rechteVon(db, n),
    angelegt: n.angelegt,
    letzte_anmeldung: n.letzte_anmeldung,
  };
}

// ---------- Mandanten (nur Betreiber) ----------

export function mandantenListe(db, akteur) {
  if (akteur.rolle === 'admin') return [mandantMitZahlen(db, mandant(db, akteur.mandant_id))];
  nurBetreiber(akteur);
  return db
    .prepare('SELECT * FROM mandanten ORDER BY name')
    .all()
    .map((m) => mandantMitZahlen(db, m));
}

function mandantMitZahlen(db, m) {
  const z = (sql) => db.prepare(sql).get(m.id).n;
  return {
    ...m,
    rechte: JSON.parse(m.rechte),
    nutzer: z('SELECT count(*) n FROM nutzer WHERE mandant_id = ?'),
    gruppen: z('SELECT count(*) n FROM gruppen WHERE mandant_id = ?'),
    projekte: z('SELECT count(*) n FROM projekte WHERE mandant_id = ?'),
  };
}

export function mandantAnlegen(db, akteur, d) {
  nurBetreiber(akteur);
  const name = text(d.name);
  if (!name) throw new Fehler(400, 'Name fehlt');
  const abo = ABOS[d.abo] ? d.abo : null;
  if (!abo) throw new Fehler(400, 'Unbekanntes Abo');
  const rechte = Array.isArray(d.rechte) ? nurBekannte(d.rechte) : ABOS[abo];
  const max = Math.max(1, Math.min(10000, Number(d.max_nutzer) || 10));
  return transaktion(db, () => {
    const id = Number(
      db
        .prepare(
          'INSERT INTO mandanten(name, abo, rechte, max_nutzer, gueltig_bis, angelegt) VALUES (?,?,?,?,?,?)',
        )
        .run(name, abo, JSON.stringify(rechte), max, datum(d.gueltig_bis), jetzt()).lastInsertRowid,
    );
    // Standardgruppe: neue Nutzer kommen hierhin, Rechte = Rechte des Mandanten
    db.prepare('INSERT INTO gruppen(mandant_id, name, rechte) VALUES (?,?,?)').run(
      id,
      'Alle',
      JSON.stringify(rechte),
    );
    protokolliere(db, id, akteur.email, 'mandant_angelegt', `${name} (${abo})`);
    return mandantMitZahlen(db, mandant(db, id));
  });
}

export function mandantAendern(db, akteur, id, d) {
  nurBetreiber(akteur);
  const m = mandant(db, id);
  if (!m) throw nichtGefunden();
  const neu = {
    name: d.name !== undefined ? text(d.name) || m.name : m.name,
    abo: d.abo !== undefined ? (ABOS[d.abo] ? d.abo : null) : m.abo,
    rechte: d.rechte !== undefined ? JSON.stringify(nurBekannte(d.rechte)) : m.rechte,
    max_nutzer:
      d.max_nutzer !== undefined ? Math.max(1, Math.min(10000, Number(d.max_nutzer) || 1)) : m.max_nutzer,
    gueltig_bis: d.gueltig_bis !== undefined ? datum(d.gueltig_bis) : m.gueltig_bis,
    status: d.status !== undefined ? (['aktiv', 'gesperrt'].includes(d.status) ? d.status : null) : m.status,
  };
  if (!neu.abo) throw new Fehler(400, 'Unbekanntes Abo');
  if (!neu.status) throw new Fehler(400, 'Unbekannter Status');
  if (d.abo !== undefined && d.rechte === undefined) neu.rechte = JSON.stringify(ABOS[neu.abo]);
  db.prepare(
    'UPDATE mandanten SET name=?, abo=?, rechte=?, max_nutzer=?, gueltig_bis=?, status=? WHERE id=?',
  ).run(neu.name, neu.abo, neu.rechte, neu.max_nutzer, neu.gueltig_bis, neu.status, m.id);
  if (neu.status === 'gesperrt')
    db.prepare('DELETE FROM sitzungen WHERE nutzer_id IN (SELECT id FROM nutzer WHERE mandant_id = ?)').run(
      m.id,
    );
  protokolliere(db, m.id, akteur.email, 'mandant_geaendert', JSON.stringify(neu));
  return mandantMitZahlen(db, mandant(db, m.id));
}

export function mandantLoeschen(db, akteur, id) {
  nurBetreiber(akteur);
  const m = mandant(db, id);
  if (!m) throw nichtGefunden();
  db.prepare('DELETE FROM mandanten WHERE id = ?').run(m.id); // Nutzer, Gruppen, Projekte per CASCADE
  protokolliere(db, null, akteur.email, 'mandant_geloescht', `${m.id} ${m.name}`);
  return m;
}

// ---------- Gruppen ----------

export function gruppenListe(db, akteur, mandantId) {
  const mid = bereich(akteur, mandantId);
  return db
    .prepare(
      'SELECT g.*, (SELECT count(*) FROM mitglieder x WHERE x.gruppe_id = g.id) mitglieder FROM gruppen g WHERE mandant_id = ? ORDER BY name',
    )
    .all(mid)
    .map((g) => ({ ...g, rechte: JSON.parse(g.rechte) }));
}

function gruppeImBereich(db, akteur, id) {
  const g = db.prepare('SELECT * FROM gruppen WHERE id = ?').get(Number(id));
  if (!g) throw nichtGefunden();
  bereich(akteur, g.mandant_id);
  return g;
}

/** Gruppenrechte dürfen die Rechte des Mandanten nicht übersteigen. */
function begrenzt(db, mid, rechte) {
  const grenze = JSON.parse(mandant(db, mid).rechte);
  return nurBekannte(rechte).filter((r) => grenze.includes(r));
}

export function gruppeAnlegen(db, akteur, mandantId, d) {
  const mid = bereich(akteur, mandantId);
  const name = text(d.name, 60);
  if (!name) throw new Fehler(400, 'Name fehlt');
  try {
    const id = db
      .prepare('INSERT INTO gruppen(mandant_id, name, rechte) VALUES (?,?,?)')
      .run(mid, name, JSON.stringify(begrenzt(db, mid, d.rechte))).lastInsertRowid;
    protokolliere(db, mid, akteur.email, 'gruppe_angelegt', name);
    return db.prepare('SELECT * FROM gruppen WHERE id = ?').get(id);
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new Fehler(400, 'Eine Gruppe mit diesem Namen gibt es schon');
    throw e;
  }
}

export function gruppeAendern(db, akteur, id, d) {
  const g = gruppeImBereich(db, akteur, id);
  const name = d.name !== undefined ? text(d.name, 60) || g.name : g.name;
  const rechte = d.rechte !== undefined ? JSON.stringify(begrenzt(db, g.mandant_id, d.rechte)) : g.rechte;
  try {
    db.prepare('UPDATE gruppen SET name = ?, rechte = ? WHERE id = ?').run(name, rechte, g.id);
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new Fehler(400, 'Eine Gruppe mit diesem Namen gibt es schon');
    throw e;
  }
  protokolliere(db, g.mandant_id, akteur.email, 'gruppe_geaendert', `${name}: ${rechte}`);
  return db.prepare('SELECT * FROM gruppen WHERE id = ?').get(g.id);
}

export function gruppeLoeschen(db, akteur, id) {
  const g = gruppeImBereich(db, akteur, id);
  db.prepare('DELETE FROM gruppen WHERE id = ?').run(g.id);
  protokolliere(db, g.mandant_id, akteur.email, 'gruppe_geloescht', g.name);
}

// ---------- Nutzer ----------

export function nutzerListe(db, akteur, mandantId) {
  if (akteur.rolle === 'betreiber' && (mandantId == null || mandantId === '')) {
    return db
      .prepare('SELECT * FROM nutzer WHERE mandant_id IS NULL ORDER BY email')
      .all()
      .map((n) => oeffentlicherNutzer(db, n));
  }
  const mid = bereich(akteur, mandantId);
  return db
    .prepare('SELECT * FROM nutzer WHERE mandant_id = ? ORDER BY email')
    .all(mid)
    .map((n) => oeffentlicherNutzer(db, n));
}

function nutzerImBereich(db, akteur, id) {
  const n = db.prepare('SELECT * FROM nutzer WHERE id = ?').get(Number(id));
  if (!n) throw nichtGefunden();
  if (n.rolle === 'betreiber') {
    nurBetreiber(akteur);
    return n;
  }
  bereich(akteur, n.mandant_id);
  return n;
}

function setzeGruppen(db, mid, nutzerId, ids) {
  const erlaubt = new Set(
    db
      .prepare('SELECT id FROM gruppen WHERE mandant_id = ?')
      .all(mid)
      .map((g) => g.id),
  );
  const gewaehlt = [...new Set((ids || []).map(Number))];
  if (gewaehlt.some((g) => !erlaubt.has(g))) throw new Fehler(400, 'Unbekannte Gruppe');
  db.prepare('DELETE FROM mitglieder WHERE nutzer_id = ?').run(nutzerId);
  const ins = db.prepare('INSERT INTO mitglieder(gruppe_id, nutzer_id) VALUES (?,?)');
  for (const g of gewaehlt) ins.run(g, nutzerId);
}

/** Legt einen Nutzer an (Status „eingeladen“). Die Einladungsmail verschickt anmeldung.mjs. */
export function nutzerAnlegen(db, akteur, mandantId, d) {
  const email = text(d.email, 254).toLowerCase();
  if (!gueltigeEmail(email)) throw new Fehler(400, 'Ungültige E-Mail-Adresse');
  if (d.rolle === 'betreiber') {
    nurBetreiber(akteur);
    throw new Fehler(400, 'Betreiber werden in der Konfiguration festgelegt');
  }
  const mid = bereich(akteur, mandantId);
  const rolle = d.rolle === 'admin' ? 'admin' : 'nutzer';
  const m = mandant(db, mid);
  const anzahl = db.prepare('SELECT count(*) n FROM nutzer WHERE mandant_id = ?').get(mid).n;
  if (anzahl >= m.max_nutzer) throw new Fehler(400, `Höchstzahl von ${m.max_nutzer} Nutzern erreicht`);
  if (db.prepare('SELECT 1 FROM nutzer WHERE email = ?').get(email))
    throw new Fehler(400, 'Diese E-Mail-Adresse ist bereits vergeben');
  return transaktion(db, () => {
    const id = Number(
      db
        .prepare('INSERT INTO nutzer(mandant_id, email, name, rolle, angelegt) VALUES (?,?,?,?,?)')
        .run(mid, email, text(d.name), rolle, jetzt()).lastInsertRowid,
    );
    let gruppen = d.gruppen;
    if (!Array.isArray(gruppen)) {
      const alle = db.prepare("SELECT id FROM gruppen WHERE mandant_id = ? AND name = 'Alle'").get(mid);
      gruppen = alle ? [alle.id] : [];
    }
    setzeGruppen(db, mid, id, gruppen);
    protokolliere(db, mid, akteur.email, 'nutzer_angelegt', `${email} (${rolle})`);
    return db.prepare('SELECT * FROM nutzer WHERE id = ?').get(id);
  });
}

export function nutzerAendern(db, akteur, id, d) {
  const n = nutzerImBereich(db, akteur, id);
  if (n.rolle === 'betreiber') throw new Fehler(400, 'Betreiber werden in der Konfiguration verwaltet');
  const rolle = d.rolle !== undefined ? (d.rolle === 'admin' ? 'admin' : 'nutzer') : n.rolle;
  let status = n.status;
  if (d.status === 'gesperrt') status = 'gesperrt';
  if (d.status === 'entsperrt' && n.status === 'gesperrt') status = n.pw_hash ? 'aktiv' : 'eingeladen';
  if (n.id === akteur.id && (status === 'gesperrt' || rolle !== n.rolle))
    throw new Fehler(400, 'Eigene Rolle und eigener Zugang können nicht selbst geändert werden');
  if (n.rolle === 'admin' && (rolle !== 'admin' || status === 'gesperrt') && akteur.rolle !== 'betreiber') {
    const admins = db
      .prepare(
        "SELECT count(*) n FROM nutzer WHERE mandant_id = ? AND rolle = 'admin' AND status != 'gesperrt'",
      )
      .get(n.mandant_id).n;
    if (admins <= 1) throw new Fehler(400, 'Der letzte Admin des Mandanten kann nicht entfernt werden');
  }
  transaktion(db, () => {
    db.prepare('UPDATE nutzer SET name = ?, rolle = ?, status = ? WHERE id = ?').run(
      d.name !== undefined ? text(d.name) : n.name,
      rolle,
      status,
      n.id,
    );
    if (Array.isArray(d.gruppen)) setzeGruppen(db, n.mandant_id, n.id, d.gruppen);
    if (status === 'gesperrt') db.prepare('DELETE FROM sitzungen WHERE nutzer_id = ?').run(n.id);
  });
  protokolliere(db, n.mandant_id, akteur.email, 'nutzer_geaendert', `${n.email}: ${rolle}, ${status}`);
  return oeffentlicherNutzer(db, db.prepare('SELECT * FROM nutzer WHERE id = ?').get(n.id));
}

export function nutzerLoeschen(db, akteur, id) {
  const n = nutzerImBereich(db, akteur, id);
  if (n.rolle === 'betreiber') throw new Fehler(400, 'Betreiber werden in der Konfiguration verwaltet');
  if (n.id === akteur.id) throw new Fehler(400, 'Das eigene Konto kann nicht gelöscht werden');
  if (n.rolle === 'admin' && akteur.rolle !== 'betreiber') {
    const admins = db
      .prepare("SELECT count(*) n FROM nutzer WHERE mandant_id = ? AND rolle = 'admin'")
      .get(n.mandant_id).n;
    if (admins <= 1) throw new Fehler(400, 'Der letzte Admin des Mandanten kann nicht gelöscht werden');
  }
  db.prepare('DELETE FROM nutzer WHERE id = ?').run(n.id);
  protokolliere(db, n.mandant_id, akteur.email, 'nutzer_geloescht', n.email);
  return n;
}

/** Für Einladung/Link erneut senden: Ziel-Nutzer im Bereich des Akteurs. */
export function nutzerFuerAktion(db, akteur, id) {
  return nutzerImBereich(db, akteur, id);
}

// ---------- Protokoll ----------

export function protokoll(db, akteur, mandantId) {
  if (akteur.rolle === 'betreiber' && (mandantId == null || mandantId === ''))
    return db.prepare('SELECT * FROM protokoll ORDER BY id DESC LIMIT 300').all();
  const mid = bereich(akteur, mandantId);
  return db.prepare('SELECT * FROM protokoll WHERE mandant_id = ? ORDER BY id DESC LIMIT 300').all(mid);
}

export { ALLE_RECHTE };
