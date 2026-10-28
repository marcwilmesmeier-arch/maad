/* v399 Gebäudeklasse (MBO §2 Abs. 3): aus Höhe (Fußbodenoberkante des höchsten Geschosses mit Aufenthaltsraum über mittlerem Gelände), Nutzungseinheiten (Anzahl, Größe) und Freistand.
   Fehlen definierte Nutzungseinheiten, wird je Geschoss eine Einheit angenommen (Annahme wird im Fenster ausgewiesen). Sonderbau-Prüfung nur Hochhausgrenze (Fußboden > 22 m). Abstand für „freistehend“ in S.lim.gka (m). */
const gkP = () => ({ a: S.lim.gka >= 0 && S.lim.gka != null ? S.lim.gka : 5 });
function gkDist(A, B) {
  let m = 1e9;
  const sd = (p, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = dx * dx + dz * dz || 1e-12;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
  };
  A.forEach((p, i) => {
    B.forEach((q, j) => {
      const q2 = B[(j + 1) % B.length];
      m = Math.min(m, sd(p, q, q2));
    });
  });
  B.forEach((p, i) => {
    A.forEach((q, j) => {
      const q2 = A[(j + 1) % A.length];
      m = Math.min(m, sd(p, q, q2));
    });
  });
  return m;
}
function gkInfo(b) {
  if (!b || !b.levels || !b.levels.length) return null;
  const P = gkP(),
    I = vgInfo(b);
  let tm = 0;
  try {
    tm = b.fp.reduce((s, q) => s + gh(q[0], q[1]), 0) / b.fp.length - base(b);
  } catch (e) {
    logErr(e, 'gkInfo');
  }
  const ugH = b.levels.reduce((t, l) => t + (l.ug ? l.h : 0), 0),
    top = b.levels.reduce((t, l) => t + l.h, 0) - ugH,
    last = b.levels[b.levels.length - 1],
    roofH = b._roofH || 0,
    dg = I.dach && roofH + (+(b.roof || {}).dremp || 0) >= 2.3;
  const fl = dg ? top : top - last.h,
    H = fl - tm;
  let nu = 0,
    big = 0,
    asum = 0,
    def = false;
  try {
    if (b.ub) {
      grData(b).forEach((g) =>
        g.faces.forEach((f) => {
          if (!f.un) return;
          def = true;
          nu++;
          big = Math.max(big, f.a);
          asum += f.a;
        }),
      );
    }
  } catch (e) {
    logErr(e, 'gkInfo');
  }
  if (!def) {
    const L = bLv(b).filter((r) => !r.ug);
    nu = Math.max(1, L.length);
    big = Math.max(0, ...L.map((r) => r.a));
    asum = L.reduce((s, r) => s + r.a, 0);
  }
  let dmin = 1e9;
  S.bld.forEach((o) => {
    if (o === b || !o.fp) return;
    dmin = Math.min(dmin, gkDist(b.fp, o.fp));
  });
  const free = dmin >= P.a;
  let k, why;
  const sum = asum;
  if (H > 22) {
    k = 5;
    why = 'Fußboden des höchsten Geschosses mehr als 22 m über Gelände: Hochhaus, Sonderbau (mind. GK 5)';
  } else if (H <= 7 && nu <= 2 && sum <= 400 && free) {
    k = 1;
    why = 'Höhe ≤ 7 m, höchstens 2 Nutzungseinheiten mit zusammen ≤ 400 m², freistehend';
  } else if (H <= 7 && nu <= 2 && sum <= 400) {
    k = 2;
    why = 'Höhe ≤ 7 m, höchstens 2 Nutzungseinheiten mit zusammen ≤ 400 m², nicht freistehend';
  } else if (H <= 7) {
    k = 3;
    why = 'Höhe ≤ 7 m, mehr als 2 Nutzungseinheiten oder mehr als 400 m²';
  } else if (H <= 13 && big <= 400) {
    k = 4;
    why = 'Höhe ≤ 13 m, Nutzungseinheiten jeweils ≤ 400 m²';
  } else {
    k = 5;
    why = H > 13 ? 'Höhe über 13 m' : 'Nutzungseinheit größer als 400 m²';
  }
  return {
    k,
    why,
    H,
    nu,
    big,
    sum,
    def,
    dmin,
    free,
    dg,
    P,
    tm,
    use: (typeof zoUses === 'function' ? zoUses(b) : []).join(' / '),
  };
}
function gkHtml(b) {
  const g = gkInfo(b);
  if (!g) return '';
  return `<div class="r ind"><span title="Gebäudeklasse nach Musterbauordnung (MBO §2): aus Höhe, Nutzungseinheiten und Freistand">Gebäudeklasse</span><b>GK ${g.k}</b><button class="vgb" title="Berechnungsregeln und Ergebnis der Gebäudeklasse" aria-label="Regeln" onclick="gkOpen('${esc(b.id)}')">⚙</button></div>`;
}
const GKW = { id: null };
function gkOpen(id) {
  GKW.id = id;
  let e = document.getElementById('gkW');
  if (!e) {
    e = document.createElement('div');
    e.id = 'gkW';
    e.className = 'fl';
    e.style.cssText =
      'position:fixed;left:312px;top:150px;width:340px;max-height:74vh;overflow:auto;padding:12px 14px;z-index:40;font-size:12.5px;line-height:1.35';
    document.body.appendChild(e);
  }
  e.style.display = 'block';
  gkRender();
}
function gkClose() {
  GKW.id = null;
  const e = document.getElementById('gkW');
  if (e) e.style.display = 'none';
}
function gkSet(v) {
  v = parseFloat(String(v).replace(',', '.'));
  S.lim.gka = isFinite(v) && v >= 0 ? v : null;
  try {
    rr();
  } catch (e) {
    logErr(e, 'gkSet');
  }
  try {
    zoRender();
  } catch (e) {
    logErr(e, 'gkSet');
  }
  gkRender();
}
function gkRender() {
  const e = document.getElementById('gkW');
  if (!e || !GKW.id) return;
  const b = S.bld.find((x) => x.id === GKW.id);
  if (!b) {
    gkClose();
    return;
  }
  const g = gkInfo(b);
  if (!g) {
    gkClose();
    return;
  }
  const T = [
    [1, 'Freistehend, Höhe ≤ 7 m, höchstens 2 Nutzungseinheiten, zusammen ≤ 400 m²'],
    [2, 'Nicht freistehend, Höhe ≤ 7 m, höchstens 2 Nutzungseinheiten, zusammen ≤ 400 m²'],
    [3, 'Sonstige Gebäude mit Höhe ≤ 7 m'],
    [4, 'Höhe ≤ 13 m, Nutzungseinheiten jeweils ≤ 400 m²'],
    [5, 'Sonstige Gebäude (höher als 13 m oder größere Nutzungseinheiten, auch unterirdische)'],
  ];
  const kv = (a, v, t) => `<div class="gkr"><span${t ? ` title="${t}"` : ''}>${a}</span><b>${v}</b></div>`,
    f = (v, d) => f1(v, d);
  e.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><b style="flex:1">Gebäudeklasse · ${esc(b.name || b.id)}</b><button class="sm" onclick="gkClose()">✕</button></div>
 <div class="gkk">GK ${g.k}</div><div class="mu" style="margin-bottom:8px">${esc(g.why)}</div>
 <div class="bd" style="margin-top:6px">Eingangswerte</div>
 ${kv('Nutzung', esc(g.use || '–'), 'aus den Geschossnutzungen')}${kv('Höhe (Fußboden oberstes Aufenthaltsgeschoss über Gelände)', f(g.H, 2) + ' m', 'Fußbodenoberkante des höchsten Geschosses mit möglichem Aufenthaltsraum, im Mittel über der Geländeoberfläche' + (g.dg ? ' (Dachgeschoss mitgerechnet)' : ''))}
 ${kv('Nutzungseinheiten', g.nu + (g.def ? '' : ' (Annahme: 1 je Geschoss)'))}${kv('größte Einheit', f(g.big, 0) + ' m²')}${kv('Summe Einheiten', f(g.sum, 0) + ' m²')}
 ${kv('Abstand zum nächsten Gebäude', g.dmin > 1e8 ? '–' : f(g.dmin, 1) + ' m')}<label class="gkr"><span>freistehend ab Abstand (m)</span><input type="number" min="0" step="0.5" value="${g.P.a}" onchange="gkSet(this.value)" style="width:64px;font:inherit;padding:2px 4px"></label>${kv('freistehend', g.free ? 'ja' : 'nein')}
 <div class="bd" style="margin-top:10px">Regel (MBO § 2 Abs. 3)</div>${T.map(([k, t]) => `<div class="gkt${k === g.k ? ' on' : ''}"><b>GK ${k}</b> ${t}</div>`).join('')}
 <div class="mu" style="margin-top:8px">Nicht geprüft: Sonderbauten nach Nutzung (z. B. Versammlung, Beherbergung), landesrechtliche Abweichungen. Höhe &gt; 22 m = Hochhaus. Ohne definierte Nutzungseinheiten wird je Geschoss eine Einheit angenommen.</div>`;
}
setInterval(() => {
  try {
    if (
      GKW.id &&
      !(document.activeElement && document.getElementById('gkW').contains(document.activeElement))
    )
      gkRender();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 1200);
{
  const c = document.createElement('style');
  c.textContent = `#gkW .bd,#vgW .bd{font-weight:600;font-size:13px;margin:12px 0 4px;padding-top:10px;border-top:1px solid rgba(128,128,128,.25)}#gkW .gkk{font-size:26px;font-weight:600;margin:8px 0 2px}#gkW .gkr{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0;font-size:12px}#gkW .gkr span{flex:1;min-width:0}#gkW .gkt{padding:4px 6px;border-radius:6px;margin-top:3px;font-size:12px;color:var(--mu,#777)}#gkW .gkt.on{background:var(--zh,#e9f1f9);color:inherit}`;
  document.head.appendChild(c);
}
