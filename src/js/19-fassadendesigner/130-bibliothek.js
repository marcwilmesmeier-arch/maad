// ======================= BIBLIOTHEK: eigene Öffnungstypen und Gruppen projektübergreifend =======================
// Selbst angelegte oder geänderte Fenster/Türen (S.oet) und Öffnungsgruppen (S.oeg) werden bei jeder Änderung im
// Browser gemerkt (localStorage 'maad.bib.v1' = { oet: [...], oeg: [...] }) und stehen in neuen Projekten zur
// Verfügung. Vorgaben (OET0/OEG0) werden nur gemerkt, wenn sie geändert wurden.
// Neues Projekt: Bibliothek ersetzt gleichnamige Vorgaben und ergänzt den Rest.
// Projekt öffnen: das Projekt gewinnt, Bibliothek und Vorgaben ergänzen nur fehlende Schlüssel; eigene Einträge des Projekts
// werden danach selbst in die Bibliothek übernommen.
// Löschen im Konfigurator entfernt den Eintrag auch aus der Bibliothek.

const BIB_KEY = 'maad.bib.v1';

/** Bibliothek lesen (geprüft); leer, wenn nichts gespeichert ist oder der Speicher gesperrt ist. */
function bibLesen() {
  try {
    const o = JSON.parse(localStorage.getItem(BIB_KEY) || 'null');
    if (!o || typeof o !== 'object') return { oet: [], oeg: [] };
    return {
      oet: Array.isArray(o.oet) ? oeTypenPruefen(o.oet) : [],
      oeg: Array.isArray(o.oeg) ? oegPruefen(o.oeg) : [],
    };
  } catch (e) {
    logErr(e, 'bibLesen');
    return { oet: [], oeg: [] };
  }
}
function bibSchreiben(B) {
  try {
    localStorage.setItem(BIB_KEY, JSON.stringify(B));
  } catch (e) {
    logErr(e, 'bibSchreiben');
  }
}
/** Eintrag weicht von der Vorgabe gleichen Schlüssels ab (oder ist keine Vorgabe). */
function bibEigen(x, V) {
  const v = V.find((y) => y.k === x.k);
  return !v || JSON.stringify(v) !== JSON.stringify(x);
}
/** Eigene Typen und Gruppen des Projekts in die Bibliothek übernehmen (gleicher Schlüssel wird ersetzt). */
function bibMerken() {
  const B = bibLesen(),
    rein = (L, neu) =>
      neu.forEach((x) => {
        const i = L.findIndex((y) => y.k === x.k),
          c = JSON.parse(JSON.stringify(x));
        if (i >= 0) L[i] = c;
        else L.push(c);
      });
  rein(
    B.oet,
    S.oet.filter((t) => bibEigen(t, OET0)),
  );
  rein(
    B.oeg,
    S.oeg.filter((G) => bibEigen(G, OEG0)),
  );
  bibSchreiben(B);
}
/** Eintrag aus der Bibliothek entfernen (art 'oet' oder 'oeg'). */
function bibEntfernen(art, k) {
  const B = bibLesen();
  B[art] = B[art].filter((x) => x.k !== k);
  bibSchreiben(B);
}
/**
 * Bibliothek ins Projekt holen. neu = true (neues Projekt): Bibliothek ersetzt gleiche Schlüssel; sonst werden nur
 * fehlende ergänzt.
 */
function bibErgaenzen(neu) {
  const B = bibLesen(),
    holen = (L, Q) =>
      Q.forEach((x) => {
        const i = L.findIndex((y) => y.k === x.k);
        if (i < 0) L.push(x);
        else if (neu) L[i] = x;
      });
  holen(S.oet, B.oet);
  holen(S.oeg, B.oeg);
  // neue Vorgaben (z. B. Raster-Fassade) auch in bestehenden Projekten, sofern der Schlüssel dort fehlt
  const fehlend = (L, V) =>
    V.forEach((x) => {
      if (!L.some((y) => y.k === x.k)) L.push(JSON.parse(JSON.stringify(x)));
    });
  fehlend(S.oet, OET0);
  fehlend(S.oeg, OEG0);
}
