// ======================= EMISSIONEN: AUSBREITUNG IM WINDFELD =======================
// Lagrange-Teilchenmodell: Eine Punktquelle (Schornstein oder Kfz-Abgase) gibt laufend Teilchen ab, die mit dem
// berechneten mittleren Windfeld (3D) transportiert werden und sich nach der örtlichen Schwankung (Turbulenzgrad)
// zufällig ausbreiten. Boden: Reflexion, Gebäude: Teilchen bleibt an der alten Stelle, Fensterrand: Teilchen verlässt
// den Rechenraum. Ergebnis: Zusatzbelastung in Fußgängerhöhe (µg/m³ bei konstantem Wind und konstanter Rate) und
// eine Momentaufnahme der Teilchenwolke. Nicht berücksichtigt: Abgasfahnenüberhöhung, Chemie, Ablagerung.
//
// wiAusbreitung() ist eine reine Rechenfunktion (Hintergrund-Thread, Node-Test).

/**
 * @param {{nx:number, ny:number, nz:number, dx:number, fest:Uint8Array, u:Float32Array, ti:Float32Array,
 *          skala:number, quelle:number[], rate:number, streu:number, dauer:number, dt:number, proSchritt:number,
 *          seed:number}} a  u/ti in Gittereinheiten, skala: m/s je Gittereinheit, quelle: [i, j, k] (Zellen),
 *          rate: g/s, streu: Quellbreite in Zellen, dauer/dt in s
 * @returns {{c:Float32Array, punkte:Float32Array, n:number}} c: µg/m³ je Bodenzelle, punkte: Teilchen [i, j, k] …
 */
function wiAusbreitung(a, fortschritt) {
  const { nx, ny, nz, dx, fest, u, ti, skala } = a,
    schritte = Math.round(a.dauer / a.dt),
    anlauf = Math.round(schritte * 0.4), // erst nach dem Anlauf mitzählen (Fahne muss sich ausbilden)
    max = schritte * a.proSchritt,
    px = new Float32Array(max),
    py = new Float32Array(max),
    pz = new Float32Array(max),
    lebt = new Uint8Array(max),
    c = new Float64Array(nx * ny);
  let seed = a.seed || 1,
    anzahl = 0;
  const zufall = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648,
    normal = () => Math.sqrt(-2 * Math.log(zufall() + 1e-12)) * Math.cos(2 * Math.PI * zufall());
  const zelle = (i, j, k) => {
    const ii = Math.min(nx - 1, Math.max(0, i | 0)),
      jj = Math.min(ny - 1, Math.max(0, j | 0)),
      kk = Math.min(nz - 1, Math.max(0, k | 0));
    return ii + nx * (jj + ny * kk);
  };
  const masse = (a.rate * a.dt) / a.proSchritt, // g je Teilchen
    dtz = a.dt / dx; // Zeitschritt in Zellen je (m/s)
  for (let t = 0; t < schritte; t++) {
    for (let n = 0; n < a.proSchritt; n++) {
      const p = anzahl++;
      px[p] = a.quelle[0] + normal() * a.streu;
      py[p] = a.quelle[1] + normal() * a.streu;
      pz[p] = a.quelle[2];
      lebt[p] = 1;
    }
    const zaehlen = t >= anlauf;
    for (let p = 0; p < anzahl; p++) {
      if (!lebt[p]) continue;
      const c0 = zelle(px[p], py[p], pz[p]),
        vx = u[3 * c0] * skala,
        vy = u[3 * c0 + 1] * skala,
        vz = u[3 * c0 + 2] * skala,
        sp = Math.hypot(vx, vy, vz),
        // Schwankung m/s: aufgelöste Turbulenz, mindestens der in Städten übliche Anteil (~18 % der Geschwindigkeit),
        // den das grobe Gitter nicht auflöst
        sig = Math.max(0.15, ti[c0] * skala, 0.18 * sp),
        tl = dx / Math.max(sp, 0.5), // Lagrange-Zeitskala ~ Zellweite / Geschwindigkeit
        K = sig * sig * tl + 0.05, // Diffusionskoeffizient m²/s
        s = Math.sqrt(2 * K * a.dt) / dx;
      const ni = px[p] + vx * dtz + normal() * s,
        nj = py[p] + vy * dtz + normal() * s;
      let nk = pz[p] + vz * dtz + normal() * s;
      if (nk < 0) nk = -nk; // Boden: Reflexion
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny || nk >= nz) {
        lebt[p] = 0;
        continue;
      }
      if (!fest[zelle(ni, nj, nk)]) {
        px[p] = ni;
        py[p] = nj;
        pz[p] = nk;
      }
      if (zaehlen && pz[p] < 1) c[zelle(px[p], py[p], 0)] += masse * a.dt;
    }
    if (fortschritt && t % 20 === 0) fortschritt(t / schritte);
  }
  // Konzentration: Masse × Aufenthaltszeit / (Zellvolumen × Mittelungszeit), g/m³ -> µg/m³
  const T = (schritte - anlauf) * a.dt,
    vol = dx * dx * dx,
    out = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) out[i] = (c[i] / (vol * T)) * 1e6;
  const pk = [];
  for (let p = 0; p < anzahl; p++) if (lebt[p]) pk.push(px[p], py[p], pz[p]);
  return { c: out, punkte: Float32Array.from(pk), n: anzahl };
}

function wiAusbreitungHaupt() {
  self.onmessage = (e) => {
    try {
      const r = wiAusbreitung(e.data, (p) => self.postMessage({ p }));
      self.postMessage({ fertig: true, c: r.c, punkte: r.punkte }, [r.c.buffer, r.punkte.buffer]);
    } catch (err) {
      self.postMessage({ fehler: String((err && err.message) || err) });
    }
  };
}

// ---- Bedienung und Ablauf ----
S.em = { art: 'kfz', hoehe: 15, rate: 0.01, flaeche: true, punkte: true };
// Startwerte der Emissionsrate je Quellenart (grobe Größenordnung NOx, g/s)
const EM_RATE = { kfz: 0.01, schornstein: 0.03 };
const EM = { q: null, st: 'aus', anteil: 0, erg: null, fehler: '', worker: null, nachWind: false };
// Klassen der Zusatzbelastung in µg/m³ (zum Vergleich: Jahresgrenzwert NO2 40 µg/m³)
const EM_KLASSEN = [
  [1, '< 1 µg/m³', '#dfe9f0'],
  [5, '1–5', '#b9d7c4'],
  [10, '5–10', '#e8d96a'],
  [20, '10–20', '#f0a04b'],
  [40, '20–40', '#e05a3c'],
  [Infinity, '> 40', '#7a1f4a'],
];

/** Quelle im Modell wählen; danach wird gerechnet (bei Bedarf zuerst der Wind um die Quelle). */
function emWahl() {
  EM.st = 'wahl';
  const el = ren.domElement,
    klick = (ev) => {
      el.removeEventListener('click', klick, true);
      ev.stopPropagation();
      ev.preventDefault();
      const r = el.getBoundingClientRect(),
        m = new T.Vector2(
          ((ev.clientX - r.left) / r.width) * 2 - 1,
          -((ev.clientY - r.top) / r.height) * 2 + 1,
        ),
        rc = new T.Raycaster();
      rc.setFromCamera(m, act());
      const hit = rc.intersectObjects([G.terrain, G.buildings], true)[0];
      EM.st = 'aus';
      if (hit) {
        EM.q = [hit.point.x, hit.point.z];
        EM.erg = null;
        emStarten();
      }
      rr();
    };
  el.addEventListener('click', klick, true);
  rr();
}

/** Liegt die Quelle im berechneten Windfeld (mit Abstand zum Rand)? Sonst Wind um die Quelle neu rechnen. */
function emStarten() {
  if (!EM.q) return;
  const gt = WI.gitter,
    innen = (() => {
      if (!WI.roh || !gt) return false;
      const [i, j] = emGitter(EM.q[0], EM.q[1]);
      return i > gt.nx * 0.15 && i < gt.nx * 0.6 && j > gt.ny * 0.15 && j < gt.ny * 0.85;
    })();
  if (!innen) {
    // Quelle etwas in Luv des Fenstermittelpunkts: Die Fahne zieht mit dem Wind durch das Fenster
    const [fx, fz] = wiRichtung(S.wi.r),
      v = S.wi.fenster * 0.2;
    WI.p = [EM.q[0] + fx * v, EM.q[1] + fz * v];
    WI.erg = WI.roh = null;
    EM.nachWind = true;
    wiStarten();
    return;
  }
  emRechnen();
}
/** Welt -> Gitter (Zellkoordinaten, kontinuierlich). */
function emGitter(x, z) {
  const gt = WI.gitter,
    dx = x - WI.p[0],
    dz = z - WI.p[1];
  return [
    (dx * gt.f[0] + dz * gt.f[1]) / gt.dx + gt.nx / 2,
    (dx * gt.q[0] + dz * gt.q[1]) / gt.dx + gt.ny / 2,
  ];
}
function emRechnen() {
  const gt = WI.gitter,
    s = S.em;
  let [i, j] = emGitter(EM.q[0], EM.q[1]),
    hoehe = s.art === 'kfz' ? 0.5 : s.hoehe;
  const dach = gt.hoehe[Math.min(gt.nx - 1, i | 0) + gt.nx * Math.min(gt.ny - 1, j | 0)] || 0;
  EM.hinweis = '';
  if (dach > 0 && s.art === 'schornstein' && hoehe < dach + 2) {
    // Schornstein auf einem Gebäude: Mündung mindestens 2 m über Dach
    hoehe = dach + 2;
    EM.hinweis = `Mündung auf ${hoehe.toFixed(0)} m angehoben (2 m über Dach).`;
  } else if (dach > 0 && s.art === 'kfz') {
    // Kfz-Quelle auf einem Gebäude: nächste freie Stelle suchen
    let best = null;
    for (let rr = 1; rr < 15 && !best; rr++)
      for (let a = -rr; a <= rr && !best; a++)
        for (const [di, dj] of [
          [a, -rr],
          [a, rr],
          [-rr, a],
          [rr, a],
        ]) {
          const ii = (i | 0) + di,
            jj = (j | 0) + dj;
          if (ii >= 0 && jj >= 0 && ii < gt.nx && jj < gt.ny && !gt.hoehe[ii + gt.nx * jj]) {
            best = [ii + 0.5, jj + 0.5];
            break;
          }
        }
    if (best) [i, j] = best;
    EM.hinweis = 'Quelle lag auf einem Gebäude und wurde auf die nächste freie Fläche verschoben.';
  }
  EM.hoehe = hoehe;
  const skala = S.wi.v / WI_U10,
    dauer = Math.min(900, (gt.nx * gt.dx * 2.5) / Math.max(1, S.wi.v * 0.5));
  EM.st = 'rechnet';
  EM.anteil = 0;
  rr();
  const src = `${wiAusbreitung.toString()}\n(${wiAusbreitungHaupt.toString()})();`,
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
    wk = new Worker(url);
  URL.revokeObjectURL(url);
  EM.worker = wk;
  wk.onmessage = (e) => {
    const d = e.data;
    if (d.p != null) {
      EM.anteil = d.p;
      const b = $('emFort');
      if (b) b.style.width = Math.round(d.p * 100) + '%';
    } else if (d.fertig || d.fehler) {
      wk.terminate();
      EM.worker = null;
      if (d.fertig) {
        EM.erg = { c: d.c, punkte: d.punkte, gt };
        EM.st = 'fertig';
        S.wiZ.flaeche = false; // Windfläche ausblenden, damit die Belastung lesbar bleibt (Stromlinien bleiben)
      } else {
        EM.st = 'fehler';
        EM.fehler = d.fehler;
      }
      wiZeichnen();
      rr();
    }
  };
  wk.postMessage({
    nx: gt.nx,
    ny: gt.ny,
    nz: gt.nz,
    dx: gt.dx,
    fest: gt.fest,
    u: WI.roh.u,
    ti: WI.roh.ti,
    skala,
    quelle: [i, j, hoehe / gt.dx],
    rate: s.rate,
    streu: s.art === 'kfz' ? 1.2 : 0.2, // Kfz: verteilt über die Fahrbahn
    dauer,
    dt: 0.5,
    proSchritt: 6,
    seed: 7,
  });
}
function emSet(k, v) {
  if (k === 'art' && v !== S.em.art) S.em.rate = EM_RATE[v];
  S.em[k] = v;
  if (k === 'flaeche' || k === 'punkte') wiZeichnen();
  else if (EM.q && EM.erg && WI.roh) emRechnen();
  rr();
}

/** Darstellung: Konzentrationsfläche und Teilchenwolke (Punkte). Aufruf aus wiZeichnen(). */
function emZeichnen() {
  const e = EM.erg;
  if (EM.q) {
    // Quelle: Kfz als flache Scheibe auf der Straße, Schornstein als kurzer Kamin bis zur Mündung
    const kfz = S.em.art === 'kfz',
      top = kfz ? 0.3 : EM.hoehe || S.em.hoehe,
      l = kfz ? 0.3 : 3,
      m = new T.Mesh(
        kfz ? new T.CylinderGeometry(2.5, 2.5, l, 24) : new T.CylinderGeometry(0.6, 0.7, l, 12),
        new T.MeshBasicMaterial({ color: 0x4a3f38 }),
      );
    m.position.set(EM.q[0], gh(EM.q[0], EM.q[1]) + top - l / 2, EM.q[1]);
    m.raycast = () => {};
    WI_G.add(m);
  }
  if (!e) return;
  const gt = e.gt,
    { nx, ny } = gt;
  if (S.em.flaeche) {
    const data = new Uint8Array(nx * ny * 4),
      col = new T.Color();
    for (let c = 0; c < nx * ny; c++) {
      const v = e.c[c];
      if (!(v >= 0.2)) continue; // sehr geringe Werte durchsichtig
      col.set(EM_KLASSEN.find((k) => v < k[0])[2]);
      data.set([col.r * 255, col.g * 255, col.b * 255, 220], c * 4);
    }
    const tex = new T.DataTexture(data, nx, ny);
    tex.needsUpdate = true;
    const g = new T.PlaneGeometry(1, 1, nx, ny),
      p = g.attributes.position,
      uv = g.attributes.uv;
    for (let v = 0; v < p.count; v++) {
      const [x, z] = gt.welt(uv.getX(v) * nx - 0.5, uv.getY(v) * ny - 0.5);
      p.setXYZ(v, x, gh(x, z) + 0.45, z);
    }
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -6,
      }),
    );
    m.raycast = () => {};
    m.renderOrder = 2;
    WI_G.add(m);
  }
  if (S.em.punkte && e.punkte.length) {
    const n = e.punkte.length / 3,
      pos = new Float32Array(n * 3);
    for (let p = 0; p < n; p++) {
      const [x, z] = gt.welt(e.punkte[3 * p] - 0.5, e.punkte[3 * p + 1] - 0.5);
      pos[3 * p] = x;
      pos[3 * p + 1] = gh(x, z) + e.punkte[3 * p + 2] * gt.dx;
      pos[3 * p + 2] = z;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pt = new T.Points(
      g,
      new T.PointsMaterial({
        color: 0x4a3f38,
        size: 2.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
      }),
    );
    pt.raycast = () => {};
    WI_G.add(pt);
  }
}

/** Panel-Abschnitt „Emissionen“. */
function emPanel() {
  const s = S.em,
    e = EM.erg;
  let h = `<div class="card"><b>Emissionen</b><div class="dmu" style="margin:4px 0 8px">Ausbreitung von Abgasen einer Quelle im berechneten Windfeld (konstanter Wind, ohne Chemie). Liegt die Quelle außerhalb des Windfensters, wird der Wind zuerst um sie berechnet.</div>`;
  h += `<div style="display:flex;gap:4px;margin-bottom:6px">${[
    ['schornstein', 'Schornstein'],
    ['kfz', 'Kfz-Abgase'],
  ]
    .map(
      ([k, n]) => `<button class="sm ${s.art === k ? 'on' : ''}" onclick="emSet('art','${k}')">${n}</button>`,
    )
    .join('')}</div>`;
  if (s.art === 'schornstein')
    h += `<label style="display:block;font-size:12px">Höhe der Mündung über Gelände <input type="number" min="2" max="150" step="1" value="${s.hoehe}" style="width:60px" onchange="emSet('hoehe',+this.value)"> m</label>`;
  h += `<label style="display:block;font-size:12px;margin-top:4px">Emissionsrate <input type="number" min="0.001" step="0.01" value="${s.rate}" style="width:70px" onchange="emSet('rate',+this.value)"> g/s</label><div class="dmu">Rate des betrachteten Stoffs (z. B. NOx) – am besten aus Anlagen- oder Verkehrsdaten. Grobe Größenordnung NOx: stark befahrene Straße (~20.000 Kfz/Tag) ≈ 0,01 g/s je 100 m, Heizung Mehrfamilienhaus ≈ 0,01–0,05 g/s.</div>`;
  if (EM.st === 'rechnet')
    h += `<div style="margin-top:10px;height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="emFort" style="height:100%;width:${Math.round(EM.anteil * 100)}%;background:#5b4636"></div></div><div class="dmu">Ausbreitung wird berechnet …</div>`;
  else if (WI.st === 'rechnet' && EM.nachWind)
    h += `<div class="dmu" style="margin-top:8px">Zuerst wird der Wind um die Quelle berechnet …</div>`;
  else
    h += `<button class="pri" style="margin-top:10px;width:100%" onclick="emWahl()">${EM.st === 'wahl' ? 'Quelle im Modell anklicken …' : EM.q ? 'Neue Quelle setzen' : 'Quelle setzen'}</button>`;
  if (EM.st === 'fehler') h += `<div class="dmu" style="color:#b00">Fehler: ${esc(EM.fehler)}</div>`;
  if (e && EM.st === 'fertig') {
    let mx = 0;
    for (const v of e.c) if (v > mx) mx = v;
    h += `<div style="margin-top:8px"><label class="ck"><input type="checkbox" ${s.flaeche ? 'checked' : ''} onchange="emSet('flaeche',this.checked)"> Belastung am Boden</label> <label class="ck"><input type="checkbox" ${s.punkte ? 'checked' : ''} onchange="emSet('punkte',this.checked)"> Abgasfahne (Punkte)</label></div>`;
    h += EM_KLASSEN.map(
      (k) =>
        `<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:3px"><span style="width:14px;height:10px;background:${k[2]};border-radius:2px"></span><span>${k[1]}</span></div>`,
    ).join('');
    if (mx < 0.2)
      h += `<div class="dmu" style="margin-top:6px">Die Abgasfahne erreicht innerhalb des Rechenfensters den Boden nicht (hohe Quelle, Fahne zieht darüber hinweg).</div>`;
    if (EM.hinweis) h += `<div class="dmu" style="margin-top:6px">${esc(EM.hinweis)}</div>`;
    h += `<div class="dmu" style="margin-top:6px">Zusatzbelastung in ca. ${(e.gt.dx / 2).toFixed(1)} m Höhe, höchster Wert ${mx.toFixed(1)} µg/m³ – bei konstantem Wind aus ${WI_ROSE[Math.round(S.wi.r / 45) % 8]} mit ${S.wi.v} m/s (ungünstiger Dauerfall, kein Jahresmittel).</div>`;
  }
  return h + '</div>';
}
