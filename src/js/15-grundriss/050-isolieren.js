// ---- Isolieren: Klick auf eine Ergebniszeile blendet alle anderen Körper aus (nochmal klicken hebt auf)
const ZI = { sp: null, key: '', hid: [], exv: null, acts: [] };
function zoIsoHit(sp, b, pt) {
  const t = sp.t;
  if (t === 'all') return true;
  if (t === 'bld') return b.id === sp.bid;
  if (pt.hull) {
    const k = pt.k;
    if (t === 'lvl') return k === 'roof' ? sp.n === 'DG' : lname(b, k) === sp.n;
    if (t === 'use') return (k === 'roof' ? roofUse(b) : lUse(b, b.levels[k])) === sp.u;
    if (t === 'ug') return (k === 'roof' ? false : k < ugN(b)) === !!sp.v;
    return true;
  }
  const m = pt.u || {},
    fa = grFA(m.fa) || {};
  if (t === 'fa') return m.fa === sp.k;
  if (t === 'din') return fa.d === sp.d;
  if (t === 'uuse') return fa.u === sp.u;
  if (t === 'ulv') return m.sn === sp.sn;
  if (t === 'unit') return b.id === sp.bid && m.sn === sp.sn && m.fi === sp.fi;
  return true;
}
function zoIsoApply() {
  ZI.hid.forEach((o) => {
    o.visible = !(o.userData && o.userData.kont && S.noK);
  });
  ZI.hid = [];
  const sp = ZI.sp;
  if (!sp) return;
  const hide = (o) => {
    if (o.visible) {
      o.visible = false;
      ZI.hid.push(o);
    }
  };
  S.bld.forEach((b) => {
    if (b.ex) return;
    if (b._g)
      exTag(b).forEach((t) => {
        if (!zoIsoHit(sp, b, { hull: 1, k: t.k })) hide(t.o);
      });
    G.un.children.forEach((g) => {
      if (g.userData.bid !== b.id) return;
      g.children.forEach((lg) =>
        lg.children.forEach((o) => {
          if (!zoIsoHit(sp, b, { u: o.userData.u || {}, k: lg.userData.k })) hide(o);
        }),
      );
    });
  });
}
function zoIsoClear(keep) {
  if (S.hlw) {
    S.hlw = 0;
    if (ZI.sp && ZI.sp.k) hlClear(1);
  }
  ZI.sp = null;
  ZI.key = '';
  zoIsoApply();
  if (!keep) zoRender();
}
function zoPick(i) {
  // ── Erweiterung aus 22-lod200-waende/080-isolieren-aus-der-gebaeudemetrik-in.js
  if (S.l2.iso) {
    S.l2.iso = null;
    l2IsoApply(true);
  }
  const sp = ZI.acts[i];
  if (!sp) return;
  {
    const pid = sp.pie || (sp.k === 'bgf' ? 'bgfx' : sp.k === 'bri' ? 'brix' : '');
    if (pid && zoPies[pid]) (S.zo.pi || (S.zo.pi = {}))[S.zo.m] = pid;
  }
  const key = JSON.stringify(sp);
  if (ZI.key === key) {
    zoIsoClear();
    return;
  }
  zoIsoClear(true);
  ZI.sp = sp;
  ZI.key = key;
  if (sp.k) {
    S.hlk = sp.k;
    S.hlb = sp.bid;
    S.hlw = 1;
    hlApply();
  }
  zoIsoApply();
  zoRender();
  zoTick.k = zoSig();
}

// ---- Kreisdiagramm ganz unten: Anteile der zuletzt angeklickten Überschrift (Standard: erste Auswertung des Reiters)
const ZPAL = [
  '#4e79a7',
  '#f28e2b',
  '#59a14f',
  '#e15759',
  '#b07aa1',
  '#76b7b2',
  '#edc948',
  '#9c755f',
  '#bab0ab',
  '#86bcb6',
];
function zoPieId() {
  const m = S.zo.m,
    pi = S.zo.pi || (S.zo.pi = {}),
    def = m === 'b' ? 'bn' : m === 'f' ? 'f1' : 'u1';
  return pi[m] && zoPies[pi[m]] ? pi[m] : zoPies[def] ? def : Object.keys(zoPies)[0];
}
function zoPieHtml() {
  const id = zoPieId(),
    d = id && zoPies[id];
  if (!d) return '';
  let r = d.r.filter((x) => x.v > 1e-6).sort((a, b) => b.v - a.v);
  if (!r.length) return '';
  if (r.length > 10) {
    const rest = r.slice(9).reduce((t, x) => t + x.v, 0);
    r = r.slice(0, 9).concat([{ n: 'Weitere', c: '#bab0ab', v: rest }]);
  }
  const T_ = r.reduce((t, x) => t + x.v, 0);
  let a0 = -Math.PI / 2,
    sl = '';
  r.forEach((x) => {
    const f = x.v / T_,
      a1 = a0 + f * 2 * Math.PI,
      pc = f1(f * 100, 1) + ' %';
    if (f > 0.9999)
      sl += `<circle cx="0" cy="0" r="1" fill="${x.c}"><title>${esc(x.n)}: ${pc}</title></circle>`;
    else
      sl += `<path d="M0 0L${Math.cos(a0).toFixed(4)} ${Math.sin(a0).toFixed(4)}A1 1 0 ${f > 0.5 ? 1 : 0} 1 ${Math.cos(a1).toFixed(4)} ${Math.sin(a1).toFixed(4)}Z" fill="${x.c}" stroke="var(--pn,#fff)" stroke-width=".02"><title>${esc(x.n)}: ${pc}</title></path>`;
    a0 = a1;
  });
  return `<h5>Anteile · ${esc(d.t.replace(/<[^>]*>/g, ''))}</h5><div class="pie"><svg viewBox="-1.02 -1.02 2.04 2.04" width="104" height="104" role="img" aria-label="Kreisdiagramm ${esc(d.t)}">${sl}</svg><div class="pl">${r.map((x) => `<div><i style="background:${x.c}"></i><span>${esc(x.n)}</span><b>${f1((x.v / T_) * 100, 1)} %</b></div>`).join('')}</div></div>`;
}
function zoPie(id) {
  if (!zoPies[id]) return;
  (S.zo.pi || (S.zo.pi = {}))[S.zo.m] = id;
  const e = $('zoPie');
  if (e) e.innerHTML = zoPieHtml();
  try {
    zoUnPaint();
  } catch (e) {
    logErr(e, 'zoPie');
  }
}
// 3D-Einheitenkörper nach der zuletzt angeklickten Überschrift (Flächenart, DIN 277, Nutzung, Geschoss) in den Legendenfarben einfärben
function zoUnPaint() {
  if (!G.un || !G.un.children.length) return;
  const pid = S.zo.m === 'u' ? (S.zo.pi && S.zo.pi.u) || 'u1' : 'u1',
    lvc = {};
  if (pid === 'u4') {
    const ks = {};
    zoScope().forEach((b) => {
      if (!b.ub) return;
      grData(b).forEach((g) => {
        if (g.faces.some((f) => f.un)) ks[g.sn] = 1;
      });
    });
    Object.keys(ks)
      .sort((a, b) => zoRank(b) - zoRank(a))
      .forEach((n, i) => (lvc[n] = ZPAL[i % ZPAL.length]));
  }
  G.un.traverse((o) => {
    if (!o.isMesh || !o.userData.u || o.userData.u.fa === undefined) return;
    const M = o.userData.u,
      d = grFA(M.fa) || grDefFa(M.use);
    const c =
      pid === 'u2'
        ? S.din[d.d] || '#9aa0a6'
        : pid === 'u3'
          ? S.uses[d.u] || '#9aa0a6'
          : pid === 'u4'
            ? lvc[M.sn] || '#9aa0a6'
            : d.c;
    if (c && o.material && o.material.color) o.material.color.set(c);
  });
}
function zoRender() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js
  const r = (() => {
    // ── Erweiterung aus 22-lod200-waende/070-nettogeschossflaeche.js
    const r = (() => {
      const e = $('zol');
      if (!e) return;
      zoPies = {};
      const m = S.zo.m,
        P = zoScope(),
        one = P.length === 1 && S.sel === P[0];
      let h = `<b>Gebäudemetrik</b><button class="zg ${FAP.open ? 'on' : ''}" title="Flächenarten und Nutzungen einstellen" aria-label="Optionen: Flächenarten" onclick="faToggle()"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 4.5h5M11.5 4.5H14M2 11.5h2.5M8 11.5h6"/><circle cx="9.2" cy="4.5" r="1.7"/><circle cx="6.2" cy="11.5" r="1.7"/></svg></button><div class="seg">${[
        ['b', 'Gebäude', '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M12 11v10M4 7l8 4 8-4"/>'],
        [
          'f',
          'Flächen',
          '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
        ],
        ['u', 'Einheiten', '<path d="M4 20V9l8-5 8 5v11z"/><path d="M4 14h16M12 14v6"/>'],
      ]
        .map(
          ([k, n, ic]) =>
            `<button class="${m === k ? 'on' : ''}" onclick="zoMode('${k}')" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ic}</svg><span>${n}</span></button>`,
        )
        .join(
          '',
        )}</div>${ZI.sp ? `<div class="iso"><span>Isoliert: ${esc(ZI.sp.lab || '')}</span><button onclick="zoIsoClear()" title="Isolierung aufheben">×</button></div>` : ''}`;
      const ACT = [],
        R = (sw, n, v, cls, sp) => {
          let at = '',
            kc = '';
          if (sp) {
            const key = JSON.stringify(sp);
            ACT.push(sp);
            at = ` onclick="zoPick(${ACT.length - 1})" title="Anklicken: im Modell isolieren (nochmal klicken hebt auf)"`;
            kc = ' k' + (ZI.key === key ? ' on' : '');
          }
          return `<div class="r ${cls || ''}${kc}"${at}>${sw ? `<i style="background:${sw}"></i>` : ''}<span>${n}</span><b>${v}</b></div>`;
        },
        A = (v) => f1(v, 1) + ' m²';
      if (!P.length) h += '<div class="mu">Noch kein Planungsgebäude.</div>';
      else {
        h += `<div class="mu">${one ? 'Auswahl: ' + esc(P[0].name || P[0].id) : 'Alle Gebäude (' + P.length + ')'} · live aus dem Modell</div>`;
        if (m === 'b') {
          const all = USES.filter((u) => P.some((b) => zoUses(b).includes(u))).join(' / ');
          h += `<div class="cl"><input type="color" value="${S.zo.bc}" oninput="zoCol(this.value)" title="Farbe der Gebäudedarstellung ändern"><b>${all || '–'}</b></div>`;
          let tg = 0,
            to = 0,
            tu = 0,
            tv = 0,
            tr = 0,
            tbo = 0,
            tbu = 0;
          const bu = {};
          P.forEach((b) =>
            bLv(b).forEach((r, i) => {
              const u = i >= b.levels.length ? roofUse(b) : lUse(b, b.levels[i]);
              bu[u] = (bu[u] || 0) + r.a;
            }),
          );
          zoPies.bn = {
            t: 'BGF nach Nutzung',
            r: USES.filter((u) => bu[u]).map((u) => ({ n: u, c: S.uses[u], v: bu[u] })),
          };
          P.forEach((b) => {
            const k = bM(b),
              g = k.bgfoi + k.bgfui,
              B = (kk, l) => ({ t: 'bld', bid: b.id, k: kk, lab: (b.name || b.id) + (l ? ' · ' + l : '') });
            tg += g;
            to += k.bgfoi;
            tu += k.bgfui;
            tv += k.brioi + k.briui;
            tbo += k.brioi;
            tbu += k.briui;
            tr += grOf(b);
            const fl = zoD(
              'bf' + b.id,
              'Flächen' + (P.length > 1 ? ' · ' + esc(b.name || b.id) : ''),
              '',
              R('', 'Fassadenfläche', A(k.fas), '', B('fas', 'Fassadenfläche')) +
                fdRows(b) +
                R('', 'Dachfläche', A(k.dach), '', B('dach', 'Dachfläche')) +
                R('', 'Terrassenfläche', A(k.terr), '', B('terr', 'Terrassenfläche')),
              [
                { n: 'Fassadenfläche', c: '#8fa9c4', v: k.fas },
                { n: 'Dachfläche', c: '#c97b63', v: k.dach },
                { n: 'Terrassenfläche', c: '#9bbf8a', v: k.terr },
              ],
            );
            h += zoBldHtml(b, k, R, A, B, P);
            try {
              h += znRows(b, R, A, zoD);
            } catch (e) {
              logErr(e, 'zoRender>anonym');
            }
          });
          zoPies.bgfx = {
            t: 'BGF oberirdisch / unterirdisch',
            r: [
              { n: 'BGF oberirdisch', c: '#4e79a7', v: to },
              { n: 'BGF unterirdisch', c: '#9aa5b1', v: tu },
            ],
          };
          zoPies.brix = {
            t: 'BRI oberirdisch / unterirdisch',
            r: [
              { n: 'BRI oberirdisch', c: '#f28e2b', v: tbo },
              { n: 'BRI unterirdisch', c: '#bfa58a', v: tbu },
            ],
          };
          if (P.length > 1) h += zoBldTot(P, R, A, { tg, to, tu, tv, tbo, tbu, tr });
        } else if (m === 'f') {
          const lv = {},
            use = {};
          let tg = 0,
            to = 0,
            tu = 0;
          P.forEach((b) => {
            const k = bM(b),
              L = bLv(b);
            tg += k.bgfoi + k.bgfui;
            to += k.bgfoi;
            tu += k.bgfui;
            L.forEach((r, i) => {
              const dg = i >= b.levels.length,
                n = dg ? 'DG' : lname(b, i),
                u = dg ? roofUse(b) : lUse(b, b.levels[i]),
                x = lv[n] || (lv[n] = { a: 0, u: {} });
              x.a += r.a;
              x.u[u] = (x.u[u] || 0) + r.a;
              use[u] = (use[u] || 0) + r.a;
            });
          });
          const names = Object.keys(lv).sort((a, b) => zoRank(b) - zoRank(a)),
            AL = { t: 'all', lab: 'Alle Geschosse' };
          h += zoD(
            'f1',
            'BGF nach Geschoss',
            A(tg),
            names
              .map((n) => {
                const x = lv[n],
                  us = Object.keys(x.u).sort((a, b) => x.u[b] - x.u[a]);
                return R(
                  S.uses[us[0]],
                  zoLvN(n) + ' <span class="mu">' + us.join(' / ') + '</span>',
                  A(x.a),
                  '',
                  { t: 'lvl', n, lab: zoLvN(n) },
                );
              })
              .join('') +
              R('', 'BGF gesamt', A(tg), 't', AL) +
              R('', 'davon oberirdisch', A(to), 's', { t: 'ug', v: 0, lab: 'oberirdische Geschosse' }) +
              (tu
                ? R('', 'davon unterirdisch', A(tu), 's', { t: 'ug', v: 1, lab: 'unterirdische Geschosse' })
                : ''),
            names.map((n) => {
              const x = lv[n],
                us = Object.keys(x.u).sort((a, b) => x.u[b] - x.u[a]);
              return { n: zoLvN(n), c: S.uses[us[0]], v: x.a };
            }),
          );
          h += zoD(
            'f2',
            'BGF nach Nutzung',
            A(tg),
            USES.filter((u) => use[u])
              .map((u) => R(S.uses[u], u, A(use[u]), '', { t: 'use', u, lab: u }))
              .join(''),
            USES.filter((u) => use[u]).map((u) => ({ n: u, c: S.uses[u], v: use[u] })),
          );
        } else {
          const fa = {},
            lv = {},
            din = {},
            nu = {},
            rows = [];
          let ta = 0,
            tr = 0,
            any = 0;
          P.forEach((b) => {
            if (!b.ub) return;
            grData(b).forEach((g) => {
              const us = [];
              g.faces.forEach((f) => {
                if (!f.un) return;
                any = 1;
                const d = grFA(f.fa) || grDefFa(g.use),
                  x = fa[d.k] || (fa[d.k] = { n: 0, a: 0, r: 0, d });
                x.n++;
                x.a += f.a;
                x.r += (f.a * d.f) / 100;
                lv[g.sn] = (lv[g.sn] || 0) + f.a;
                const q = din[d.d] || (din[d.d] = { a: 0, r: 0 });
                q.a += f.a;
                q.r += (f.a * d.f) / 100;
                nu[d.u] = (nu[d.u] || 0) + f.a;
                ta += f.a;
                tr += (f.a * d.f) / 100;
                us.push({
                  nr: g.sn + '.' + f.idx,
                  sn: g.sn,
                  fi: f.idx,
                  bid: b.id,
                  n: f.n || d.n,
                  fa: d.n,
                  c: d.c,
                  a: f.a,
                  b: P.length > 1 ? b.name || b.id : '',
                });
              });
              if (us.length) rows.push({ sn: g.sn, us });
            });
          });
          if (!any)
            h +=
              '<div class="mu" style="margin-top:8px">Noch keine Einheiten vergeben. Im Grundriss (Taste G) mit Linie oder Rechteck schneiden und Flächenarten zuweisen.</div>';
          else {
            const AL = { t: 'all', lab: 'Alle Einheiten' };
            h += zoD(
              'u1',
              'Flächenart',
              A(ta),
              S.fa
                .filter((f) => fa[f.k])
                .map((f) =>
                  R(f.c, esc(f.n) + ' <span class="mu">' + fa[f.k].n + '×</span>', A(fa[f.k].a), '', {
                    t: 'fa',
                    k: f.k,
                    lab: f.n,
                  }),
                )
                .join('') +
                R('', 'Einheiten gesamt', A(ta), 't', AL) +
                R('', 'anrechenbar', A(tr), 's', AL),
              S.fa.filter((f) => fa[f.k]).map((f) => ({ n: f.n, c: f.c, v: fa[f.k].a })),
            );
            h += zoD(
              'u2',
              'DIN 277',
              A(ta),
              Object.keys(GRDIN)
                .filter((k) => din[k])
                .map((k) =>
                  R(
                    S.din[k],
                    k + ' <span class="mu">' + GRDIN[k].replace(/ \(.*/, '') + '</span>',
                    A(din[k].a),
                    '',
                    { t: 'din', d: k, lab: k },
                  ),
                )
                .join(''),
              Object.keys(GRDIN)
                .filter((k) => din[k])
                .map((k) => ({ n: k, c: S.din[k] || '#9aa0a6', v: din[k].a })),
            );
            h += zoD(
              'u3',
              'Nutzung',
              A(ta),
              USES.filter((u) => nu[u])
                .map((u) => R(S.uses[u], u, A(nu[u]), '', { t: 'uuse', u, lab: u }))
                .join(''),
              USES.filter((u) => nu[u]).map((u) => ({ n: u, c: S.uses[u], v: nu[u] })),
            );
            h += zoD(
              'u4',
              'Geschoss',
              A(ta),
              Object.keys(lv)
                .sort((a, b) => zoRank(b) - zoRank(a))
                .map((n, i) =>
                  R(ZPAL[i % ZPAL.length], zoLvN(n), A(lv[n]), '', { t: 'ulv', sn: n, lab: zoLvN(n) }),
                )
                .join(''),
              Object.keys(lv)
                .sort((a, b) => zoRank(b) - zoRank(a))
                .map((n, i) => ({ n: zoLvN(n), c: ZPAL[i % ZPAL.length], v: lv[n] })),
            );
            h += zoD(
              'u5',
              'Einheiten',
              rows.reduce((n, r) => n + r.us.length, 0) + '×',
              rows
                .sort((a, b) => zoRank(b.sn) - zoRank(a.sn))
                .map((r) =>
                  r.us
                    .map((u) =>
                      R(
                        u.c,
                        esc(u.n) + ' <span class="mu">' + u.nr + (u.b ? ' · ' + esc(u.b) : '') + '</span>',
                        A(u.a),
                        '',
                        { t: 'unit', bid: u.bid, sn: u.sn, fi: u.fi, lab: u.n + ' ' + u.nr },
                      ),
                    )
                    .join(''),
                )
                .join(''),
              rows.reduce((l, r) => l.concat(r.us.map((u) => ({ n: u.n + ' ' + u.nr, c: u.c, v: u.a }))), []),
            );
          }
          h += '<button class="ac" onclick="grOpen()">Grundriss öffnen (G)</button>';
        }
      }
      ZI.acts = ACT;
      h += `<div id="zoPie">${zoPieHtml()}</div>`;
      e.innerHTML = h;
    })();
    try {
      if (!l2on()) return r;
      const e = $('zol');
      if (!e) return r;
      const P = zoScope(),
        m = S.zo.m,
        A = (v) => f1(v, 1) + ' m²',
        R = l2R;
      let h = '';
      if (m === 'b') {
        // Modus 'b': bewusst keine Zusatzzeilen
      } else if (m === 'f') {
        const lv = {};
        P.forEach((b) =>
          l2Ngf(b).lv.forEach((l) => {
            const x = lv[l.n] || (lv[l.n] = { a: 0, w: 0, n: 0 });
            x.a += l.a;
            x.w += l.w;
            x.n += l.ngf;
          }),
        );
        const ks = Object.keys(lv).reverse();
        let t = 0;
        ks.forEach((k) => (t += lv[k].n));
        h +=
          zoD(
            'f3',
            'NGF nach Geschoss',
            A(t),
            ks
              .map((k) =>
                R(
                  k + ' <span class="mu">BGF ' + A(lv[k].a) + ' − Wände ' + A(lv[k].w) + '</span>',
                  A(lv[k].n),
                  '',
                  ['ngf', '*', 'n:' + k],
                ),
              )
              .join('') + R('NGF gesamt', A(t), 't', ['ngf', '*', 'all']),
          ) +
          zoD(
            'f4',
            'KF nach Geschoss',
            A(ks.reduce((q, k) => q + lv[k].w, 0)),
            ks.map((k) => R(k, A(lv[k].w), '', ['kf', '*', 'n:' + k])).join('') +
              R('KF gesamt', A(ks.reduce((q, k) => q + lv[k].w, 0)), 't', ['kf', '*', 'all']),
          );
      }
      if (l23() && (m === 'b' || m === 'f')) {
        h +=
          '<h5>Tragwerk · LOD 300</h5>' +
          P.map((b) => {
            const t = l2Tr(b);
            return R(
              (P.length > 1 ? esc(b.name || b.id) + ' · ' : '') +
                'Nur tragende Komponenten <span class="mu">(Tragschichten)</span>',
              l2f(t.v) + ' m³',
              't',
              ['tr', b.id, 'all'],
            );
          }).join('');
      }
      if (h) e.insertAdjacentHTML('beforeend', h);
    } catch (err) {
      console.warn('NGF', err);
    }
    return r;
  })();
  try {
    const e = document.getElementById('zol');
    if (!e) return r;
    const o = document.getElementById('zoAll');
    if (o) o.remove();
    const bs = S.bld.filter((b) => !b.ex && b.fp);
    if (bs.length < 2) return r;
    let tg = 0,
      tr = 0;
    bs.forEach((b) => {
      const k = bM(b);
      tg += k.bgfoi + k.bgfui;
      tr += grOf(b);
    });
    const on = !S.sel && S.multi && S.multi.length === bs.length && bs.every((b) => S.multi.includes(b)),
      A = (v) => f1(v, 1) + ' m²',
      ng = bs.reduce((n, b) => n + b.levels.length, 0),
      h = `<div id="zoAll" class="${on ? 'on' : ''}" onclick="zoSelAll()" title="Anklicken: alle Gebäude auswählen"><div class="zt">${bs.length} Gebäude<span style="font-weight:400;color:var(--zm);font-size:11px;margin-left:6px">${ng} Geschosse</span></div><div class="zr"><span>BGF gesamt</span><span style="white-space:nowrap">${A(tg)}</span></div><div class="zr" style="font-size:11.5px;color:var(--zm)"><span>GR gesamt</span><span style="white-space:nowrap">${A(tr)}</span></div></div>`;
    const m = e.querySelector('.mu');
    if (m) m.insertAdjacentHTML('afterend', h);
    else e.insertAdjacentHTML('afterbegin', h);
  } catch (err) {
    console.warn('Gesamtzeile', err);
  }
  return r;
}
function zoMode(k) {
  if (ZI.sp) zoIsoClear(true);
  S.zo.m = k;
  if (k === 'u' && !G.un.children.length) {
    try {
      grUnBuild();
    } catch (e) {
      logErr(e, 'zoMode');
    }
  }
  zoApply();
  zoRender();
  zoTick.k = zoSig();
  // ── Erweiterung aus 18-erweiterungen-v280-v325/150-explosionsansicht.js (danach)
  try {
    exApply();
  } catch (e) {
    logErr(e, 'zoMode');
  }
}
function zoCol(v) {
  S.zo.bc = v;
  zoApply();
}
