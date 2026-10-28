/* v509: Schalen-Bäume (Laub-/Nadelschalen) werden vor dem selbst erzeugten Gebäude durchscheinend (Dithering, kein echtes Alpha).
   Pro Instanz ein Attribut aHid (0 = voll sichtbar, fehlendes Attribut = 0 = sichtbar). Schatten bleibt voll. */
const TF = { arr: new Map(), t: 0, hid: 0.65 };
function tfPatch(mat) {
  if (!mat || mat.userData.tf) return;
  mat.userData.tf = 1;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh) {
    if (prev) prev.apply(this, arguments);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHid;varying float vHid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHid=aHid;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHid;')
      .replace(
        /void main\s*\(\s*\)\s*\{/,
        (m) =>
          m +
          'if(vHid>.001){float tfd=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(tfd<vHid)discard;}',
      );
  };
  const src = prev ? prev.toString() : '';
  mat.customProgramCacheKey = function () {
    return mat.userData.nk
      ? 'nearshell' + mat.userData.nk + 'tf'
      : src + '|tf' + (mat.userData.near ? 'n' : '');
  };
  mat.needsUpdate = true;
}
function tfMeshes() {
  const out = [];
  const add = (g) => {
    if (!g) return;
    g.children.forEach((o) => {
      if (o.isInstancedMesh && o.material && !Array.isArray(o.material) && o.count > 0) out.push(o);
    });
  };
  if (fxOn('trees')) add(G.trees);
  if (fxOn('nadel') && G.wld && G.wld.visible) add(G.wld);
  return out;
}
/* Sichtstrahlen von der Kamera durch die Baumkrone (Mitte + 4 Randpunkte) weiter nach hinten: trifft einer das Gebäudevolumen (Grundriss × Höhe), verdeckt der Baum das Gebäude */
function tfHit(C, px, py, pz, r, b) {
  if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1 && inP([px, pz], b.fp)) return false;
  let dx = px - C.x,
    dy = py - C.y,
    dz = pz - C.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  dx /= L;
  dy /= L;
  dz /= L;
  let rx = dz,
    rz = -dx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -dy * rx,
    uy = rx * dz - rz * dx,
    uz = -dy * rz;
  const ul = Math.hypot(ux, uy, uz) || 1,
    k = r * 0.8;
  const offs = [
    [0, 0, 0],
    [rx * k, 0, rz * k],
    [-rx * k, 0, -rz * k],
    [(ux / ul) * k, (uy / ul) * k, (uz / ul) * k],
    [(-ux / ul) * k, (-uy / ul) * k, (-uz / ul) * k],
  ];
  for (const o of offs) {
    const qx = px + o[0],
      qy = py + o[1],
      qz = pz + o[2];
    let ex = qx - C.x,
      ey = qy - C.y,
      ez = qz - C.z;
    const El = Math.hypot(ex, ey, ez) || 1;
    ex /= El;
    ey /= El;
    ez /= El;
    let t0 = El,
      t1 = 1e9;
    const sl = (c0, d, lo, hi) => {
      if (Math.abs(d) < 1e-9) {
        return c0 >= lo && c0 <= hi;
      }
      let a = (lo - c0) / d,
        bb = (hi - c0) / d;
      if (a > bb) {
        const q = a;
        a = bb;
        bb = q;
      }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, bb);
      return t0 <= t1;
    };
    if (!sl(C.x, ex, b.x0, b.x1) || !sl(C.y, ey, b.y0, b.y1) || !sl(C.z, ez, b.z0, b.z1)) continue;
    for (let s = t0; s <= t1; s += 1) {
      const x = C.x + ex * s,
        z = C.z + ez * s,
        y = C.y + ey * s;
      if (y >= b.y0 && y <= b.y1 && inP([x, z], b.fp)) return true;
    }
  }
  return false;
}
function tfTick() {
  const ms = S.m3 && CAMX.on ? tfMeshes() : [],
    own = S.bld.filter((b) => !b.ex && b.fp && b.fp.length > 2);
  if (!ms.length || !own.length || !S.m3 || !CAMX.on || typeof pc === 'undefined') {
    TF.arr.forEach((o, a) => {
      if (o.on) {
        a.array.fill(0);
        a.needsUpdate = true;
        o.on = 0;
      }
    });
    return;
  }
  const C = pc.position,
    B = own.map((b) => {
      const c = cen(b.fp);
      let R = 0;
      b.fp.forEach((p) => {
        R = Math.max(R, Math.hypot(p[0] - c[0], p[1] - c[1]));
      });
      const H = (b._h || 10) + (b._roofH || 0),
        y = gh(c[0], c[1]) + H / 2;
      let x0 = 1e9,
        x1 = -1e9,
        z0 = 1e9,
        z1 = -1e9;
      b.fp.forEach((p) => {
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[1]);
        z1 = Math.max(z1, p[1]);
      });
      const gy = gh(c[0], c[1]);
      return { x: c[0], y, z: c[1], R: Math.max(R, H / 2), fp: b.fp, x0, x1, z0, z1, y0: gy - 1, y1: gy + H };
    });
  const groups = new Map();
  ms.forEach((m) => {
    const g = m.geometry;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(m);
  });
  groups.forEach((list, g) => {
    const first = list[0],
      n = first.count;
    let a = g.attributes.aHid;
    if (!a || a.count !== first.instanceMatrix.count) {
      a = new T.InstancedBufferAttribute(new Float32Array(first.instanceMatrix.count), 1);
      a.setUsage(T.DynamicDrawUsage);
      g.setAttribute('aHid', a);
      TF.arr.set(a, { on: 1 });
    }
    list.forEach((m) => {
      tfPatch(m.material);
    });
    const e = first.instanceMatrix.array,
      arr = a.array;
    let ch = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 16,
        sx = Math.hypot(e[o], e[o + 1], e[o + 2]),
        sy = Math.hypot(e[o + 4], e[o + 5], e[o + 6]),
        sz = Math.hypot(e[o + 8], e[o + 9], e[o + 10]);
      let tg = 0;
      const stem = first.geometry.type === 'CylinderGeometry';
      const r = stem ? Math.max(sx, sz, 1.2) : Math.max(sx, sz);
      if (r > 0.3 && sy > 0.01) {
        const base =
          first.geometry.type === 'CylinderGeometry' ||
          first.geometry.type === 'ConeGeometry' ||
          !!first.userData.wl;
        const px = e[o + 12],
          pz = e[o + 14],
          py = e[o + 13] + (base ? sy * 0.5 : 0);
        for (const b of B) {
          const dx = b.x - C.x,
            dy = b.y - C.y,
            dz = b.z - C.z,
            L2 = dx * dx + dy * dy + dz * dz;
          if (L2 < 1) continue;
          const L = Math.sqrt(L2),
            t = ((px - C.x) * dx + (py - C.y) * dy + (pz - C.z) * dz) / L2;
          if (t <= 0 || t >= 1 + b.R / L) continue;
          const qx = C.x + dx * t - px,
            qy = C.y + dy * t - py,
            qz = C.z + dz * t - pz;
          if (Math.hypot(qx, qy, qz) < r * 1.3 + b.R * t * 1.3 && tfHit(C, px, py, pz, r, b)) {
            tg = TF.hid;
            break;
          }
        }
      }
      const cur = arr[i],
        nv = cur + (tg - cur) * 0.4,
        v = Math.abs(nv - tg) < 0.02 ? tg : nv;
      if (Math.abs(v - cur) > 0.002) {
        arr[i] = v;
        ch = 1;
      }
    }
    if (ch) a.needsUpdate = true;
    const o = TF.arr.get(a);
    if (o) o.on = 1;
  });
  /* Stämme folgen der Krone desselben Baums (gleicher Index, gleiche Anzahl) */
  try {
    const cm = GEO.tmesh,
      ca = cm && cm.geometry.attributes.aHid;
    if (ca)
      groups.forEach((list, g) => {
        const a = g.attributes.aHid;
        if (
          a &&
          g !== cm.geometry &&
          g.type === 'CylinderGeometry' &&
          list[0].count === cm.count &&
          a.array.length === ca.array.length
        ) {
          a.array.set(ca.array);
          a.needsUpdate = true;
        }
      });
  } catch (e) {
    logErr(e, 'tfTick');
  }
}
setInterval(() => {
  try {
    tfTick();
  } catch (e) {
    console.warn('tf', e);
  }
}, 100);
