// ---- Zeichnen: Kanten bleiben stehen
function sksOn() {
  return false;
} // v485: Umriss direkt zum Koerper (kein Flaechen-Zwischenschritt); Skizzenebene fuer Gebaeude-Konturen deaktiviert
function sksAdd(list, c) {
  if (!list.length) return 0;
  const f0 = sksFacesNow().length;
  hist();
  SKS.e = sksNorm(SKS.e.concat(list.map((s) => ({ a: s.a.slice(), b: s.b.slice(), c: c || 0 }))));
  SKS.fc = null;
  sksChanged();
  return sksFacesNow().length - f0;
}
function sksFinish(pts) {
  if (!sksOn() || S.shape === 'free') return false;
  const L = [];
  pts.forEach((p, i) => L.push({ a: p, b: pts[(i + 1) % pts.length] }));
  const d = sksAdd(L, ++SKS.cv);
  S.anchor = null;
  S.prev = null;
  S.edge = null;
  S.hs = '';
  S.refH = null;
  S.snp = null;
  drawOv();
  rr();
  szMsg(
    d > 0
      ? 'Fläche geschlossen · P = Ziehen & Schieben zum Gebäude'
      : 'Form gezeichnet · weiter zeichnen oder P = Ziehen & Schieben',
  );
  return true;
}
function sksPush(q) {
  if (!sksOn() || S.shape !== 'free') return;
  const D = S.draft;
  if (D.length === 1) {
    szMsg('Linie · nächsten Punkt klicken oder Länge tippen + Enter · Doppelklick/Esc = beenden');
    return;
  }
  if (D.length < 2) return;
  const d = sksAdd([{ a: D.at(-2), b: q }], 0);
  const first = D[0],
    close = Math.hypot(first[0] - q[0], first[1] - q[1]) < 0.05;
  if (d > 0 || close) {
    S.draft = [];
    S.anchor = null;
    S.snp = null;
    S.refH = null;
    szMsg(d > 0 ? 'Fläche geschlossen · P = Ziehen & Schieben zum Gebäude' : 'Linienzug beendet');
  } else szMsg('Linie · weiterzeichnen, Länge tippen + Enter · Doppelklick/Esc = beenden');
}
function sksEnd() {
  S.draft = [];
  S.anchor = null;
  S.snp = null;
  S.refH = null;
  drawOv();
  rr();
}
// close(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
cv.addEventListener(
  'dblclick',
  (e) => {
    if (sksOn() && S.shape === 'free' && S.draft.length) {
      e.stopImmediatePropagation();
      sksEnd();
    }
  },
  true,
);
// snap(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// ---- Auswahl, Teilen, Löschen, Ziehen & Schieben auf der Skizze
function sksEntAt(e) {
  try {
    return skHit(e);
  } catch (_) {
    return null;
  }
}
function sksDelete() {
  if (!SKS.sel.length) return false;
  const fs = sksFacesNow(),
    kill = new Set(),
    keep = new Set();
  SKS.sel.forEach((s) => {
    if (s.k === 'e') kill.add(s.i);
    else if (s.k === 'f' && fs[s.f]) fs[s.f].es.forEach((i) => kill.add(i));
  });
  fs.forEach((F, i) => {
    if (SKS.sel.some((s) => s.k === 'f' && s.f === i)) return;
    F.ea.forEach((k) => keep.add(k));
  });
  SKS.sel.forEach((s) => {
    if (s.k === 'e') keep.delete(s.i);
  });
  const del = [...kill].filter((i) => !keep.has(i) || SKS.sel.some((s) => s.k === 'e' && s.i === i));
  if (!del.length) {
    szMsg('Die Kanten gehören noch zu einer Nachbarfläche');
    return true;
  }
  hist();
  SKS.e = SKS.e.filter((_, i) => !del.includes(i));
  SKS.sel = [];
  sksChanged();
  szMsg(del.length + ' Kante' + (del.length === 1 ? '' : 'n') + ' gelöscht');
  return true;
}
function sksSplitAt(h, e) {
  const s = SKS.e[h.i];
  if (!s) return;
  let q = snap(h.p, e, null, []).p;
  const dx = s.b[0] - s.a[0],
    dz = s.b[1] - s.a[1],
    L2 = dx * dx + dz * dz;
  let t = ((q[0] - s.a[0]) * dx + (q[1] - s.a[1]) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  if (t < 0.01 || t > 0.99) {
    szMsg('Teilen nicht am Endpunkt');
    return;
  }
  const m = [s.a[0] + dx * t, s.a[1] + dz * t];
  hist();
  SKS.e.splice(h.i, 1, { a: s.a, b: m, c: s.c }, { a: m, b: s.b, c: s.c });
  SKS.e = sksNorm(SKS.e);
  sksChanged();
  szMsg('Kante geteilt · Teile lassen sich einzeln wählen und löschen');
}
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    const t = SK.tool;
    if (
      !GE.d &&
      !SZ.d &&
      !SZ.op &&
      !OFS.d &&
      SKS.e.length &&
      (t === 's' || t === 'l' || t === 'p') &&
      !sksEntAt(e)
    ) {
      const h = sksHit(e);
      if (t === 's') {
        if (h) {
          const same = (a, b) => a.k === b.k && (a.k === 'e' ? a.i === b.i : a.f === b.f);
          const i = SKS.sel.findIndex((x) => same(x, h));
          if (e.shiftKey) {
            if (i >= 0) SKS.sel.splice(i, 1);
            else SKS.sel.push({ k: h.k, i: h.i, f: h.f });
          } else SKS.sel = [{ k: h.k, i: h.i, f: h.f }];
          sksRedraw();
          if (h.k === 'f' && !e.shiftKey && typeof skCm === 'function') {
            skCm('make');
            return true;
          }
          szMsg((h.k === 'f' ? 'Fläche' : 'Kante') + ' gewählt · Entf = löschen · Umschalt = mehrere');
          return true;
        } else if (SKS.sel.length) {
          SKS.sel = [];
          sksRedraw();
        }
      }
      if (t === 'l' && h && h.k === 'e') {
        sksSplitAt(h, e);
        return true;
      }
      if (t === 'p' && h && h.k === 'f') {
        const F = sksFacesNow()[h.f];
        S.draft = F.o.map((q) => q.slice());
        S.closed = true;
        S.dk = 'free';
        S.refH = gh(F.o[0][0], F.o[0][1]);
        SKS.pend = F;
        if (gdExDown(e)) return true;
        S.draft = [];
        S.closed = false;
        SKS.pend = null;
      }
    }
    return _d(e);
  };
}
// gdExCommit(): Erweiterung zusammengeführt, siehe 27-skizze/010-grundflaechen-zeichnen-nach-dem-vorbild.js
function sksConsume(F) {
  const b = S.bld.at(-1);
  if (!b) return;
  if (F.h.length) {
    b.voids = b.voids || [];
    F.h.forEach((r) => b.voids.push({ poly: r.map((q) => q.slice()), j0: 0, j1: b.levels.length - 1 }));
    try {
      mesh(b);
      H();
      drawOv();
      rr();
    } catch (x) {
      console.warn(x);
    }
  }
  const all = sksFaces(SKS.e),
    sF = sksSig(F.o),
    holes = new Set(F.h.map(sksSig)),
    gone = new Set([sF, ...holes]);
  const keep = new Set();
  all.forEach((G) => {
    if (!gone.has(sksSig(G.o))) G.ea.forEach((k) => keep.add(k));
  });
  const del = new Set();
  all.forEach((G) => {
    if (gone.has(sksSig(G.o)))
      G.es.forEach((k) => {
        if (!keep.has(k)) del.add(k);
      });
  });
  SKS.e = SKS.e.filter((_, i) => !del.has(i));
  SKS.hide = SKS.hide.concat([...gone]);
  SKS.sel = [];
  SKS.fc = null;
  sksChanged();
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (GE.d) {
      SKS.pend = null;
      S.draft = [];
      S.closed = false;
    }
    return _e();
  };
}
addEventListener(
  'keydown',
  (e) => {
    try {
      if (!SKS.sel.length) return;
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === 'Delete' || (e.key === 'Backspace' && !GV.buf && !SK.vcb)) {
        if (sksDelete()) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      }
    } catch (x) {
      console.warn(x);
    }
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (!SKS.e.length || e.buttons) return;
      if (!(SK.tool === 's' || SK.tool === 'l' || SK.tool === 'p') || GE.d) return;
      if (e.target !== cv) return;
      const h = sksEntAt(e) ? null : sksHit(e);
      const a = SKS.hv,
        k = (x) => (x ? x.k + (x.k === 'e' ? x.i : x.f) : '');
      if (k(a) !== k(h)) {
        SKS.hv = h;
        sksRedraw();
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
// skUse(): Erweiterung zusammengeführt, siehe 26-modellier-modus/120-modellier.js
