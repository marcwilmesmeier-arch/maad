#!/usr/bin/env node
// Playwright CLI für maad (Browser per Kommandozeile steuern, z. B. für Agenten): npm run pw -- <befehl> [argumente]
//   npm run pw -- open dist/maad.html     maad öffnen (lokale Datei; Pfad relativ zum Projekt)
//   npm run pw -- snapshot | screenshot | eval "S.dar" | click e15 | close
// Browser: CHROMIUM_PATH, sonst der vorinstallierte Chromium der Cloud-Umgebung (/opt/pw-browsers/chromium), sonst
// die Voreinstellung der CLI (Google Chrome). Lokale Dateien sind freigegeben (maad wird als Datei geöffnet).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Zeitgrenzen großzügig: ohne Grafikkarte (Software-Rendering) braucht ein Bild der 3D-Szene teils Sekunden
const env = {
  PLAYWRIGHT_MCP_TIMEOUT_ACTION: '30000',
  PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION: '120000',
  ...process.env,
  PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS: 'true',
};
const chromium =
  process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
if (chromium) {
  env.PLAYWRIGHT_MCP_BROWSER = 'chromium';
  env.PLAYWRIGHT_MCP_EXECUTABLE_PATH = chromium;
}
const cli = (a) =>
  spawnSync('npx', ['--no-install', 'playwright-cli', ...a], { stdio: 'inherit', env }).status ?? 1;
// „open dist/maad.html“ bzw. „goto …“: vorhandene Datei als file://-Adresse übergeben
const args = process.argv
  .slice(2)
  .map((a, i, all) =>
    i > 0 &&
    /^(open|goto|tab-new)$/.test(all[0]) &&
    !/^[a-z]+:\/\//i.test(a) &&
    !a.startsWith('-') &&
    existsSync(a)
      ? pathToFileURL(resolve(a)).href
      : a,
  );
const ziel = /^(open|goto)$/.test(args[0]) && args.slice(1).find((a) => /^file:/.test(a));
if (!ziel) process.exit(cli(args));

// maad lokal öffnen: Bibliotheken (three.js, MapLibre, Wolkentexturen) aus node_modules ausliefern wie in den Tests
// (tests/bibliotheken.mjs) – funktioniert auch ohne Zugang zum CDN. Ablauf: Browser öffnen, Umleitungen
// einrichten (run-code im Hintergrundprozess der CLI), dann die Datei laden.
const NM = resolve('node_modules'),
  three = JSON.parse(readFileSync(resolve(NM, 'three/package.json'), 'utf8')).version,
  code = `async (page) => {
  const NM = ${JSON.stringify(NM)}, THREE = ${JSON.stringify(three)};
  const regeln = [
    [/three@([\\d.]+)\\/(build\\/[\\w.]+\\.js|examples\\/jsm\\/[\\w./-]+\\.js)$/, (m) => m[1] === THREE && NM + '/three/' + m[2]],
    [/maplibre-gl\\.js$/, () => NM + '/maplibre-gl/dist/maplibre-gl.js'],
    [/maplibre-gl\\.css$/, () => NM + '/maplibre-gl/dist/maplibre-gl.css'],
    [/packages\\/clouds\\/assets\\/([\\w.]+)$/, (m) => NM + '/@takram/three-clouds/assets/' + m[1]],
  ];
  const typ = { js: 'text/javascript', css: 'text/css', png: 'image/png', bin: 'application/octet-stream' };
  await page.context().route((u) => regeln.some(([re]) => re.test(u.href)), async (route) => {
    const u = route.request().url();
    for (const [re, datei] of regeln) {
      const m = re.exec(u), p = m && datei(m);
      if (p) return route.fulfill({ path: p, contentType: typ[p.split('.').pop()] || 'application/octet-stream' });
    }
    return route.continue();
  });
  return 'Bibliotheken lokal: three ' + THREE;
}`;
mkdirSync(resolve('.playwright-cli'), { recursive: true });
const datei = resolve('.playwright-cli/bibliotheken-route.js');
writeFileSync(datei, code);
const optionen = args.slice(1).filter((a) => a !== ziel);
let st = args[0] === 'open' ? cli(['open', ...optionen]) : 0;
if (!st) st = cli(['run-code', '--filename', datei]);
if (!st) st = cli(['goto', ziel]);
process.exit(st);
