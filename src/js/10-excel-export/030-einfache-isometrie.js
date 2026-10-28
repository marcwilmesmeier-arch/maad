// ---- einfache Isometrie (Blick von Südosten)
function xlIso(bs, title) {
  const F = [];
  bs.forEach((b, bi) => {
    const u = ugN(b),
      c0 = cen(b.fp),
      bd = c0[0] + c0[1];
    let ugH = 0;
    for (let i = 0; i < u; i++) ugH += b.levels[i].h;
    let z0 = 0;
    b.levels.forEach((l, i) => {
      if (i < u) return;
      const f = lf(b, l),
        z1 = z0 + l.h;
      let sa = 0;
      f.forEach((a, j) => {
        const c = f[(j + 1) % f.length];
        sa += a[0] * c[1] - c[0] * a[1];
      });
      const sg = sa > 0 ? 1 : -1;
      f.forEach((a, j) => {
        const c = f[(j + 1) % f.length],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < 0.05) return;
        const nx = (sg * dz) / len,
          nz = (-sg * dx) / len;
        if (nx + nz <= 0.01) return;
        F.push({
          k: [bd, i, 0, (a[0] + c[0] + a[1] + c[1]) / 2],
          p: [
            [a[0], a[1], z0],
            [c[0], c[1], z0],
            [c[0], c[1], z1],
            [a[0], a[1], z1],
          ],
          c: nx > nz ? '#e6e2d8' : '#cdc8ba',
        });
      });
      F.push({ k: [bd, i, 1, 0], p: f.map((q) => [q[0], q[1], z1]), c: '#f3f0e9' });
      z0 = z1;
    });
    const rp = b._rp;
    if (rp) {
      const tri = (arr, col, lv, sh) => {
        for (let i = 0; i + 8 < arr.length; i += 9) {
          const P = [0, 3, 6].map((o) => [arr[i + o], arr[i + o + 2], arr[i + o + 1] - b._y - ugH]);
          const ux = P[1][0] - P[0][0],
            uy = P[1][1] - P[0][1],
            uz = P[1][2] - P[0][2],
            vx = P[2][0] - P[0][0],
            vy = P[2][1] - P[0][1],
            vz = P[2][2] - P[0][2];
          let nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
          if (nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          const lt = Math.max(0, nx * 0.45 + ny * 0.4 + nz * 0.8) / 1.0,
            k = 0.55 + 0.45 * Math.min(1, lt),
            cc = sh
              ? 'rgb(' +
                Math.round(col[0] * k) +
                ',' +
                Math.round(col[1] * k) +
                ',' +
                Math.round(col[2] * k) +
                ')'
              : col;
          F.push({
            k: [bd, lv, 0, (P[0][0] + P[1][0] + P[2][0] + P[0][1] + P[1][1] + P[2][1]) / 3],
            p: P,
            c: cc,
          });
        }
      };
      if (rp.pw) tri(rp.pw, '#d9d4c8', 98, 0);
      if (rp.pr) tri(rp.pr, [196, 150, 128], 99, 1);
    }
  });
  F.sort((a, c) => {
    for (let i = 0; i < 4; i++) if (a.k[i] !== c.k[i]) return a.k[i] - c.k[i];
    return 0;
  });
  const pj = ([x, z, y]) => [(x - z) * 0.866, (x + z) * 0.5 - y];
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  F.forEach((f) =>
    f.p.forEach((q) => {
      const [a, c] = pj(q);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, a);
      y0 = Math.min(y0, c);
      y1 = Math.max(y1, c);
    }),
  );
  if (x0 > x1) return null;
  const sc = Math.min(720 / Math.max(1, x1 - x0), 380 / Math.max(1, y1 - y0)),
    m = 30,
    W = Math.max(420, Math.ceil((x1 - x0) * sc + 2 * m)),
    H = Math.ceil((y1 - y0) * sc + 2 * m + 26),
    K = 2,
    cv = document.createElement('canvas');
  cv.width = W * K;
  cv.height = H * K;
  const g = cv.getContext('2d');
  g.scale(K, K);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  const ox = (W - (x1 - x0) * sc) / 2;
  g.lineJoin = 'round';
  F.forEach((f) => {
    g.beginPath();
    f.p.forEach((q, i) => {
      const [a, c] = pj(q),
        X = ox + (a - x0) * sc,
        Y = m + 26 + (c - y0) * sc;
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    });
    g.closePath();
    g.fillStyle = f.c;
    g.fill();
    g.strokeStyle = '#6a6a66';
    g.lineWidth = 0.6;
    g.stroke();
  });
  g.fillStyle = '#1d1d1b';
  g.font = 'bold 14px Arial';
  g.textBaseline = 'middle';
  g.fillText(title, 12, 16);
  g.fillStyle = '#777';
  g.font = '10px Arial';
  g.textAlign = 'right';
  g.fillText('Isometrie, Blick von Südosten, nicht maßstäblich', W - 10, H - 10);
  return { png: layB64(cv.toDataURL('image/png')), w: W, h: H };
}
// ---- Arbeitsmappe
function xlBuild() {
  const bl = xlSel();
  if (!bl.length) throw new Error('Kein Gebäude ausgewählt.');
  const each = XL.scope !== 'total',
    tot = XL.scope !== 'each';
  const pn = (S.project && S.project.name) || 'maad',
    dt = new Date().toLocaleDateString('de-DE'),
    sheets = [],
    media = [],
    used = new Set();
  const D = bl.map((b) => {
    const m = bM(b);
    return { b, m, v: xlVal(b), L: bLv(b), W: xlWalls(b), R: xlRoof(b, m), T: xlTerr(b), U: useAgg(b) };
  });
  const en = (k) => XL.cols[k].filter((c) => c.on);
  const mk = (key, def) => {
    let n =
        (XL.shn[key] || def)
          .replace(/[\[\]:*?\/\\]/g, ' ')
          .trim()
          .slice(0, 31) || def,
      q = n,
      i = 2;
    while (used.has(q.toLowerCase())) {
      q = n.slice(0, 28) + ' ' + i++;
    }
    used.add(q.toLowerCase());
    const s = xlSheet(q);
    s.set(1, 1, (XL.title || pn) + ' – ' + (XL.shn[key] || def), 7);
    s.set(
      2,
      1,
      'Stand ' +
        dt +
        ' · aus maad · Werte aus der Analyse, Gebäude: ' +
        bl.map((b) => b.name || b.id).join(', '),
      13,
    );
    s.ht[1] = 22;
    sheets.push(s);
    return s;
  };
  const setw = (s, cols) => {
    s.w = cols.map((c) => c.w || 12);
  };
  const nv = (v) => (v == null ? null : v);
  if (XL.sh.sum && en('sum').length) {
    const s = mk('sum', 'Kennwerte'),
      cols = en('sum');
    setw(s, cols);
    s.frz = 4;
    const rows = each ? D.map((d) => ({ ...d.v })) : [];
    const T = xlTbl(s, 4, cols, rows);
    let q = T.next;
    if (tot) {
      const d = layData(bl),
        t = { name: `Summe (${D.length} Gebäude)`, use: '', roof: '' };
      for (const c of cols) {
        if (c.t === 's') t[c.k] = D.reduce((a, x) => a + (x.v[c.k] || 0), 0);
        else if (c.t === 'm') t[c.k] = Math.max(...D.map((x) => x.v[c.k] || 0));
      }
      t.fasb =
        t.fas != null && t.bgf
          ? t.fas / t.bgf
          : D.reduce((a, x) => a + x.v.fas, 0) /
            Math.max(
              1e-9,
              D.reduce((a, x) => a + x.v.bgf, 0),
            );
      if (d.grz != null) {
        t.grz = d.grz;
        t.gfz = d.gfz;
      }
      cols.forEach((c, i) => {
        let v = t[c.k],
          f = null;
        if (i === 0) {
          s.set(q, 1, t.name, 8);
          return;
        }
        if (v == null || v === '') {
          s.set(q, i + 1, null, 8);
          return;
        }
        if (each && T.r1 >= T.r0 && c.t === 's') f = `SUM(${T.L[c.k]}${T.r0}:${T.L[c.k]}${T.r1})`;
        else if (each && T.r1 >= T.r0 && c.t === 'm') f = `MAX(${T.L[c.k]}${T.r0}:${T.L[c.k]}${T.r1})`;
        else if (c.k === 'fasb' && T.L.fas && T.L.bgf)
          f = `IF(${T.L.bgf}${q}=0,0,${T.L.fas}${q}/${T.L.bgf}${q})`;
        s.set(q, i + 1, v, xlSt(c, v, 'sum'), f);
      });
      q++;
    }
    s.set(
      q + 1,
      1,
      'BGF/BRI/Fassade/Dach/Terrasse wie in der Analyse (gleiche Berechnung). Fassade = oberirdische Außenwände brutto ohne Öffnungsabzug. GRZ/GFZ beziehen sich auf das Grundstück des Gebäudes.',
      13,
    );
  }
  if (XL.sh.lev && en('lev').length) {
    const s = mk('lev', 'Geschosse'),
      cols = en('lev');
    setw(s, cols);
    s.frz = 4;
    let q = 4;
    const num = ['h', 'bgf', 'bri', 'umf', 'wand'];
    if (each) {
      D.forEach((d, bi) => {
        const rows = d.L.map((r, i) => {
          const l = d.b.levels[i],
            f = l ? lf(d.b, l) : null,
            dg = !l;
          return {
            bld: bi === 0 || true ? d.b.name || d.b.id : '',
            n: r.n,
            use: dg ? roofUse(d.b) : lUse(d.b, l),
            uk: null,
            h: dg ? d.b._roofH || 0 : l.h,
            bgf: r.a,
            bri: r.v,
            umf: f ? xlPer(f) : null,
            wand: dg ? (d.b._rp ? d.b._rp.aW : 0) : xlPer(f) * l.h,
          };
        });
        let z = 0;
        for (let i = 0; i < d.b.levels.length; i++) if (d.b.levels[i].ug) z -= d.b.levels[i].h;
        rows.forEach((r, i) => {
          r.uk = z;
          z += r.h;
        });
        const T = xlTbl(s, q, cols, rows);
        q = T.next;
        const vs = {};
        num.forEach(
          (k) => (vs[k] = k === 'h' || k === 'umf' ? null : rows.reduce((a, r) => a + (r[k] || 0), 0)),
        );
        xlSumRow(s, q, cols, T, 'Summe ' + (d.b.name || d.b.id), ['bgf', 'bri', 'wand'], vs, T.r0, T.r1);
        q += 2;
        if (XL.img) q = xlPlace(s, q, xlPlans('lev', d), media);
      });
    }
    if (tot) {
      const g = {};
      D.forEach((d) =>
        d.L.forEach((r, i) => {
          const l = d.b.levels[i],
            f = l ? lf(d.b, l) : null,
            k = r.n,
            x =
              g[k] ||
              (g[k] = {
                bld: 'alle Gebäude',
                n: k,
                use: '',
                uk: null,
                h: 0,
                bgf: 0,
                bri: 0,
                umf: 0,
                wand: 0,
              });
          x.h = Math.max(x.h, l ? l.h : d.b._roofH || 0);
          x.bgf += r.a;
          x.bri += r.v;
          if (f) x.umf += xlPer(f);
          x.wand += l ? xlPer(f) * l.h : d.b._rp ? d.b._rp.aW : 0;
        }),
      );
      const rows = Object.values(g);
      const T = xlTbl(s, q, cols, rows);
      q = T.next;
      const vs = { bgf: 0, bri: 0, wand: 0 };
      rows.forEach((r) => {
        vs.bgf += r.bgf;
        vs.bri += r.bri;
        vs.wand += r.wand;
      });
      xlSumRow(s, q, cols, T, 'Summe alle Gebäude', ['bgf', 'bri', 'wand'], vs, T.r0, T.r1);
      q += 2;
    }
    if (!each && XL.img) q = xlTail(s, q, 'lev', D, media);
  }
  if (XL.sh.abw && en('abw').length) {
    const s = mk('abw', 'Abwicklungen'),
      cols = en('abw');
    setw(s, cols);
    let q = 4;
    const opd = XL.opd || 0;
    const mkRow = (w, bn) => {
      const base = { bld: bn, lv: w.lv, nr: w.nr, dir: w.dir, len: nv(w.len), h: nv(w.h), op: null };
      base.area =
        w.len != null
          ? { f: (L, r) => (L.len && L.h ? `${L.len}${r}*${L.h}${r}` : null), v: w.area }
          : w.area;
      base.net = {
        f: (L, r) =>
          L.area ? (L.op ? `${L.area}${r}*(1-N(${L.op}${r})/100)` : `${L.area}${r}*(1-${opd}/100)`) : null,
        v: w.area * (1 - opd / 100),
      };
      return base;
    };
    if (each) {
      D.forEach((d) => {
        const bn = d.b.name || d.b.id;
        s.set(q, 1, bn, 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
        if (XL.img) {
          const im = xlPng(d.b, d.W);
          if (im) {
            media.push(im.png);
            s.img.push({ row: q, col: 0, w: im.w, h: im.h, mi: media.length });
            q += Math.ceil(im.h / 20) + 1;
          }
        }
        const ws = d.W.slice().sort((a, c) => (a.x ? 1 : 0) - (c.x ? 1 : 0) || a.lvi - c.lvi),
          ug = ws.filter((w) => w.ug),
          og = ws.filter((w) => !w.ug);
        const rows = ug.concat(og).map((w) => mkRow(w, bn)),
          T = xlTbl(s, q, cols, rows);
        q = T.next;
        const nU = ug.length,
          rU1 = T.r0 + nU - 1,
          rO0 = T.r0 + nU;
        const ssum = (a) => a.reduce((x, w) => x + w.area, 0),
          keys = ['len', 'area', 'net'];
        const vsU = {
            len: ug.reduce((x, w) => x + (w.len || 0), 0),
            area: ssum(ug),
            net: ssum(ug) * (1 - opd / 100),
          },
          vsO = {
            len: og.filter((w) => !w.x).reduce((x, w) => x + w.len, 0),
            area: ssum(og),
            net: ssum(og) * (1 - opd / 100),
          };
        if (nU) {
          xlSumRow(s, q, cols, T, 'Σ Untergeschoss-Außenwände (erdberührt)', keys, vsU, T.r0, rU1);
          q++;
        }
        xlSumRow(
          s,
          q,
          cols,
          T,
          'Σ Fassade oberirdisch (= Kennwert Fassadenfläche brutto)',
          keys,
          vsO,
          rO0,
          T.r1,
        );
        q += 2;
        if (T.L.dir && T.L.area) {
          s.set(q, 1, 'Fassade oberirdisch nach Himmelsrichtung', 14);
          for (let i = 2; i <= 3; i++) s.set(q, i, null, 14);
          q++;
          XLD.concat(['versch.']).forEach((dn) => {
            const a = og.filter((w) => w.dir === dn).reduce((x, w) => x + w.area, 0);
            if (a < 0.005) return;
            s.set(q, 1, dn, 0);
            s.set(
              q,
              2,
              a,
              3,
              `SUMIFS(${T.L.area}${rO0}:${T.L.area}${T.r1},${T.L.dir}${rO0}:${T.L.dir}${T.r1},"${dn}")`,
            );
            q++;
          });
        }
        q += 2;
      });
    }
    if (tot) {
      const g = {};
      D.forEach((d) =>
        d.W.filter((w) => !w.ug).forEach((w) => {
          const k = w.dir,
            x =
              g[k] ||
              (g[k] = {
                bld: 'alle Gebäude',
                lv: 'oberirdisch',
                nr: '',
                dir: k,
                len: 0,
                h: null,
                area: 0,
                op: null,
              });
          x.len += w.len || 0;
          x.area += w.area;
        }),
      );
      const keys = Object.keys(g).sort(
        (a, c) => (XLD.indexOf(a) < 0 ? 9 : XLD.indexOf(a)) - (XLD.indexOf(c) < 0 ? 9 : XLD.indexOf(c)),
      );
      if (each) {
        s.set(q, 1, 'Summe alle Gebäude nach Himmelsrichtung (oberirdisch)', 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
      }
      const rows = keys.map((k) => ({
        ...g[k],
        len: g[k].len || null,
        net: {
          f: (L, r) => (L.area ? `${L.area}${r}*(1-${opd}/100)` : null),
          v: g[k].area * (1 - opd / 100),
        },
      }));
      const T = xlTbl(s, q, cols, rows);
      q = T.next;
      const vs = {
        len: rows.reduce((a, r) => a + (r.len || 0), 0),
        area: rows.reduce((a, r) => a + r.area, 0),
      };
      vs.net = vs.area * (1 - opd / 100);
      xlSumRow(s, q, cols, T, 'Σ Fassade oberirdisch alle Gebäude', ['len', 'area', 'net'], vs, T.r0, T.r1);
      q++;
      const ugS = D.reduce((a, d) => a + d.W.filter((w) => w.ug).reduce((x, w) => x + w.area, 0), 0);
      if (ugS > 0.01) {
        s.set(q + 1, 1, 'Untergeschoss-Außenwände (erdberührt) gesamt', 2);
        s.set(q + 1, 2, ugS, 3);
      }
    }
  }
  if (XL.sh.roof && en('roof').length) {
    const s = mk('roof', 'Dachflächen'),
      cols = en('roof');
    setw(s, cols);
    let q = 4;
    if (each)
      D.forEach((d) => {
        const bn = d.b.name || d.b.id;
        s.set(q, 1, bn, 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
        const rows = d.R.map((r) => ({ ...r, bld: bn }));
        const T = xlTbl(s, q, cols, rows);
        q = T.next;
        const vs = { area: rows.reduce((a, r) => a + r.area, 0), proj: rows.reduce((a, r) => a + r.proj, 0) };
        xlSumRow(s, q, cols, T, 'Σ Dachfläche ' + bn, ['area', 'proj'], vs, T.r0, T.r1);
        q++;
        const f = lf(d.b, d.b.levels.at(-1));
        s.set(
          q,
          1,
          `Umfang oberstes Geschoss (Traufe/Attika): ${f1(xlPer(f), 2)} m · Dachneigung ${d.b.roof && d.b.roof.type && d.b.roof.type !== 'flat' ? (+d.b.roof.angle || 0) + '°' : '–'}${d.b._rp && d.b._rp.aW > 0.01 ? ` · Giebel-/Dachwandflächen ${f1(d.b._rp.aW, 2)} m² (siehe Abwicklungen)` : ''}`,
          13,
        );
        q += 2;
        if (XL.img) q = xlPlace(s, q, xlPlans('roof', d), media);
        q += 1;
      });
    if (tot) {
      const g = {};
      D.forEach((d) =>
        d.R.forEach((r) => {
          const k = r.typ + '|' + r.ang + '|' + r.dir,
            x =
              g[k] ||
              (g[k] = {
                bld: 'alle Gebäude',
                nr: '',
                typ: r.typ,
                ang: r.ang,
                dir: r.dir,
                azi: null,
                area: 0,
                proj: 0,
              });
          x.area += r.area;
          x.proj += r.proj;
        }),
      );
      if (each) {
        s.set(q, 1, 'Summe alle Gebäude', 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
      }
      const rows = Object.values(g),
        T = xlTbl(s, q, cols, rows);
      q = T.next;
      const vs = { area: rows.reduce((a, r) => a + r.area, 0), proj: rows.reduce((a, r) => a + r.proj, 0) };
      xlSumRow(s, q, cols, T, 'Σ Dachfläche alle Gebäude', ['area', 'proj'], vs, T.r0, T.r1);
      q += 2;
    }
    if (!each && XL.img) q = xlTail(s, q, 'roof', D, media);
  }
  if (XL.sh.terr && en('terr').length) {
    const s = mk('terr', 'Terrassen'),
      cols = en('terr');
    setw(s, cols);
    let q = 4;
    if (each)
      D.forEach((d) => {
        const bn = d.b.name || d.b.id;
        s.set(q, 1, bn, 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
        if (!d.T.length) {
          s.set(q, 1, 'keine Terrassen', 13);
          q += 3;
          return;
        }
        const rows = d.T.map((r) => ({ ...r, bld: bn })),
          T = xlTbl(s, q, cols, rows);
        q = T.next;
        xlSumRow(
          s,
          q,
          cols,
          T,
          'Σ Terrassen ' + bn,
          ['area'],
          { area: rows.reduce((a, r) => a + r.area, 0) },
          T.r0,
          T.r1,
        );
        q += 2;
        if (XL.img) q = xlPlace(s, q, xlPlans('terr', d), media);
        q += 1;
      });
    if (tot) {
      const rows = D.filter((d) => d.T.length).map((d) => ({
        bld: d.b.name || d.b.id,
        lv: 'alle Terrassen',
        area: d.T.reduce((a, r) => a + r.area, 0),
      }));
      if (each) {
        s.set(q, 1, 'Summe alle Gebäude', 14);
        for (let i = 2; i <= cols.length; i++) s.set(q, i, null, 14);
        q++;
      }
      if (rows.length) {
        const T = xlTbl(s, q, cols, rows);
        q = T.next;
        xlSumRow(
          s,
          q,
          cols,
          T,
          'Σ Terrassen alle Gebäude',
          ['area'],
          { area: rows.reduce((a, r) => a + r.area, 0) },
          T.r0,
          T.r1,
        );
      } else s.set(q, 1, 'keine Terrassen', 13);
    }
    if (!each && XL.img) q = xlTail(s, q + 2, 'terr', D, media);
    s.set(
      q + 2,
      1,
      'Umgrenzung = umschreibendes Rechteck der Terrassenfläche (Anhalt für Länge/Breite, nicht die tatsächliche Kontur).',
      13,
    );
  }
  if (XL.sh.use && en('use').length) {
    const s = mk('use', 'Nutzungen'),
      cols = en('use');
    setw(s, cols);
    let q = 4;
    if (each)
      D.forEach((d) => {
        const bn = d.b.name || d.b.id,
          rows = Object.entries(d.U).map(([u, x]) => ({ bld: bn, use: u, bgf: x.a, bri: x.v })),
          T = xlTbl(s, q, cols, rows);
        q = T.next;
        xlSumRow(
          s,
          q,
          cols,
          T,
          'Σ ' + bn,
          ['bgf', 'bri'],
          { bgf: rows.reduce((a, r) => a + r.bgf, 0), bri: rows.reduce((a, r) => a + r.bri, 0) },
          T.r0,
          T.r1,
        );
        q += 3;
      });
    if (tot) {
      const g = {};
      D.forEach((d) =>
        Object.entries(d.U).forEach(([u, x]) => {
          const y = g[u] || (g[u] = { bld: 'alle Gebäude', use: u, bgf: 0, bri: 0 });
          y.bgf += x.a;
          y.bri += x.v;
        }),
      );
      const rows = Object.values(g),
        T = xlTbl(s, q, cols, rows);
      q = T.next;
      xlSumRow(
        s,
        q,
        cols,
        T,
        'Σ alle Gebäude',
        ['bgf', 'bri'],
        { bgf: rows.reduce((a, r) => a + r.bgf, 0), bri: rows.reduce((a, r) => a + r.bri, 0) },
        T.r0,
        T.r1,
      );
    }
  }
  if (XL.sh.plot && en('plot').length) {
    const s = mk('plot', 'Grundstück'),
      cols = en('plot');
    setw(s, cols);
    let q = 4;
    const seen = new Set();
    D.forEach((d) => {
      let k = null;
      try {
        k = kw(d.b);
      } catch (e) {
        logErr(e, 'xlBuild>anonym');
      }
      if (!k || seen.has(k.p)) return;
      seen.add(k.p);
      const L = S.lim,
        rows = [
          { g: 'Grundstücksfläche', v: k.A, u: 'm²' },
          { g: 'Überbaute Fläche (alle Gebäude)', v: k.fp, u: 'm²' },
          { g: 'GRZ', v: k.grz, u: '' },
          { g: 'GRZ zulässig', v: L.grz, u: '' },
          { g: 'BGF oberirdisch (GFZ-relevant)', v: k.gfz * k.A, u: 'm²' },
          { g: 'GFZ', v: k.gfz, u: '' },
          { g: 'GFZ zulässig', v: L.gfz, u: '' },
        ];
      try {
        areaOnPlot(k.p.poly).forEach((x) => rows.push({ g: x.n + ' (freie Flächen)', v: x.a, u: 'm²' }));
      } catch (e) {
        logErr(e, 'xlBuild>anonym');
      }
      rows.forEach((r) => {
        r._d = r.u === 'm²' ? 1 : 2;
      });
      const T = xlTbl(
        s,
        q,
        cols,
        rows.map((r) => ({ g: r.g, v: r.v, u: r.u })),
      );
      const vc = cols.findIndex((c) => c.k === 'v') + 1;
      for (let i = T.r0; i <= T.r1; i++) {
        const c = s.rows[i] && s.rows[i][vc];
        if (c && typeof c.v === 'number') c.st = rows[i - T.r0].u === 'm²' ? 3 : 4;
      }
      q = T.next + 1;
      if (XL.img) {
        const im = xlSitePlan(
          k,
          D.filter((x) => {
            try {
              return kw(x.b).p === k.p;
            } catch (_) {
              return false;
            }
          }),
        );
        if (im) q = xlAddImg(s, q, im, media);
      }
      q += 1;
    });
  }
  if (!sheets.length) throw new Error('Kein Tabellenblatt mit Spalten ausgewählt.');
  if (XL.img && sheets.length) {
    const s0 = sheets[0];
    let q = Math.max(...Object.keys(s0.rows).map(Number), 0) + 2;
    s0.img.forEach((m) => {
      q = Math.max(q, m.row + Math.ceil(m.h / 20) + 2);
    });
    const ims =
      XL.scope === 'total'
        ? [xlIso(bl, 'Isometrie – alle Gebäude')]
        : bl.map((b) => xlIso([b], 'Isometrie ' + (b.name || b.id)));
    ims.forEach((im) => {
      if (im) q = xlAddImg(s0, q, im, media);
    });
  }
  // Dateien
  const files = [],
    ct = [
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Default Extension="png" ContentType="image/png"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ];
  let dn = 0;
  sheets.forEach((s, i) => {
    const n = i + 1;
    ct.push(
      `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    );
    if (s.img.length) {
      dn++;
      ct.push(
        `<Override PartName="/xl/drawings/drawing${dn}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      );
      files.push({
        n: `xl/worksheets/_rels/sheet${n}.xml.rels`,
        d: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${dn}.xml"/></Relationships>`,
      });
      let dx =
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        dr =
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      s.img.forEach((m, j) => {
        const cx = Math.round(m.w * 9525),
          cy = Math.round(m.h * 9525);
        dx += `<xdr:oneCellAnchor><xdr:from><xdr:col>${m.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${m.row - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${j + 2}" name="Abwicklung ${j + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${j + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
        dr += `<Relationship Id="rId${j + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${m.mi}.png"/>`;
      });
      files.push(
        { n: `xl/drawings/drawing${dn}.xml`, d: dx + '</xdr:wsDr>' },
        { n: `xl/drawings/_rels/drawing${dn}.xml.rels`, d: dr + '</Relationships>' },
      );
    }
    files.push({ n: `xl/worksheets/sheet${n}.xml`, d: s.xml(s.img.length) });
  });
  media.forEach((p, i) => files.push({ n: `xl/media/image${i + 1}.png`, d: p }));
  files.unshift(
    {
      n: '[Content_Types].xml',
      d:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        ct.join('') +
        '</Types>',
    },
    {
      n: '_rels/.rels',
      d: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      n: 'xl/workbook.xml',
      d:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
        sheets
          .map((s, i) => `<sheet name="${xlX(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>',
    },
    {
      n: 'xl/_rels/workbook.xml.rels',
      d:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (s, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { n: 'xl/styles.xml', d: XST },
  );
  return { blob: XZ(files), sheets: sheets.map((s) => s.name) };
}
async function xlExport() {
  const btn = $('xlGo');
  try {
    btn.disabled = true;
    btn.textContent = 'Erzeuge Excel …';
    await new Promise((r) => setTimeout(r, 30));
    const r = xlBuild(),
      fn =
        (((S.project && S.project.name) || 'maad').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim() || 'maad') +
        '_Analyse.xlsx';
    let dl = null;
    try {
      dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) {
      logErr(e, 'xlExport');
    }
    if (dl) await dl.save({ filename: fn, data: r.blob });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(r.blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    }
    XL.last = r;
  } catch (err) {
    if (!(err && err.code === 'declined')) {
      console.error(err);
      alert('Excel-Export fehlgeschlagen: ' + ((err && err.message) || err));
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Excel exportieren';
  }
}
