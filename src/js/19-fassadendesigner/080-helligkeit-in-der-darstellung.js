/* v332: Helligkeit in der Darstellung „Realistisch“ (50–150 %): Himmel, Wasser und Beleuchtung (Sonne + Umgebungslicht) */
S.rb = 100;
const brK = () => Math.max(0.5, Math.min(1.5, (+S.rb || 100) / 100));
function brPatch() {
  try {
    if (DR.skyM && DR.skyM.material && !DR.skyM.userData.brp) {
      const m = DR.skyM.material;
      if (m.fragmentShader.indexOf('gl_FragColor=vec4(c,1.)') >= 0) {
        m.fragmentShader = m.fragmentShader
          .replace('uniform vec3 uZ;', 'uniform vec3 uZ;uniform float uBr;')
          .replace('gl_FragColor=vec4(c,1.)', 'gl_FragColor=vec4(c*uBr,1.)');
        m.uniforms.uBr = { value: 1 };
        m.needsUpdate = true;
      }
      DR.skyM.userData.brp = 1;
    }
    sc.traverse((o) => {
      const m = o.material;
      if (m && m.isShaderMaterial && m.uniforms && m.uniforms.uD && m.uniforms.uSun && !m.userData.brp) {
        m.userData.brp = 1;
        const f = m.fragmentShader,
          a = 'gl_FragColor=vec4(col,smoothstep(.04,.5,a0))';
        if (f.indexOf(a) >= 0) {
          m.fragmentShader = f
            .replace(/uniform vec3 uD,/, 'uniform float uBr;uniform vec3 uD,')
            .replace(a, 'gl_FragColor=vec4(col*uBr,smoothstep(.04,.5,a0))');
          m.uniforms.uBr = { value: 1 };
          m.needsUpdate = true;
        }
      }
    });
    const k = S.dar === 'real' ? brK() : 1;
    if (DR.skyM && DR.skyM.material.uniforms.uBr) DR.skyM.material.uniforms.uBr.value = k;
    sc.traverse((o) => {
      const m = o.material;
      if (m && m.isShaderMaterial && m.uniforms && m.uniforms.uBr && m !== (DR.skyM && DR.skyM.material))
        m.uniforms.uBr.value = k;
    });
  } catch (e) {
    logErr(e, 'brPatch');
  }
}
// liUp(): Erweiterung zusammengeführt, siehe 06-darstellung/010-darstellung.js
// Bildzähler für brPatch() in der Darstellung „Realistisch“
let brTickN = 0;
// drTick(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
function brSet(v) {
  S.rb = Math.max(50, Math.min(150, Math.round(+v || 100)));
  brUi();
  liUp();
}
function brUi() {
  const r = $('brR'),
    t = $('brV');
  if (r) r.value = String(S.rb);
  if (t) t.textContent = S.rb + ' %';
}
// drUi(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
(function () {
  const p = $('darReal');
  if (!p || $('brR')) return;
  const d = document.createElement('div');
  d.style.marginTop = '8px';
  d.innerHTML =
    '<label style="display:block">Helligkeit <b id="brV">100 %</b> <input id="brR" type="range" min="50" max="150" step="5" value="100" style="width:100%" oninput="brSet(this.value)" ondblclick="brSet(100)"></label><div class="dmu">Hellt Beleuchtung, Himmel und Wasser gemeinsam auf oder dunkelt sie ab. Doppelklick auf den Regler setzt auf 100 % zurück. Wird je Projekt und Ansicht gespeichert.</div>';
  p.appendChild(d);
  brUi();
})();

// ---- Baugrube: Untergeschosse schneiden ihre Form exakt aus dem Gelände (Negativ); Böschungswände (senkrecht) und Sohle
const PIT = {
  u: {
    uE: { value: Array.from({ length: 128 }, () => new T.Vector4(0, 0, 0, 0)) },
    uG: { value: new Array(128).fill(0) },
    uN: { value: 0 },
    uC: { value: Array.from({ length: 96 }, () => new T.Vector4(0, 0, 0, 0)) },
    uCG: { value: new Array(96).fill(0) },
    uCn: { value: 0 },
  },
  g: new T.Group(),
  k: '',
};
G.terrain.add(PIT.g);
function pitPatch(m) {
  if (!m || m.userData.pit) return;
  m.userData.pit = 1;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, PIT.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'varying vec3 vPw;\n#include <common>')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvPw=(modelMatrix*vec4(transformed,1.0)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        'varying vec3 vPw;\nuniform vec4 uE[128];uniform float uG[128];uniform int uN;uniform vec4 uC[96];uniform float uCG[96];uniform int uCn;\n#include <common>',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif(uN>0){vec4 cn=vec4(0.0);vec2 p=vPw.xz;for(int i=0;i<128;i++){if(i>=uN)break;vec4 e=uE[i];if((e.y>p.y)!=(e.w>p.y)){if(p.x<(e.z-e.x)*(p.y-e.y)/(e.w-e.y)+e.x){vec4 mk=vec4(equal(vec4(uG[i]),vec4(0.0,1.0,2.0,3.0)));cn+=mk;}}}\n if(mod(cn.x,2.0)>.5||mod(cn.y,2.0)>.5||mod(cn.z,2.0)>.5||mod(cn.w,2.0)>.5)discard;}\nif(uCn>0){vec4 cm=vec4(0.0);vec2 q=vPw.xz;for(int i=0;i<96;i++){if(i>=uCn)break;vec4 e=uC[i];if((e.y>q.y)!=(e.w>q.y)){if(q.x<(e.z-e.x)*(q.y-e.y)/(e.w-e.y)+e.x){cm+=vec4(equal(vec4(uCG[i]),vec4(0.0,1.0,2.0,3.0)));}}}\n if(mod(cm.x,2.0)>.5||mod(cm.y,2.0)>.5||mod(cm.z,2.0)>.5||mod(cm.w,2.0)>.5)discard;}',
      );
  };
  m.customProgramCacheKey = () => 'pit2';
  m.needsUpdate = true;
}
function pitBuild() {
  const items = [];
  let gi = 0;
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(b.levels || []).some((l) => l.ug)) return;
    let y = b._y;
    b.levels.forEach((l) => {
      const y0 = y;
      y += l.h;
      if (!l.ug) return;
      const r = lf(b, l);
      if (!r || r.length < 3) return;
      items.push({ r, y0, g: gi % 4 });
      gi++;
    });
  });
  const key = JSON.stringify(items.map((i) => [i.r, i.y0]));
  if (key === PIT.k) return;
  PIT.k = key;
  while (PIT.g.children.length) {
    const o = PIT.g.children.pop();
    o.geometry.dispose();
    o.material.dispose();
  }
  let n = 0;
  items.forEach((it) => {
    it.r.forEach((p, i) => {
      if (n >= 128) return;
      const q = it.r[(i + 1) % it.r.length];
      PIT.u.uE.value[n].set(p[0], p[1], q[0], q[1]);
      PIT.u.uG.value[n] = it.g;
      n++;
    });
  });
  PIT.u.uN.value = n;
  const pos = [],
    idx = [];
  items.forEach((it) => {
    const r = it.r;
    r.forEach((p, i) => {
      const q = r[(i + 1) % r.length],
        L = Math.hypot(q[0] - p[0], q[1] - p[1]),
        k = Math.max(1, Math.ceil(L / 1.5)),
        b0 = pos.length / 3;
      for (let j = 0; j <= k; j++) {
        const x = p[0] + ((q[0] - p[0]) * j) / k,
          z = p[1] + ((q[1] - p[1]) * j) / k;
        pos.push(x, Math.max(gh(x, z), it.y0 + 0.01), z, x, it.y0, z);
      }
      for (let j = 0; j < k; j++) {
        const a = b0 + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  });
  if (pos.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x9a8a74, side: T.DoubleSide }));
    m.receiveShadow = true;
    PIT.g.add(m);
  }
  items.forEach((it) => {
    const sh = new T.Shape(it.r.map((p) => new T.Vector2(p[0], -p[1]))),
      g = new T.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x7d705e, side: T.DoubleSide }));
    m.position.y = it.y0 - 0.02;
    m.receiveShadow = true;
    PIT.g.add(m);
  });
}
setInterval(() => {
  try {
    pitPatch(S.terr && S.terr.material);
    pitBuild();
  } catch (e) {
    console.warn('Baugrube', e);
  }
}, 600);

// ---- Fassadendesigner: Vor- und Rücksprünge der Fassade mit Konturen und leichtem Schatten hervorheben
function fdDepthFx(g, b, V, ox, o) {
  const P = (V.pcs || []).filter((p) => p.dp != null && p.ring && p.ring.length > 2);
  if (P.length < 2) return;
  const X = (u) => fdSX(u + ox),
    Y = fdSY,
    key = (p) => Math.round(p.dp / 0.05),
    ks = [...new Set(P.map(key))].sort((a, c) => a - c),
    dpr = fdSize().dpr || 1;
  const sub = (ps) =>
    ps.forEach((p) => {
      p.ring.forEach((q, i) => (i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))));
      g.closePath();
    });
  if (ks.length > 1) {
    // zurückliegende Teile leicht abgedunkelt (Tiefenwirkung)
    ks.forEach((k, j) => {
      if (j === ks.length - 1) return;
      const a = 0.11 * (1 - j / (ks.length - 1));
      g.save();
      g.beginPath();
      sub(P.filter((p) => key(p) === k));
      g.fillStyle = 'rgba(30,42,56,' + a.toFixed(3) + ')';
      g.fill();
      g.restore();
    });
    // Schlagschatten der vorspringenden Teile auf die dahinterliegenden
    ks.slice(1).forEach((k, j) => {
      const bu = P.filter((p) => key(p) === k),
        st = Math.min(3, j + 1);
      g.save();
      g.beginPath();
      sub(P.filter((p) => key(p) < k));
      g.clip();
      g.shadowColor = 'rgba(20,28,38,.55)';
      g.shadowBlur = (9 + st * 3) * dpr;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = (2 + st) * dpr;
      g.beginPath();
      sub(bu);
      g.fillStyle = '#000';
      g.fill();
      g.restore();
    });
    // Konturen an den Sprungkanten (gemeinsame Kanten von Teilen unterschiedlicher Tiefe)
    g.save();
    g.lineWidth = 2.6;
    g.strokeStyle = '#1F2A33';
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        if (key(P[i]) === key(P[j])) continue;
        const R1 = P[i].ring,
          R2 = P[j].ring;
        for (let a = 0; a < R1.length; a++) {
          const p1 = R1[a],
            p2 = R1[(a + 1) % R1.length],
            dx = p2[0] - p1[0],
            dz = p2[1] - p1[1],
            L = Math.hypot(dx, dz);
          if (L < 0.05) continue;
          const ux = dx / L,
            uz = dz / L;
          for (let c = 0; c < R2.length; c++) {
            const q1 = R2[c],
              q2 = R2[(c + 1) % R2.length];
            const d1 = Math.abs((q1[0] - p1[0]) * uz - (q1[1] - p1[1]) * ux),
              d2 = Math.abs((q2[0] - p1[0]) * uz - (q2[1] - p1[1]) * ux);
            if (d1 > 0.04 || d2 > 0.04) continue;
            const t1 = (q1[0] - p1[0]) * ux + (q1[1] - p1[1]) * uz,
              t2 = (q2[0] - p1[0]) * ux + (q2[1] - p1[1]) * uz,
              lo = Math.max(0, Math.min(t1, t2)),
              hi = Math.min(L, Math.max(t1, t2));
            if (hi - lo < 0.05) continue;
            g.moveTo(X(p1[0] + ux * lo), Y(p1[1] + uz * lo));
            g.lineTo(X(p1[0] + ux * hi), Y(p1[1] + uz * hi));
          }
        }
      }
    g.stroke();
    g.restore();
  }
}
// fdDrawView(): Erweiterung zusammengeführt, siehe 19-fassadendesigner/040-fang.js

// ======================================================================
// Gebäude nach Flächennutzung (CORINE): Umgebungsgebäude (Kontextmodell) übernehmen die CLC-Farbe der Fläche, auf der sie stehen – für die Übersicht.
// Layer „Gebäude nach Flächennutzung (CORINE)“; Dachfarben-Layer (geneigt/flach) behalten ihre Farbe, wenn sie eingeschaltet sind.
// ======================================================================
LY.push(['Gebäude nach Flächennutzung (CORINE)', 'bclc', 0, 1]);
const BCL = { sig: '' };
const bclOn = () => {
  const L = LY.find((l) => l[1] === 'bclc');
  return !!(L && L[2]);
};
function bclIn(rs, x, z) {
  let c = false;
  for (const r of rs) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  }
  return c;
}
function bclCode(x, z) {
  const it = (typeof OVI !== 'undefined' && OVI.clc) || [];
  let hit = null;
  for (const o of it) {
    if (o.t !== 'a' || !o.r || !o.r.length) continue;
    if (bclIn(o.r, x, z)) {
      hit = o;
      break;
    }
  }
  return hit;
}
// rfUp(): Erweiterung zusammengeführt, siehe 17-erweiterungen-v253-v280/120-dachfarben.js
function bclPaint() {
  if (!bclOn()) return;
  const m = GEO.mesh;
  if (!m || !m.geometry || !m.geometry.attributes.position) return;
  const it = (typeof OVI !== 'undefined' && OVI.clc) || [];
  if (!it.length) return;
  const g = m.geometry,
    pos = g.attributes.position.array;
  let col = g.attributes.color;
  const n = g.attributes.position.count;
  if (!col) {
    col = new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3);
    g.setAttribute('color', col);
    m.material.vertexColors = true;
    m.material.needsUpdate = true;
  }
  const a = col.array,
    b0 = m.material.color,
    R = GEO.ranges || [],
    C = new T.Color();
  for (const r of R) {
    let sx = 0,
      sz = 0,
      k = 0;
    for (let i = r.s * 3; i < r.e * 3; i++) {
      sx += pos[i * 3];
      sz += pos[i * 3 + 2];
      k++;
    }
    if (!k) continue;
    const o = bclCode(sx / k, sz / k);
    if (!o || !o.c) continue;
    C.set(o.c);
    const q = [
      Math.min(3, C.r / Math.max(b0.r, 0.05)),
      Math.min(3, C.g / Math.max(b0.g, 0.05)),
      Math.min(3, C.b / Math.max(b0.b, 0.05)),
    ];
    for (let i = r.s * 3; i < r.e * 3; i++) {
      if (a[i * 3] === 1 && a[i * 3 + 1] === 1 && a[i * 3 + 2] === 1) {
        a[i * 3] = q[0];
        a[i * 3 + 1] = q[1];
        a[i * 3 + 2] = q[2];
      }
    }
  }
  col.needsUpdate = true;
}
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// ovSync(): Erweiterung zusammengeführt, siehe 17-erweiterungen-v253-v280/080-karten.js
setInterval(() => {
  try {
    const m = GEO.mesh,
      it = (typeof OVI !== 'undefined' && OVI.clc) || [],
      sg = [m && m.uuid, bclOn() ? 1 : 0, it.length, it._v || ''].join('|');
    if (sg !== BCL.sig) {
      BCL.sig = sg;
      RFC.sig = '';
      rfUp();
    }
  } catch (e) {
    console.warn(e);
  }
}, 400);

// Frankreich: Gelände/Oberfläche aus IGN LiDAR HD (Test-Knopf entfernt in v364)
function frtM(lat, lon) {
  const R = 6378137;
  return [(lon * Math.PI * R) / 180, Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * R];
}
