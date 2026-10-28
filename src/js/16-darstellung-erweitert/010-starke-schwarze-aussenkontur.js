/* v239: Starke schwarze Außenkontur (Silhouette aus Betrachterrichtung) für alle Gebäude – Weißmodell und Schattiert getrennt schaltbar.
   Technik: je Gebäudemesh ein "Hüllen"-Mesh (nur abgewandte Flächen, im Bildschirmraum nach außen versetzt, schwarz). Innenkanten bleiben dünne, etwas hellere Linien. */
S.kon = { wm: { on: false, w: 3, c: '#000000' }, sch: { on: false, w: 3, c: '#000000' } };
const KON = { g: new T.Group(), pairs: new Map(), lines: [], sig: '', fr: 0, was: null };
KON.g.name = 'kontHull';
KON.g.visible = false;
sc.add(KON.g);
KON.U = {
  uRes: { value: new T.Vector2(1, 1) },
  uW: { value: 2.5 },
  uO: { value: 0 },
  uB: { value: 0.25 },
  uP: { value: 0.6 },
  uK: { value: 8 },
  uC: { value: new T.Color(0, 0, 0) },
};
KON.mat = new T.ShaderMaterial({
  uniforms: KON.U,
  side: T.DoubleSide,
  vertexShader:
    'attribute vec3 aSm;uniform vec2 uRes;uniform float uW;uniform float uP;uniform float uK;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vec4 c=projectionMatrix*p;float pw=c.w*2./(uRes.y*projectionMatrix[1][1]);vec4 q=p;q.z-=uP+min(uW*pw*8.,uK);vec4 c1=projectionMatrix*q;vec3 ns=normalMatrix*aSm;vec2 d=(projectionMatrix*vec4(ns,0.)).xy;float l=length(d);d=l>1e-5?d/l:vec2(0.);c.xy+=d*uW*2./uRes*c.w;c.z=c1.z/c1.w*c.w;gl_Position=c;}',
  fragmentShader: 'uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.);}',
});
// geglättete Normalen je Eckpunkt-Position (Schlüssel exakt, 5-cm-Raster)
function konSm(geo, groups) {
  if (geo.attributes.aSm || !geo.attributes.position || !geo.attributes.normal) return !!geo.attributes.aSm;
  const P = geo.attributes.position,
    N = geo.attributes.normal,
    n = P.count,
    q = (v) => Math.round(v * 20) + 131072,
    key = (i) => {
      const a = q(P.getX(i)),
        b = q(P.getY(i)),
        c = q(P.getZ(i));
      return a < 0 || b < 0 || c < 0 || a > 262143 || b > 262143 || c > 262143
        ? -1
        : a * 17179869184 + b * 262144 + c;
    };
  const out = new Float32Array(n * 3),
    gs = groups && groups.length ? groups : [[0, n]];
  for (const [g0, g1] of gs) {
    const M = new Map(),
      ks = new Float64Array(g1 - g0);
    let cx = 0,
      cy = 0,
      cz = 0;
    for (let i = g0; i < g1; i++) {
      cx += P.getX(i);
      cy += P.getY(i);
      cz += P.getZ(i);
      const k = (ks[i - g0] = key(i));
      if (k < 0) continue;
      let e = M.get(k);
      if (!e) {
        e = [0, 0, 0];
        M.set(k, e);
      }
      e[0] += N.getX(i);
      e[1] += N.getY(i);
      e[2] += N.getZ(i);
    }
    const m = Math.max(1, g1 - g0);
    cx /= m;
    cy /= m;
    cz /= m;
    let vote = 0;
    const tmp = new Float32Array((g1 - g0) * 3);
    for (let i = g0; i < g1; i++) {
      let x = N.getX(i),
        y = N.getY(i),
        z = N.getZ(i);
      const k = ks[i - g0];
      if (k >= 0) {
        const e = M.get(k);
        x = e[0];
        y = e[1];
        z = e[2];
      }
      const l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
      const j = (i - g0) * 3;
      tmp[j] = x;
      tmp[j + 1] = y;
      tmp[j + 2] = z;
      vote += x * (P.getX(i) - cx) + y * (P.getY(i) - cy) + z * (P.getZ(i) - cz);
    }
    const sg = vote < 0 ? -1 : 1;
    for (let i = g0; i < g1; i++) {
      const j = (i - g0) * 3;
      out[i * 3] = tmp[j] * sg;
      out[i * 3 + 1] = tmp[j + 1] * sg;
      out[i * 3 + 2] = tmp[j + 2] * sg;
    }
  }
  geo.setAttribute('aSm', new T.BufferAttribute(out, 3));
  return true;
}
function konSrc(o) {
  const u = o.userData || {};
  if (!o.isMesh || o.parent === KON.g || u._ov || u.ol || u.hl) return false;
  if (!(u.ctx || u.b)) return false;
  const m = o.material;
  if (
    !m ||
    Array.isArray(m) ||
    m.type === 'ShaderMaterial' ||
    m.depthWrite === false ||
    (m.transparent && m.opacity < 0.95 && !u.ctx)
  )
    return false;
  const g = o.geometry;
  return !!(g && g.attributes && g.attributes.normal && g.attributes.position);
}
function konScan() {
  const live = new Set(),
    lines = [];
  sc.traverse((o) => {
    if (o.isLineSegments && o.userData && o.userData.kont) lines.push(o);
    if (!konSrc(o)) return;
    live.add(o);
    let p = KON.pairs.get(o);
    if (!p) {
      if (!konSm(o.geometry, o.userData.ctx && GEO.ranges ? GEO.ranges.map((r) => [r.s * 3, r.e * 3]) : null))
        return;
      const ol = new T.Mesh(o.geometry, KON.mat);
      ol.matrixAutoUpdate = false;
      ol.updateMatrixWorld = function () {};
      ol.raycast = () => {};
      ol.userData._ov = 1;
      ol.castShadow = ol.receiveShadow = false;
      ol.renderOrder = -1;
      KON.g.add(ol);
      p = { ol };
      KON.pairs.set(o, p);
    } else if (p.ol.geometry !== o.geometry) {
      if (konSm(o.geometry, o.userData.ctx && GEO.ranges ? GEO.ranges.map((r) => [r.s * 3, r.e * 3]) : null))
        p.ol.geometry = o.geometry;
    }
  });
  KON.pairs.forEach((p, o) => {
    if (!live.has(o)) {
      KON.g.remove(p.ol);
      KON.pairs.delete(o);
    }
  });
  KON.lines = lines;
}
function konLines(on) {
  KON.lines.forEach((l) => {
    const m = l.material,
      u = l.userData;
    if (!m) return;
    if (u._kc == null) {
      u._kc = m.color.getHex();
      u._ko = m.opacity;
    }
    if (on) {
      m.color.setHex(0x80807e);
      if (u._ko < 1) m.opacity = Math.min(u._ko, 0.6);
    } else {
      m.color.setHex(u._kc);
      m.opacity = u._ko;
    }
  });
}
function konSig() {
  let s = GEO.mesh ? GEO.mesh.id : '';
  for (const b of S.bld) {
    if (b._g) s += '|' + b._g.id + ':' + b._g.children.length;
  }
  return s;
}
function konPre(scn, cm) {
  if (typeof skyPre === 'function')
    try {
      skyPre();
    } catch (e) {
      logErr(e, 'konPre');
    }
  const md = S.dar === 'wm' ? 'wm' : S.dar === 'sch' ? 'sch' : null,
    cf = md && S.kon && S.kon[md],
    on = !!(cf && cf.on);
  KON.g.visible = on;
  if (KON.was !== on) {
    KON.was = on;
    if (KON.lines.length) konLines(on);
    else KON.fr = 1e9;
  }
  if (!on) return;
  const sg = konSig();
  if (sg !== KON.sig || ++KON.fr > 90) {
    KON.sig = sg;
    KON.fr = 0;
    konScan();
    konLines(true);
  }
  const v = new T.Vector2();
  ren.getDrawingBufferSize(v);
  const mh = Math.max(1, mid.clientHeight);
  KON.U.uRes.value.copy(v);
  KON.U.uW.value = cf.w * (v.y / mh) * (ren.getPixelRatio() > 0 ? 1 : 1);
  KON.U.uO.value = cm && cm.isOrthographicCamera ? 1 : 0;
  KON.U.uP.value = KON.push || 0.6;
  KON.U.uC.value.set(cf.c || '#000000');
  scn.updateMatrixWorld();
  konBaseUpd();
  KON.pairs.forEach((p, o) => {
    let vis = true;
    for (let q = o; q; q = q.parent) {
      if (!q.visible) {
        vis = false;
        break;
      }
    }
    const m = o.material;
    if (vis && m && m.transparent && m.opacity < 0.95) vis = false;
    p.ol.visible = vis;
    if (vis) p.ol.matrixWorld.copy(o.matrixWorld);
  });
}

// ---- Fußlinie: dicke dunkle Kontur entlang des Grundrisses, dem Gelände folgend (Bildschirm-Breite)
KON.U.uB2 = { value: 0.3 };
KON.lm = new T.ShaderMaterial({
  uniforms: KON.U,
  side: T.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
  vertexShader:
    'attribute vec3 aOth;attribute float aSd;uniform vec2 uRes;uniform float uW;uniform float uB;void main(){vec4 p0=modelViewMatrix*vec4(position,1.);vec4 p1=modelViewMatrix*vec4(aOth,1.);p0.z+=uB;p1.z+=uB;vec4 c0=projectionMatrix*p0;vec4 c1=projectionMatrix*p1;vec2 s0=c0.xy/c0.w*uRes*.5;vec2 s1=c1.xy/c1.w*uRes*.5;vec2 d=s1-s0;float l=length(d);d=l>1e-4?d/l:vec2(1.,0.);vec2 nn=vec2(-d.y,d.x);vec2 o=(nn*aSd-d)*uW*.5;c0.xy+=o/(uRes*.5)*c0.w;gl_Position=c0;}',
  fragmentShader: 'uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.);}',
});
function konRing(ring, out, yoff) {
  // Ring [[x,z],...] -> Segmente (Weltkoordinaten), in ≤3-m-Schritten entlang des Geländes
  const n = ring.length;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 1e-3)) continue;
    const k = Math.max(1, Math.ceil(L / 3));
    let px = a[0],
      pz = a[1],
      py = gh(px, pz) + yoff;
    for (let j = 1; j <= k; j++) {
      const t = j / k,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t,
        y = gh(x, z) + yoff;
      if (isFinite(py) && isFinite(y)) out.push(px, py, pz, x, y, z);
      px = x;
      pz = z;
      py = y;
    }
  }
}
function konQuads(seg) {
  // [x0,y0,z0,x1,y1,z1,...] -> Quad-Geometrie (je Segment 4 Ecken)
  const n = seg.length / 6;
  if (!n) return null;
  const P = new Float32Array(n * 12),
    O = new Float32Array(n * 12),
    S2 = new Float32Array(n * 4),
    I = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = [seg[i * 6], seg[i * 6 + 1], seg[i * 6 + 2]],
      b = [seg[i * 6 + 3], seg[i * 6 + 4], seg[i * 6 + 5]];
    const v = [
      [a, b, -1],
      [a, b, 1],
      [b, a, -1],
      [b, a, 1],
    ];
    v.forEach(([e, o, sd], k) => {
      const q = i * 4 + k;
      P.set(e, q * 3);
      O.set(o, q * 3);
      S2[q] = sd;
    });
    const q = i * 4;
    I.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], i * 6);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3));
  g.setAttribute('aOth', new T.BufferAttribute(O, 3));
  g.setAttribute('aSd', new T.BufferAttribute(S2, 1));
  g.setIndex(new T.BufferAttribute(I, 1));
  g.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), 1e7);
  return g;
}
KON.base = { c: null, p: new Map(), sig: '' };
function konBaseSig() {
  let s = GEO.mesh ? GEO.mesh.id + ':' + GEO.ranges.length : '';
  try {
    s += '|' + gh(0, 0);
  } catch (e) {
    logErr(e, 'konBaseSig');
  }
  for (const b of S.bld) {
    s += '|' + (b._g ? b._g.id : '') + (b.ref != null ? b.ref : '') + b.fp.length;
  }
  return s;
}
function konBaseBuild() {
  const B = KON.base;
  if (B.c) {
    KON.g.remove(B.c);
    B.c.geometry.dispose();
    B.c = null;
  }
  B.p.forEach((m) => {
    KON.g.remove(m);
    m.geometry.dispose();
  });
  B.p.clear();
  if (GEO.mesh && GEO.ranges && GEO.ranges.length) {
    const seg = [];
    GEO.ranges.forEach((r) => {
      const o = r.b && r.b.o;
      if (o && o.length > 2) konRing(o, seg, 0.03);
    });
    const g = konQuads(seg);
    if (g) {
      B.c = new T.Mesh(g, KON.lm);
      B.c.frustumCulled = false;
      B.c.raycast = () => {};
      B.c.userData._ov = 1;
      KON.g.add(B.c);
    }
  }
  S.bld.forEach((b) => {
    if (!b._g || !b.levels) return;
    const i0 = Math.max(
        0,
        b.levels.findIndex((l) => !l.ug),
      ),
      fp = lf(b, b.levels[i0]) || b.fp;
    if (!fp || fp.length < 3) return;
    const seg = [];
    konRing(fp, seg, 0.03);
    const g = konQuads(seg);
    if (!g) return;
    const m = new T.Mesh(g, KON.lm);
    m.frustumCulled = false;
    m.raycast = () => {};
    m.userData._ov = 1;
    m.userData.bb = b;
    KON.g.add(m);
    B.p.set(b, m);
  });
}
function konBaseUpd() {
  const B = KON.base,
    sg = konBaseSig();
  if (sg !== B.sig) {
    B.sig = sg;
    try {
      konBaseBuild();
    } catch (e) {
      logErr(e, 'konBaseUpd');
    }
  }
  if (B.c) {
    let v = true;
    if (GEO.mesh)
      for (let q = GEO.mesh; q; q = q.parent) {
        if (!q.visible) {
          v = false;
          break;
        }
      }
    const m = GEO.mesh && GEO.mesh.material;
    if (m && m.transparent && m.opacity < 0.95) v = false;
    B.c.visible = v;
  }
  B.p.forEach((m, b) => {
    let v = !!b._g;
    if (v)
      for (let q = b._g; q; q = q.parent) {
        if (!q.visible) {
          v = false;
          break;
        }
      }
    m.visible = v;
  });
}
{
  const r0 = ren.render;
  ren.render = function (a, b) {
    if (a === sc) {
      try {
        konPre(a, b);
      } catch (e) {
        KON.g.visible = false;
      }
    }
    return r0.call(this, a, b);
  };
}
// ---- Bedienung in "Darstellung" (nur Weißmodell/Schattiert, je Modus getrennt)
document
  .getElementById('darBase')
  .insertAdjacentHTML(
    'afterbegin',
    '<label id="konL" title="Starke schwarze Außenkontur aus Betrachterrichtung – gilt nur für diese Darstellung">Starke Außenkontur <input type="checkbox" id="konck"></label>',
  );
function konMode() {
  return S.dar === 'wm' ? 'wm' : 'sch';
}
function konUi() {
  const m = konMode(),
    c = S.kon[m] || { on: false, w: 3, c: '#000000' },
    real = S.dar === 'real',
    a = document.getElementById('konck');
  if (a) a.checked = !!c.on;
  const q = (id) => document.getElementById(id),
    ck = q('konck2'),
    w = q('konw2'),
    cc = q('konc2'),
    o = q('konv2'),
    nm = q('konnm'),
    row = q('konrow');
  if (ck) {
    ck.checked = !!c.on;
    ck.disabled = real;
    w.value = c.w;
    w.disabled = real || !c.on;
    cc.value = c.c || '#000000';
    cc.disabled = real || !c.on;
    o.textContent = String(c.w).replace('.', ',') + ' px';
    nm.textContent = real
      ? '(nur Weißmodell/Schattiert)'
      : '(' + (m === 'wm' ? 'Weißmodell' : 'Schattiert') + ')';
    row.style.opacity = real ? 0.5 : 1;
  }
}
document.getElementById('konck').addEventListener('change', (e) => {
  S.kon[konMode()].on = e.target.checked;
  konUi();
});
// ---- Bedienung im Menü "Layer": Gebäudekontur (an/aus, Stärke, Farbe) – getrennt für Weißmodell und Schattiert
{
  const l0 = lyRender;
  lyRender = function () {
    l0.apply(this, arguments);
    const el = document.getElementById('lyp');
    if (!el) return;
    const gb = [...el.querySelectorAll('.ly label')].find((x) => x.textContent.trim() === 'Gebäude'),
      gr = gb && gb.closest('.ly');
    (gr || el).insertAdjacentHTML(
      gr ? 'afterend' : 'beforeend',
      '<div id="konrow" style="margin:2px 0 8px 18px;padding:6px 10px;border-left:2px solid var(--ln);font-size:12px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0 0 6px"><input type="checkbox" id="konck2" style="width:16px;height:16px;margin:0;flex:none"><b style="font-weight:600">Gebäudekontur</b><small id="konnm" style="color:var(--mu)"></small></label><div style="display:grid;grid-template-columns:48px 1fr 44px;align-items:center;gap:8px;margin:4px 0"><span>Stärke</span><input type="range" id="konw2" min="1" max="6" step=".25" style="width:100%;margin:0"><span id="konv2" style="text-align:right"></span></div><div style="display:grid;grid-template-columns:48px 34px auto;align-items:center;gap:8px;margin:4px 0"><span>Farbe</span><input type="color" id="konc2" style="width:34px;height:24px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"><button type="button" id="konrs" style="justify-self:start;font-size:11px;border:1px solid var(--ln);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer">Schwarz</button></div></div>',
    );
    konUi();
  };
}
{
  const lp = document.getElementById('lyp');
  lp.addEventListener('change', (e) => {
    if (e.target.id === 'konck2') {
      S.kon[konMode()].on = e.target.checked;
      konUi();
    }
  });
  lp.addEventListener('input', (e) => {
    const c = S.kon[konMode()];
    if (e.target.id === 'konw2') {
      c.w = +e.target.value;
      konUi();
    } else if (e.target.id === 'konc2') {
      c.c = e.target.value;
    }
  });
  lp.addEventListener('click', (e) => {
    if (e.target.id === 'konrs') {
      S.kon[konMode()].c = '#000000';
      konUi();
    }
  });
}
{
  const u0 = drUi;
  drUi = function () {
    u0.apply(this, arguments);
    konUi();
  };
}
konUi();
