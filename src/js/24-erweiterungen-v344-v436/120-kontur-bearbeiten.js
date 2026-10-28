// ---- Kontur bearbeiten: Kanten greifen und ziehen, Länge der Linie am gewählten Punkt, Länge/Breite des ganzen Gebäudes per Eingabe
const ktB = () => {
  const b = S.sel;
  return b && !b.ex && S.bld.includes(b) && b.levels && b.kind !== 'circ' ? b : null;
};
const ktRef = (A) => {
  const b = S.sel;
  mesh(b);
  H();
  hpos();
  drawOv();
  rr();
};
function ktEdit(fn) {
  const b = ktB();
  if (!b) return;
  const A = cfp(b);
  hist();
  const ct = ctBegin(b);
  fn(A);
  ctEnd(ct);
  ktRef(A);
}
const ktU = (a, c) => {
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  return [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
};
// Linie (zusammenhängende, gleichgerichtete Kanten) am Punkt vi: Richtung 'prev' = Kante davor, 'next' = Kante danach
function ktLine(A, vi, w) {
  const m = A.length,
    P = A[vi],
    step = w === 'prev' ? -1 : 1;
  let k = vi,
    u = null;
  for (let g = 0; g < m; g++) {
    const a = A[(((k + step) % m) + m) % m],
      l = Math.hypot(k === vi ? P[0] - a[0] : A[k][0] - a[0], k === vi ? P[1] - a[1] : A[k][1] - a[1]);
    if (l < 1e-6) break;
    const d = ktU(a, A[k]);
    if (u && Math.abs(u[0] * d[1] - u[1] * d[0]) > 0.0087) break;
    u = u || d;
    k = (((k + step) % m) + m) % m;
  }
  const F = A[k];
  if (!u || k === vi) return null;
  return { F, u, len: Math.hypot(P[0] - F[0], P[1] - F[1]), w };
}
function ktLen(vi, w, val) {
  const L0 = +String(val).replace(',', '.');
  if (!(L0 >= 0.5)) return;
  ktEdit((A) => {
    const m = A.length,
      ln = ktLine(A, vi, w);
    if (!ln) return;
    const dl = L0 - ln.len,
      i2 = w === 'prev' ? vi : (vi - 1 + m) % m,
      E = A[i2],
      E2 = A[(i2 + 1) % m],
      e = ktU(E, E2),
      pe = Math.abs(e[0] * ln.u[0] + e[1] * ln.u[1]) < 0.02;
    if (pe && A.length >= 4) {
      const r = offEdge(A, i2, ln.u, dl);
      r.forEach((q, j) => {
        A[j] = q;
      });
    } else {
      A[vi] = [A[vi][0] + ln.u[0] * dl, A[vi][1] + ln.u[1] * dl];
    }
  });
}
// Gesamtmaße einfacher (rechtwinkliger) Grundrisse
function ktBox(A) {
  if (!A || A.length < 4) return null;
  let th = 0,
    best = 0;
  A.forEach((p, i) => {
    const q = A[(i + 1) % A.length],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > best) {
      best = l;
      th = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
  });
  const c = Math.cos(th),
    s = Math.sin(th),
    R = A.map((p) => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]);
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    if (Math.min(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) > 0.03) return null;
  }
  const u0 = Math.min(...R.map((p) => p[0])),
    u1 = Math.max(...R.map((p) => p[0])),
    v0 = Math.min(...R.map((p) => p[1])),
    v1 = Math.max(...R.map((p) => p[1]));
  return { th, R, u0, u1, v0, v1, L: u1 - u0, W: v1 - v0 };
}
function ktSize(k, val) {
  const v = +String(val).replace(',', '.');
  if (!(v >= 1)) return;
  ktEdit((A) => {
    const B = ktBox(A);
    if (!B) return;
    const d = v - (k === 0 ? B.L : B.W),
      c = Math.cos(B.th),
      s = Math.sin(B.th);
    B.R.forEach((p, i) => {
      const q = p.slice();
      if (k === 0 && p[0] >= B.u1 - 0.03) q[0] += d;
      if (k === 1 && p[1] >= B.v1 - 0.03) q[1] += d;
      A[i] = [q[0] * c - q[1] * s, q[0] * s + q[1] * c];
    });
  });
}
function ktCard() {
  const b = ktB();
  if (!b) return '';
  const A = cfp(b),
    B = ktBox(A),
    f = (x) => String(Math.round(x * 100) / 100).replace('.', ','),
    ip = (js, v, u) =>
      `<input type="number" style="width:76px" min="0.5" step="0.05" value="${Math.round(v * 100) / 100}" onchange="${js}"> ${u || 'm'}`;
  let h =
    '<div class="card" id="ktCard"><div style="font-weight:600;margin-bottom:4px">Länge und Breite</div>';
  if (B)
    h += `<div class="kv"><span>Länge gesamt</span><span>${ip('ktSize(0,this.value)', B.L)}</span></div><div class="kv"><span>Breite gesamt</span><span>${ip('ktSize(1,this.value)', B.W)}</span></div><div style="color:var(--mu);font-size:11px">Die Außenwand am Ende wandert, die Ecke links unten bleibt fest.</div>`;
  else
    h +=
      '<div style="color:var(--mu);font-size:11px">Für diese Form: Punkte und Kanten im Werkzeug „Kontur bearbeiten“ ziehen oder Linienlängen am gewählten Punkt eingeben.</div>';
  const vi = S.vi;
  if (S.tool === 'ed' && vi != null && A[vi]) {
    const pl = ktLine(A, vi, 'prev'),
      nl = ktLine(A, vi, 'next');
    h +=
      `<div style="font-weight:600;margin:8px 0 4px">Punkt ${vi + 1} von ${A.length}</div>` +
      (pl
        ? `<div class="kv"><span>Linie davor</span><span>${ip(`ktLen(${vi},'prev',this.value)`, pl.len)}</span></div>`
        : '') +
      (nl
        ? `<div class="kv"><span>Linie danach</span><span>${ip(`ktLen(${vi},'next',this.value)`, nl.len)}</span></div>`
        : '') +
      '<div style="color:var(--mu);font-size:11px">Länge ändern: Die Linie verlängert oder verkürzt sich zum gewählten Punkt hin, rechtwinklig anschließende Wände wandern mit.</div>';
  } else if (S.tool === 'ed')
    h +=
      '<div style="color:var(--mu);font-size:11px;margin-top:6px">Punkt anklicken: Länge der Linie eingeben. Kante anklicken = Länge eingeben, Kante ziehen = Wand parallel verschieben, Doppelklick = Punkt einfügen.</div>';
  return h + '</div>';
}
// rr(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js
// Punkt wählen: Panel aktualisieren
cv.addEventListener('pointerdown', () => {
  if (S.tool === 'ed') {
    try {
      rr();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  }
});
// Kante greifen und ziehen (Wand parallel verschieben)
cv.addEventListener('pointerdown', (e) => {
  try {
    if (!dr || dr.v != null || dr.h || dr.f || dr.p || S.tool !== 'ed' || e.button !== 0) return;
    const A = edv();
    if (!A || !isCt(A) || !ktB()) return;
    const g = ground(e);
    if (!g) return;
    let bi = -1,
      bd = 8 * mpp();
    A.forEach((a, k) => {
      const o = proj(g, a, A[(k + 1) % A.length]);
      if (o.d < bd) {
        bd = o.d;
        bi = k;
      }
    });
    if (bi < 0) return;
    const a = A[bi],
      c = A[(bi + 1) % A.length],
      u = ktU(a, c);
    dr.eg = {
      i: bi,
      A0: A.map((q) => q.slice()),
      n: [-u[1], u[0]],
      p0: g,
      x: e.clientX,
      y: e.clientY,
      ct: null,
    };
  } catch (e) {
    logErr(e, 'init>anonym');
  }
});
window.addEventListener(
  'pointermove',
  (e) => {
    if (!dr || !dr.eg) return;
    const eg = dr.eg;
    e.stopImmediatePropagation();
    if (!dr.m && Math.hypot(e.clientX - eg.x, e.clientY - eg.y) < 4) return;
    const A = ed(),
      g = ground(e);
    if (!A || !g) return;
    if (!dr.m) {
      dr.m = 1;
      hist();
      eg.ct = ctBegin(S.sel);
    }
    const raw = (g[0] - eg.p0[0]) * eg.n[0] + (g[1] - eg.p0[1]) * eg.n[1],
      d = e.altKey ? raw : Math.round(raw * 20) / 20,
      r = offEdge(eg.A0, eg.i, eg.n, d);
    r.forEach((q, j) => {
      A[j] = q;
    });
    if (eg.ct) ctEnd(eg.ct);
    $('hud').textContent = `Wand ${d >= 0 ? '+' : ''}${f1(d, 2)} m verschoben · Alt = ohne Raster`;
    mesh(S.sel);
    H();
    hpos();
    drawOv();
  },
  true,
);
window.addEventListener(
  'pointerup',
  () => {
    if (dr && dr.eg && dr.m)
      setTimeout(() => {
        try {
          rr();
        } catch (e) {
          logErr(e, 'init>anonym');
        }
      }, 0);
  },
  true,
);

// ---- Direkteingabe: Kante anklicken öffnet ein Eingabefenster für die Länge der ganzen Linie
function ktPopClose() {
  const p = document.getElementById('ktPop');
  if (p) p.remove();
  S.ke = null;
}
function ktPopOpen(x, y, html, focusId) {
  ktPopClose();
  const p = document.createElement('div');
  p.id = 'ktPop';
  p.style.cssText = `position:fixed;left:${Math.min(innerWidth - 250, Math.max(8, x + 14))}px;top:${Math.min(innerHeight - 170, Math.max(8, y + 14))}px;z-index:99999;background:#E9EDEF;border:1px solid #9fb2bd;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.25);padding:8px 10px;font:13px system-ui;min-width:210px;color:#222`;
  p.innerHTML = html;
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(p);
  const f = focusId && document.getElementById(focusId);
  if (f) {
    f.focus();
    f.select && f.select();
  }
}
const ktIn = (id, v, js) =>
  `<input id="${id}" type="text" inputmode="decimal" style="width:80px;font:inherit;padding:2px 4px" value="${String(Math.round(v * 100) / 100).replace('.', ',')}" onkeydown="if(event.key==='Enter'){${js};event.stopPropagation()}else if(event.key==='Escape'){ktPopClose()}else event.stopPropagation()"> m`;
function ktEdgeOpen(i, end, x, y) {
  const b = ktB();
  if (!b) return;
  const A = cfp(b),
    m = A.length,
    vi = end ? (i + 1) % m : i,
    ln = ktLine(A, vi, end ? 'prev' : 'next');
  if (!ln) return;
  ktPopOpen(
    x,
    y,
    `<div style="font-weight:600;margin-bottom:4px">Linie ${i + 1} · Länge</div><div>${ktIn('ktPv', ln.len, `ktPopApply()`)} <button class="sm" onclick="ktPopApply()">OK</button></div><div style="margin:6px 0 2px;color:#667;font-size:11px">Es bewegt sich ${end ? 'das Ende B' : 'das Ende A'} (Punkt ${vi + 1}). <a href="#" onclick="ktPopSide();return false">andere Seite</a></div><div style="display:flex;gap:6px;margin-top:4px"><button class="sm" onclick="ktPopIns()">Punkt einfügen</button><button class="sm" onclick="ktPopClose()">Schließen</button></div>`,
    'ktPv',
  );
  S.ke = { i, end, x, y };
}
function ktPopApply() {
  const k = S.ke,
    el = document.getElementById('ktPv');
  if (!k || !el) return;
  const b = ktB();
  if (!b) return;
  const m = cfp(b).length,
    vi = k.end ? (k.i + 1) % m : k.i;
  ktLen(vi, k.end ? 'prev' : 'next', el.value);
  ktPopClose();
}
function ktPopSide() {
  const k = S.ke;
  if (k) ktEdgeOpen(k.i, k.end ? 0 : 1, k.x, k.y);
}
function ktPopIns() {
  const k = S.ke,
    b = ktB();
  if (!k || !b) return;
  const A = cfp(b),
    a = A[k.i],
    c = A[(k.i + 1) % A.length];
  ktPopClose();
  ktEdit((A) => {
    A.splice(k.i + 1, 0, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
  });
}
function ktVertOpen(vi, x, y) {
  const b = ktB();
  if (!b) return;
  const A = cfp(b),
    pl = ktLine(A, vi, 'prev'),
    nl = ktLine(A, vi, 'next');
  ktPopOpen(
    x,
    y,
    `<div style="font-weight:600;margin-bottom:4px">Punkt ${vi + 1} · Linienlängen</div>` +
      (pl
        ? `<div style="margin:3px 0">davor ${ktIn('ktPa', pl.len, `ktVApply(${vi},'prev','ktPa')`)}</div>`
        : '') +
      (nl
        ? `<div style="margin:3px 0">danach ${ktIn('ktPb', nl.len, `ktVApply(${vi},'next','ktPb')`)}</div>`
        : '') +
      `<div style="margin:6px 0 2px;color:#667;font-size:11px">Enter übernimmt. Die Linie verlängert sich zum Punkt hin.</div><button class="sm" onclick="ktPopClose()">Schließen</button>`,
    pl ? 'ktPa' : 'ktPb',
  );
  S.ke = { vi, x, y };
}
function ktVApply(vi, w, id) {
  const el = document.getElementById(id);
  if (!el) return;
  ktLen(vi, w, el.value);
  ktPopClose();
}
function ktEdgeAt(g, A) {
  let bi = -1,
    bd = 8 * mpp(),
    q = null;
  A.forEach((a, k) => {
    const o = proj(g, a, A[(k + 1) % A.length]);
    if (o.d < bd) {
      bd = o.d;
      bi = k;
      q = o;
    }
  });
  if (bi < 0) return null;
  const a = A[bi],
    c = A[(bi + 1) % A.length],
    end = Math.hypot(q.q[0] - c[0], q.q[1] - c[1]) < Math.hypot(q.q[0] - a[0], q.q[1] - a[1]) ? 1 : 0;
  return { i: bi, end, q: q.q };
}
// Klick auf Kante (ohne Ziehen): Eingabefenster statt Punkt einfügen; Klick auf Punkt: Fenster mit beiden Linienlängen
window.addEventListener(
  'pointerup',
  (e) => {
    try {
      if (!dr || dr.btn !== 0 || dr.m || dr.h || dr.f || dr.p || S.tool !== 'ed') return;
      const A = edv();
      if (!A || !isCt(A) || !ktB()) return;
      if (dr.v != null) {
        const vi = dr.v,
          x = e.clientX,
          y = e.clientY;
        setTimeout(() => ktVertOpen(vi, x, y), 30);
        return;
      }
      const g = ground(e);
      if (!g) return;
      const hit = ktEdgeAt(g, A);
      if (!hit) return;
      e.stopImmediatePropagation();
      dr = null;
      S.vi = null;
      ktEdgeOpen(hit.i, hit.end, e.clientX, e.clientY);
      try {
        drawOv();
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
// Doppelklick auf Kante: Punkt einfügen
cv.addEventListener('dblclick', (e) => {
  try {
    if (S.tool !== 'ed' || !ktB()) return;
    const A = edv();
    if (!A || !isCt(A)) return;
    const g = ground(e);
    if (!g || vhit(g, A) >= 0) return;
    const hit = ktEdgeAt(g, A);
    if (!hit) return;
    ktPopClose();
    ktEdit((A) => {
      A.splice(hit.i + 1, 0, hit.q);
    });
    S.vi = hit.i + 1;
    rr();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
});
// Fenster schließen: Klick im Plan, Werkzeugwechsel
cv.addEventListener('pointerdown', () => {
  if (document.getElementById('ktPop')) ktPopClose();
});
