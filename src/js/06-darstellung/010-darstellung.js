// ======================= DARSTELLUNG (Weißmodell · Schattiert · Realistisch) =======================
// Registry: die Auswahl im Menü „Darstellung“ wird nur aus dieser Liste erzeugt.
const DAR = [
  [
    'wm',
    'Weißmodell',
    'Die Standarddarstellung in hellen Weißtönen: Baukörper, Gelände, Bäume und alle Ebenen sichtbar. Farben und Ebenen sind frei einstellbar.',
  ],
  [
    'sch',
    'Schattiert',
    'Die bisherige Standarddarstellung mit Farben und Layern. Sonnenstand optional zuschaltbar.',
  ],
  [
    'real',
    'Realistisch',
    'Blauer Himmel, warmes Sonnenlicht mit Schattenwurf, einstellbare Kantenglättung, ohne Gebäudekonturen. Sonnenstand exakt nach Standort, Datum und Uhrzeit.',
  ],
];
const DR = { n: 0, k: 0, skyM: null, wm: new Map(), aaK: [1, 1.25, 1.5, 2] };
S.dar = 'sch';
S.aa = 2;
S.noK = false;
// ---- Exakter Sonnenstand (NOAA/Meeus): Breite/Länge aus GEO, Zeitzone Europe/Berlin inkl. Sommerzeit, Zeitgleichung ----
function tzOff(y, m, d) {
  const t = Date.UTC(y, m - 1, d, 12);
  const p = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(new Date(t)),
    g = (k) => +p.find((x) => x.type === k).value;
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - t) / 60000;
}
// Exakter Sonnenstand (NOAA/Meeus): Breite/Länge aus GEO, Zeitzone Europe/Berlin inkl. Sommerzeit, Zeitgleichung
function sunPos(ds, hr, lat, lon) {
  const [y, m, d] = ds.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + (hr * 60 - tzOff(y, m, d)) * 6e4,
    R = Math.PI / 180;
  const jd = ms / 864e5 + 2440587.5,
    T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360,
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T),
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * R) * 0.000289;
  const om = 125.04 - 1934.136 * T,
    lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
  const e0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60,
    eps = e0 + 0.00256 * Math.cos(om * R);
  const dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)),
    yy = Math.tan((eps * R) / 2) ** 2;
  const eot =
    (4 *
      (yy * Math.sin(2 * L0 * R) -
        2 * e * Math.sin(M * R) +
        4 * e * yy * Math.sin(M * R) * Math.cos(2 * L0 * R) -
        0.5 * yy * yy * Math.sin(4 * L0 * R) -
        1.25 * e * e * Math.sin(2 * M * R))) /
    R;
  const utc = (((ms % 864e5) + 864e5) % 864e5) / 6e4,
    tst = (((utc + eot + 4 * lon) % 1440) + 1440) % 1440,
    H = (tst / 4 - 180) * R,
    ph = lat * R;
  const el = Math.asin(Math.sin(ph) * Math.sin(dec) + Math.cos(ph) * Math.cos(dec) * Math.cos(H)),
    az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(ph) - Math.tan(dec) * Math.cos(ph));
  return { el, az, dir: [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)] };
}
function drDs() {
  return $('dt').value || '2026-06-21';
}
function drLL() {
  return [GEO.lat || 52.27, GEO.lon || 8.53];
}
const _stTimes = {};
function drTimes(ds) {
  const [la, lo] = drLL(),
    k = ds + '|' + la.toFixed(2) + '|' + lo.toFixed(2);
  if (_stTimes[k]) return _stTimes[k];
  let r = null,
    s = null,
    p = sunPos(ds, 0, la, lo).el;
  for (let h = 0.05; h <= 24; h += 0.05) {
    const e = sunPos(ds, h, la, lo).el;
    if (p <= 0 && e > 0 && r == null) r = h;
    if (p > 0 && e <= 0) s = h;
    p = e;
  }
  return (_stTimes[k] = { rise: r, set: s });
}
function drHM(h) {
  if (h == null) return '–';
  const m = Math.round(h * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

function drSunInfo() {
  const e = $('drSun');
  if (!e) return;
  const [la, lo] = drLL(),
    ds = drDs(),
    hr = +$('hr').value,
    sp = sunPos(ds, hr, la, lo),
    el = (sp.el * 180) / Math.PI,
    t = drTimes(ds),
    az = ((((sp.az * 180) / Math.PI + 180) % 360) + 360) % 360,
    dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  e.innerHTML =
    'Sonne: Höhe <b>' +
    el.toFixed(1) +
    '°</b>, Azimut <b>' +
    az.toFixed(0) +
    '° ' +
    dirs[Math.round(az / 45) % 8] +
    '</b><br>Aufgang ' +
    drHM(t.rise) +
    ' · Untergang ' +
    drHM(t.set) +
    ' (Ortszeit, ' +
    la.toFixed(2) +
    '° N / ' +
    lo.toFixed(2) +
    '° O)';
}
const drWarm = (el) => {
  const k = Math.pow(Math.max(0, Math.min(1, el / 55)), 0.6),
    a = [255, 154, 74],
    b = [255, 241, 218];
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round(v + (b[i] - v) * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};
function sunUp() {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/040-gruenflaechen-aus-corine.js
  const r = (() => {
    const hr = +$('hr').value;
    $('hl').textContent = drHM(hr);
    const R = S.dar === 'real',
      on = S.sun || R;
    if (!on) {
      const ch = sunL.castShadow;
      sunL.castShadow = false;
      sunL.position.set(-120, 200, 160);
      sunL.intensity = 0.6 * S.sunK;
      sunL.color.set('#ffffff');
      if (ch) sc.traverse((o) => o.material && (o.material.needsUpdate = true));
      drSunInfo();
      return;
    }
    const [la, lo] = drLL(),
      sp = sunPos(drDs(), hr, la, lo),
      d = sp.dir,
      el = (sp.el * 180) / Math.PI,
      cs = el > 0;
    sunL.position.set(d[0] * 350, Math.max(d[1], 0.02) * 350, d[2] * 350);
    const ch = sunL.castShadow !== cs;
    sunL.castShadow = cs;
    sunL.intensity = (cs ? 1.1 : 0.1) * S.sunK;
    sunL.color.set(R ? drWarm(el) : '#ffffff');
    if (ch) sc.traverse((o) => o.material && (o.material.needsUpdate = true));
    drSunInfo();
  })();
  if (sunL.castShadow) sunFit();
  return r;
}
S.sunC = '#ffffff';
S.sunK = 0.2;
S.lt = { wm: { b: 0.85, k: 0.2 }, sch: { b: 0.85, k: 0.2 } };
const liK = () => (S.dar === 'wm' ? 'wm' : 'sch');
function liLoad() {
  if (S.dar === 'real') return;
  const t = S.lt[liK()];
  $('lb').value = t.b;
  $('lk').value = t.k;
}
function liUp(u) {
  const R = S.dar === 'real';
  if (u === true && !R) S.lt[liK()] = { b: +$('lb').value, k: +$('lk').value };
  hemi.intensity = R ? 0.5 : +$('lb').value;
  S.sunK = R ? 0.7 : +$('lk').value;
  sunUp();
  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  if (S.dar === 'real') {
    const k = brK();
    hemi.intensity = 0.5 * k;
    S.sunK = 0.7 * k;
    sunUp();
  }
  brPatch();
}
// ---- Himmel ----
function drSky() {
  if (DR.skyM) return;
  const m = new T.Mesh(
    new T.SphereGeometry(5000, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: { uZ: { value: new T.Color(0.08, 0.37, 0.86) } },
      vertexShader:
        'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 vD;uniform vec3 uZ;void main(){float h=vD.y;vec3 zn=uZ,hz=zn+(1.-zn)*vec3(.652,.746,.857),gd=vec3(.82,.87,.92);vec3 c=h>0.?mix(hz,zn,pow(clamp(h*1.7,0.,1.),.5)):mix(hz,gd,clamp(-h*4.,0.,1.));gl_FragColor=vec4(c,1.);}',
    }),
  );
  m.renderOrder = -100;
  m.frustumCulled = false;
  m.raycast = () => {};
  m.userData._ov = 1;
  m.visible = false;
  sc.add(m);
  DR.skyM = m;
}
// ---- Konturen (Kantenlinien der Gebäude) ----
function kontUp() {
  sc.traverse((o) => {
    if (o.userData && o.userData.kont) o.visible = !S.noK;
  });
  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js (danach)
  try {
    bkApply(true);
  } catch (e) {
    logErr(e, 'kontUp');
  }
}
// ---- Weißmodell: Farben/Texturen neutralisieren, Straßen/Plätze/Parzellen ausblenden ----
const WM_HIDE = ['parcels', 'bplan', 'abst', 'wms', 'pv'];
DR.gv = {};
function gVis(k, v) {
  if (!G[k]) return;
  if (S.dar === 'wm' && WM_HIDE.includes(k)) {
    DR.gv[k] = !!v;
    G[k].visible = false;
  } else G[k].visible = !!v && (k !== 'un' || !S.zo || S.zo.m === 'u');
}
function wmGroups() {
  const on = S.dar === 'wm';
  for (const k of WM_HIDE) {
    if (!G[k]) continue;
    if (on) {
      if (!(k in DR.gv)) DR.gv[k] = G[k].visible;
      G[k].visible = false;
    } else if (k in DR.gv) {
      G[k].visible = DR.gv[k];
      delete DR.gv[k];
    }
  }
  labVis();
  if (S.geo)
    try {
      recomp();
    } catch (e) {
      logErr(e, 'wmGroups');
    }
}
// ---- Antialiasing (Supersampling über Pixelverhältnis) ----
function drAA() {
  const k = S.dar === 'real' ? DR.aaK[S.aa] || 1 : 1,
    pr = Math.min(3, devicePixelRatio * k);
  if (Math.abs(ren.getPixelRatio() - pr) > 0.01) ren.setPixelRatio(pr);
}
