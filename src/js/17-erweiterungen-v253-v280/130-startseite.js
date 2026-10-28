/* v318: Startseite – die Darstellung (Schattiert / Realistisch / Weißmodell) kommt komplett aus den in der Administration gespeicherten Voreinstellungen
   (Ebenen, Farben, Licht, Effekte). Kleiner Schalter „Darstellung“ unten rechts; voreingestellt bleibt Schattiert. */
const RFD = ['sch', 'real', 'wm'];
function homePreset() {
  try {
    if (ADM.cfg && ADM.cfg.modes && ADM.cfg.modes[S.dar]) admModeApply(S.dar);
  } catch (e) {
    console.error(e);
  }
  try {
    rfBtn();
  } catch (e) {
    logErr(e, 'homePreset');
  }
}
function homeDar(m) {
  try {
    if (ADM.cfg && ADM.cfg.modes && ADM.cfg.modes[m]) admModeApply(m);
    else drSet(m);
  } catch (e) {
    console.error(e);
    try {
      drSet(m);
    } catch (e) {
      logErr(e, 'homeDar');
    }
  }
  try {
    rfBtn();
  } catch (e) {
    logErr(e, 'homeDar');
  }
}
function rfBtn() {
  const h = document.getElementById('home');
  if (!h) return;
  let d = document.getElementById('hDarB');
  if (!d) {
    d = document.createElement('button');
    d.type = 'button';
    d.id = 'hDarB';
    d.style.cssText =
      'position:absolute;right:22px;bottom:22px;z-index:5;pointer-events:auto;border:1px solid rgba(31,42,51,.18);background:rgba(233,237,239,.92);color:#1F2A33;border-radius:999px;padding:7px 14px;font:600 12px lot_montserrat,system-ui,sans-serif;cursor:pointer;user-select:none';
    d.onclick = (ev) => {
      ev.stopPropagation();
      homeDar(RFD[(RFD.indexOf(S.dar) + 1) % RFD.length]);
    };
    h.appendChild(d);
  }
  d.textContent = 'Darstellung: ' + (DAR.find((x) => x[0] === S.dar) || [0, S.dar])[1];
  d.title =
    'Darstellung der Startseite wechseln (Schattiert → Realistisch → Weißmodell) – jeweils mit den gespeicherten Voreinstellungen';
}
// homeOpen(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js
// demoLoad(): Erweiterung zusammengeführt, siehe 03-startseite/010-demokarte.js
// drSet(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
try {
  if (HOME.open) rfBtn();
} catch (e) {
  console.error(e);
}

/* Rasen-Foto (Draufsicht einer Wiese), Tiefpass-bereinigt: Pixelwert = relative Helligkeit/Farbe (Mittel 1) / 2 – nur Struktur, keine Grundfarbe */
