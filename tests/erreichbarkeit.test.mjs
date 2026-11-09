// Test der Erreichbarkeitsrechnung (src/js/07-analyse/180-erreichbarkeit-rechnen.js) ohne Browser.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { erNetz, erZeiten, erRaster } = new Function(
  readFileSync(join(ROOT, 'src/js/07-analyse/180-erreichbarkeit-rechnen.js'), 'utf8') +
    '\nreturn { erNetz, erZeiten, erRaster };',
)();

// Gitter aus Straßen alle 100 m, -500 … 500 m; eine Diagonale fehlt bewusst (Umweg über Ecken)
function gitterNetz() {
  const wege = [];
  let id = 1;
  const ids = new Map(),
    nid = (x, z) => {
      const k = x + ',' + z;
      if (!ids.has(k)) ids.set(k, id++);
      return ids.get(k);
    };
  for (let a = -500; a <= 500; a += 100) {
    const h = [],
      v = [];
    for (let b = -500; b <= 500; b += 50) {
      h.push([b, a]);
      v.push([a, b]);
    }
    wege.push({ ids: h.map((p) => nid(p[0], p[1])), pts: h });
    wege.push({ ids: v.map((p) => nid(p[0], p[1])), pts: v });
  }
  return erNetz(wege);
}

test('Gehzeiten im Straßengitter: Manhattan-Abstand / Geschwindigkeit', () => {
  const n = gitterNetz(),
    z = erZeiten(n, [0, 0], 80, 30);
  const bei = (x, zz) => {
    for (let i = 0; i < n.x.length; i++) if (n.x[i] === x && n.z[i] === zz) return z.t[i];
    return NaN;
  };
  assert.ok(Math.abs(bei(0, 0)) < 1e-9);
  assert.ok(Math.abs(bei(400, 0) - 5) < 1e-9, '400 m geradeaus = 5 min');
  assert.ok(Math.abs(bei(300, 300) - 7.5) < 1e-9, 'diagonal über Ecken: 600 m = 7,5 min');
  assert.ok(bei(500, 500) <= 12.5 + 1e-9, 'Ecke innerhalb von 30 min erreicht (1000 m = 12,5 min)');
});

test('Raster: abseits der Wege nur begrenzt, Zeiten wachsen mit dem Abstand', () => {
  const n = gitterNetz(),
    z = erZeiten(n, [0, 0], 80, 15),
    r = erRaster(n, z, 500, 5, 80, 30, 15),
    zelle = (x, zz) => r.t[Math.floor((zz + 500) / 5) * r.W + Math.floor((x + 500) / 5)];
  assert.ok(zelle(2, 2) < 0.2, 'Start');
  assert.ok(zelle(202, 2) > zelle(102, 2), 'weiter = später');
  // Blockmitte (50 m von jeder Straße) liegt außerhalb der 30 m abseits: nicht erreicht
  assert.equal(zelle(52, 52), Infinity);
  // 20 m neben der Straße: erreicht, etwas später als der Straßenpunkt
  assert.ok(zelle(102, 22) > zelle(102, 2) && zelle(102, 22) < zelle(102, 2) + 1);
});

test('mehrere Startpunkte (Grundstücksecken): jeweils der nächste zählt', () => {
  const n = gitterNetz(),
    z = erZeiten(
      n,
      [
        [-300, 0],
        [300, 0],
      ],
      80,
      30,
    ),
    bei = (x, zz) => {
      for (let i = 0; i < n.x.length; i++) if (n.x[i] === x && n.z[i] === zz) return z.t[i];
      return NaN;
    };
  assert.ok(Math.abs(bei(-300, 0)) < 1e-9 && Math.abs(bei(300, 0)) < 1e-9);
  assert.ok(Math.abs(bei(0, 0) - 3.75) < 1e-9, 'Mitte: 300 m vom nächsten Start');
  assert.equal(z.zugang, 0);
});
