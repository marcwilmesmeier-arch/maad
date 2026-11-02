// Einstellungen: Vorgaben, überschrieben durch die JSON-Datei (Pfad als 1. Argument oder MAAD_KONFIG).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '..', '..');

export const VORGABEN = {
  base_url: 'http://127.0.0.1:8080', // öffentliche Adresse, z. B. https://getmaad.de
  host: '127.0.0.1',
  port: 8080,
  data_dir: join(ROOT, 'server', 'daten'),
  tool_file: join(ROOT, 'dist', 'maad.html'),
  sperren_file: join(ROOT, 'dist', 'maad.sperren.json'),
  betreiber: [], // E-Mail-Adressen der Betreiber (verwalten alle Mandanten)
  app_name: 'maad',
  sitzung_tage: 14,
  einladung_stunden: 72,
  zuruecksetzen_minuten: 30,
  passwort_min: 10,
  smtp: { host: '', port: 587, user: '', password: '', from: '', ssl: false },
  maptiler_key: '',
  proxy: true,
  proxy_max_mb: 80,
  projekt_max_mb: 200,
};

export function ladeKonfig(pfad = process.argv[2] || process.env.MAAD_KONFIG) {
  const k = structuredClone(VORGABEN);
  if (pfad && existsSync(pfad)) {
    const u = JSON.parse(readFileSync(pfad, 'utf8'));
    for (const [n, v] of Object.entries(u)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof k[n] === 'object') Object.assign(k[n], v);
      else k[n] = v;
    }
  }
  k.betreiber = (k.betreiber || []).map((e) => String(e).trim().toLowerCase());
  k.sicher = k.base_url.startsWith('https://');
  return k;
}
