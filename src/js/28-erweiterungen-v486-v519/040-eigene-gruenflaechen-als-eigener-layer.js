// ---- Eigene Grünflächen als eigener Layer (Fläche und Kontur getrennt schaltbar und einfärbbar)
LY.push(['Eigene Grünflächen', 'ugr', 1, 1], ['Eigene Grünflächen – Kontur', 'ugk', 1, 1]);
S.lc.ugr = '#96dc64';
S.lc.ugk = '#6fae45';
S.lc.stem = '#7a6742';
function uAreas(x, K, X) {
  for (const a of S.areas || []) {
    if (a.type === 'road' || !a.poly || a.poly.length < 3) continue;
    const t = AT[a.type] || AT.green,
      g = !AT[a.type] || a.type === 'green';
    let fillOn = true,
      lineOn = true,
      alpha = 1,
      col,
      lc;
    if (g) {
      const Lf = LY.find((l) => l[1] === 'ugr'),
        Lk = LY.find((l) => l[1] === 'ugk');
      fillOn = !Lf || !!Lf[2];
      lineOn = !Lk || !!Lk[2];
      alpha = Lf ? Lf[3] : 1;
      col = S.lc.ugr || '#96dc64';
      lc = S.lc.ugk || shade(col, 0.8);
    } else {
      const L = LY.find((l) => l[1] === t.l);
      if (L && !L[2]) continue;
      alpha = L ? L[3] : 1;
      col = uaCol(t.c(), a.type);
      lc = shade(col, 0.9);
    }
    x.beginPath();
    a.poly.forEach(([p, q], i) => (i ? x.lineTo(X(p), X(q)) : x.moveTo(X(p), X(q))));
    x.closePath();
    if (fillOn) {
      x.globalAlpha = alpha;
      x.fillStyle = col;
      x.fill();
    }
    if (lineOn) {
      x.globalAlpha = g ? (LY.find((l) => l[1] === 'ugk') || [0, 0, 0, 1])[3] : alpha;
      x.strokeStyle = lc;
      x.lineWidth = 1.4 * PS;
      x.lineJoin = 'round';
      x.stroke();
    }
  }
  x.globalAlpha = 1;
}
{
  const _l = lcol;
  lcol = function (k, v) {
    if (k === 'stem') {
      S.lc.stem = v;
      clearTimeout(window._stT);
      window._stT = setTimeout(() => stemApply(), 80);
      return;
    }
    if (k === 'ugr' || k === 'ugk') {
      S.lc[k] = v;
      clearTimeout(window._ugT);
      window._ugT = setTimeout(() => {
        try {
          recomp();
          rr();
        } catch (e) {
          logErr(e, 'lcol>anonym');
        }
      }, 100);
      return;
    }
    return _l.apply(this, arguments);
  };
}
{
  const _v = lvis;
  lvis = function (i, v) {
    const r = _v.apply(this, arguments);
    try {
      const k = LY[i] && LY[i][1];
      if (k === 'ugr' || k === 'ugk') {
        recomp();
        rr();
      }
    } catch (e) {
      logErr(e, 'lvis');
    }
    return r;
  };
}

/* v512: Layer-Nachlauf – jede Stelle, die gespeicherte Layer-Zustände anwendet (Projekt, Ansicht, Darstellung, Admin-Standard), ruft danach alle Eintraege in LYAFTER auf.
   Regel für neue Layer: LY.push([...]) + S.lc.<key> als Standardfarbe + (falls nicht in G[key]) Anzeige-Funktion in LYAFTER eintragen. Gespeichert wird dann automatisch (vwDs, lyMSnap, projExtra lesen LY und S.lc generisch). */
const LYAFTER = [];
function lyAfterRun() {
  for (const f of LYAFTER) {
    try {
      f();
    } catch (e) {
      console.warn('LYAFTER', e);
    }
  }
}
{
  const after = (f) =>
    function () {
      const r = f.apply(this, arguments);
      try {
        lyAfterRun();
      } catch (e) {
        logErr(e, 'after>anonym');
      }
      return r;
    };
  vwApplyDs = after(vwApplyDs);
  lyMApply = after(lyMApply);
  projApplySet = after(projApplySet);
  admApply = after(admApply);
}
LYAFTER.push(() => {
  recomp();
  rr();
});

/* v512: Stammfarbe der Bäume (S.lc.stem) – wirkt auf Schalen-Stämme, eigene Bäume, Vorschau; im Layer-Panel unter „Bäume“ und im Baum-Fenster */
const STM = { c: null };
function stemApply() {
  const c = S.lc.stem || '#7a6742';
  if (STM.c === c) return;
  STM.c = c;
  try {
    if (GEO.trees && GEO.trees.length) treesBuild(GEO.trees);
    else if (UT.length) trRebuild();
  } catch (e) {
    console.warn('stem', e);
  }
  try {
    trGhost();
  } catch (e) {
    logErr(e, 'stemApply');
  }
  try {
    const i = $('trImg');
    if (i) i.innerHTML = trSvg();
    const p = $('tr_stem');
    if (p) p.value = c;
  } catch (e) {
    logErr(e, 'stemApply');
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'stemApply');
  }
}
STM.c = S.lc.stem;
LYAFTER.push(() => stemApply());
{
  const _lh = layersHtml;
  layersHtml = function () {
    let h = _lh.apply(this, arguments);
    try {
      const i = LY.findIndex((l) => l[1] === 'trees');
      if (i < 0) return h;
      const m = `onchange="lvis(${i},this.checked)"`,
        ix = h.indexOf(m);
      if (ix < 0) return h;
      const re = h.indexOf('</div>', ix) + 6;
      const row = `<div class="ly" style="padding-left:22px"><label>Stammfarbe</label><input type="color" value="${S.lc.stem || '#7a6742'}" oninput="lcol('stem',this.value)" title="Farbe der Baumstämme" style="width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"></div>`;
      h = h.slice(0, re) + row + h.slice(re);
    } catch (e) {
      console.error(e);
    }
    return h;
  };
}
/* v501: gespeicherte Darstellungen stellen auch Bahngleise, eigene Gruenflaechen (Flaeche/Kontur) samt Farben wieder her */
{
  const _a = vwApplyDs;
  vwApplyDs = function (d) {
    const r = _a.apply(this, arguments);
    try {
      if (d && d.ly) {
        ['rail', 'ugr', 'ugk'].forEach((k) => {
          const s = d.ly.find((x) => x[0] === k),
            L = LY.find((l) => l[1] === k);
          if (s && L) {
            L[2] = s[1];
            L[3] = s[2];
          }
        });
      }
      if (d && d.lc) {
        ['ugr', 'ugk', 'rail', 'trees'].forEach((k) => {
          if (d.lc[k]) S.lc[k] = d.lc[k];
        });
      }
      recomp();
      rr();
      if ($('lyp') && $('lyp').style.display === 'block') lyRender();
    } catch (e) {
      logErr(e, 'vwApplyDs');
    }
    return r;
  };
}

/* v502: Baeume (Kontextdaten) mittig auf Bahngleisen sind meist Zuege -> beim Laden entfernen */
function railTrees() {
  const rl = (GEO.acc && GEO.acc.line && GEO.acc.line.rail) || [];
  if (!rl.length || !GEO.trees) return [];
  return GEO.trees.filter((t) => {
    if (t.u) return false;
    for (const r of rl) {
      const l = r.l,
        m = (r.w || 3.4) / 2 + 0.4;
      for (let i = 0; i < l.length - 1; i++) {
        const ax = l[i][0],
          az = l[i][1],
          bx = l[i + 1][0],
          bz = l[i + 1][1],
          dx = bx - ax,
          dz = bz - az,
          L = dx * dx + dz * dz;
        let u = L ? ((t.x - ax) * dx + (t.z - az) * dz) / L : 0;
        u = Math.max(0, Math.min(1, u));
        if (Math.hypot(t.x - ax - u * dx, t.z - az - u * dz) < m) return true;
      }
    }
    return false;
  });
}
{
  const _p = treePrune;
  treePrune = function () {
    let n = _p.apply(this, arguments);
    try {
      const rm = railTrees();
      if (rm.length) {
        GEO.tdel = (GEO.tdel || []).concat(rm);
        treesBuild(GEO.trees.filter((t) => !rm.includes(t)));
        n += rm.length;
        GEO.railDel = rm.length;
      }
    } catch (e) {
      console.warn('railTrees', e);
    }
    return n;
  };
}

/* v481: nativen Browser-Kontextmenue global unterdruecken (ausser in Eingabefeldern) */
document.addEventListener(
  'contextmenu',
  (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable=true]')) return;
    e.preventDefault();
  },
  true,
);

/* v482: keine Hover-Info (Flurstueck/Gebaeude) innerhalb des Grundstuecks */
{
  const _pp = pickPar,
    _hx = hvExtra;
  const inSite = (g) => {
    try {
      return P.some((q) => q.site && q.poly && q.poly.length > 2 && inP(g, q.poly));
    } catch (_) {
      return false;
    }
  };
  pickPar = function (g) {
    return inSite(g) ? -1 : _pp.apply(this, arguments);
  };
  hvExtra = function (g) {
    return inSite(g) ? '' : _hx.apply(this, arguments);
  };
}
