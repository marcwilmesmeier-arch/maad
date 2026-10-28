/* ---------- v279: Dachfarben – geneigte Dächer und Flachdächer als Layer, Farben änderbar ---------- */
LY.push(['Geneigte Dächer', 'rfs', 1, 1], ['Flachdächer', 'rff', 1, 1]);
S.lc.rfs = '#c4795a';
S.lc.rff = '#8d969b';
const RFC = { sig: '', n: 0 };
function rfOn(k) {
  const L = LY.find((l) => l[1] === k);
  return !!(L && L[2]);
}
function rfUp() {
  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js
  const r = (() => {
    const m = GEO.mesh;
    if (!m || !m.geometry || !m.geometry.attributes.normal) return;
    const g = m.geometry,
      n = g.attributes.position.count,
      nor = g.attributes.normal.array;
    let col = g.attributes.color;
    const anyOn = rfOn('rfs') || rfOn('rff');
    if (!col) {
      if (!anyOn) return;
      col = new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3);
      g.setAttribute('color', col);
      m.material.vertexColors = true;
      m.material.needsUpdate = true;
    }
    const b0 = m.material.color,
      cs = new T.Color(S.lc.rfs),
      cf = new T.Color(S.lc.rff),
      ds = rfOn('rfs'),
      df = rfOn('rff'),
      a = col.array;
    const q = (t, b) => Math.min(1, t / Math.max(b, 0.02)),
      s = [q(cs.r, b0.r), q(cs.g, b0.g), q(cs.b, b0.b)],
      f = [q(cf.r, b0.r), q(cf.g, b0.g), q(cf.b, b0.b)];
    for (let i = 0; i < n; i++) {
      const ny = nor[i * 3 + 1];
      let c = null;
      if (ny > 0.985) {
        if (df) c = f;
      } else if (ny > 0.17) {
        if (ds) c = s;
      }
      if (c) {
        a[i * 3] = c[0];
        a[i * 3 + 1] = c[1];
        a[i * 3 + 2] = c[2];
      } else {
        a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = 1;
      }
    }
    /* Gebäude ohne Dachform (Esri/IOER-Fallback = Flachkörper): Dachtyp aus mittlerer Höhe (Volumen/Grundfläche) zu Maximalhöhe schätzen; Verhältnis < 0,88 = geneigt */
    try {
      const R = GEO.ranges || [];
      for (const r of R) {
        const b = r.b;
        if (!b || b.tris || !b.p || !(b.p.vol > 0) || !(b.p.fa > 0) || !(b.h > 0)) continue;
        const ratio = b.p.vol / b.p.fa / b.h;
        b.roofEst = ratio < 0.88 ? 'geneigt' : 'flach';
        if (b.roofEst !== 'geneigt') continue;
        for (let i = r.s * 3; i < r.e * 3; i++) {
          if (nor[i * 3 + 1] > 0.985) {
            if (ds) {
              a[i * 3] = s[0];
              a[i * 3 + 1] = s[1];
              a[i * 3 + 2] = s[2];
            } else a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = 1;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    col.needsUpdate = true;
  })();
  try {
    bclPaint();
  } catch (e) {
    console.warn(e);
  }
  return r;
}
setInterval(() => {
  try {
    const m = GEO.mesh,
      sig = [m && m.uuid, m && m.material.color.getHex(), rfOn('rfs'), rfOn('rff'), S.lc.rfs, S.lc.rff].join(
        '|',
      );
    if (sig !== RFC.sig) {
      RFC.sig = sig;
      rfUp();
    }
  } catch (e) {
    console.error(e);
  }
}, 350);
