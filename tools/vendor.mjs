// Bündelt die Bibliotheken der Darstellung „Realistisch“ zu src/vendor/realistisch.js (wird eingecheckt).
// Nur nach einem Versionswechsel in package.json nötig; npm run build braucht esbuild nicht.
//
// Aufruf: npm run vendor
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const aus = join(ROOT, 'src/vendor/realistisch.js');
const pakete = [
  'postprocessing',
  '@takram/three-atmosphere',
  '@takram/three-clouds',
  '@takram/three-geospatial',
  '@takram/three-geospatial-effects',
];
const versionen = pakete
  .map(
    (p) => `${p}@${JSON.parse(readFileSync(join(ROOT, 'node_modules', p, 'package.json'), 'utf8')).version}`,
  )
  .join(', ');

await build({
  entryPoints: [join(ROOT, 'src/vendor/realistisch-einstieg.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  external: ['three', 'three/*'], // three.js kommt über die Import-Map (gleiche Instanz wie das Hauptprogramm)
  legalComments: 'eof',
  target: 'es2022',
  outfile: aus,
});
let js = readFileSync(aus, 'utf8');
if (/<\/script/i.test(js)) throw new Error('Bündel enthält </script> und kann nicht eingebettet werden');
js = `// Erzeugt mit tools/vendor.mjs – nicht von Hand bearbeiten. Enthält: ${versionen}\n` + js;
writeFileSync(aus, js);
console.log(`src/vendor/realistisch.js gebaut (${(js.length / 1024).toFixed(0)} KB): ${versionen}`);
