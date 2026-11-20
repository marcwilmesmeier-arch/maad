// ---- Nettogeschossfläche (NGF) und Netto-Raumflächen (nur bei LOD 200): BGF abzüglich der Wandgrundflächen des Geschosses
const l2Ar = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};
function l2Clip(subj, quad) {
  let q = quad;
  if (
    (() => {
      let a = 0;
      for (let i = 0; i < 4; i++) {
        const p = q[i],
          n = q[(i + 1) % 4];
        a += p[0] * n[1] - n[0] * p[1];
      }
      return a < 0;
    })()
  )
    q = q.slice().reverse();
  let out = subj;
  for (let i = 0; i < 4 && out.length; i++) {
    const A = q[i],
      B = q[(i + 1) % 4],
      ins = (P) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= -1e-9,
      cr = (P, Q) => {
        const d1 = (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]),
          d2 = (B[0] - A[0]) * (Q[1] - A[1]) - (B[1] - A[1]) * (Q[0] - A[0]),
          t = d1 / (d1 - d2);
        return [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
      },
      inp = out;
    out = [];
    inp.forEach((P, j) => {
      const Q = inp[(j + 1) % inp.length],
        pi = ins(P),
        qi = ins(Q);
      if (pi) {
        out.push(P);
        if (!qi) out.push(cr(P, Q));
      } else if (qi) out.push(cr(P, Q));
    });
  }
  return out.length > 2 ? out : [];
}
function l2WallA(b) {
  const G = l2Els(b),
    a = [];
  G.els.forEach((e) => {
    if (e.tri && e.kind === 'AW') {
      a[e.li] = (a[e.li] || 0) + e.fp;
      return;
    }
    if (!e.quads || e.kind === 'DE' || e.kind === 'BP') return;
    e.quads.forEach((q) => {
      a[e.li] = (a[e.li] || 0) + l2Ar(q);
    });
  });
  return a;
}
function l2NetFace(b, lv, f) {
  // genau: Nettofläche der Grundrissfläche aus den Netto-Polygonen (wie NGF-Zahl und Körper)
  try {
    const n = l2NetFlaechen(b).f.get(f);
    if (n != null) return n;
  } catch (e) {
    logErr(e, 'l2NetFace');
  }
  const G = l2Els(b),
    qs = [];
  G.els.forEach((e) => {
    if (e.li === lv.i && e.quads && e.kind !== 'DE' && e.kind !== 'BP') e.quads.forEach((q) => qs.push(q));
  });
  let w = 0;
  qs.forEach((q) => {
    w += l2Ar(l2Clip(f.o, q));
    (f.h || []).forEach((h) => {
      w -= l2Ar(l2Clip(h, q));
    });
  });
  return Math.max(0, f.a - w);
}
// grLabelTxt(): Erweiterung zusammengeführt, siehe 15-grundriss/100-kopf.js
/**
 * NGF je Geschoss (LOD 200), genau aus den Netto-Polygonen (l2NetFlaechen: ohne Wände, Innenhöfe, Loggien) – dieselbe
 * Fläche wie die NGF-Körper. ngf = Regelfall R, s = Sonderfall S (Balkone, Loggien) des Geschosses, w = Wände (KF).
 * { o, u (R), so, su (S), wo, wu, lv: [{ n, ug, a, w, ngf, s }] }
 */
function l2Ngf(b) {
  const L = bLv(b),
    wa = l2WallA(b),
    nf = l2NetFlaechen(b),
    sl = [],
    r = { o: 0, u: 0, so: 0, su: 0, wo: 0, wu: 0, lv: [] };
  l2SFlaechen(b).forEach((x) => {
    const i = x.li === 'roof' ? b.levels.length : x.li;
    sl[i] = (sl[i] || 0) + x.a;
  });
  L.forEach((l, i) => {
    const w = wa[i] || 0,
      n = nf.lv[i] || 0,
      sa = sl[i] || 0;
    r.lv.push({ n: l.n, ug: l.ug, a: l.a, w, ngf: n, s: sa });
    if (l.ug) {
      r.u += n;
      r.su += sa;
      r.wu += w;
    } else {
      r.o += n;
      r.so += sa;
      r.wo += w;
    }
  });
  return r;
}
// ---- Gebäudemetrik, Reiter Gebäude: je Gebäude Kopf (Name · GR), große BGF, dann Gruppen BGF / NGF (LOD 200) / BRI / KF (LOD 200) / Flächen
const l2R = (n, v, c, sp) => {
  const key = sp ? sp[0] + '|' + sp[1] + '|' + sp[2] : '',
    on = sp && S.l2.iso && S.l2.iso.key === key;
  return `<div class="r ${c || ''}${sp ? ' k' + (on ? ' on' : '') : ''}"${sp ? ` onclick="L2ISO('${sp[0]}','${sp[1]}','${String(sp[2]).replace(/'/g, '')}')" title="Anklicken: im Modell zeigen (nochmal klicken hebt auf)"` : ''}><span>${n}</span><b>${v}</b></div>`;
};
const zoAb = (s, t) => `<abbr title="${t}">${s}</abbr>`;
function zoBldHtml(b, k, R, A, B, P) {
  const on = l2on(),
    g = k.bgfoi + k.bgfui,
    id = b.id,
    nm = esc(b.name || b.id),
    n = on ? l2Ngf(b) : null,
    // ── Erweiterung aus 22-lod200-waende/130-balkone.js: Sonderfall S nach DIN 277 (Balkone, Loggien)
    sz = on ? l2SZahlen(b) : null,
    ab = zoAb;
  let h =
    `<div class="bd">${nm} <span class="mu gr">${ab('GR', 'Grundfläche')} ${A(grOf(b))}</span></div>` +
    R(
      '',
      `<span class="big" style="padding:0">${A(g)}</span> <span class="mu" style="font-weight:400;font-size:11px">${ab('BGF', 'Bruttogeschossfläche')}</span>`,
      '',
      '',
      B('bgf', 'BGF'),
    );
  const bu = {};
  bLv(b).forEach((r, i) => {
    const u = i >= b.levels.length ? roofUse(b) : lUse(b, b.levels[i]);
    bu[u] = (bu[u] || 0) + r.a;
  });
  h += zoD(
    'bg' + id,
    ab('BGF', 'Bruttogeschossfläche'),
    A(g),
    // LOD 200: als blaue Bodenflächen wie die BRI (L2ISO 'bgf' / 'bgfr' / 'bgfs'), sonst Hervorhebung wie bisher
    (on
      ? l2R(ab('BGFoi', 'Bruttogeschossfläche oberirdisch'), A(k.bgfoi), 's', ['bgf', id, 'o'])
      : R('', ab('BGFoi', 'Bruttogeschossfläche oberirdisch'), A(k.bgfoi), 's', B('bgfoi', 'BGFoi'))) +
      (k.bgfui
        ? on
          ? l2R(ab('BGFui', 'Bruttogeschossfläche unterirdisch'), A(k.bgfui), 's', ['bgf', id, 'u'])
          : R('', ab('BGFui', 'Bruttogeschossfläche unterirdisch'), A(k.bgfui), 's', B('bgfui', 'BGFui'))
        : '') +
      (sz && sz.a > 0
        ? l2R(ab('BGF (R)', 'Regelfall: allseitig umschlossene Räume (ohne Loggien)'), A(g - sz.lo), 's', [
            'bgfr',
            id,
            'all',
          ]) +
          l2R(ab('BGF (S)', 'Sonderfall: Balkone und Loggien, getrennt ausgewiesen'), A(sz.a), 's', [
            'bgfs',
            id,
            'all',
          ])
        : ''),
    USES.filter((u) => bu[u]).map((u) => ({ n: u, c: S.uses[u], v: bu[u] })),
  );
  // BRI direkt unter der BGF
  h += zoD(
    'br' + id,
    ab('BRI', 'Bruttorauminhalt'),
    f1(k.brioi + k.briui + (sz && sz.a > 0 ? sz.bri - sz.loV : 0), 0) + ' m³',
    // LOD 200 mit Balkonen/Loggien: BRIoi = Regelfall R (ohne Loggien) und Sonderfall S zusammen, darunter getrennt
    (sz && sz.a > 0
      ? l2R(
          ab('BRIoi', 'Bruttorauminhalt oberirdisch, Regelfall R und Sonderfall S'),
          f1(k.brioi - sz.loV + sz.bri, 0) + ' m³',
          's',
          ['bri', id, 'o'],
        ) +
        l2R(ab('BRI (R)', 'Regelfall: ohne Loggien'), f1(k.brioi - sz.loV, 0) + ' m³', 's', [
          'brir',
          id,
          'o',
        ]) +
        l2R(
          ab('BRI (S)', 'Sonderfall: Balkone (bis Oberkante Geländer) und Loggien (bis unter die Decke)'),
          f1(sz.bri, 0) + ' m³',
          's',
          ['bris', id, 'o'],
        )
      : R(
          '',
          ab('BRIoi', 'Bruttorauminhalt oberirdisch'),
          f1(k.brioi, 0) + ' m³',
          's',
          B('brioi', 'BRIoi'),
        )) +
      (k.briui
        ? R(
            '',
            ab('BRIui', 'Bruttorauminhalt unterirdisch'),
            f1(k.briui, 0) + ' m³',
            's',
            B('briui', 'BRIui'),
          )
        : ''),
    [
      { n: 'oberirdisch', c: '#f28e2b', v: k.brioi },
      { n: 'unterirdisch', c: '#bfa58a', v: k.briui },
    ],
  );
  if (on)
    h += zoD(
      'ng' + id,
      ab('NGF', 'Nettogeschossfläche: Regelfall R und Sonderfall S (DIN 277)'),
      A(n.o + n.u + n.so + n.su),
      l2R(ab('NGFoi', 'Nettogeschossfläche oberirdisch, R und S'), A(n.o + n.so), 's', ['ngf', id, 'o']) +
        (n.u
          ? l2R(ab('NGFui', 'Nettogeschossfläche unterirdisch'), A(n.u + n.su), 's', ['ngf', id, 'u'])
          : '') +
        (sz && sz.a > 0
          ? l2R(ab('NGF (R)', 'Regelfall: ohne Balkone und Loggien'), A(n.o + n.u), 's', [
              'ngfr',
              id,
              'all',
            ]) + l2R(ab('NGF (S)', 'Sonderfall: Balkone und Loggien'), A(n.so + n.su), 's', ['s', id, 'all'])
          : ''),
      [
        { n: 'oberirdisch', c: '#4e79a7', v: n.o + n.so },
        { n: 'unterirdisch', c: '#9aa5b1', v: n.u + n.su },
      ],
    );
  // Netto-Rauminhalt (LOD 200): wie die NGF, als Rauminhalt; R und S zusammen, darunter getrennt
  if (on) {
    const nr = l2Nri(b),
      sV = sz && sz.a > 0 ? sz.bri : 0,
      m3 = (v) => f1(v, 0) + ' m³';
    h += zoD(
      'nr' + id,
      ab('NRI', 'Netto-Rauminhalt: Regelfall R und Sonderfall S (DIN 277)'),
      m3(nr.o + nr.u + sV),
      l2R(ab('NRIoi', 'Netto-Rauminhalt oberirdisch, R und S'), m3(nr.o + sV), 's', ['nri', id, 'o']) +
        (nr.u ? l2R(ab('NRIui', 'Netto-Rauminhalt unterirdisch'), m3(nr.u), 's', ['nri', id, 'u']) : '') +
        (sV
          ? l2R(ab('NRI (R)', 'Regelfall: ohne Balkone und Loggien'), m3(nr.o + nr.u), 's', [
              'nrir',
              id,
              'all',
            ]) + l2R(ab('NRI (S)', 'Sonderfall: Balkone und Loggien'), m3(sV), 's', ['nris', id, 'all'])
          : ''),
      null,
    );
  }
  if (on)
    h += zoD(
      'kf' + id,
      ab('KF', 'Konstruktionsfläche'),
      A(n.wo + n.wu),
      n.lv
        .slice()
        .reverse()
        .filter((l) => l.w > 0)
        .map((l) => l2R(l.n, A(l.w), 's', ['kf', id, 'n:' + l.n]))
        .join(''),
    );
  // ── Erweiterung aus 22-lod200-waende/160-loggia-fassade.js: eingezogene Flächen der Loggien (nur LOD 200)
  const fdr = fdRows(b) + l2LoggiaZeilen(b, k.fas),
    fas = fdr
      ? zoD(
          'bfa' + id,
          'Fassade',
          A(k.fas),
          R('', 'alle Fassadenflächen', A(k.fas), 's', B('fas', 'Fassadenfläche')) + fdr,
        )
      : R('', 'Fassade', A(k.fas), 's', B('fas', 'Fassadenfläche'));
  h += zoD(
    'bf' + id,
    'Flächen',
    '',
    fas +
      R('', 'Dach', A(k.dach), 's', B('dach', 'Dachfläche')) +
      R('', 'Terrassen', A(k.terr), 's', B('terr', 'Terrassenfläche')),
    [
      { n: 'Fassade', c: '#8fa9c4', v: k.fas },
      { n: 'Dach', c: '#c97b63', v: k.dach },
      { n: 'Terrassen', c: '#9bbf8a', v: k.terr },
    ],
  );
  return (
    h +
    R('', 'Gebäudehöhe', f1(b._hTot || b._hAbove || 0, 2) + ' m', 'ind', B('', 'Gebäudehöhe')) +
    vgHtml(b, R, ab) +
    gkHtml(b) +
    (() => {
      try {
        const q = kw(b);
        if (!q) return '';
        const lim = (v) => R('', 'zulässig (Planungsrecht)', f1(v, 2), 's');
        return (
          '<h5 style="font-size:12px">Grundstück</h5>' +
          R('', 'Grundstücksfläche', A(q.A), '') +
          zoD(
            'grz' + id,
            ab('GRZ', 'Grundflächenzahl'),
            f1(q.grz, 2),
            R('', ab('GR', 'Grundfläche (überbaute Fläche)'), A(q.fp), 's') + lim(S.lim.grz),
            null,
          ) +
          zoD(
            'gfz' + id,
            ab('GFZ', 'Geschossflächenzahl'),
            f1(q.gfz, 2),
            R('', ab('BGFoi', 'Bruttogeschossfläche oberirdisch'), A(q.gfz * q.A), 's') + lim(S.lim.gfz),
            null,
          )
        );
      } catch (_) {
        return '';
      }
    })()
  );
}
function zoBldTot(P, R, A, t) {
  const on = l2on(),
    ab = zoAb,
    AL = { t: 'all', lab: 'Alle Gebäude' };
  let no = 0,
    nu = 0,
    w = 0;
  if (on)
    P.forEach((b) => {
      const n = l2Ngf(b);
      no += n.o + n.so;
      nu += n.u + n.su;
      w += n.wo + n.wu;
    });
  return (
    '<h5>Gesamt</h5>' +
    R('', ab('BGF', 'Bruttogeschossfläche'), A(t.tg), 't', Object.assign({ pie: 'bgfx' }, AL)) +
    R('', ab('BGFoi', 'Bruttogeschossfläche oberirdisch'), A(t.to), 's', AL) +
    (t.tu ? R('', ab('BGFui', 'Bruttogeschossfläche unterirdisch'), A(t.tu), 's', AL) : '') +
    (on
      ? l2R(ab('NGF', 'Nettogeschossfläche: Regelfall R und Sonderfall S'), A(no + nu), 't', [
          'ngf',
          '*',
          'all',
        ]) +
        l2R(ab('NGFoi', 'Nettogeschossfläche oberirdisch'), A(no), 's', ['ngf', '*', 'o']) +
        (nu ? l2R(ab('NGFui', 'Nettogeschossfläche unterirdisch'), A(nu), 's', ['ngf', '*', 'u']) : '')
      : '') +
    R('', ab('BRI', 'Bruttorauminhalt'), f1(t.tv, 0) + ' m³', 't', Object.assign({ pie: 'brix' }, AL)) +
    (on ? l2R(ab('KF', 'Konstruktionsfläche'), A(w), 't', ['kf', '*', 'all']) : '') +
    R('', ab('GR', 'Grundfläche'), A(t.tr), 't', AL)
  );
}
// zoRender(): Erweiterung zusammengeführt, siehe 15-grundriss/050-isolieren.js
{
  let last = '';
  setInterval(() => {
    try {
      const sg = l2on()
        ? S.bld
            .map((b) =>
              b._y != null
                ? l2Geo(b).k.length +
                  ':' +
                  l2Geo(b).els.length +
                  ':' +
                  Math.round(l2WallA(b).reduce((s, x) => s + (x || 0), 0) * 100)
                : '',
            )
            .join('|')
        : 'off';
      if (sg !== last) {
        last = sg;
        zoRender();
        zoTick.k = undefined;
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  }, 800);
}

// ---- Vereinigung zweier einfacher Polygone (Außenring), für Geschossdecken bei Überhang
function l2Union(A0, B0) {
  try {
    const sa = (r) => {
        let a = 0;
        for (let i = 0; i < r.length; i++) {
          const p = r[i],
            q = r[(i + 1) % r.length];
          a += p[0] * q[1] - q[0] * p[1];
        }
        return a / 2;
      },
      ccw = (r) => (sa(r) > 0 ? r.map((p) => p.slice()) : r.map((p) => p.slice()).reverse()),
      A = ccw(A0),
      B = ccw(B0),
      E = 1e-6;
    const hit = (p, q, r, s) => {
      const d1 = [q[0] - p[0], q[1] - p[1]],
        d2 = [s[0] - r[0], s[1] - r[1]],
        det = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(det) < 1e-12) return null;
      const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / det,
        u = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / det;
      return u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
    };
    const split = (P, Q) => {
      const out = [];
      P.forEach((p, i) => {
        const q = P[(i + 1) % P.length],
          ts = [0, 1];
        Q.forEach((r, j) => {
          const t = hit(p, q, r, Q[(j + 1) % Q.length]);
          if (t != null && t > 1e-9 && t < 1 - 1e-9) ts.push(t);
        });
        ts.sort((x, y) => x - y);
        for (let k = 0; k + 1 < ts.length; k++) {
          const a = [p[0] + (q[0] - p[0]) * ts[k], p[1] + (q[1] - p[1]) * ts[k]],
            b = [p[0] + (q[0] - p[0]) * ts[k + 1], p[1] + (q[1] - p[1]) * ts[k + 1]];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > E) out.push([a, b]);
        }
      });
      return out;
    };
    const inside = (m, R) => {
      let c = 0;
      R.forEach((p, i) => {
        const q = R[(i + 1) % R.length];
        if (p[1] > m[1] !== q[1] > m[1] && m[0] < ((q[0] - p[0]) * (m[1] - p[1])) / (q[1] - p[1]) + p[0]) c++;
      });
      return c % 2 === 1;
    };
    const onEd = (m, R, d) => {
      for (let i = 0; i < R.length; i++) {
        const p = R[i],
          q = R[(i + 1) % R.length],
          dx = q[0] - p[0],
          dz = q[1] - p[1],
          L2 = dx * dx + dz * dz || 1e-12;
        let t = ((m[0] - p[0]) * dx + (m[1] - p[1]) * dz) / L2;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(p[0] + dx * t - m[0], p[1] + dz * t - m[1]) < 1e-5)
          return d ? (d[0] * dx + d[1] * dz > 0 ? 1 : -1) : 1;
      }
      return 0;
    };
    const mid = (s) => [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2],
      dr = (s) => [s[1][0] - s[0][0], s[1][1] - s[0][1]];
    const kA = split(A, B).filter((s) => {
        const m = mid(s),
          o = onEd(m, B, dr(s));
        return o ? o > 0 : !inside(m, B);
      }),
      kB = split(B, A).filter((s) => {
        const m = mid(s);
        return !onEd(m, A) && !inside(m, A);
      });
    const segs = kA.concat(kB),
      key = (p) => Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4),
      by = new Map();
    segs.forEach((s) => {
      const k = key(s[0]);
      (by.get(k) || by.set(k, []).get(k)).push(s);
    });
    const used = new Set(),
      rings = [];
    for (const s0 of segs) {
      if (used.has(s0)) continue;
      const r = [s0[0]];
      let s = s0,
        n = 0;
      used.add(s);
      while (n++ < 2000) {
        r.push(s[1]);
        if (key(s[1]) === key(s0[0])) break;
        const nx = (by.get(key(s[1])) || []).filter((z) => !used.has(z));
        if (!nx.length) break;
        s = nx[0];
        used.add(s);
      }
      if (r.length > 3 && key(r[r.length - 1]) === key(r[0])) {
        r.pop();
        rings.push(r);
      }
    }
    if (!rings.length) return null;
    rings.sort((x, y) => sa(y) - sa(x));
    let R = rings[0];
    if (sa(R) <= 0) return null;
    R = R.filter((p, i) => {
      const a = R[(i + R.length - 1) % R.length],
        c = R[(i + 1) % R.length];
      return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 1e-6;
    });
    return R.length >= 3 && sa(R) >= Math.max(sa(A), sa(B)) - 1e-3 ? R : null;
  } catch (e) {
    console.warn('Union', e);
    return null;
  }
}
