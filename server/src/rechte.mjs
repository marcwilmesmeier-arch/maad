// Rechte, Abos und Rollen.

/** Rechte, die das Tool kennt. Die ersten vier entfernen im Code Funktionen (tools/demo.mjs: SPERREN). */
export const RECHTE = {
  project_new: 'Neues Projekt anlegen',
  project_open: 'Projekte öffnen und speichern',
  export_xlsx: 'Excel-Export',
  export_ifc: 'IFC-Export',
  lod: 'Detailstufen LoD2/LoD3',
  team: 'Projekte im Team teilen',
  own_sources: 'Eigene Datenquellen',
};
export const ALLE_RECHTE = Object.keys(RECHTE);

/** Abo -> Obergrenze der Rechte des Mandanten (vom Betreiber je Mandant änderbar). */
export const ABOS = {
  starter: ['project_new', 'project_open', 'export_xlsx'],
  buero: ['project_new', 'project_open', 'export_xlsx', 'export_ifc', 'lod', 'team'],
  enterprise: ALLE_RECHTE,
};

export const ROLLEN = { betreiber: 'Betreiber', admin: 'Mandanten-Admin', nutzer: 'Nutzer' };

export const nurBekannte = (L) => [
  ...new Set((Array.isArray(L) ? L : []).filter((r) => ALLE_RECHTE.includes(r))),
];

/**
 * Wirksame Rechte eines Nutzers:
 * Betreiber: alle. Mandanten-Admin: alle Rechte des Mandanten.
 * Nutzer: Rechte seiner Gruppen, begrenzt auf die Rechte des Mandanten.
 */
export function wirksameRechte(nutzer, mandant, gruppenRechte) {
  if (nutzer.rolle === 'betreiber') return [...ALLE_RECHTE];
  if (!mandant) return [];
  const grenze = JSON.parse(mandant.rechte || '[]');
  if (nutzer.rolle === 'admin') return grenze;
  const aus = new Set(gruppenRechte.flatMap((g) => JSON.parse(g || '[]')));
  return grenze.filter((r) => aus.has(r));
}
