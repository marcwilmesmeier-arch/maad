// Bildvergleich zweier Builds: öffnet die Demokarte mit einem Gebäude, rendert jede Darstellung aus festen
// Blickwinkeln über maads eigene Bildfunktion (layShot) und vergleicht die Bilder pixelweise.
// Für Umbauten an der Grafik (z. B. three.js-Update), die das Aussehen nicht verändern sollen.
//
// Aufruf: node tools/bildvergleich.mjs <referenz.html> [kandidat.html=dist/maad.html] [ausgabeordner]
// Ausgabe: PNG/JPEG je Ansicht für beide Fassungen plus Differenzbild; Abweichung je Ansicht in der Konsole.
// Hinweis: Im Testbrowser ohne Grafikkarte (Software-Rendering) – Anhaltspunkt, keine Endabnahme.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bibliothek } from '../tests/bibliotheken.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [refFile, candFile = join(ROOT, 'dist/maad.html'), aus = join(ROOT, 'dist/bildvergleich')] =
  process.argv.slice(2);
if (!refFile) {
  console.error('Aufruf: node tools/bildvergleich.mjs <referenz.html> [kandidat.html] [ausgabeordner]');
  process.exit(2);
}
mkdirSync(aus, { recursive: true });

function deterministic() {
  let seed = 42;
  Math.random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let t = 1_790_000_000_000;
  Date.now = () => (t += 7);
  window.alert = () => {};
  window.confirm = () => true;
}

/** Läuft im Browser: Szene aufbauen und Aufnahmen machen. */
async function aufnahmen() {
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  await homeDemoOpen();
  await warte(1500);
  siteMake(
    [
      [-25, -20],
      [25, -20],
      [25, 20],
      [-25, 20],
    ],
    'Test',
  );
  setShape('rect', 'bld');
  finish([
    [-10, -8],
    [10, -8],
    [10, 8],
    [-10, 8],
  ]);
  mk();
  await warte(800);
  const ansichten = {
    schraeg: { m3: true, tx: 0, tz: 0, d: 160, az: 0.6, pol: 1.0 },
    nah: { m3: true, tx: 0, tz: 0, d: 60, az: 2.2, pol: 1.2 },
    oben: { m3: false, tx: 0, tz: 0, d: 220, az: 0, pol: 0.01, rot: 0 },
  };
  const out = {};
  for (const m of DAR.map((d) => d[0])) {
    try {
      drSet(m);
    } catch (e) {
      out[m + '-fehler'] = String(e);
      continue;
    }
    await warte(600);
    for (const [n, v] of Object.entries(ansichten)) {
      if (m === 'sw' && v.m3) continue; // Schwarzplan nur 2D
      out[`${m}-${n}`] = layShot(v, 640, 400, 0.92);
    }
  }
  return out;
}

async function lauf(browser, file) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.addInitScript(deterministic);
  await page.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    const hit = bibliothek(url);
    return hit ? route.fulfill(hit) : route.abort();
  });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on(
    'console',
    (m) =>
      (m.type() === 'error' || m.type() === 'warning') &&
      /THREE|WebGL|three/i.test(m.text()) &&
      fehler.push(m.type() + ': ' + m.text().slice(0, 200)),
  );
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);
  const bilder = await page.evaluate(aufnahmen);
  await page.close();
  return { bilder, fehler: [...new Set(fehler)] };
}

/** Abweichung zweier Bilder (im Browser berechnet): mittlere Differenz 0–255 und Anteil deutlich abweichender Pixel. */
async function differenz(browser, a, b) {
  const page = await browser.newPage();
  const r = await page.evaluate(
    async ([a, b]) => {
      const lade = (src) =>
        new Promise((ok) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.src = src;
        });
      const [ia, ib] = await Promise.all([lade(a), lade(b)]);
      const w = ia.width,
        h = ia.height;
      const c = (img) => {
        const cv = new OffscreenCanvas(w, h),
          g = cv.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, w, h).data;
      };
      const da = c(ia),
        db = c(ib);
      const cv = new OffscreenCanvas(w, h),
        g = cv.getContext('2d'),
        out = g.createImageData(w, h);
      let summe = 0,
        stark = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d =
          (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
        summe += d;
        if (d > 24) stark++;
        const v = Math.min(255, d * 4);
        out.data.set([v, v * 0.3, 255 - v, 255], i);
      }
      g.putImageData(out, 0, 0);
      const blob = await cv.convertToBlob({ type: 'image/png' });
      const bild = await new Promise((ok) => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result);
        fr.readAsDataURL(blob);
      });
      return { mittel: summe / (w * h), stark: stark / (w * h), bild };
    },
    [a, b],
  );
  await page.close();
  return r;
}

const speichern = (name, dataUrl) =>
  writeFileSync(join(aus, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  console.log('Aufnahmen Referenz …');
  const ref = await lauf(browser, refFile);
  console.log('Aufnahmen Kandidat …');
  const cand = await lauf(browser, candFile);
  console.log('\nAnsicht                 mittlere Abweichung   deutlich abweichende Pixel');
  for (const k of Object.keys(ref.bilder)) {
    if (!cand.bilder[k] || k.endsWith('-fehler')) {
      console.log(`${k.padEnd(24)} fehlt im Kandidaten ${cand.bilder[k + '-fehler'] || ''}`);
      continue;
    }
    speichern(`${k}-alt.jpg`, ref.bilder[k]);
    speichern(`${k}-neu.jpg`, cand.bilder[k]);
    const d = await differenz(browser, ref.bilder[k], cand.bilder[k]);
    speichern(`${k}-differenz.png`, d.bild);
    console.log(
      `${k.padEnd(24)}${d.mittel.toFixed(2).padStart(10)}${(d.stark * 100).toFixed(1).padStart(22)} %`,
    );
  }
  console.log('\nMeldungen Referenz:', ref.fehler.length ? ref.fehler : 'keine');
  console.log('Meldungen Kandidat:', cand.fehler.length ? cand.fehler : 'keine');
  console.log('Bilder:', aus);
} finally {
  await browser.close();
}
