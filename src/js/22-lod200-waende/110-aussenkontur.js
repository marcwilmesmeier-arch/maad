/* Außenkontur in LOD 200: nur die wirklichen Außenkanten des Baukörpers (echte Ecken über 20° Knick, Fuß, Dachrand,
   Auskragungen und Rücksprünge zwischen Geschossen, Dachkanten geneigter Dächer) – keine Unterteilungen der Wände,
   Decken oder Öffnungen. Sichtbar mit dem Layer „Gebäudekontur“ (bkont, S.noK aus), in der Explosionsansicht ausgeblendet (dort zeigen die
   Bauteile ihre eigenen Kanten).
   Fette Kontur (16-darstellung-erweitert/010): wie bei Umgebungsgebäuden nur die Silhouette, hinter dem Gebäude. Eine
   Hülle schiene durch die Fensterlöcher; deshalb werden je Bild die Kanten gesucht, an denen eine angrenzende Fläche
   zur Kamera und die andere von ihr weg zeigt, und als breite Linie leicht hinter dem Gebäude gezeichnet. */
const L2KO = new Map(); // Gebäude-ID → { sig, ln }
/** Außenkontur von Gebäude b: p = Kantenpunkte [x, y, z, x, y, z, …], n = je Kante die Normalen der beiden
    angrenzenden Flächen [n1x, n1y, n1z, n2x, n2y, n2z, …] (für die Silhouette). */
function l2KonturPunkte(b) {
  const out = [],
    nor = [],
    L = b.levels
      .map((l, j) => ({ l, j, f: lf(b, l), z0: skZ(b, j), z1: skZ(b, j) + l.h }))
      .filter((x) => !x.l.ug);
  if (!L.length) return out;
  const seg = (a, c, y, n1, n2) => {
      out.push(a[0], y, a[1], c[0], y, c[1]);
      nor.push(...n1, ...n2);
    },
    flaeche = (f) => {
      let A = 0;
      for (let i = 0; i < f.length; i++) {
        const p = f[i],
          q = f[(i + 1) % f.length];
        A += p[0] * q[1] - q[0] * p[1];
      }
      return A;
    },
    // Ring f auf Höhe y abgehen; Stücke, an denen die Wand gerade weiterläuft (Nachbargeschoss g), auslassen
    // oben: Kante oben am Geschoss (true) oder unten (false)
    // att: Attika-Höhe an Terrassenrändern (Rand oben, kein Geschoss darüber)
    rand = (f, y, g, oben, att) => {
      const n = f.length,
        sg = flaeche(f) > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = f[i],
          c = f[(i + 1) % n],
          len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 0.05) continue;
        const ux = (c[0] - a[0]) / len,
          uz = (c[1] - a[1]) / len,
          nx = sg > 0 ? uz : -uz,
          nz = sg > 0 ? -ux : ux,
          k = Math.max(1, Math.ceil(len / 0.5));
        let start = null,
          art = 0;
        for (let s = 0; s <= k; s++) {
          // 0 = keine Kante, 1 = Rand zur waagerechten Fläche dieses Geschosses (Dach/Unterseite), 2 = zur Fläche davor
          let a2 = 0;
          if (s < k) {
            const t = ((s + 0.5) / k) * len,
              m = [a[0] + ux * t, a[1] + uz * t],
              rein = g && inP([m[0] - nx * 0.05, m[1] - nz * 0.05], g),
              raus = g && inP([m[0] + nx * 0.05, m[1] + nz * 0.05], g);
            a2 = !g || !rein ? 1 : raus ? 2 : 0;
          }
          const t0 = (s / k) * len,
            P = [a[0] + ux * t0, a[1] + uz * t0];
          if (start && a2 !== art) {
            // waagerechte Nachbarfläche: oben Dach (nach oben) bzw. Terrasse davor; unten Unterseite bzw. Sockel
            const w = [nx, 0, nz],
              h = art === 1 ? [0, oben ? 1 : -1, 0] : [0, oben ? -1 : 1, 0];
            seg(start, P, y + (oben && art === 1 ? att || 0 : 0), w, h);
            start = null;
          }
          if (a2 && !start) {
            start = P;
            art = a2;
          }
        }
      }
    };
  // Attika 0,30 m über dem obersten Geschoss bei Flachdach (wie l2Els, 020-ableitung: hAt)
  const flach = !b.roof || !b.roof.type || b.roof.type === 'flat',
    letzt = b.levels.length - 1;
  L.forEach((x) => {
    if (flach && x.j === letzt) x.z1 += 0.3;
  });
  L.forEach((x, q) => {
    const unten = L[q - 1] && L[q - 1].j === x.j - 1 ? L[q - 1].f : null,
      oben = L[q + 1] && L[q + 1].j === x.j + 1 ? L[q + 1].f : null;
    // senkrechte Kanten nur an echten Ecken (Normalen der beiden angrenzenden Wände)
    const sg = flaeche(x.f) > 0 ? 1 : -1,
      wn = (p, q) => {
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
          ux = (q[0] - p[0]) / L,
          uz = (q[1] - p[1]) / L;
        return sg > 0 ? [uz, 0, -ux] : [-uz, 0, ux];
      };
    x.f.forEach((v, i) => {
      if (!skEckeEcht(x.f, i)) return;
      const N = skEckeNachbarn(x.f, i),
        // Terrassenecke (nicht unter dem Geschoss darüber): Kante bis Oberkante Attika
        terr =
          oben &&
          !inP(
            [v[0] + (N[0][0] + N[1][0] - 2 * v[0]) * 0.01, v[1] + (N[0][1] + N[1][1] - 2 * v[1]) * 0.01],
            oben,
          );
      out.push(v[0], x.z0, v[1], v[0], x.z1 + (terr ? 0.3 : 0), v[1]);
      nor.push(...wn(N[0], v), ...wn(v, N[1]));
    });
    rand(x.f, x.z0, unten, false);
    // geneigtes Dach: über dem obersten Geschoss laufen Drempel und Giebel in derselben Ebene weiter – keine Kante
    if (flach || x.j !== letzt) rand(x.f, x.z1, oben, true, oben ? 0.3 : 0);
  });
  // geneigte Dächer: Kanten zwischen Dachflächen über 15° Knick und Ränder (Nachbarfläche dort: Wand darunter)
  if (b._rp && b._rp.geo && b.roof && b.roof.type && b.roof.type !== 'flat') {
    // Dachkanten aus der Dachform (01-modell-3d/020-mehrkoerper: roofKanten), keine Stoßstellen der Zerlegung
    const K = roofKanten(b._rp, lf(b, b.levels[b.levels.length - 1]));
    K.p.forEach((v) => out.push(v));
    K.n.forEach((v) => nor.push(v));
  }
  return { p: out, n: nor };
}
// Material der fetten Silhouette: wie die Fußlinie (KON.lm), aber doppelt breit und leicht nach hinten versetzt,
// damit nur der äußere Teil am Gebäude vorbei sichtbar ist (wie die Hülle der Umgebungsgebäude)
let L2KSM = null;
function l2KonturMat() {
  if (L2KSM) return L2KSM;
  L2KSM = new T.ShaderMaterial({
    uniforms: Object.assign({}, KON.U, { uB: { value: -0.35 } }),
    side: T.DoubleSide,
    vertexShader: KON.lm.vertexShader.replace('*uW*.5', '*uW'),
    fragmentShader: KON.lm.fragmentShader,
  });
  return L2KSM;
}
/** Fette Silhouette je Bild (aus konPre): Kanten, an denen eine Fläche zur Kamera und die andere weg zeigt. */
function l2KonturSil(cm) {
  if (!cm) return;
  const C = cm.position,
    ck = [C.x, C.y, C.z, cm.isOrthographicCamera ? 1 : 0].map((v) => v.toFixed(2)).join(',');
  L2KO.forEach((o) => {
    if (!o.fett || !o.fett.visible || o.ck === ck) return;
    o.ck = ck;
    const p = o.p,
      n = o.n,
      sil = [],
      d = new T.Vector3();
    if (cm.isOrthographicCamera) cm.getWorldDirection(d).negate();
    for (let i = 0; i < p.length / 6; i++) {
      const mx = (p[i * 6] + p[i * 6 + 3]) / 2,
        my = (p[i * 6 + 1] + p[i * 6 + 4]) / 2,
        mz = (p[i * 6 + 2] + p[i * 6 + 5]) / 2,
        vx = cm.isOrthographicCamera ? d.x : C.x - mx,
        vy = cm.isOrthographicCamera ? d.y : C.y - my,
        vz = cm.isOrthographicCamera ? d.z : C.z - mz,
        f1 = n[i * 6] * vx + n[i * 6 + 1] * vy + n[i * 6 + 2] * vz > 0,
        f2 = n[i * 6 + 3] * vx + n[i * 6 + 4] * vy + n[i * 6 + 5] * vz > 0;
      if (f1 !== f2) for (let q = 0; q < 6; q++) sil.push(p[i * 6 + q]);
    }
    const g = konQuads(sil);
    o.fett.geometry.dispose();
    o.fett.geometry = g || new T.BufferGeometry();
  });
}
/** Konturen der geplanten Gebäude aktuell halten (Takt aus 030-aktionen). */
function l2Kontur() {
  // dünne Linien folgen dem Layer „Gebäudekontur“ (bkont), die fette Silhouette dem Schalter „Fette Außenkontur“
  const lk = LY.find((l) => l[1] === 'bkont'),
    duenn = !lk || !!lk[2],
    an = l2on(),
    ex = !!(S.expl && S.expl.cur > 0.05) || l23(),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an || l2Unruhig(b)) return; // in Bewegung: ruht
    da.add(b.id);
    const sig = skSig(b) + '|' + JSON.stringify(b.roof || {}) + '|' + (b._rp ? b._rp.h : 0);
    let o = L2KO.get(b.id);
    if (!o || o.sig !== sig) {
      if (o) l2KonturWeg(o);
      const K = l2KonturPunkte(b),
        ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(K.p), 3));
      const ln = new T.LineSegments(ge, new T.LineBasicMaterial({ color: 0x4a4a4a }));
      ln.userData.kont = 1;
      ln.raycast = () => {};
      G.l2.add(ln);
      // fette Kontur: Silhouette, je Bild aus den Kanten neu bestimmt (l2KonturSil)
      const fett = new T.Mesh(new T.BufferGeometry(), l2KonturMat());
      fett.frustumCulled = false;
      fett.raycast = () => {};
      KON.g.add(fett);
      o = { sig, ln, fett, p: K.p, n: K.n, ck: '' };
      L2KO.set(b.id, o);
    }
    o.ln.visible = duenn && !S.noK && !ex;
    if (o.fett) o.fett.visible = !ex;
  });
  L2KO.forEach((o, id) => {
    if (da.has(id)) return;
    l2KonturWeg(o);
    L2KO.delete(id);
  });
}
function l2KonturWeg(o) {
  G.l2.remove(o.ln);
  o.ln.geometry.dispose();
  if (o.fett) {
    KON.g.remove(o.fett);
    o.fett.geometry.dispose();
  }
}
