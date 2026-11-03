// Test des Windlösers (src/js/07-analyse/100-wind-loeser.js) ohne Browser: freie Anströmung bleibt ungestört,
// ein Gebäudeblock erzeugt seitlich höhere Geschwindigkeit und dahinter Rückströmung (Wirbel).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wiLoeser = new Function(
  readFileSync(join(ROOT, 'src/js/07-analyse/100-wind-loeser.js'), 'utf8') + '\nreturn wiLoeser;',
)();
// nur die Rechenfunktion aus 140-emissionen.js (der Rest der Datei braucht den Browser)
const emSrc = readFileSync(join(ROOT, 'src/js/07-analyse/140-emissionen.js'), 'utf8'),
  wiAusbreitung = new Function(
    emSrc.slice(emSrc.indexOf('function wiAusbreitung('), emSrc.indexOf('function wiAusbreitungHaupt(')) +
      '\nreturn wiAusbreitung;',
  )();

function lauf(mitBlock) {
  const nx = 48,
    ny = 32,
    nz = 14,
    fest = new Uint8Array(nx * ny * nz);
  if (mitBlock)
    for (let k = 0; k < 6; k++)
      for (let j = 12; j < 20; j++) for (let i = 14; i < 20; i++) fest[i + nx * (j + ny * k)] = 1;
  const t0 = performance.now();
  const r = wiLoeser({ nx, ny, nz, fest, u10: 0.07, z10: 2.5, alpha: 0.25, schritte: 1600, mittel: 500 });
  return { ...r, nx, ny, nz, ms: performance.now() - t0 };
}
const ux = (r, i, j, k) => r.u[3 * (i + r.nx * (j + r.ny * k))];

test('freie Anströmung bleibt ungestört', () => {
  const r = lauf(false);
  const a = ux(r, 30, 16, 4),
    b = 0.07 * Math.pow(4.5 / 2.5, 0.25);
  assert.ok(Math.abs(a - b) / b < 0.15, `u = ${a.toFixed(4)}, erwartet ≈ ${b.toFixed(4)}`);
  console.log(`  frei: ${r.ms.toFixed(0)} ms für ${r.nx * r.ny * r.nz} Zellen × 1600 Schritte`);
});

test('Gebäudeblock: seitliche Beschleunigung und Rückströmung dahinter', () => {
  const r = lauf(true);
  const frei = ux(r, 8, 16, 1),
    seite = ux(r, 17, 9, 1),
    hinten = ux(r, 21, 16, 1);
  console.log(
    `  Block: frei ${frei.toFixed(4)}, Seite ${seite.toFixed(4)}, hinter dem Block ${hinten.toFixed(4)}, ${r.ms.toFixed(0)} ms`,
  );
  assert.ok(seite > frei * 1.1, 'seitlich schneller als in der freien Anströmung');
  assert.ok(hinten < 0, 'direkt hinter dem Block Rückströmung');
  assert.ok([...r.u].every(Number.isFinite), 'keine ungültigen Werte');
});

test('Ausbreitung: Belastung in Lee, nicht in Luv; bodennahe Quelle belastet mehr als hoher Schornstein', () => {
  const nx = 40,
    ny = 24,
    nz = 12,
    n = nx * ny * nz,
    u = new Float32Array(3 * n),
    ti = new Float32Array(n).fill(0.01);
  for (let c = 0; c < n; c++) u[3 * c] = 0.1; // gleichmäßiger Wind in x
  const lauf = (k) =>
    wiAusbreitung({
      nx,
      ny,
      nz,
      dx: 4,
      fest: new Uint8Array(n),
      u,
      ti,
      skala: 30,
      quelle: [10, 12, k],
      rate: 1,
      streu: 0.2,
      dauer: 120,
      dt: 0.5,
      proSchritt: 6,
      seed: 3,
    }).c;
  const boden = lauf(0.2),
    hoch = lauf(6);
  const summe = (c, i0, i1) => {
    let s = 0;
    for (let j = 0; j < ny; j++) for (let i = i0; i < i1; i++) s += c[i + nx * j];
    return s;
  };
  assert.ok(summe(boden, 12, 40) > 0, 'in Lee belastet');
  assert.equal(summe(boden, 0, 9), 0, 'in Luv unbelastet');
  assert.ok(summe(boden, 10, 20) > summe(hoch, 10, 20) * 3, 'Bodenquelle belastet nahe der Quelle stärker');
  console.log(
    `  Ausbreitung: Bodenquelle ${summe(boden, 10, 20).toFixed(1)}, Schornstein ${summe(hoch, 10, 20).toFixed(1)} (µg/m³ summiert, Nahbereich)`,
  );
});
