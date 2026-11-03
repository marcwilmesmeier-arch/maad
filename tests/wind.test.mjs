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
