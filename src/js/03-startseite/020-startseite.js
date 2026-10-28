// ---- Startseite: Übersichtskarte (Deutschland) mit allen gespeicherten Projekten
// Kartendaten: <script id="lotMap"> (Natural Earth, gemeinfrei, vereinfacht). Koordinaten stehen je Projekt im Index (lon/lat).
const HM = {
  K: Math.cos((51.2 * Math.PI) / 180),
  lon0: 5.0,
  lon1: 15.9,
  lat0: 46.7,
  lat1: 55.6,
  big: false,
  list: [],
  groups: [],
  data: null,
  built: false,
  busy: false,
};
HM.s = 1000 / (HM.lat1 - HM.lat0);
HM.W = (HM.lon1 - HM.lon0) * HM.K * HM.s;
HM.H = 1000;
HM.asp = HM.W / HM.H;
const hmX = (lon) => (lon - HM.lon0) * HM.K * HM.s,
  hmY = (lat) => (HM.lat1 - lat) * HM.s;
async function hmGunzip(u8) {
  const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(st).text();
}
async function hmData() {
  if (HM.data) return HM.data;
  const e = document.getElementById('lotMap');
  if (!e) return null;
  HM.data = JSON.parse(await hmGunzip(snapU8(e.textContent.trim())));
  return HM.data;
}
function hmPath(rs, u) {
  return rs
    .map((r) => {
      let x = r[0],
        y = r[1],
        d = 'M' + hmX(x / u).toFixed(1) + ' ' + hmY(y / u).toFixed(1);
      for (let i = 2; i < r.length; i += 2) {
        x += r[i];
        y += r[i + 1];
        d += 'L' + hmX(x / u).toFixed(1) + ' ' + hmY(y / u).toFixed(1);
      }
      return d + 'Z';
    })
    .join('');
}
async function hmBuild() {
  if (HM.built) return;
  const d = await hmData();
  if (!d) return;
  const sv = $('hMapSvg');
  sv.setAttribute('viewBox', '0 0 ' + HM.W.toFixed(1) + ' ' + HM.H);
  sv.innerHTML =
    '<path class="mnb" d="' +
    hmPath(d.nb, d.u) +
    '"/><path class="mdf" d="' +
    hmPath(d.de, d.u) +
    '"/><path class="mbl" d="' +
    hmPath(d.bl, d.u) +
    '"/><path class="mde" d="' +
    hmPath(d.de, d.u) +
    '"/>';
  HM.built = true;
}
const hmOk = (x) => x && isFinite(x.lon) && isFinite(x.lat) && x.lon != null && x.lat != null;
async function hmLoad() {
  if (HM.busy) return;
  HM.busy = true;
  try {
    const L = await projList();
    HM.list = L.filter(hmOk);
    hmDots();
    const miss = L.filter((x) => !hmOk(x) && !x.nll);
    if (!miss.length) return;
    for (const x of miss) {
      let lo = null,
        la = null;
      try {
        const sn = await idbGet('snap:' + x.id);
        if (sn) {
          const t = await hmGunzip(sn),
            h = t.slice(0, 8000),
            a = /"lon":\s*(-?\d+(?:\.\d+)?)/.exec(h),
            b = /"lat":\s*(-?\d+(?:\.\d+)?)/.exec(h);
          if (a && b) {
            lo = +a[1];
            la = +b[1];
          } else {
            const o = JSON.parse(t, snapDec);
            lo = o.lon;
            la = o.lat;
          }
        }
      } catch (e) {
        logErr(e, 'hmLoad');
      }
      const ok =
        isFinite(lo) && isFinite(la) && lo != null && la != null && Math.abs(lo) <= 180 && Math.abs(la) <= 90;
      try {
        const ix = (await idbGet('projIdx')) || [],
          e = ix.find((y) => y.id === x.id);
        if (e) {
          if (ok) {
            e.lon = lo;
            e.lat = la;
          } else e.nll = 1;
          await idbSet('projIdx', ix);
        }
      } catch (e) {
        logErr(e, 'hmLoad');
      }
      if (ok) {
        HM.list.push(Object.assign({}, x, { lon: lo, lat: la }));
        hmDots();
      }
    }
  } catch (e) {
    console.warn('Übersichtskarte:', e);
  } finally {
    HM.busy = false;
  }
}
function hmDots() {
  const box = $('hMapDots');
  if (!box) return;
  const g = new Map();
  let out = 0;
  for (const x of HM.list) {
    const px = hmX(x.lon),
      py = hmY(x.lat);
    if (px < 0 || px > HM.W || py < 0 || py > HM.H) {
      out++;
      continue;
    }
    const k = Math.round(px / 14) + ',' + Math.round(py / 14);
    if (!g.has(k)) g.set(k, { a: [] });
    g.get(k).a.push(Object.assign({ px, py }, x));
  }
  HM.groups = [...g.values()].map((c) => {
    c.px = c.a.reduce((s, x) => s + x.px, 0) / c.a.length;
    c.py = c.a.reduce((s, x) => s + x.py, 0) / c.a.length;
    return c;
  });
  box.innerHTML = HM.groups
    .map((c, i) => {
      const n = c.a[0].name + (c.a.length > 1 ? ' +' + (c.a.length - 1) : '');
      return (
        '<button class="hmd' +
        (c.px > HM.W * 0.6 ? ' l' : '') +
        '" data-i="' +
        i +
        '" style="left:' +
        ((c.px / HM.W) * 100).toFixed(2) +
        '%;top:' +
        ((c.py / HM.H) * 100).toFixed(2) +
        '%" title="' +
        esc(c.a.map((x) => x.name).join(' · ')) +
        '"><span class="hml">' +
        esc(n) +
        '</span></button>'
      );
    })
    .join('');
  const n = HM.list.length;
  $('hMapCap').textContent = n
    ? n +
      (n === 1 ? ' Projekt' : ' Projekte') +
      ' · Punkt anklicken zum Laden' +
      (out ? ' · ' + out + ' außerhalb des Kartenausschnitts' : '')
    : 'Noch keine Projekte gespeichert.';
}
function hmLayout() {
  const m = $('hMap');
  if (!m) return;
  const mob = innerWidth <= 820;
  let w, h, l, t;
  if (HM.big) {
    h = Math.min(innerHeight * 0.86, (innerWidth * 0.92) / HM.asp);
    w = h * HM.asp;
    l = (innerWidth - w) / 2;
    t = (innerHeight - h) / 2;
  } else {
    w = mob ? 84 : Math.min(128, innerWidth * 0.14);
    h = w / HM.asp;
    l = innerWidth - w - 26;
    t = mob ? 14 : 22;
  }
  Object.assign(m.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
}
function hmPopClose() {
  const p = $('hMapPop');
  if (p) p.classList.remove('on');
}
function hmToggle(on) {
  HM.big = !!on;
  const m = $('hMap');
  m.classList.toggle('big', HM.big);
  $('hMapBg').classList.toggle('on', HM.big);
  hmPopClose();
  hmLayout();
  m.title = HM.big ? '' : 'Projekte auf der Karte – anklicken zum Vergrößern';
}
function hmShow() {
  const m = $('hMap');
  if (!m) return;
  m.style.display = 'block';
  HM.big = false;
  m.classList.remove('big', 'on');
  $('hMapBg').classList.remove('on');
  hmPopClose();
  hmLayout();
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('on')));
  hmBuild().then(() => {
    hmLoad();
    setTimeout(hmLoad, 700);
  });
}
function hmHide() {
  const m = $('hMap');
  if (!m) return;
  HM.big = false;
  m.classList.remove('big', 'on');
  m.style.display = 'none';
  $('hMapBg').classList.remove('on');
  hmPopClose();
}
(function () {
  const m = $('hMap');
  if (!m) return;
  m.addEventListener('click', (e) => {
    if (!HM.big) {
      hmToggle(true);
      return;
    }
    if (e.target.closest('.hmx')) {
      hmToggle(false);
      return;
    }
    const pb = e.target.closest('#hMapPop button[data-id]');
    if (pb) {
      hmToggle(false);
      projOpen(pb.dataset.id);
      return;
    }
    const d = e.target.closest('.hmd');
    if (d) {
      const c = HM.groups[+d.dataset.i];
      if (!c) return;
      if (c.a.length === 1) {
        hmToggle(false);
        projOpen(c.a[0].id);
      } else {
        const p = $('hMapPop');
        p.innerHTML =
          '<b>' +
          c.a.length +
          ' Projekte an diesem Ort</b>' +
          c.a
            .map(
              (x) =>
                '<button data-id="' +
                x.id +
                '">' +
                esc(x.name) +
                '<small>' +
                esc((x.label || '').split(',')[0]) +
                ' · ' +
                new Date(x.t).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }) +
                '</small></button>',
            )
            .join('');
        p.classList.add('on');
        const r = m.getBoundingClientRect(),
          px = (c.px / HM.W) * r.width,
          py = (c.py / HM.H) * r.height;
        p.style.left = Math.min(px + 16, r.width - p.offsetWidth - 10) + 'px';
        p.style.top = Math.min(py - 10, r.height - p.offsetHeight - 10) + 'px';
      }
      return;
    }
    if (!e.target.closest('#hMapSvg path.mdf,#hMapSvg path.mbl,#hMapSvg path.mde,#hMapPop')) {
      hmToggle(false);
      return;
    }
    hmPopClose();
  });
  $('hMapBg').addEventListener('click', () => hmToggle(false));
  addEventListener('resize', () => {
    if (HOME.open) hmLayout();
  });
})();

// Auswahlfenster der unteren Leiste (Layer, Ansichten, Belichtung) über ihrem Knopf platzieren
function vcPlace(pid, bid) {
  const el = $(pid),
    b = $(bid),
    m = $('mid');
  if (!el || !b || !m || getComputedStyle(el).display === 'none') return;
  const r = b.getBoundingClientRect(),
    mr = m.getBoundingClientRect(),
    w = el.offsetWidth;
  el.style.right = 'auto';
  el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - mr.left - w / 2, mr.width - w - 8)) + 'px';
}
const VCP = [
  ['tgLayer', 'lyp', 'bg'],
  ['tgViews', 'vwp', 'bv'],
  ['tgLight', 'lc', 'bl'],
];
for (const [fn, pid, bid] of VCP) {
  const o = window[fn];
  if (typeof o === 'function')
    window[fn] = function () {
      const r = o.apply(this, arguments);
      vcPlace(pid, bid);
      return r;
    };
}
addEventListener('resize', () => VCP.forEach(([, p, b]) => vcPlace(p, b)));
// ---- Aufbau
function homeChips() {
  const nb = GEO.ranges ? GEO.ranges.length : 0,
    np = AL.length,
    W = innerWidth,
    Hh = innerHeight;
  const _n = (v) => Math.round(v).toLocaleString('de-DE'),
    _a = GEO.acc || {},
    _res = GEO.N ? Math.round(GEO.size / GEO.N) : 0,
    xl = [
      ['Gelände', _res ? 'DGM · ' + _res + ' m Raster' : 'DGM'],
      ['Gebäude', _n(nb) + ' · LoD2'],
      ['Bäume', _n((GEO.trees || []).length)],
      ['Grünflächen', _n(((_a.fill || {}).green || []).length)],
      ['Flurstücke', _n(np) + ' · ALKIS'],
      ['Straßen &amp; Wege', _n(((_a.line || {}).roads || []).length + ((_a.line || {}).paths || []).length)],
    ]
      .map((r) => `<span class="hxr"><i>${r[0]}</i><em>${r[1]}</em></span>`)
      .join('');
  const C = [
    `<svg width="46" height="30" viewBox="0 0 46 30"><path class="hdraw" d="M4 24 L12 6 L30 4 L42 16 L34 27 Z" fill="none" stroke="#5E7F92" stroke-width="2" stroke-linejoin="round"/></svg><b class="t">Kontext in Sekunden</b><span class="hc"><span class="hcnt" data-to="${nb}">0</span> <small style="display:inline;font-size:12px">Gebäude</small> · <span class="hcnt" data-to="${np}">0</span> <small style="display:inline;font-size:12px">Flurstücke</small></span><small>ALKIS · LoD2 · Gelände · OSM</small>`,
    `<svg width="46" height="30" viewBox="0 0 46 30"><g fill="#1d1d1b"><rect class="hb1" x="3" y="4" width="7" height="24" rx="1.5"/><rect class="hb1 hb2" x="14" y="4" width="7" height="24" rx="1.5" fill="#5E7F92"/><rect class="hb1 hb3" x="25" y="4" width="7" height="24" rx="1.5"/><rect class="hb1 hb4" x="36" y="4" width="7" height="24" rx="1.5" fill="#8a8984"/></g></svg><b class="t">Analyse live</b><small>BGF · BRI · Fassade · Terrasse – je Gebäude und Geschoss</small>`,
    `<svg width="46" height="30" viewBox="0 0 46 30"><g fill="none" stroke="#1d1d1b" stroke-width="2" stroke-linejoin="round"><path d="M4 8h18v18H4z"/><path class="hpull" d="M22 8h12v18H22z" fill="#5E7F9222" stroke="#5E7F92"/></g></svg><b class="t">Schnelles Modellieren</b><small>LOD100 / LOD200<br>Varianten planen und vergleichen</small>`,
    `<svg width="46" height="30" viewBox="0 0 46 30"><g fill="none" stroke="#1d1d1b" stroke-width="2" stroke-linejoin="round"><path d="M10 2h20l6 6v20H10z"/><path class="hdraw" d="M15 14h16M15 19h16M15 24h10" stroke="#5E7F92" stroke-linecap="round"/></g></svg><b class="t">Layout &amp; PDF</b><small>Ansichten mit Maßstab, Legende, Texte, Anmerkungen</small>`,
    `<svg width="46" height="30" viewBox="0 0 46 30"><g fill="none" stroke="#1d1d1b" stroke-width="1.8" stroke-linejoin="round"><path class="hx1" d="M4 8l19-6 19 6-19 6z" stroke="#5E7F92"/><path class="hx2" d="M4 15l19 6 19-6"/><path class="hx3" d="M4 22l19 6 19-6" stroke="#8a8984"/></g></svg><b class="t">3D Umgebung</b><span class="hxl2">${xl}</span><small class="hxh">Anklicken: Ebenen auseinanderziehen</small>`,
  ];
  $('hChips').innerHTML = C.map((h) => `<div class="hchip">${h}</div>`).join('');
  {
    const c0 = $('hChips').firstChild;
    if (c0) {
      c0.classList.add('pl');
      c0.title = 'Anklicken: Flurstücke aufleuchten lassen';
      c0.onclick = homeFlash;
    }
    const c4 = $('hChips').lastChild;
    if (c4) {
      c4.classList.add('pl');
      c4.onclick = homeExplode;
    }
  }
  $('hLines').innerHTML = C.map(() => '<line/><circle class="r" r="5"/><circle class="d" r="3.5"/>').join('');
  HOME.ln = [...$('hLines').querySelectorAll('line')];
  HOME.rg = [...$('hLines').querySelectorAll('.r')];
  HOME.dt = [...$('hLines').querySelectorAll('.d')];
  const L = (GEO.ranges || [])
    .map((r) => r.b)
    .filter((b) => b && b.o && b.o.length)
    .map((b) => {
      const c = cen(b.o);
      return { b, c, d: Math.hypot(c[0], c[1]) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 80);
  const pick = [3, 19, 34, 52, 66].map((i) => L[Math.min(i, L.length - 1)]).filter(Boolean);
  HOME.anc = pick.map((o) => ({ x: o.c[0], z: o.c[1], y: gh(o.c[0], o.c[1]) + (o.b.h || 8) }));
  HOME.cnt = performance.now();
  setTimeout(
    () =>
      document.querySelectorAll('.hchip').forEach((e, i) => setTimeout(() => e.classList.add('in'), i * 220)),
    300,
  );
}
function homeUnghost() {
  const h = HOME.fgh;
  if (!h) return;
  HOME.fgh = null;
  try {
    const pa = h.m.geometry.attributes.position;
    h.rs.forEach((x) => pa.array.set(x.p, x.s * 9));
    pa.needsUpdate = true;
  } catch (e) {
    logErr(e, 'homeUnghost');
  }
  if (h.g.parent) h.g.parent.remove(h.g);
  h.g.geometry.dispose();
  h.g.material.dispose();
  if (h.t) clearInterval(h.t);
}
function homeGhost(a) {
  homeUnghost();
  const M = GEO.mesh;
  if (!M) return;
  const bl = ctxOn(a);
  if (!bl.length) return;
  const rs = GEO.ranges.filter((r) => bl.includes(r.b));
  if (!rs.length) return;
  const pa = M.geometry.attributes.position,
    na = M.geometry.attributes.normal;
  let n = 0;
  rs.forEach((r) => (n += (r.e - r.s) * 9));
  const P = new Float32Array(n),
    N = new Float32Array(n),
    sv = [];
  let o = 0;
  for (const r of rs) {
    const p = pa.array.slice(r.s * 9, r.e * 9);
    P.set(p, o);
    N.set(na.array.slice(r.s * 9, r.e * 9), o);
    o += p.length;
    sv.push({ s: r.s, p });
    pa.array.fill(0, r.s * 9, r.e * 9);
  }
  pa.needsUpdate = true;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3));
  g.setAttribute('normal', new T.BufferAttribute(N, 3));
  const m = new T.Mesh(
    g,
    new T.MeshLambertMaterial({
      color: S.lc.buildings,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  m.frustumCulled = false;
  m.raycast = () => {};
  m.renderOrder = 5;
  (M.parent || sc).add(m);
  const h = { m: M, g: m, rs: sv, t: 0 };
  HOME.fgh = h;
  let k = 0;
  h.t = setInterval(() => {
    k++;
    m.material.opacity = Math.max(0.16, 0.7 - k * 0.14);
    if (k >= 4) {
      clearInterval(h.t);
      h.t = 0;
    }
  }, 90);
}
function homeFlashStop() {
  HOME.ftok = (HOME.ftok || 0) + 1;
  homeUnghost();
  if (HOME.fg) {
    sc.remove(HOME.fg);
    HOME.fg = null;
  }
  const c = document.querySelector('.hchip');
  if (c && HOME.fo) {
    const hc = c.querySelector('.hc'),
      sm = c.querySelector(':scope > small');
    hc.innerHTML = HOME.fo[0];
    sm.innerHTML = HOME.fo[1];
    HOME.cd = 0;
    HOME.cnt = performance.now() - 5000;
  }
  HOME.fo = null;
  if (c) c.classList.remove('fl');
}
function homeFlash() {
  if (HOME.st || !HOME.open) return;
  if (HX.on) homeXStop(1);
  if (HOME.fo) {
    homeFlashStop();
    return;
  }
  const c = document.querySelector('.hchip');
  if (!c) return;
  const hc = c.querySelector('.hc'),
    sm = c.querySelector(':scope > small');
  const L = AL.filter((a) => !a.cut && a.poly && a.poly.length > 2)
    .map((a) => {
      const ar = area(a.poly),
        q = cen(a.poly);
      return { a, ar, q, d: Math.hypot(q[0], q[1]) };
    })
    .filter((o) => o.ar >= 200 && o.ar <= 6000)
    .sort((x, y) => x.d - y.d)
    .slice(0, 45);
  if (!L.length) return;
  const pick = [],
    used = [];
  for (const o of L) {
    if (pick.length >= 6) break;
    if (used.every((u) => Math.hypot(u[0] - o.q[0], u[1] - o.q[1]) > 50)) {
      pick.push(o);
      used.push(o.q);
    }
  }
  pick.sort(() => Math.random() - 0.5);
  HOME.fo = [hc.innerHTML, sm.innerHTML];
  c.classList.add('fl');
  HOME.ftok = (HOME.ftok || 0) + 1;
  const tok = HOME.ftok;
  const show = (o, i) => {
    if (HOME.fg) {
      sc.remove(HOME.fg);
      HOME.fg = null;
    }
    const g = new T.Group(),
      pts = o.a.poly.map((q) => new T.Vector3(q[0], gh(q[0], q[1]) + 0.7, q[1])),
      ln = new T.LineLoop(
        new T.BufferGeometry().setFromPoints(pts),
        new T.LineBasicMaterial({ color: 0x5e7f92, transparent: true, depthTest: false }),
      );
    ln.renderOrder = 20;
    ln.raycast = () => {};
    let tri = [];
    try {
      tri = T.ShapeUtils.triangulateShape(
        o.a.poly.map((q) => new T.Vector2(q[0], q[1])),
        [],
      );
    } catch (e) {
      logErr(e, 'show');
    }
    const pa = [];
    for (const [a, b, d] of tri)
      for (const j of [a, b, d]) {
        const q = o.a.poly[j];
        pa.push(q[0], gh(q[0], q[1]) + 0.6, q[1]);
      }
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
    const fm = new T.Mesh(
      ge,
      new T.MeshBasicMaterial({
        color: 0x5e7f92,
        transparent: true,
        opacity: 0.34,
        side: T.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    fm.renderOrder = 19;
    fm.raycast = () => {};
    g.add(ln, fm);
    sc.add(g);
    HOME.fg = g;
    homeGhost(o.a);
    hc.innerHTML = `<span style="font-size:15px">${o.a.id || 'Flurstück'} · ${Math.round(o.ar).toLocaleString('de-DE')} m²</span>`;
    sm.textContent = `Flurstück ${i + 1} von ${pick.length} · ALKIS`;
  };
  const step = (i) => {
    if (tok !== HOME.ftok) return;
    if (i >= pick.length) {
      homeFlashStop();
      return;
    }
    show(pick[i], i);
    setTimeout(() => step(i + 1), 1700);
  };
  step(0);
}
const HX = { on: false, k: 0, tg: 0, t0: 0, lay: [] };
function homeRecomp(skip) {
  try {
    const c = GEO.comp,
      x = c.getContext('2d');
    x.globalAlpha = 1;
    x.fillStyle = S.lc.terrain;
    x.fillRect(0, 0, PW, PW);
    for (const k of ['green', 'water', 'paths', 'cycle', 'rail', 'bplan', 'parcels', 'roads']) {
      if (skip.includes(k)) continue;
      const L = LY.find((l) => l[1] === k);
      if (!L || !L[2]) continue;
      x.globalAlpha = L[3];
      x.drawImage(PL[k], 0, 0);
    }
    x.globalAlpha = 1;
    if (GEO.tex) GEO.tex.needsUpdate = true;
  } catch (e) {
    console.error(e);
  }
}
function hxLayer(k, col) {
  try {
    const m = new T.Mesh(
      S.terr.geometry,
      new T.MeshLambertMaterial({
        map: new T.CanvasTexture(PL[k]),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        color: col || 0xffffff,
      }),
    );
    m.raycast = () => {};
    m.renderOrder = 3;
    m.frustumCulled = false;
    return m;
  } catch (e) {
    return null;
  }
}
function homeExplode() {
  if (HX.on) {
    homeXStop();
    return;
  }
  if (HOME.st || !HOME.open || !GEO.tex) return;
  homeFlashStop();
  HX.on = true;
  document.body.classList.add('hx');
  const c = document.querySelector('.hchip:last-of-type');
  if (c) {
    c.classList.add('hxon');
    const h = c.querySelector('.hxh');
    if (h) h.textContent = 'Anklicken: wieder zusammenfügen';
  }
  const u = GEO.size * 0.1;
  HX.u = u;
  const gm = hxLayer('green'),
    pm = hxLayer('parcels');
  HX.gm = gm;
  HX.pm = pm;
  if (gm) sc.add(gm);
  if (pm) sc.add(pm);
  HX.gm_ = gm;
  homeRecomp(['green', 'parcels']);
  HX.lay = [
    {
      n: 'Parcels',
      t: 'Flurstücke',
      s: AL.length + ' Flurstücke · ALKIS',
      y: 2 * u,
      g: [pm, G.parcels, G.flab],
    },
    {
      n: 'Green',
      t: 'Grünflächen &amp; Bäume',
      s:
        (((GEO.acc || {}).fill || {}).green || []).length +
        ' Flächen · ' +
        (GEO.trees || []).length +
        ' Bäume',
      y: u,
      g: [gm, G.trees],
    },
    { n: 'Bld', t: 'Gebäude', s: (GEO.ranges ? GEO.ranges.length : 0) + ' Gebäude · LoD2', y: 0, g: [] },
    { n: 'Terr', t: 'Gelände', s: 'DGM · Straßen · Wege · Wasser', y: -1.2 * u, g: [G.terrain, G.rnam] },
  ];
  const box = $('hX');
  box.querySelectorAll('.hxc').forEach((e) => e.remove());
  const sv = $('hXs');
  sv.innerHTML = '';
  HX.lay.forEach((l) => {
    l.el = document.createElement('div');
    l.el.className = 'hxc';
    l.el.innerHTML = `<b>${l.t}</b><span>${l.s}</span>`;
    box.appendChild(l.el);
    l.ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.dt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    l.dt.setAttribute('r', 3.5);
    sv.appendChild(l.ln);
    sv.appendChild(l.dt);
  });
  HX.c0 = CL.cover;
  HX.t0 = performance.now();
  HX.tg = 1;
}
function homeXStop(now) {
  HX.tg = 0;
  HX.t0 = performance.now();
  document.body.classList.remove('hx');
  const c = document.querySelector('.hchip:last-of-type');
  if (c) {
    c.classList.remove('hxon');
    const h = c.querySelector('.hxh');
    if (h) h.textContent = 'Anklicken: Ebenen auseinanderziehen';
  }
  if (now === 1) {
    HX.k = 0;
    homeXApply();
    homeXEnd();
  }
}
function homeXEnd() {
  if (!HX.on) return;
  HX.on = false;
  if (HX.c0 != null) CL.cover = HX.c0;
  [HX.gm, HX.pm].forEach((m) => {
    if (m) {
      sc.remove(m);
      m.material.map && m.material.map.dispose();
      m.material.dispose();
    }
  });
  HX.gm = HX.pm = null;
  homeRecomp([]);
  HX.lay.forEach((l) => {
    l.g.forEach((g) => g && (g.position.y = 0));
  });
  if ($('hX')) {
    $('hX')
      .querySelectorAll('.hxc')
      .forEach((e) => e.remove());
    $('hXs').innerHTML = '';
  }
  HX.lay = [];
}
function homeXApply() {
  const k = HX.k,
    e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  HX.lay.forEach((l) => l.g.forEach((g) => g && (g.position.y = l.y * e)));
}
function homeXTick(now) {
  if (!HX.on) return;
  const d = Math.min(1, (now - HX.t0) / 1500);
  HX.k = HX.tg ? d : 1 - d;
  homeXApply();
  CL.cover = HX.c0 + (0.99 - HX.c0) * HX.k;
  if (!HX.tg && d >= 1) {
    homeXEnd();
    return;
  }
  const kk = act();
  kk.updateMatrixWorld();
  const el = kk.matrixWorld.elements;
  let rx = el[0],
    rz = el[2];
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const P = anP(),
    W = innerWidth,
    Hh = innerHeight,
    R = GEO.size * 0.44,
    a = HX.k;
  HX.lay.forEach((l) => {
    const q = P([rx * R, gh(rx * R, rz * R) + l.y * Math.min(1, a * 1.0) + 4, rz * R]);
    if (!q || innerWidth <= 820) {
      l.el.style.opacity = 0;
      l.ln.style.display = l.dt.style.display = 'none';
      return;
    }
    const cw = l.el.offsetWidth || 170,
      ch = l.el.offsetHeight || 40;
    const cx = Math.min(W - cw - 14, q[0] + 46),
      cy = Math.max(8, Math.min(Hh - ch - 8, q[1] - ch / 2));
    l.el.style.left = cx + 'px';
    l.el.style.top = cy + 'px';
    l.el.style.opacity = HX.tg ? Math.max(0, (a - 0.55) * 2.2) : 0;
    l.ln.style.display = l.dt.style.display = '';
    l.ln.setAttribute('x1', q[0]);
    l.ln.setAttribute('y1', q[1]);
    l.ln.setAttribute('x2', cx);
    l.ln.setAttribute('y2', cy + ch / 2);
    l.dt.setAttribute('cx', q[0]);
    l.dt.setAttribute('cy', q[1]);
    l.ln.style.opacity = l.dt.style.opacity = HX.tg ? Math.min(1, a * 1.6) : 0;
  });
}
function homePos() {
  const W = innerWidth,
    Hh = innerHeight,
    rx = Math.min(W * 0.36, 540),
    ry = Math.min(Hh * 0.33, 300);
  HOME.cp = [-148, -32, 32, 148, 90].map((a) => {
    const r = (a * Math.PI) / 180;
    return [W / 2 + rx * Math.cos(r) + (a == 90 ? 40 : 0), Hh * 0.47 + ry * Math.sin(r)];
  });
  document.querySelectorAll('.hchip').forEach((e, i) => {
    if (HOME.cp[i]) {
      e.style.left = HOME.cp[i][0] + 'px';
      e.style.top = HOME.cp[i][1] + 'px';
    }
  });
}
