/* v434 Varianten: speichern jetzt den vollständigen Planungsstand (alle Gebäudefelder, Flächen, Beschriftungen, Geländeplanum); Aktiv-Markierung, „Aktualisieren“ und Rückfrage beim Wechsel mit ungespeicherten Änderungen */
const VAR = { cur: null, sig: '' };
function vSnap() {
  return {
    data: JSON.parse(projBld()),
    areas: cp(S.areas || []),
    areaN: S.areaN,
    lab: cp(S.lab || []),
    plm: cp(plmSave()),
  };
}
function vSig() {
  try {
    const s = vSnap();
    return JSON.stringify([s.data, s.areas, s.lab, s.plm]);
  } catch (_) {
    return '';
  }
}
function vId(v) {
  if (!v.id) v.id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return v.id;
}
function vAct(v) {
  return !!v && VAR.cur && vId(v) === VAR.cur;
}
function vDirty() {
  return vSig() !== VAR.sig;
}
function vMeta() {
  return {
    bgf: S.bld.reduce((s, b) => s + bgfOf(b), 0),
    g: S.bld.length ? Math.max(...S.bld.map((b) => b.levels.length)) : 0,
  };
}
function sv(name) {
  const v = Object.assign(
    { name: name || 'Variante ' + String.fromCharCode(65 + (S.variants.length % 26)) },
    vMeta(),
    vSnap(),
  );
  vId(v);
  S.variants.push(v);
  VAR.cur = v.id;
  VAR.sig = vSig();
  rr();
}
function vUpd(v) {
  Object.assign(v, vMeta(), vSnap());
  VAR.cur = vId(v);
  VAR.sig = vSig();
}
function vUpdI(i) {
  const v = S.variants[i];
  if (!v) return;
  if (!confirm('Variante „' + v.name + '“ mit dem aktuellen Stand überschreiben?')) return;
  vUpd(v);
  rr();
}
function lv(i) {
  const v = S.variants[i];
  if (!v) return;
  const a = S.variants.find((x) => vAct(x));
  if (
    a &&
    a !== v &&
    vDirty() &&
    confirm(
      'In „' +
        a.name +
        '“ gibt es ungespeicherte Änderungen.\nOK = in „' +
        a.name +
        '“ speichern, Abbrechen = verwerfen',
    )
  )
    vUpd(a);
  hist();
  load(v.data);
  if (v.areas) {
    S.areas = cp(v.areas);
    S.areaN = Math.max(S.areas.length, v.areaN || 0);
    S.selA = null;
    try {
      areasApply();
    } catch (e) {
      logErr(e, 'lv');
    }
  }
  if (v.lab) {
    try {
      lbRebuild(v.lab);
    } catch (e) {
      console.warn(e);
    }
  }
  if (v.plm) {
    try {
      plmLoad(v.plm);
    } catch (e) {
      console.warn(e);
    }
  }
  VAR.cur = vId(v);
  VAR.sig = vSig();
  rr();
}
function dv(i) {
  const v = cp(S.variants[i]);
  v.name += ' (Kopie)';
  delete v.id;
  vId(v);
  S.variants.splice(i + 1, 0, v);
  rr();
}
function vCard(v, i) {
  const act = vAct(v),
    d = act && vDirty();
  return `<div class="card"${act ? ' style="border:1px solid #5E7F92"' : ''}><b>${v.name}</b>${act ? ' · aktiv' + (d ? ' · geändert' : '') : ''}<br>${v.g} Geschosse · ${f1(v.bgf)} m² BGF<br><button class="sm" onclick="lv(${i})">Laden</button> ${act ? `<button class="sm" onclick="vUpdI(${i})" title="Aktuellen Stand in diese Variante speichern">Aktualisieren</button> ` : ''}<button class="sm" onclick="dv(${i})">Duplizieren</button> <button class="sm" onclick="S.variants.splice(${i},1);rr()">×</button></div>`;
}
