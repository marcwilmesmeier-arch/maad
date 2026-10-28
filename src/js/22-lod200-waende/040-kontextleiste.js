// ---- Kontextleiste (Forma-artig) und Tooltip
function l2Doc() {
  const d = GRS.doc;
  if (!d) return null;
  if (!d.getElementById('l2css')) {
    const s = d.createElement('style');
    s.id = 'l2css';
    s.textContent = `
#l2bar{position:absolute;left:50%;bottom:74px;z-index:6;display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:15px;background:rgba(246,245,241,.9);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);border:1px solid rgba(94,127,146,.28);box-shadow:0 8px 26px rgba(29,29,27,.18);font:500 12px Manrope,Montserrat,system-ui,sans-serif;color:#1d1d1b;animation:l2in .22s cubic-bezier(.2,.9,.3,1.2);white-space:nowrap}
@keyframes l2in{from{opacity:0;transform:translate(-50%,6px) scale(.94)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
#l2bar{transform:translate(-50%,0)}
#l2bar .k{display:flex;align-items:center;gap:6px;padding:3px 9px 3px 7px;border-radius:11px;background:#E9EDEF;font-weight:600}
#l2bar .k i{width:9px;height:9px;border-radius:3px;display:inline-block}
#l2bar button{font:inherit;border:0;background:transparent;border-radius:11px;padding:5px 9px;cursor:pointer;color:inherit;transition:background .15s,color .15s,transform .12s}
#l2bar button:hover{background:#E9EDEF}#l2bar button:active{transform:scale(.95)}
#l2bar .ty{background:#E9EDEF;border:1px solid rgba(94,127,146,.3);max-width:230px;overflow:hidden;text-overflow:ellipsis}
#l2bar .seg{display:flex;background:#E9EDEF;border-radius:12px;padding:2px;position:relative}
#l2bar .seg button{padding:4px 10px;position:relative;z-index:1;border-radius:10px}
#l2bar .seg button.on{background:#fff;color:#5E7F92;font-weight:700;box-shadow:0 1px 5px rgba(29,29,27,.15)}
#l2bar .mu{color:#6f7a80;font-size:11px}
#l2bar .sp{width:1px;height:20px;background:rgba(94,127,146,.25)}
#l2pk{position:absolute;left:50%;bottom:128px;z-index:7;width:340px;max-height:360px;overflow:auto;border-radius:15px;background:rgba(250,249,246,.96);backdrop-filter:blur(14px);border:1px solid rgba(94,127,146,.28);box-shadow:0 12px 34px rgba(29,29,27,.22);font:500 12px Manrope,Montserrat,system-ui,sans-serif;color:#1d1d1b;padding:6px;transform:translate(-50%,0);animation:l2in .2s ease}
#l2pk .it{padding:7px 9px;border-radius:10px;cursor:pointer;display:block}#l2pk .it:hover{background:#E9EDEF}#l2pk .it.on{background:#dfe8ed}
#l2pk .it b{display:block;font-weight:600}#l2pk .it small{color:#6f7a80;font-size:10.5px;display:block}
#l2pk .ft{display:flex;align-items:center;gap:6px;padding:7px 9px 3px;border-top:1px solid rgba(94,127,146,.2);margin-top:4px;color:#5E7F92;font-weight:600;cursor:pointer}
#l2tip{position:absolute;z-index:5;pointer-events:none;padding:6px 10px;border-radius:11px;background:rgba(29,29,27,.88);color:#fff;font:500 11.5px Manrope,Montserrat,system-ui,sans-serif;line-height:1.35;box-shadow:0 6px 18px rgba(0,0,0,.25)}
#l2tip small{opacity:.7;display:block;font-size:10.5px}
.l2sw{display:inline-flex;align-items:center;gap:6px;margin:0 4px;padding:3px 10px;border-radius:12px;border:1px solid #c9d3d8;background:#E9EDEF;font:600 12px Manrope,Montserrat,system-ui,sans-serif;cursor:pointer;color:#5E7F92}
.l2sw.on{background:#5E7F92;color:#fff;border-color:#5E7F92}
.l2t{width:100%;border-collapse:collapse;font-size:11.5px}.l2t th{text-align:right;font-weight:600;color:#6f7a80;padding:2px 3px}.l2t th:first-child,.l2t td:first-child{text-align:left}.l2t td{padding:3px;border-top:1px solid #e3e8ea;text-align:right}
.l2dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:-1px}`;
    d.head.appendChild(s);
  }
  return d;
}
function l2BarHide() {
  const d = GRS.doc;
  if (!d) return;
  ['l2bar', 'l2pk', 'l2tip'].forEach((i) => {
    const e = d.getElementById(i);
    if (e) e.remove();
  });
  S.l2.bsig = '';
}
function l2Bar(force) {
  const d = l2Doc(),
    cw = gD('grCw');
  if (!d || !cw) return;
  const T_ = l2Target();
  let bar = d.getElementById('l2bar');
  if (!T_ || GRS.pts.length || GRS.rect) {
    if (bar) bar.remove();
    const pk = d.getElementById('l2pk');
    if (pk) pk.remove();
    S.l2.bsig = '';
    return;
  }
  const el = T_.el,
    K = L2K[el.kind],
    D = l2Data(T_.lv),
    al = D.al[el.gid] || 'm',
    sig = [
      S.lod,
      JSON.stringify((T_.b.l2 && T_.b.l2.cn) || 0),
      el.id,
      el.T.id,
      al,
      S.l2.pick,
      S.l2.all,
      Math.round(el.len * 100),
      S.l2.pt ? S.l2.pt.p.join() : '',
    ].join('|');
  const AW = el.kind === 'AW';
  if (!bar || force || sig !== S.l2.bsig) {
    S.l2.bsig = sig;
    if (!bar) {
      bar = d.createElement('div');
      bar.id = 'l2bar';
      cw.appendChild(bar);
    }
    bar.innerHTML = `<span class="k"><i style="background:${K.c2}"></i>${K.n}</span>
<button onclick="GR.l2.cfg()" title="Bauteilkonfigurator öffnen">⚙</button><button class="ty" onclick="GR.l2.pick()" title="${l23() ? 'Wandtyp wählen – Kategorie ▸ Funktion ▸ Bauweise ▸ Typ' : 'Stärke wählen'}">${esc(el.T.dl)} ▾</button>
<span class="sp"></span>${
      AW
        ? l23()
          ? `<span class="seg" title="Eckanschluss der Außenwände ohne Gehrung: welche Wand läuft durch (Eckpunkt im Plan anklicken = tauschen)">${[
              ['l', 'Längere durch'],
              ['k', 'Kürzere durch'],
              ['w', 'Windmühle'],
            ]
              .map(
                (a) =>
                  `<button class="${((T_.b.l2 && T_.b.l2.cn && T_.b.l2.cn.m) || 'l') === a[0] ? 'on' : ''}" onclick="GR.l2.cnm('${a[0]}')">${a[1]}</button>`,
              )
              .join('')}</span>`
          : `<span class="mu" title="Außenwände bauen sich immer von der Gebäudekubatur nach innen auf">⟵ von außen nach innen</span>`
        : !l23()
          ? `<span class="mu">⟷ mittig auf der Trennlinie</span>`
          : `<span class="seg" title="Lage der Wand zur Zeichenlinie (Blickrichtung der Linie)">${['l', 'm', 'r'].map((a) => `<button class="${a === al ? 'on' : ''}" onclick="GR.l2.al('${a}')">${L2AL[a]}</button>`).join('')}</span>`
    }
<span class="sp"></span><span class="mu">${l2f(el.len)} m${l23() ? ' · KG ' + el.T.kg : ''}</span>${S.l2.pt && S.l2.pt.g === el.gid ? `<span class="sp"></span><button title="Endpunkt bis zur nächsten Wand dehnen bzw. an der Kreuzung stutzen" onclick="GR.l2.ptExt()">⇥ Punkt dehnen/stutzen</button>` : ''}${!AW && el.gid ? `<button title="Wand löschen (Entf)" onclick="GR.delSel()">✕</button>` : ''}`;
  }

  let pk = d.getElementById('l2pk');
  if (S.l2.pick) {
    const sg = sig;
    if (!pk) {
      pk = d.createElement('div');
      pk.id = 'l2pk';
      cw.appendChild(pk);
    }
    if (pk.dataset.s !== sg) {
      pk.dataset.s = sg;
      const grp = el.kind === 'AW' ? ['AW'] : ['TW', 'TH'];
      const list = L2T.filter((t) => grp.indexOf(t.grp) >= 0 || (el.kind === 'DE' && t.grp === 'DE'));
      if (!l23()) {
        const cur = Math.round(el.T.d * 1000) / 10,
          cs = (L2CP[el.kind] || []).slice();
        if (cs.indexOf(cur) < 0) {
          cs.push(cur);
          cs.sort((a, c) => a - c);
        }
        pk.innerHTML =
          cs
            .map(
              (c) =>
                `<span class="it ${c === cur ? 'on' : ''}" onclick="GR.l2.cm(${c})"><b>${String(c).replace('.', ',')} cm</b></span>`,
            )
            .join('') +
          (el.kind === 'DE' || el.kind === 'BP' || el.kind === 'RD'
            ? ''
            : `<span class="ft" onclick="GR.l2.tgAll()">${S.l2.all ? '☑' : '☐'} Für alle ${K.n}n übernehmen</span>`);
      } else
        pk.innerHTML =
          list
            .map(
              (t) =>
                `<span class="it ${t.id === el.T.id ? 'on' : ''}" onclick="GR.l2.set('${t.id}')"><b>${esc(t.dl)}</b><small>${esc(t.path.slice(0, -1).join(' ▸ ') || t.path[0])} · KG ${t.kg}${t.rei !== '–' ? ' · ' + t.rei : ''}</small></span>`,
            )
            .join('') +
          `<span class="ft" onclick="GR.l2.tgAll()">${S.l2.all ? '☑' : '☐'} Für alle ${K.n}n übernehmen</span>`;
    }
  } else if (pk) pk.remove();
}
function l2Tip(w, e) {
  const d = l2Doc(),
    cw = gD('grCw');
  if (!d || !cw) return;
  let t = d.getElementById('l2tip');
  const T_ = l2Target();
  if (!w || (T_ && T_.el.id === w.id) || GRS.pan) {
    if (t) t.remove();
    return;
  }
  if (!t) {
    t = d.createElement('div');
    t.id = 'l2tip';
    cw.appendChild(t);
  }
  const r = cw.getBoundingClientRect(),
    K = L2K[w.kind];
  t.innerHTML = l23()
    ? `<b>${K.n}</b> · ${esc(w.T.nm)}<small>${Math.round(w.d * 100)} cm · ${l2f(w.len)} m · KG ${w.T.kg} · ${w.T.pre}</small>`
    : `<b>${K.n}</b><small>${l2f(w.d * 100, 1)} cm · ${l2f(w.len)} m</small>`;
  t.style.left = e.clientX - r.left + 14 + 'px';
  t.style.top = e.clientY - r.top + 16 + 'px';
}
