// ---- Planungsbeispiel: Bestand entfernen, Riegel mit Satteldach (3 Vollgeschosse) einpassen, Analyse zeigen
const hWait = (ms) => new Promise((r) => setTimeout(r, ms));
function homeCap(n, t, sub) {
  const e = $('hCap');
  if (!e) return;
  e.innerHTML = n ? `<b>${n}</b><span>${t}</span>${sub ? '<small>' + sub + '</small>' : ''}` : '';
  e.classList.toggle('on', !!n);
}
const HOME_PLAN = {
  id: 'building_002',
  name: 'Gebäude 2',
  use: 'Wohnen',
  kind: 'free',
  fp: [
    [-36.03, 16.95],
    [-22.21, 17.15],
    [18.54, 25.63],
    [20.55, 16.33],
    [21.15, -27.86],
    [-35.63, -11.45],
  ],
  levels: [
    {
      name: 'EG',
      h: 3,
      fp: [
        [-36.03, 16.95],
        [-22.21, 17.15],
        [18.54, 25.63],
        [20.55, 16.33],
        [21.15, -27.86],
        [-35.63, -11.45],
      ],
    },
    {
      name: '1.OG',
      h: 3,
      fp: [
        [-36.03, 16.95],
        [-22.21, 17.15],
        [18.54, 25.63],
        [20.55, 16.33],
        [21.15, -27.86],
        [-35.63, -11.45],
      ],
    },
    {
      name: '2.OG',
      h: 3,
      fp: [
        [-36.03, 16.95],
        [-22.21, 17.15],
        [18.54, 25.63],
        [20.55, 16.33],
        [21.15, -27.86],
        [-35.63, -11.45],
      ],
    },
    {
      name: '3.OG',
      h: 3,
      fp: [
        [-36.03, 16.95],
        [-22.21, 17.15],
        [18.54, 25.63],
        [20.55, 16.33],
        [21.15, -27.86],
        [-35.63, -11.45],
      ],
    },
    {
      name: '4.OG',
      h: 3,
      fp: [
        [-36.03, 16.95],
        [-22.21, 17.15],
        [18.54, 25.63],
        [20.55, 16.33],
        [21.15, -27.86],
        [-35.63, -11.45],
      ],
    },
    {
      name: '5.OG',
      h: 3,
      fp: [
        [-33.1, 15.09],
        [-4.11, 15.5],
        [16.67, 19.83],
        [18.68, 10.53],
        [19.16, -24.78],
        [-32.75, -9.78],
      ],
    },
  ],
  type: 'residential',
  roof: { type: 'flat' },
  ref: -0.15,
  patches: [
    {
      k: 5,
      i: -1,
      poly: [
        [-20.97, 7.12],
        [-20.97, -2.62],
        [7.1, -9.95],
        [7.1, 8.48],
        [-20.97, 8.48],
      ],
      d: -12,
    },
  ],
};
function homeFit(poly) {
  const c = cen(poly),
    eds = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    eds.push({ l: Math.hypot(b[0] - a[0], b[1] - a[1]), an: Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  eds.sort((x, y) => y.l - x.l);
  const angs = [];
  eds.forEach((e) => {
    if (angs.length < 4 && !angs.some((a) => Math.abs(Math.sin(a - e.an)) < 0.05)) angs.push(e.an);
  });
  const dist = (q) => {
    let m = 1e9;
    for (let i = 0; i < poly.length; i++) m = Math.min(m, proj(q, poly[i], poly[(i + 1) % poly.length]).d);
    return m;
  };
  const ok = (fp, sb) => {
    for (let i = 0; i < 4; i++) {
      const a = fp[i],
        b = fp[(i + 1) % 4];
      for (let k = 0; k < 6; k++) {
        const t = k / 6,
          q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (!inP(q, poly) || dist(q) < sb) return false;
      }
    }
    return true;
  };
  for (const sb of [4, 3, 2])
    for (const D of [12, 11, 10, 9]) {
      let best = null;
      for (const an of angs) {
        const u = [Math.cos(an), Math.sin(an)],
          v = [-u[1], u[0]];
        for (const L of [46, 42, 38, 34, 30, 26, 22, 18]) {
          if (best && best.A >= L * D) break;
          let f = null;
          for (let du = -24; du <= 24 && !f; du += 4)
            for (let dv = -24; dv <= 24 && !f; dv += 4) {
              const m = [c[0] + u[0] * du + v[0] * dv, c[1] + u[1] * du + v[1] * dv],
                fp = [
                  [-1, -1],
                  [1, -1],
                  [1, 1],
                  [-1, 1],
                ].map(([a, b]) => [
                  m[0] + (u[0] * a * L) / 2 + (v[0] * b * D) / 2,
                  m[1] + (u[1] * a * L) / 2 + (v[1] * b * D) / 2,
                ]);
              if (ok(fp, sb)) f = fp;
            }
          if (f && (!best || L * D > best.A)) best = { A: L * D, fp: f };
        }
      }
      if (best && best.A >= 250) return best.fp;
    }
  const r = Math.sqrt(area(poly)) / 4;
  return [
    [c[0] - r * 1.4, c[1] - r * 0.6],
    [c[0] + r * 1.4, c[1] - r * 0.6],
    [c[0] + r * 1.4, c[1] + r * 0.6],
    [c[0] - r * 1.4, c[1] + r * 0.6],
  ];
}
function homeUndo() {
  HOME.tok = (HOME.tok || 0) + 1;
  HOME.show = 0;
  $('home').classList.remove('show');
  homeCap(0);
  if (HOME.hb) {
    sc.remove(HOME.hb);
    HOME.hb = null;
  }
  if (HOME.db) {
    S.bld = S.bld.filter((x) => x !== HOME.db);
    if (HOME.db._g && HOME.db._g.parent) HOME.db._g.parent.remove(HOME.db._g);
    HOME.db = null;
    S.sel = null;
    S.selF = null;
  }
  if (HOME.rm && HOME.rm.length) {
    GEO.bdel = GEO.bdel.filter((x) => !HOME.rm.includes(x));
    GEO.blist = GEO.blist.concat(HOME.rm);
    ctxBuild(GEO.blist.slice());
  }
  HOME.rm = null;
  S.n = 1;
}
// Während des Zooms: Bestand erkennen & löschen, Planung zeichnen – fertig, wenn die Kamera ankommt
async function homeDemo(p, DU) {
  const tok = (HOME.tok = (HOME.tok || 0) + 1),
    live = () => HOME.tok === tok && HOME.open && HOME.st === 1;
  HOME.show = 1;
  $('home').classList.add('show');
  try {
    const a = p.a,
      ex = ctxOn({ poly: p.poly });
    await hWait(700);
    if (!live()) return;
    if (ex.length) {
      const hg = new T.Group();
      ex.forEach((b) => {
        const l = new T.LineLoop(
          new T.BufferGeometry().setFromPoints(
            b.o.map((q) => new T.Vector3(q[0], gh(q[0], q[1]) + (b.h || 8) + 0.5, q[1])),
          ),
          new T.LineBasicMaterial({ color: 0x5e7f92, depthTest: false }),
        );
        l.renderOrder = 22;
        l.raycast = () => {};
        hg.add(l);
      });
      sc.add(hg);
      HOME.hb = hg;
      homeCap('1', 'Bestand erfasst', ex.length + ' Gebäude auf ' + esc((a && a.id) || 'dem Grundstück'));
      await hWait(1100);
      if (!live()) return;
      homeCap('2', 'Bestand entfernen', '');
      sc.remove(hg);
      HOME.hb = null;
      GEO.blist = GEO.blist.filter((b) => !ex.includes(b));
      GEO.bdel.push(...ex);
      HOME.rm = ex;
      ctxBuild(GEO.blist.slice());
      await hWait(600);
      if (!live()) return;
    }
    const PL = HOME_PLAN,
      b = JSON.parse(JSON.stringify(PL));
    b.id = 'building_001';
    b.name = 'Blockrand (Beispiel)';
    b.levels = [];
    b.patches = [];
    S.bld.push(b);
    HOME.db = b;
    homeCap('3', 'Planung entsteht', '6 Geschosse · Flachdach · Wohnen');
    const per = Math.max(300, Math.floor((DU - HOME.t0e - 1200) / PL.levels.length));
    for (const lv of PL.levels) {
      b.levels.push(JSON.parse(JSON.stringify(lv)));
      mesh(b);
      await hWait(per);
      if (!live()) return;
    }
    homeCap('4', 'Innenhof ausschneiden', '');
    b.patches = JSON.parse(JSON.stringify(PL.patches || []));
    mesh(b);
    await hWait(900);
  } catch (e) {
    console.error(e);
  } finally {
    if (HOME.tok === tok) {
      HOME.show = 0;
      $('home').classList.remove('show');
      homeCap(0);
    }
  }
}
function homeBack() {
  if (!HOME.st || HOME.show) return;
  homeUndo();
  HOME.st = 0;
  $('home').classList.remove('z');
  if (HOME.hl) {
    sc.remove(HOME.hl);
    HOME.hl = null;
  }
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: { tx: 0, tz: 0, d: Math.max(430, Math.min(1000, GEO.size * 1.05)), az: V.az, pol: 0.92, rot: V.rot },
    t0: performance.now(),
    dur: 2000,
  };
  HOME.az0 = V.az;
}
async function homePanel(sub) {
  HOME.sub = sub;
  const el = $('hSide'),
    p = HOME.par || homePar(),
    a = p.a;
  if (sub === 'main') {
    el.innerHTML = `<h2>${a ? esc(a.id) : 'Grundstück'}</h2><div class="sub">${f1(p.ar)} m² · ${esc((GEO.snap && GEO.snap.label) || '')}</div>
${homeDemoBtn()}<button class="hbtn pri" onclick="homeCreate()"><i>＋</i><span>Neues Projekt anlegen<small>Standort auf der Weltkugel wählen</small></span></button>
<button class="hbtn" onclick="homePanel('open')"><i>▤</i><span>Projekt öffnen<small>Zuletzt gespeicherte Projekte</small></span></button>
${S.project && S.project.id ? `<button class="hbtn ghost" onclick="homeResume()"><i>↩</i><span>${esc(S.project.name)} fortsetzen</span></button>` : ''}
${homeDemoFileBtn()}<button class="hback" onclick="homeBack()">‹ Zurück zur Übersicht</button>`;
  } else if (sub === 'new') {
    el.innerHTML = `<h2>Neues Projekt</h2><div class="sub">Name vergeben – gespeichert wird automatisch.</div><input id="hName" type="text" value="${esc((S.project && S.project.name && 0) || 'Neues Projekt')}" onkeydown="if(event.key==='Enter')homeCreate()"><button class="hbtn pri" onclick="homeCreate()" style="margin-top:12px"><i>→</i><span>Projekt anlegen</span></button><button class="hback" onclick="homePanel('main')">‹ Zurück</button>`;
    setTimeout(() => {
      const i = $('hName');
      if (i) {
        i.focus();
        i.select();
      }
    }, 60);
  } else {
    const L = await projList();
    el.innerHTML =
      `<h2>Projekt öffnen</h2><div class="sub">${L.length ? L.length + ' gespeichert (in diesem Browser)' : 'Noch keine Projekte gespeichert.'}</div>` +
      L.map(
        (x) =>
          `<div class="hproj" onclick="projOpen('${x.id}')">${x.thumb ? `<img src="${x.thumb}" alt="">` : '<div class="ph"></div>'}<div><b>${esc(x.name)}</b><small>${x.n || 0} Gebäude · ${new Date(x.t).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</small><br><small>${esc((x.label || '').split(',')[0])}</small></div><button title="Umbenennen" onclick="projRen('${x.id}',event)">✎</button><button title="Löschen" onclick="projDel('${x.id}',event)">✕</button></div>`,
      ).join('') +
      `<button class="hback" onclick="homePanel('main')">‹ Zurück</button>`;
  }
}
function homeCreate() {
  const n = (($('hName') || {}).value || '').trim();
  WZ.name = n;
  homeUndo();
  homeClose();
  wzOpen();
}
(function () {
  const h = $('home');
  if (!h) return;
  h.addEventListener('pointermove', (e) => {
    HOME.mx = (e.clientX / innerWidth) * 2 - 1;
    HOME.my = (e.clientY / innerHeight) * 2 - 1;
  });
  h.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  addEventListener('resize', () => {
    if (HOME.open) homePos();
  });
})();
addEventListener(
  'keydown',
  (e) => {
    if (!HOME.open || e.key !== 'Escape') return;
    if (HM.big) {
      hmToggle(false);
      e.stopPropagation();
      return;
    }
    if (HOME.st) {
      if (HOME.sub === 'main') homeBack();
      else homePanel('main');
    }
  },
  true,
);
