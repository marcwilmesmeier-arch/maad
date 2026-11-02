// SQLite-Datenbank (eingebaut in Node) mit Schema-Versionen.
// Mandantentrennung: Tabellen mit Kundendaten tragen mandant_id; Zugriffe laufen über mandanten.mjs.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA = [
  // Version 1
  `
  CREATE TABLE mandanten(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    abo TEXT NOT NULL,
    rechte TEXT NOT NULL DEFAULT '[]',          -- Obergrenze der Rechte (aus dem Abo vorbelegt)
    max_nutzer INTEGER NOT NULL DEFAULT 10,
    gueltig_bis TEXT NOT NULL DEFAULT '',       -- JJJJ-MM-TT, leer = unbefristet
    status TEXT NOT NULL DEFAULT 'aktiv',       -- aktiv | gesperrt
    angelegt TEXT NOT NULL
  );
  CREATE TABLE nutzer(
    id INTEGER PRIMARY KEY,
    mandant_id INTEGER REFERENCES mandanten(id) ON DELETE CASCADE,   -- NULL nur bei Betreibern
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    rolle TEXT NOT NULL,                        -- betreiber | admin | nutzer
    pw_hash TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'eingeladen',  -- eingeladen | aktiv | gesperrt
    fehlversuche INTEGER NOT NULL DEFAULT 0,
    gesperrt_bis REAL NOT NULL DEFAULT 0,
    angelegt TEXT NOT NULL,
    letzte_anmeldung TEXT NOT NULL DEFAULT '',
    CHECK ((rolle = 'betreiber') = (mandant_id IS NULL))
  );
  CREATE TABLE gruppen(
    id INTEGER PRIMARY KEY,
    mandant_id INTEGER NOT NULL REFERENCES mandanten(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rechte TEXT NOT NULL DEFAULT '[]',
    UNIQUE(mandant_id, name)
  );
  CREATE TABLE mitglieder(
    gruppe_id INTEGER NOT NULL REFERENCES gruppen(id) ON DELETE CASCADE,
    nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
    PRIMARY KEY(gruppe_id, nutzer_id)
  );
  CREATE TABLE sitzungen(
    h TEXT PRIMARY KEY,                         -- SHA-256 des Cookie-Werts
    nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
    laeuft_ab REAL NOT NULL,
    erstellt REAL NOT NULL,
    ip TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE tokens(
    h TEXT PRIMARY KEY,                         -- SHA-256 des Link-Werts
    nutzer_id INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
    zweck TEXT NOT NULL,                        -- einladung | zuruecksetzen
    laeuft_ab REAL NOT NULL,
    benutzt INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE projekte(
    id TEXT PRIMARY KEY,
    mandant_id INTEGER NOT NULL REFERENCES mandanten(id) ON DELETE CASCADE,
    besitzer_id INTEGER REFERENCES nutzer(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    groesse INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    angelegt TEXT NOT NULL,
    geaendert TEXT NOT NULL,
    geaendert_von INTEGER
  );
  CREATE TABLE freigaben(
    projekt_id TEXT NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
    art TEXT NOT NULL CHECK (art IN ('mandant', 'gruppe', 'nutzer')),
    ziel_id INTEGER NOT NULL,
    recht TEXT NOT NULL CHECK (recht IN ('lesen', 'bearbeiten')),
    PRIMARY KEY(projekt_id, art, ziel_id)
  );
  CREATE TABLE protokoll(
    id INTEGER PRIMARY KEY,
    zeit TEXT NOT NULL,
    mandant_id INTEGER,
    nutzer TEXT NOT NULL DEFAULT '',
    ereignis TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT NOT NULL);
  CREATE INDEX nutzer_mandant ON nutzer(mandant_id);
  CREATE INDEX projekte_mandant ON projekte(mandant_id);
  CREATE INDEX protokoll_mandant ON protokoll(mandant_id, zeit);
  `,
];

export function oeffneDatenbank(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'maad.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version(v INTEGER NOT NULL)');
  const row = db.prepare('SELECT v FROM schema_version').get();
  let v = row ? row.v : 0;
  if (!row) db.prepare('INSERT INTO schema_version(v) VALUES (0)').run();
  for (; v < SCHEMA.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(SCHEMA[v]);
      db.prepare('UPDATE schema_version SET v = ?').run(v + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

/** Führt fn in einer Transaktion aus. */
export function transaktion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const jetzt = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
