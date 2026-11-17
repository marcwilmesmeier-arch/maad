/* v431 Geländeplanum: Kontur und Wandkanten als normale Linien über dem Gelände – liegen über der Grundstücksgrenze; Schraffur/Füllung bleiben in der Geländetextur */
const PLV = { g: new T.Group(), sig: '' };
PLV.g.renderOrder = 8;
sc.add(PLV.g);
function plvClear() {
  PLV.g.children.slice().forEach((m) => {
    PLV.g.remove(m);
    m.geometry && m.geometry.dispose();
    m.material && m.material.dispose();
  });
}
function plvLinie(pts, closed, col, ro) {
  if (pts.length < 2) return;
  const g = new T.BufferGeometry().setFromPoints(pts),
    l = closed
      ? new T.LineLoop(g, new T.LineBasicMaterial({ color: col }))
      : new T.Line(g, new T.LineBasicMaterial({ color: col }));
  l.renderOrder = ro;
  l.raycast = () => {};
  l.frustumCulled = false;
  PLV.g.add(l);
}
function plvSig() {
  try {
    return JSON.stringify([PLM.sel, PLM.a.map((a) => [a.id, a.on !== false, a.poly, a.w])]);
  } catch (_) {
    return '';
  }
}
function plvBuild() {
  try {
    plvClear();
    PLV.sig = plvSig();
    if (!PLM.a.some((a) => a.on !== false)) return;
    for (const a of PLM.a) {
      if (a.on === false || !a.poly || a.poly.length < 3) continue;
      const sel = a.id === PLM.sel;
      plvLinie(pbLinienPunkte(a.poly, 1.1), true, sel ? 0x5e7f92 : 0x222222, sel ? 10 : 9);
      const L = a.poly.length;
      for (let i = 0; i < L; i++)
        if (a.w && a.w[i])
          plvLinie(pbLinienPunkte([a.poly[i], a.poly[(i + 1) % L]], 1.15, false), false, 0x4a4a4a, 9);
    }
  } catch (e) {
    console.warn('Planum-Vektor', e);
  }
}
// plmPaint(): Erweiterung zusammengeführt, siehe 21-gelaendeplanum/010-gelaendeplanum.js
setInterval(() => {
  try {
    const s = plvSig();
    if (s !== PLV.sig) {
      plvBuild();
      return;
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 160);

/* v433/v435 Geländeausschnitt NUR unter Gebäuden mit Untergeschoss (sonst wird der 3 m tiefe EG-Sockel durch das Loch sichtbar = 'Ebene unter dem EG'): aus den tatsächlichen Geschoss-Grundrissen (Untergeschosse + EG) statt nur aus b.fp, und sofort nach jeder Änderung am Körper (Ziehen/Schieben) neu berechnet */
function plmFoot() {
  const out = [],
    seen = new Set();
  for (const b of S.bld || []) {
    if (b.ex) continue;
    const u = typeof ugN === 'function' ? ugN(b) : 0;
    if (u < 1) continue;
    const add = (p) => {
      if (!p || p.length < 3) return;
      const k = JSON.stringify(p);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(p);
    };
    try {
      (b.levels || []).forEach((l, i) => {
        if (i < u) {
          let r = null;
          try {
            r = lf(b, l);
          } catch (e) {
            logErr(e, 'plmFoot>anonym');
          }
          add(r);
        }
      });
    } catch (e) {
      logErr(e, 'plmFoot');
    }
  }
  return out;
}
// mesh(): Erweiterung zusammengeführt, siehe 01-modell-3d/020-mehrkoerper.js
/* v435 Geländeausschnitt pixelgenau: Gebäudekubatur (Grundrisse UG..EG) wird zusätzlich im Gelände-Shader ausgeschnitten (discard), nicht nur über das Netz */
function plmCut() {
  try {
    const U = PIT.u,
      E = U.uC.value,
      G = U.uCG.value;
    let n = 0;
    plmFoot().forEach((p, gi) => {
      for (let i = 0; i < p.length; i++) {
        if (n >= 96) return;
        const q = p[(i + 1) % p.length];
        E[n].set(p[i][0], p[i][1], q[0], q[1]);
        G[n] = gi % 4;
        n++;
      }
    });
    U.uCn.value = n;
  } catch (e) {
    console.warn('plmCut', e);
  }
}
// plmGeom(): Erweiterung zusammengeführt, siehe 21-gelaendeplanum/020-gelaendenetz.js
