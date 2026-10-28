/* v374: Tannen – Bäume aus den Höhenmodell-/OSM-Daten, die in CORINE-Nadelwald (312) stehen, werden als Tannen (Kegel) dargestellt.
   Schalter = Ebene „Tannen in Nadelwald“; aus = normale Bäume an derselben Stelle. Farbe der Tannen einstellbar. (Zufallswald, Mischwald, Laubwald und Waldboden-Shader entfernt.) */
LY.push(['Tannen in Nadelwald', 'wld', 0, 1]);
S.lc.nad = '#2f5d3f';
S.fx.real.nadel = 1;
S.fx.sch.nadel = 0;
G.wld = new T.Group();
sc.add(G.wld);
G.wld.visible = false;
const WLD = { sig: '', polys: [], cnt: { n: 0 }, tr: { ex: 0 }, mod: false, mesh: [] };
const wldOn = () => {
  const L = LY.find((l) => l[1] === 'wld');
  return !!(L && L[2]);
};
const wldH = (a, b) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
function wldPolys() {
  const it = (typeof OVI !== 'undefined' && OVI.clc) || [],
    out = [];
  WLD.cnt = { n: 0 };
  for (const o of it) {
    if (o.cd !== '312' || o.t !== 'a' || !o.r) continue;
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9;
    for (const r of o.r)
      for (const q of r) {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        z0 = Math.min(z0, q[1]);
        z1 = Math.max(z1, q[1]);
      }
    out.push({ k: 'n', r: o.r, x0, x1, z0, z1 });
    WLD.cnt.n++;
  }
  return out;
}
function wldIn(p, x, z) {
  if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) return false;
  let c = false;
  for (const r of p.r) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  }
  return c;
}
function wldKind(x, z) {
  for (const p of WLD.polys) if (wldIn(p, x, z)) return p.k;
  return null;
}
let WLD_CONE = null;
/* Kegel: 4 gestapelte Kegelstufen, Höhe 1, Radius 1, Farbverlauf dunkel (unten) → hell (Spitze) */
function wldConeGeo() {
  if (WLD_CONE) return WLD_CONE;
  const tiers = [
      [1, 0.46, 0.1],
      [0.78, 0.4, 0.34],
      [0.56, 0.36, 0.56],
      [0.34, 0.3, 0.76],
    ],
    P = [],
    N = [],
    C = [];
  for (const [r, h, y0] of tiers) {
    const g = new T.ConeGeometry(r, h, 10, 1).toNonIndexed();
    g.translate(0, y0 + h / 2, 0);
    const p = g.attributes.position,
      n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i) / 1.06, p.getY(i) / 1.06, p.getZ(i) / 1.06);
      N.push(n.getX(i), n.getY(i), n.getZ(i));
      const sh = 0.62 + 0.38 * Math.min(1, Math.max(0, (p.getY(i) - y0) / h)) * 0.8 + 0.1 * y0;
      C.push(sh, sh, sh);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute('color', new T.BufferAttribute(new Float32Array(C), 3));
  WLD_CONE = g;
  return g;
}
/* Nadelschalen: Grafikeffekt analog „Laubschalen“ – Schalen mit Nadelstruktur (senkrecht gestreckt) auf den Kegeln */
function wldShells(m) {
  const K = 5;
  for (let i = 0; i < K; i++) {
    const t = (i + 1) / K,
      off = 0.05 * (i + 1),
      mat = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uO = { value: off };
      sh.uniforms.uT = { value: t };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;uniform float uO;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed+=vec3(normal.x,normal.y*.15-.1,normal.z)*uO;{vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);vW=wp.xyz;}',
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vW;uniform float uT;
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`,
        )
        .replace(
          'void main() {',
          'void main(){vec3 q=vec3(vW.x,vW.y*.35,vW.z)/.42;float nn=n3(q)*.6+n3(q*2.6)*.4;if(nn<.34+.5*uT)discard;',
        )
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=.8+.34*nn;');
    };
    const sm = new T.InstancedMesh(m.geometry, mat, m.count);
    sm.instanceMatrix = m.instanceMatrix;
    sm.instanceColor = m.instanceColor;
    sm.frustumCulled = false;
    sm.castShadow = false;
    sm.receiveShadow = true;
    sm.raycast = () => {};
    sm.userData.wl = 1;
    G.wld.add(sm);
    WLD.mesh.push(sm);
  }
}
function wldClear(restore) {
  while (G.wld.children.length) {
    const o = G.wld.children.pop();
    if (o.geometry && o.geometry !== WLD_CONE) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
  WLD.mesh = [];
  if (restore && WLD.mod) {
    WLD.mod = false;
    try {
      if (GEO.trees && GEO.trees.length) treesBuild(GEO.trees);
    } catch (e) {
      console.error(e);
    }
  }
}
function wldBuild() {
  wldClear(true);
  WLD.polys = wldPolys();
  WLD.tr = { ex: 0 };
  if (!WLD.polys.length || !GEO.size) return;
  const ex = GEO.trees || [],
    lst = [],
    zero = new T.Matrix4().makeScale(0, 0, 0),
    tm = GEO.tmesh;
  let moved = 0;
  ex.forEach((t, i) => {
    if (wldKind(t.x, t.z) !== 'n') return;
    const h = Math.max(4, t.h);
    lst.push({ x: t.x, z: t.z, h, r: Math.max(1.2, Math.min(t.r * 0.8, h * 0.28)), r2: Math.max(1, t.r) });
    if (tm && i < tm.count) {
      tm.setMatrixAt(i, zero);
      moved++;
    }
  });
  if (tm && moved) {
    tm.instanceMatrix.needsUpdate = true;
    WLD.mod = true;
  }
  WLD.tr.ex = moved;
  if (!lst.length) return;
  const Q = new T.Quaternion(),
    E = new T.Euler(),
    V = new T.Vector3(),
    Sc = new T.Vector3(),
    C = new T.Color(),
    M = new T.Matrix4(),
    base = new T.Color(S.lc.nad),
    mt = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    m = new T.InstancedMesh(wldConeGeo(), mt, lst.length);
  lst.forEach((q, i) => {
    const y = gh(q.x, q.z),
      r1 = wldH(q.x, q.z);
    E.set(0, r1 * 6.283, 0);
    Q.setFromEuler(E);
    Sc.set(q.r, q.h, q.r);
    V.set(q.x, y, q.z);
    M.compose(V, Q, Sc);
    m.setMatrixAt(i, M);
    C.copy(base).offsetHSL(
      (r1 - 0.5) * 0.05,
      (wldH(q.z, q.x) - 0.5) * 0.14,
      (wldH(q.x + 1, q.z) - 0.5) * 0.16,
    );
    m.setColorAt(i, C);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.raycast = () => {};
  m.userData.wl = 1;
  G.wld.add(m);
  WLD.mesh.push(m);
  if (fxOn('nadel')) wldShells(m);
  WLD.sig = wldSig();
}
function wldSig() {
  const it = (typeof OVI !== 'undefined' && OVI.clc) || [];
  return [
    wldOn() ? 1 : 0,
    it.length,
    it._v || '',
    GEO.size || 0,
    S.lc.nad,
    fxOn('nadel') ? 1 : 0,
    GEO.trees ? GEO.trees.length : 0,
    GEO.mesh ? GEO.mesh.uuid : '',
    S.dar === 'wm' ? 'wm' : 'c',
  ].join('|');
}
setInterval(() => {
  try {
    if (!S.geo || !GEO.size) return;
    const sg = wldSig();
    if (sg !== WLD.sig) {
      WLD.sig = sg;
      if (wldOn() && typeof OVI !== 'undefined' && OVI.clc) wldBuild();
      else wldClear(true);
    }
    const v = wldOn();
    for (const m of WLD.mesh) m.visible = true;
    if (G.wld.visible !== v) G.wld.visible = v;
  } catch (e) {
    console.error(e);
  }
}, 400);
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// ovSync(): Erweiterung zusammengeführt, siehe 17-erweiterungen-v253-v280/080-karten.js
// treesBuild(): Erweiterung zusammengeführt, siehe 02-geodaten/070-baumkataster.js
window.wldSet = function (k, v) {
  if (k === 'nad') S.lc.nad = v;
};
function wldStat() {
  const d = typeof OVD !== 'undefined' ? OVD.clc : null;
  if (!d) return 'Daten werden beim Einschalten geladen (CORINE)';
  if (d.st === 'busy') return 'wird geladen …';
  if (d.st === 'err') return d.msg || 'Fehler';
  const n = WLD.cnt.n;
  return n
    ? `${n} Nadelwaldflächen (CORINE) · ${WLD.tr.ex} Bäume als Tannen` +
        (WLD.tr.ex ? '' : ' – keine Bäume aus Höhenmodell/OSM in diesen Flächen')
    : 'Keine Nadelwaldflächen im Ausschnitt (CORINE, ab 5 ha)';
}
{
  const _lh = layersHtml;
  layersHtml = function () {
    let h = _lh.apply(this, arguments);
    try {
      const i = LY.findIndex((l) => l[1] === 'wld');
      if (i < 0) return h;
      const m = `onchange="lvis(${i},this.checked)"`,
        ix = h.indexOf(m);
      if (ix < 0) return h;
      const rs = h.lastIndexOf('<div class="ly">', ix),
        re = h.indexOf('</div>', ix) + 6;
      const row = h.slice(rs, re).replace(/<input type="color"[^>]*>/, '');
      const st =
          'style="width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"',
        subs = `<div class="ly" style="padding-left:22px"><label>Tannenfarbe</label><input type="color" value="${S.lc.nad || '#2f5d3f'}" oninput="lcol('nad',this.value)" title="Farbe der Tannen" ${st}></div><div class="ly" style="padding-left:22px"><label style="font-size:11px;opacity:.7;flex:1">${wldStat()}</label></div>`;
      h = h.slice(0, rs) + row + subs + h.slice(re);
    } catch (e) {
      console.error(e);
    }
    return h;
  };
}
// fxUi(): Erweiterung zusammengeführt, siehe 18-erweiterungen-v280-v325/030-layer.js
try {
  fxUi();
} catch (e) {
  logErr(e, 'init');
}
