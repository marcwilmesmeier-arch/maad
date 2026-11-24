// ---- LOD 200: Ruhebündel – ein Gebäude in Ruhe wird mit wenigen Zeichenaufrufen gezeichnet
// Jedes Bauteil (Wand, Decke, Dach …) ist ein eigenes Objekt mit eigenen Materialien; große Gebäude kommen so auf
// über tausend Zeichenaufrufe je Bild, doppelt mit Schatten – die Kamera ruckelt. Steht ein Gebäude still (Aufbau
// fertig, nichts gewählt, keine Analyse, Explosion oder Schnitt), werden seine Meshes nach gleichem Material zu
// wenigen großen Meshes zusammengefasst; die Bauteile bleiben unverändert erhalten, ihre Meshes nur ausgeblendet.
// Sobald etwas die Bauteile einzeln braucht, wird das Bündel aufgelöst. Geometrie und Materialien sind dieselben –
// das Bild ändert sich nicht.

const L2RB = { g: new T.Group(), bau: new Map() }; // Gebäude-ID → { sig, ms: [Mesh], aus: [Mesh] }
L2RB.g.name = 'l2Buendel';
sc.add(L2RB.g);

/** Dürfen Bündel bestehen? (nichts braucht die Bauteile einzeln) */
function l2bErlaubt() {
  return (
    l2on() &&
    G.l2.visible &&
    !l23() &&
    !(S.l2 && (S.l2.iso || S.l2.pick)) &&
    !(S.expl && S.expl.cur > 0.01) &&
    !(typeof ZI !== 'undefined' && ZI.sp) &&
    !(typeof L2CUT !== 'undefined' && L2CUT.m !== 'off') &&
    S.dar !== 'realp'
  );
}
/** Material, das gebündelt werden darf, und sein Schlüssel ('' = einzeln lassen: Schraffur, Glas, durchscheinend). */
function l2bMatKey(m) {
  if (!m || Array.isArray(m) || m.transparent || m.onBeforeCompile !== T.Material.prototype.onBeforeCompile)
    return '';
  if (!m.color) return '';
  return [
    m.type,
    m.color.getHexString(),
    m.emissive ? m.emissive.getHexString() : '',
    m.side,
    m.polygonOffset ? m.polygonOffsetFactor + ',' + m.polygonOffsetUnits : '',
    m.vertexColors ? 1 : 0,
    m.map ? m.map.uuid : '',
    m.depthWrite ? 1 : 0,
    m.userData.ftC || '',
  ].join('|');
}
/** Bündel eines Gebäudes auflösen: Meshes der Bauteile wieder zeigen. */
function l2bLoesen(bid) {
  const B = L2RB.bau.get(bid);
  if (!B) return;
  B.aus.forEach((o) => {
    if (o.userData._l2b) {
      delete o.userData._l2b;
      o.visible = true;
    }
  });
  B.ms.forEach((m) => {
    L2RB.g.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  L2RB.bau.delete(bid);
}
/** Bündel eines Gebäudes aus seinen Bauteilen (its) bauen. */
function l2bBauen(bid, its, sig) {
  const gruppen = new Map(),
    aus = [];
  its.forEach((it) => {
    it.g.updateMatrixWorld(true);
    it.g.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
      // nur sichtbare Meshes, deren ganze Kette sichtbar ist
      for (let p = o.parent; p && p !== it.g.parent; p = p.parent) if (!p.visible) return;
      const mk = l2bMatKey(o.material);
      if (!mk) return;
      const at = Object.keys(o.geometry.attributes).sort().join(','),
        k = mk + '|' + at + '|' + o.castShadow + o.receiveShadow;
      let a = gruppen.get(k);
      if (!a) gruppen.set(k, (a = []));
      a.push(o);
    });
  });
  const ms = [];
  gruppen.forEach((L) => {
    const o0 = L[0],
      namen = Object.keys(o0.geometry.attributes),
      n = L.reduce(
        (s, o) => s + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count),
        0,
      ),
      daten = namen.map((nm) => new Float32Array(n * o0.geometry.attributes[nm].itemSize));
    let off = 0;
    L.forEach((o) => {
      const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      ge.applyMatrix4(o.matrixWorld);
      const c = ge.attributes.position.count;
      namen.forEach((nm, i) => {
        const a = ge.attributes[nm];
        daten[i].set(a.array.subarray(0, c * a.itemSize), off * a.itemSize);
      });
      off += c;
      ge.dispose();
    });
    const ge = new T.BufferGeometry();
    namen.forEach((nm, i) => {
      const a = o0.geometry.attributes[nm];
      ge.setAttribute(
        nm,
        new T.BufferAttribute(daten[i].subarray(0, off * a.itemSize), a.itemSize, a.normalized),
      );
    });
    ge.computeBoundingSphere();
    const m = new T.Mesh(ge, o0.material.clone());
    m.castShadow = o0.castShadow;
    m.receiveShadow = o0.receiveShadow;
    m.raycast = () => {};
    m.userData.bid = bid;
    m.matrixAutoUpdate = false;
    L2RB.g.add(m);
    ms.push(m);
    L.forEach((o) => {
      o.userData._l2b = 1;
      o.visible = false;
      aus.push(o);
    });
  });
  L2RB.bau.set(bid, { sig, ms, aus });
}
/**
 * Vor jedem Bild: Bündel bauen, wo ein Gebäude ruht, und auflösen, wo Bauteile einzeln gebraucht werden. Je Bild
 * höchstens ein neues Bündel (der Aufbau verteilt sich).
 */
function l2Ruhe() {
  const an = l2bErlaubt();
  L2RB.g.visible = G.l2.visible;
  if (!an) {
    if (L2RB.bau.size) [...L2RB.bau.keys()].forEach(l2bLoesen);
    return;
  }
  // Bauteile je Gebäude; ein Gebäude ruht, wenn alle fertig eingeblendet sind und keines gewählt/überfahren ist
  const je = new Map();
  for (const it of L2I.values()) {
    const bid = it.el.bid;
    let a = je.get(bid);
    if (!a) je.set(bid, (a = { its: [], ruhig: true }));
    a.its.push(it);
    if (it.mat.transparent || it.g.scale.y !== 1 || S.l2.sel === it.el.id || S.l2.hv === it.el.id)
      a.ruhig = false;
  }
  for (const bid of [...L2RB.bau.keys()]) if (!je.has(bid) || !je.get(bid).ruhig) l2bLoesen(bid);
  let neu = 0;
  je.forEach((a, bid) => {
    if (!a.ruhig || neu) return;
    const sig = a.its.map((it) => it.gen).join(',');
    const B = L2RB.bau.get(bid);
    if (B && B.sig === sig) return;
    if (B) l2bLoesen(bid);
    try {
      l2bBauen(bid, a.its, sig);
    } catch (e) {
      logErr(e, 'l2Ruhe');
      l2bLoesen(bid);
    }
    neu++;
  });
}
