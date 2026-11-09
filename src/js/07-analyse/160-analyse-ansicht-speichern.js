// ======================= ANALYSEANSICHT UND GESPEICHERTE ANALYSEN =======================
// Analyseansicht: Beim Berechnen wechselt maad in eine eigene Ansicht (Weißmodell, Leiste unten mit Ergebnis,
// Speichern und Schließen). „Schließen“ stellt die vorherige Darstellung wieder her.
// Gespeicherte Analysen (wie in Forma): Ergebnis der Windberechnung mit Richtung, Stärke, Bereich und Strömungsfeld,
// zugeordnet der aktiven Variante (oder ohne Variante). Liste im Reiter „Varianten“ unter der jeweiligen Variante;
// „Anzeigen“ stellt das Ergebnis ohne neue Rechnung wieder her. Hat sich die Planung seit dem Speichern geändert,
// ist die Analyse als „veraltet“ markiert. Das Feld wird verkleinert gespeichert (16 Bit, gzip, Base64).

const AV = { an: false, vorDar: null };
S.analysen = [];
const AN_SKALA = 1e5; // Gittergeschwindigkeit (|u| ≤ 0,3) -> Int16

/** In die Analyseansicht wechseln (Weißmodell, Leiste unten). */
function avAn() {
  if (!AV.an) {
    AV.an = true;
    AV.vorDar = S.dar;
  }
  if (S.dar !== 'wm') drSet('wm');
  avLeiste();
}
/** Analyseansicht verlassen: vorherige Darstellung zurück. */
function avAus() {
  if (!AV.an) return;
  AV.an = false;
  const e = document.getElementById('avBar');
  if (e) e.remove();
  if (AV.vorDar && AV.vorDar !== S.dar) drSet(AV.vorDar);
  AV.vorDar = null;
}
/** Leiste der Analyseansicht (unten, über der Werkzeugleiste) neu zeichnen. */
function avLeiste() {
  let e = document.getElementById('avBar');
  if (!AV.an) {
    if (e) e.remove();
    return;
  }
  if (!e) {
    e = document.createElement('div');
    e.id = 'avBar';
    e.style.cssText =
      'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:30;display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.94);box-shadow:0 2px 12px rgba(0,0,0,.15);font-size:12.5px;white-space:nowrap';
    document.body.appendChild(e);
  }
  const erg = WI.erg,
    txt =
      WI.st === 'rechnet'
        ? 'Strömung wird berechnet …'
        : erg
          ? `Wind ${WI_ROSE16[Math.round(erg.r / 22.5) % 16]} ${Math.round(erg.r)}° · ${erg.v10} m/s`
          : 'Noch kein Ergebnis';
  e.innerHTML = `<b>Analyseansicht</b><span>${txt}</span>${erg && WI.st !== 'rechnet' ? '<button class="sm" onclick="anSpeichern()">Speichern</button>' : ''}<button class="sm" onclick="avAus()">Schließen</button>`;
}

/** Kurzer Hinweis über der Werkzeugleiste (verschwindet nach einigen Sekunden). */
function anHinweis(t) {
  let e = document.getElementById('anHinweis');
  if (!e) {
    e = document.createElement('div');
    e.id = 'anHinweis';
    e.style.cssText =
      'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:31;padding:6px 12px;border-radius:10px;background:#1f2a33;color:#fff;font-size:12px;max-width:80vw';
    document.body.appendChild(e);
  }
  e.textContent = t;
  clearTimeout(AV.hinweisT);
  AV.hinweisT = setTimeout(() => e.remove(), 4000);
}

// ---- Feld kodieren / dekodieren
async function anPacken(f) {
  const q = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) q[i] = Math.max(-32767, Math.min(32767, Math.round(f[i] * AN_SKALA)));
  const z = await new Response(
    new Blob([q.buffer]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  const b = new Uint8Array(z);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function anEntpacken(t) {
  const s = atob(t),
    b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  const roh = await new Response(
    new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
  const q = new Int16Array(roh),
    f = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) f[i] = q[i] / AN_SKALA;
  return f;
}

/** Planungsstand einer Variante als Vergleichswert (gleicher Aufbau wie vSig()). */
function anSigVariante(v) {
  return JSON.stringify([v.data, v.areas, v.lab, v.plm]);
}
/** Hat sich die Planung seit dem Speichern der Analyse geändert? */
function anVeraltet(a) {
  const v = a.varId && S.variants.find((x) => x.id === a.varId);
  if (v && !vAct(v)) return anSigVariante(v) !== a.sig;
  return vSig() !== a.sig;
}

/** Aktuelles Windergebnis speichern (an der aktiven Variante, sonst ohne Variante). */
async function anSpeichern() {
  if (!WI.roh || !WI.gitter || !WI.erg) return;
  const gt = WI.gitter,
    e = WI.erg,
    v = S.variants.find((x) => vAct(x));
  try {
    const a = {
      id: 'a' + Date.now().toString(36),
      art: 'wind',
      name: `Wind ${WI_ROSE16[Math.round(e.r / 22.5) % 16]} ${Math.round(e.r)}° · ${e.v10} m/s`,
      datum: new Date().toISOString(),
      varId: v ? v.id : null,
      sig: vSig(),
      p: WI.p.slice(),
      wi: { r: S.wi.r, v: S.wi.v, radius: S.wi.radius, dx: S.wi.dx },
      n: [gt.nx, gt.ny, gt.nz],
      dauer: WI.dauer,
      u: await anPacken(WI.roh.u),
      ti: await anPacken(WI.roh.ti),
    };
    S.analysen.push(a);
    anHinweis(
      `Analyse gespeichert${v ? ' unter „' + v.name + '“' : ' (ohne Variante)'} – Liste im Reiter „Varianten“.`,
    );
  } catch (err) {
    logErr(err, 'anSpeichern');
    anHinweis('Analyse konnte nicht gespeichert werden: ' + ((err && err.message) || err));
  }
  rr();
}

/** Gespeicherte Analyse anzeigen: ggf. Variante laden, Feld wiederherstellen, Analyseansicht öffnen. */
async function anZeigen(id) {
  const a = S.analysen.find((x) => x.id === id);
  if (!a) return;
  const vi = a.varId ? S.variants.findIndex((x) => x.id === a.varId) : -1;
  if (vi >= 0 && !vAct(S.variants[vi])) lv(vi);
  try {
    wiAbbrechen();
    Object.assign(S.wi, a.wi);
    S.wi.selbst = true;
    WI.p = a.p.slice();
    const gt = wiGitter();
    if (gt.nx !== a.n[0] || gt.ny !== a.n[1] || gt.nz !== a.n[2])
      throw new Error('Rechengitter passt nicht mehr (Gelände oder Höhen geändert) – bitte neu berechnen');
    const u = await anEntpacken(a.u),
      ti = await anEntpacken(a.ti);
    WI.gitter = gt;
    WI.roh = { u, ti };
    WI.erg = wiAuswerten(gt, u, ti);
    WI.st = 'fertig';
    WI.dauer = a.dauer;
    EM.erg = null;
    go('Analyse');
    S.anT = 'wi';
    avAn();
    wiZeichnen();
    rr();
  } catch (err) {
    logErr(err, 'anZeigen');
    anHinweis('Analyse nicht anzeigbar: ' + ((err && err.message) || err));
  }
}
function anLoeschen(id) {
  const a = S.analysen.find((x) => x.id === id);
  if (!a || !confirm('Analyse „' + a.name + '“ löschen?')) return;
  S.analysen = S.analysen.filter((x) => x !== a);
  rr();
}

/** Liste gespeicherter Analysen (einer Variante bzw. ohne Variante) für den Reiter „Varianten“. */
function anListe(varId) {
  const L = S.analysen.filter((a) =>
    varId ? a.varId === varId : !a.varId || !S.variants.some((v) => v.id === a.varId),
  );
  if (!L.length) return '';
  return `<div style="margin:-2px 0 8px 10px;padding-left:8px;border-left:2px solid var(--ln);font-size:12px">${L.map(
    (a) =>
      `<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span style="flex:1"><b>${esc(a.name)}</b><br><span class="dmu">${new Date(a.datum).toLocaleDateString('de-DE')} · Radius ${a.wi.radius} m${anVeraltet(a) ? ' · <span style="color:#b56a00" title="Planung seit dem Speichern geändert – neu berechnen für aktuelle Werte">veraltet</span>' : ''}</span></span><button class="sm" onclick="anZeigen('${a.id}')">Anzeigen</button><button class="sm" onclick="anLoeschen('${a.id}')" title="Analyse löschen">×</button></div>`,
  ).join('')}</div>`;
}
/** Analysen ohne (noch vorhandene) Variante. */
function anListeOhne() {
  const h = anListe(null);
  return h ? `<h4>Analysen ohne Variante</h4>${h}` : '';
}
