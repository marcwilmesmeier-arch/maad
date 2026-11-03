// Externe Bibliotheken und Daten für Tests und Werkzeuge lokal ausliefern (gleiche Versionen wie im CDN-Link),
// damit alles ohne Netz läuft: bibliothek(url) liefert { body, contentType } oder null (Abruf wird dann blockiert).
// Ältere three.js-Fassungen (für Vergleiche mit alten Builds) liegen in node_modules/.three-cache/<version>/build.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NM = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');
const THREE_CACHE = process.env.THREE_CACHE || join(NM, '.three-cache');
const JS = 'text/javascript';
const installiert = JSON.parse(readFileSync(join(NM, 'three/package.json'), 'utf8')).version;

/** [Muster, Datei aus dem Treffer] */
const REGELN = [
  [/three\.js\/r128\/three\.min\.js$/, () => join(THREE_CACHE, '0.128.0/build/three.min.js')],
  [
    /three@([\d.]+)\/(build\/[\w.]+\.js|examples\/jsm\/[\w./-]+\.js)$/,
    (m) => (m[1] === installiert ? join(NM, 'three', m[2]) : join(THREE_CACHE, m[1], m[2])),
  ],
  [/maplibre-gl\.js$/, () => join(NM, 'maplibre-gl/dist/maplibre-gl.js')],
  [/maplibre-gl\.css$/, () => join(NM, 'maplibre-gl/dist/maplibre-gl.css')],
  // Texturen für Wolken (sonst von media.githubusercontent.com)
  [/packages\/clouds\/assets\/([\w.]+)$/, (m) => join(NM, '@takram/three-clouds/assets', m[1])],
];
const TYP = { js: JS, css: 'text/css', png: 'image/png', bin: 'application/octet-stream' };

export function bibliothek(url) {
  for (const [re, datei] of REGELN) {
    const m = re.exec(url);
    if (!m) continue;
    const p = datei(m);
    if (!existsSync(p)) return null;
    return { body: readFileSync(p), contentType: TYP[p.split('.').pop()] || 'application/octet-stream' };
  }
  return null;
}
