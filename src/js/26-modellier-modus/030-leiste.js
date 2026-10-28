// ---- Leiste
function skTool(t) {
  // ── Erweiterung aus 27-skizze/040-skizzenmodus.js
  sofReset();
  SOF.re = null;
  // ── Erweiterung aus 26-modellier-modus/130-versatz.js
  ofReset();
  OFS.re = null;
  // ── Erweiterung aus 26-modellier-modus/120-modellier.js
  SK.cp = false;
  // ── Erweiterung aus 26-modellier-modus/100-verschieben-kopieren-von-gezeichneten-flaechen.js
  szReset();
  SK.tool = t;
  if (typeof SKLN !== 'undefined') SKLN.visible = false;
  SK.lh = null;
  if (SK.opEsc) SK.opEsc();
  skBar();
  try {
    $('hud').textContent = '' + (SKT.find((x) => x[0] === t) || ['', '', ''])[1];
  } catch (e) {
    logErr(e, 'skTool');
  }
  // ── Erweiterung aus 26-modellier-modus/050-stufe-4.js (danach)
  try {
    skIfOff();
  } catch (e) {
    logErr(e, 'skTool');
  }

  // ── Erweiterung aus 26-modellier-modus/120-modellier.js (danach)
  try {
    skBaSync();
  } catch (e) {
    logErr(e, 'skTool');
  }
}
function skToggle() {
  SK.on = !SK.on;
  try {
    localStorage.setItem('maad.sk', SK.on ? '1' : '0');
  } catch (e) {
    logErr(e, 'skToggle');
  }
  if (!SK.on) {
    SK.sel = [];
    SK.hv = null;
    SK.ver++;
    if (SK.opEsc) SK.opEsc();
  }
  skBar();
  try {
    $('hud').textContent = SK.on
      ? 'Auswahl (Klick · Doppelklick · Dreifachklick · Shift/Strg · Shift+Ziehen = Fenster)'
      : 'Auswahl aus';
  } catch (e) {
    logErr(e, 'skToggle');
  }
  rr();
}
function skBar() {
  let d = document.getElementById('skbar');
  if (!d) {
    d = document.createElement('div');
    d.id = 'skbar';
    d.className = 'fl';
    d.style.cssText =
      'position:absolute;left:12px;top:56px;z-index:6;padding:4px 6px;display:none;gap:4px;align-items:center;font-size:11px;flex-wrap:wrap;max-width:min(92%,420px)';
    mid.appendChild(d);
  }
  const show = false;
  d.style.display = show ? 'flex' : 'none';
  if (!show) return;
  const sg = SK.on + '|' + SK.tool + '|' + SKT.length;
  if (d.dataset.sg === sg) return;
  d.dataset.sg = sg;
  const bt = (on, t, tt, fn) =>
    `<button class="tb${on ? ' on' : ''}" title="${tt}" onclick="${fn}" style="font-size:11px;padding:4px 8px">${t}</button>`;
  d.innerHTML =
    bt(SK.on, 'Modellieren', 'Modellieren ein/aus', 'skToggle()') +
    (SK.on
      ? SKT.map((x) =>
          bt(
            SK.tool === x[0],
            x[1] + ' <small style="opacity:.6">' + x[2] + '</small>',
            x[1],
            `skTool('${x[0]}')`,
          ),
        ).join('') + '<span id="skvcb"></span>'
      : '');
  try {
    skVcbShow();
  } catch (e) {
    logErr(e, 'skBar');
  }
}

// ================= Stufe 2: Ziehen & Schieben (P) + Messwerte-Box =================
// Fläche anklicken und ziehen (oder klicken – bewegen – klicken); Zahl + Enter = exakter Wert; Doppelklick auf andere Fläche = letzten Wert wiederholen; Esc = abbrechen.
// Ohne Auswahl wirkt Ziehen & Schieben auf die ganze Fläche (alle Geschosse in einer Flucht), Alt = nur dieses Geschoss; mit Auswahl auf die gewählten Flächen.
SK.vcb = '';
SK.lastD = null;
function skArea(f) {
  let A = 0;
  for (let q = 0; q < f.length; q++) {
    const p = f[q],
      r = f[(q + 1) % f.length];
    A += p[0] * r[1] - r[0] * p[1];
  }
  return A / 2;
}
function skVcbShow() {
  const s = document.getElementById('skvcb');
  if (!s) return;
  s.innerHTML =
    SK.op ||
    (typeof SZ !== 'undefined' && SZ.d) ||
    (typeof OFS !== 'undefined' && (OFS.d || OFS.re)) ||
    SK.tool === 'l' ||
    (SK.sel.length && SK.tool !== 's')
      ? '<input id="skvi" readonly value="' +
        (SK.vcb || '') +
        '" placeholder="Wert in m" style="width:84px;font-size:11px;padding:3px 5px;border:1px solid var(--ln);border-radius:6px;background:var(--bg);color:var(--tx)">'
      : '';
}
function skTargets(en, e) {
  // Ziele eines Ziehen & Schieben-Vorgangs
  if (en.top) {
    const tops = SK.sel.filter((x) => x.top && skHas(en));
    return tops.length ? tops : [en];
  }
  let l;
  if (SK.sel.length && skHas(en)) l = SK.sel.filter((x) => !x.top);
  else l = e && e.altKey ? [en] : skGroup(en);
  return l;
}
function skOpStart(en, e) {
  const tg = skTargets(en, e),
    b = en.b;
  const op = {
    top: !!en.top,
    en,
    b,
    tg: tg.filter((x) => x.b === b),
    all: tg,
    d: 0,
    mv: 0,
    armed: false,
    x: e.clientX,
    y: e.clientY,
    orig: {},
    h0: {},
  };
  op.tg.forEach((x) => {
    const k = x.j;
    if (en.top) {
      op.h0[k] = b.levels[k].h;
    } else if (!op.orig[k]) op.orig[k] = lf(b, b.levels[k]).map((q) => q.slice());
  });
  if (!op.top) {
    op.js = Object.keys(op.orig).map(Number);
    op.n = skN(b, en.j, en.i);
    op.bfpOK =
      op.js.length === b.levels.length &&
      b.levels.every((l) => JSON.stringify(lf(b, l)) === JSON.stringify(b.fp));
    const z0 = skZ(b, en.j);
    op.wy = z0 + b.levels[en.j].h / 2;
    op.p0 = planePt(e, op.wy);
    op.cand = wallCand(b, en.j, en.i, op.n, op.js);
    op.cand.push(0);
    op.ents = op.tg.filter((x) => x.i != null).map((x) => ({ j: x.j, i: x.i, n: skN(b, x.j, x.i) }));
  }
  if (op.top) {
    const last = b.levels.length - 1;
    op.storeys = en.j === last && !(e && e.altKey) && (!SK.sel.length || skWhole(b) || !skHas(en));
    op.lv0 = b.levels.slice();
    op.v0 = JSON.stringify(b.voids || []);
    op.pat0 = (b.patches || []).slice();
    op.nl0 = b.levels.length;
    op.hT = b.levels[last].h;
    op.wy = skZ(b, last) + op.hT;
    if (op.storeys) {
      op.x = e.clientX;
      op.y = e.clientY;
    }
  }
  hist();
  S.sel = b;
  op.hl = JSON.stringify(S.hist.length);
  SK.op = op;
  SK.hv = null;
  SK.ver++;
  return op;
}
function skOpApply(op, d) {
  const b = op.b;
  if (op.top && op.storeys) {
    const ug = ugN(b),
      n = Math.max(-(op.nl0 - ug - 1), Math.min(40 - op.nl0, Math.round(d / op.hT)));
    let arr = op.lv0.slice();
    if (n > 0) {
      const src = op.lv0[op.nl0 - 1];
      for (let q = 0; q < n; q++) {
        const c = JSON.parse(JSON.stringify(src));
        delete c.name;
        arr.push(c);
      }
    } else if (n < 0) arr.length = op.nl0 + n;
    b.levels = arr;
    b.patches = op.pat0.filter((q) => q.k == null || q.k < arr.length);
    {
      const nl = arr.length,
        vs = JSON.parse(op.v0);
      vs.forEach((v) => {
        if (v.j1 >= op.nl0 - 1) v.j1 = nl - 1;
      });
      b.voids = vs.filter((v) => v.j0 < nl);
    }
    op.n = n;
    op.d = n * op.hT;
    mesh(b);
    H();
    hpos();
    return true;
  }
  if (op.top) {
    const nh = {};
    for (const k in op.h0) nh[k] = Math.min(12, Math.max(0.5, Math.round((op.h0[k] + d) * 100) / 100));
    for (const k in nh) b.levels[k].h = nh[k];
    op.d = d;
    mesh(b);
    H();
    hpos();
    return true;
  }
  const res = {};
  for (const k of op.js) {
    const o = op.orig[k],
      m = o.length,
      r = o.map((q) => q.slice());
    op.ents
      .filter((x) => x.j == k) // == bewusst: k ist Objektschlüssel (Text), x.j eine Zahl
      .forEach((x) => {
        const q = offEdge(o, x.i, x.n, d);
        r[x.i] = q[x.i];
        r[(x.i + 1) % m] = q[(x.i + 1) % m];
      });
    const a0 = skArea(o),
      a1 = skArea(r);
    if (a0 * a1 <= 0 || Math.abs(a1) < 1 || r.some((q) => !isFinite(q[0]) || !isFinite(q[1]))) return false;
    if ((b.voids || []).some((v) => k >= v.j0 && k <= v.j1 && !znInterior(r, v.poly))) return false;
    res[k] = r;
  }
  for (const k of op.js) b.levels[k].fp = res[k];
  if (op.bfpOK) b.fp = res[op.js[0]].map((q) => q.slice());
  if (d && b.kind === 'circ') b.kind = 'free';
  op.d = d;
  mesh(b);
  H();
  hpos();
  if (op.bfpOK) drawOv();
  return true;
}
function skOpRaw(op, e) {
  // Mausposition -> Abstand (m)
  if (op.top && op.storeys) {
    return (-(e.clientY - op.y) / 18) * op.hT;
  }
  if (op.top) {
    return -(e.clientY - op.y) * mpp() * 1.1;
  }
  const p = planePt(e, op.wy);
  if (!p || !op.p0) return null;
  return (p[0] - op.p0[0]) * op.n[0] + (p[1] - op.p0[1]) * op.n[1];
}
function skOpMouse(e) {
  // ── Erweiterung aus 26-modellier-modus/050-stufe-4.js
  // Ziehen & Schieben: Fang auf parallele Wand/Ausgangsposition
  (() => {
    const op = SK.op,
      raw = skOpRaw(op, e);
    if (raw == null) return;
    let d,
      sn = 0;
    if (op.top) d = Math.round(raw * 20) / 20;
    else {
      const r =
        e.altKey && 0
          ? [Math.round(raw * 20) / 20, 0]
          : pullH(raw, op.cand, Math.min(0.6, Math.max(0.12, 9 * mpp())));
      d = r[0];
      sn = r[1];
    }
    op.sn = sn;
    if (skOpApply(op, d)) {
      op.last = d;
    }
    if (op.top && op.storeys) {
      $('hud').textContent =
        (op.n >= 0 ? '+' : '') +
        op.n +
        ' Geschoss' +
        (Math.abs(op.n) === 1 ? '' : 'e') +
        ' (' +
        (op.n >= 0 ? '+' : '') +
        f1(op.n * op.hT, 2).replace('.', ',') +
        ' m) · oberstes Geschoss wird kopiert · Alt = stufenlose Höhe · Zahl + Enter = Meter, Zahl + g = Geschosse · Esc';
      return;
    }
    $('hud').textContent =
      'Ziehen & Schieben ' +
      (op.d >= 0 ? '+' : '') +
      f1(op.d, 2).replace('.', ',') +
      ' m' +
      (sn ? (sn === 2 ? ' · Fang: Ausgangsposition' : ' · Fang: parallele Wand/Grenze') : '') +
      (op.top ? ' · Geschosshöhe' : op.tg.length > 1 ? ' · ' + op.tg.length + ' Geschossflächen' : '') +
      ' · Zahl + Enter = exakt · Esc = abbrechen';
  })();
  try {
    const op = SK.op;
    if (!op) {
      return;
    }
    if (op.top || !op.sn) {
      skIf([]);
      skTip('', null);
      return;
    }
    const p = [];
    op.tg.forEach((g) => {
      if (g.i == null || g.top) return;
      const l = op.b.levels[g.j],
        f = lf(op.b, l),
        a = f[g.i],
        c = f[(g.i + 1) % f.length],
        z0 = skZ(op.b, g.j),
        z1 = z0 + l.h;
      p.push(a[0], z0, a[1], c[0], z0, c[1], a[0], z1, a[1], c[0], z1, c[1]);
    });
    skIf([{ c: 0xd63ad6, p }]);
    skTip(op.sn === 2 ? 'Ausgangsposition' : 'Parallel zu Wand/Grenze', e);
  } catch (e) {
    logErr(e, 'skOpMouse');
  }
}
function skOpEnd(ok) {
  // ── Erweiterung aus 26-modellier-modus/120-modellier.js
  const op = SK.op;
  const r = skOpEndStufe1.apply(this, arguments);
  try {
    if (ok && op && op.b && !op.top && !op.kind && znCleanFp(op.b)) {
      op.b._gr = null;
      mesh(op.b);
      H();
      hpos();
      rr();
    }
  } catch (e) {
    console.warn('Grundriss bereinigen', e);
  }
  // ── Erweiterung aus 27-skizze/080-auswahl.js (danach)
  if (SKX.back && !SK.op) {
    SKX.back = 0;
    SK.tool = 's';
    try {
      skBar();
    } catch (e) {
      logErr(e, 'skOpEnd');
    }
  }
  return r;
}
// skOpEnd() ohne die Erweiterungen darüber – wird von skOpEnd() gezielt aufgerufen
function skOpEndStufe1(c) {
  // ── Erweiterung aus 26-modellier-modus/050-stufe-4.js
  // Aufraeumen
  skOpEndBasis.apply(this, arguments);
  try {
    skIfOff();
  } catch (e) {
    logErr(e, 'skOpEnd');
  }
}
// skOpEnd() ohne die Erweiterungen darüber – wird von skOpEnd() gezielt aufgerufen
function skOpEndBasis(commit) {
  const op = SK.op;
  if (!op) return;
  if (!commit) {
    if (op.top && op.storeys) {
      op.b.levels = op.lv0.slice();
      op.b.patches = op.pat0.slice();
      op.b.voids = JSON.parse(op.v0);
    } else if (op.top) {
      for (const k in op.h0) op.b.levels[k].h = op.h0[k];
    } else {
      op.js.forEach((k) => {
        const l = op.b.levels[k];
        l.fp = op.orig[k].map((q) => q.slice());
      });
      if (op.bfpOK) {
        /* b.fp wurde mitverschoben -> zurück aus Geschoss 0 */ op.b.fp = op.orig[op.js[0]].map((q) =>
          q.slice(),
        );
      }
    }
    mesh(op.b);
    H();
    hpos();
    if (S.hist.length && JSON.stringify(S.hist.length) === op.hl) S.hist.pop();
  } else {
    const ch = Math.abs(op.d) > 1e-6;
    if (ch && op.top && op.storeys) {
      SK.sel = SK.sel.filter((x) => !(x.top && x.b === op.b));
      SK.sel.push({ b: op.b, j: op.b.levels.length - 1, top: 1 });
    }
    if (!ch) {
      if (S.hist.length && JSON.stringify(S.hist.length) === op.hl) S.hist.pop();
    } else {
      SK.lastD = op.d;
      if (op.b.ub)
        try {
          $('hud').textContent += ' · Hinweis: Gebäude hat Einheiten – Grundriss ggf. neu übernehmen';
        } catch (e) {
          logErr(e, 'skOpEnd');
        }
    }
    if (op.bfpOK)
      try {
        drawOv();
      } catch (e) {
        logErr(e, 'skOpEnd');
      }
  }
  SK.op = null;
  SK.vcb = '';
  SK.ver++;
  skVcbShow();
  skSync();
  rr();
}
SK.opEscP = function () {
  if (SK.op) {
    skOpEnd(false);
    try {
      $('hud').textContent = 'Ziehen & Schieben abgebrochen';
    } catch (e) {
      logErr(e, 'opEscP');
    }
    return true;
  }
  if (SK.vcb) {
    SK.vcb = '';
    skVcbShow();
    return true;
  }
  return false;
};
SK.opDownP = function (e) {
  if (SK.tool !== 'p') return false;
  const n = skClickN(e);
  if (SK.op && SK.op.armed) {
    // zweiter Klick: übernehmen (oder Doppelklick = letzten Wert wiederholen)
    if (n >= 2 && SK.lastD != null && Math.hypot(e.clientX - SK.op.x, e.clientY - SK.op.y) < 7) {
      const en = SK.op.en,
        e2 = e;
      skOpEnd(false);
      const op = skOpStart(en, e2);
      skOpApply(op, SK.lastD);
      skOpEnd(true);
      $('hud').textContent = 'Ziehen & Schieben wiederholt: ' + f1(SK.lastD, 2).replace('.', ',') + ' m';
      return true;
    }
    SK.op.armed = false;
    SK.op.ending = 1;
    skOpMouse(e);
    return true;
  }
  const en = skHit(e);
  if (!en) return false;
  // Doppelklick auf eine andere Fläche: letzten Wert wiederholen
  if (n >= 2 && SK.lastD != null && SK.prevEn && skKey(SK.prevEn) !== skKey(en)) {
    const op = skOpStart(en, e);
    if (skOpApply(op, SK.lastD)) {
      skOpEnd(true);
      $('hud').textContent = 'Ziehen & Schieben wiederholt: ' + f1(SK.lastD, 2).replace('.', ',') + ' m';
    } else skOpEnd(false);
    return true;
  }
  SK.prevEn = en;
  skOpStart(en, e);
  skVcbShow();
  $('hud').textContent =
    'Ziehen & Schieben · Maus ziehen (oder klicken, bewegen, klicken) · Zahl + Enter = exakt';
  return true;
};
SK.opMoveP = function (e) {
  const op = SK.op;
  if (!op) return false;
  if (Math.hypot(e.clientX - op.x, e.clientY - op.y) > 4) op.mv = 1;
  if (op.mv || op.armed || op.ending) skOpMouse(e);
  return true;
};
SK.opUpP = function (e) {
  const op = SK.op;
  if (!op) return false;
  if (op.ending) {
    skOpEnd(true);
    return true;
  }
  if (op.mv) {
    skOpEnd(true);
    return true;
  }
  op.armed = true;
  try {
    $('hud').textContent =
      'Ziehen & Schieben · Maus bewegen, erneut klicken zum Übernehmen · Zahl + Enter = exakt · Esc = abbrechen';
  } catch (e) {
    logErr(e, 'opUpP');
  }
  return true;
};
// Messwerte-Box: Zahl tippen, Enter
function skVcbVal() {
  const v = parseFloat((SK.vcb || '').replace(',', '.'));
  return isFinite(v) ? v : null;
}
SK.keysP = function (e) {
  const k = e.key;
  if (k === 'p' || k === 'P') {
    skTool('p');
    return true;
  }
  if (SK.tool === 'p' || SK.op) {
    if (/^[0-9.,\-gG]$/.test(k) && (SK.op || SK.sel.length)) {
      SK.vcb += k.toLowerCase();
      skVcbShow();
      return true;
    }
    if (k === 'Backspace' && SK.vcb) {
      SK.vcb = SK.vcb.slice(0, -1);
      skVcbShow();
      return true;
    }
    if (k === 'Enter') {
      const v = skVcbVal(),
        g = /g/.test(SK.vcb || '');
      if (v == null) return false;
      if (g) {
        const tp =
          SK.op && SK.op.top
            ? SK.op.en
            : SK.sel.find((x) => x.top) ||
              (SK.sel[0] && { b: SK.sel[0].b, j: SK.sel[0].b.levels.length - 1, top: 1 });
        if (!tp) return false;
        if (SK.op) skOpEnd(false);
        const op = skOpStart(tp, { altKey: false, clientX: 0, clientY: 0 });
        if (!op.storeys) {
          skOpEnd(false);
          $('hud').textContent = 'Geschosse hinzufügen nur am obersten Geschoss';
          return true;
        }
        const n = Math.round(v);
        skOpApply(op, n * op.hT);
        skOpEnd(true);
        $('hud').textContent =
          (op.n >= 0 ? '+' : '') +
          op.n +
          ' Geschoss' +
          (Math.abs(op.n) === 1 ? '' : 'e') +
          ' – oberstes Geschoss kopiert';
        return true;
      }
      if (SK.op) {
        const op = SK.op;
        if (op.armed || op.mv || true) {
          if (skOpApply(op, v)) {
            skOpEnd(true);
            $('hud').textContent =
              'Ziehen & Schieben ' + (v >= 0 ? '+' : '') + f1(v, 2).replace('.', ',') + ' m';
          } else {
            skOpEnd(false);
            $('hud').textContent = 'Ziehen & Schieben: Wert nicht möglich (Fläche würde verschwinden)';
          }
        }
        return true;
      }
      if (SK.sel.length) {
        const en = SK.sel.find((x) => !x.top) || SK.sel[0],
          op = skOpStart(en, { altKey: true, clientX: 0, clientY: 0 });
        if (skOpApply(op, v)) {
          skOpEnd(true);
          $('hud').textContent =
            'Ziehen & Schieben ' +
            (v >= 0 ? '+' : '') +
            f1(v, 2).replace('.', ',') +
            ' m auf ' +
            SK.sel.length +
            ' Flächen';
        } else {
          skOpEnd(false);
          $('hud').textContent = 'Ziehen & Schieben: Wert nicht möglich';
        }
        return true;
      }
    }
  }
  return false;
};
