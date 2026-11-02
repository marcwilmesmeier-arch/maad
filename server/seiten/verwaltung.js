// Verwaltungsoberfläche: Betreiber (alle Mandanten) und Mandanten-Admins (eigener Mandant).
// Alle Texte werden über textContent gesetzt (el()), nie als HTML.
import { $, api, el } from '/seiten/gemeinsam.js';

const STATUS = { aktiv: 'Aktiv', eingeladen: 'Eingeladen', gesperrt: 'Gesperrt' };
const zeit = (s) => (s ? s.replace('T', ' ').replace('Z', '') : '–');
let STAMM = null; // { rechte, abos, rollen, ich }
let MANDANTEN = [];
let MID = null; // gewählter Mandant
let GRUPPEN = [];
let tab = 'nutzer';

const betreiber = () => STAMM.ich.rolle === 'betreiber';
const mandant = () => MANDANTEN.find((m) => m.id === MID);
const rechteName = (r) => STAMM.rechte[r] || r;

async function sicher(fn, msgId) {
  try {
    await fn();
  } catch (e) {
    if (e.status === 401) location.href = '/anmelden';
    if (msgId) $(msgId).textContent = e.message;
    else alert(e.message);
  }
}

/** Haken für Rechte bzw. Gruppen in einen Container setzen. */
function haken(box, eintraege, gewaehlt) {
  box.textContent = '';
  for (const [wert, text] of eintraege)
    box.append(
      el(
        'label',
        {},
        el('input', { type: 'checkbox', value: String(wert), checked: gewaehlt.includes(wert) }),
        text,
      ),
    );
}
const gewaehlt = (box, zahl) =>
  [...box.querySelectorAll('input:checked')].map((i) => (zahl ? Number(i.value) : i.value));

function dialog(id) {
  const d = $(id);
  d.querySelector('.schliessen').onclick = () => d.close();
  return d;
}

// ---------- Mandanten (Betreiber) ----------

async function ladeMandanten() {
  MANDANTEN = (await api('/api/verwaltung/mandanten')).mandanten;
  if (!betreiber()) {
    MID = MANDANTEN[0].id;
    return;
  }
  const tb = $('mandanten');
  tb.textContent = '';
  for (const m of MANDANTEN) {
    tb.append(
      el(
        'tr',
        {},
        el('td', {}, el('strong', {}, m.name)),
        el('td', {}, m.abo),
        el(
          'td',
          {},
          m.rechte.map((r) => el('span', { className: 'pill' }, rechteName(r))),
        ),
        el('td', {}, `${m.nutzer} / ${m.max_nutzer}`),
        el('td', {}, m.gueltig_bis || 'unbefristet'),
        el(
          'td',
          { className: m.status === 'aktiv' ? 'st-aktiv' : 'st-gesperrt' },
          m.status === 'aktiv' ? 'Aktiv' : 'Gesperrt',
        ),
        el(
          'td',
          { className: 'akt' },
          el('button', { type: 'button', on: { click: () => waehle(m.id) } }, 'Öffnen'),
          el('button', { type: 'button', on: { click: () => mandantDialog(m) } }, 'Bearbeiten'),
          el(
            'button',
            { type: 'button', className: 'warn', on: { click: () => mandantLoeschen(m) } },
            'Löschen',
          ),
        ),
      ),
    );
  }
  const w = $('wahl');
  w.textContent = '';
  w.append(
    el('option', { value: '' }, '– Mandant wählen –'),
    ...MANDANTEN.map((m) => el('option', { value: String(m.id), selected: m.id === MID }, m.name)),
  );
}

function mandantDialog(m) {
  const d = dialog('d-mandant');
  $('d-mandant-titel').textContent = m ? 'Mandant bearbeiten' : 'Mandant anlegen';
  $('m-fehler').textContent = '';
  const abo = $('m-abo');
  abo.textContent = '';
  abo.append(...Object.keys(STAMM.abos).map((a) => el('option', { value: a }, a)));
  abo.value = m ? m.abo : 'starter';
  $('m-name').value = m ? m.name : '';
  $('m-max').value = m ? m.max_nutzer : 10;
  $('m-bis').value = m ? m.gueltig_bis : '';
  $('m-status').value = m ? m.status : 'aktiv';
  const setze = (L) => haken($('m-rechte'), Object.entries(STAMM.rechte), L);
  setze(m ? m.rechte : STAMM.abos[abo.value]);
  abo.onchange = () => setze(STAMM.abos[abo.value]);
  $('f-mandant').onsubmit = (ev) => {
    ev.preventDefault();
    sicher(async () => {
      const d2 = {
        name: $('m-name').value,
        abo: abo.value,
        rechte: gewaehlt($('m-rechte')),
        max_nutzer: Number($('m-max').value),
        gueltig_bis: $('m-bis').value,
        status: $('m-status').value,
      };
      if (m) await api('/api/verwaltung/mandanten/' + m.id, d2);
      else await api('/api/verwaltung/mandanten', d2);
      d.close();
      await ladeMandanten();
      if (MID) zeigeMandant();
    }, 'm-fehler');
  };
  d.showModal();
}

function mandantLoeschen(m) {
  const eingabe = prompt(
    `Mandant „${m.name}“ mit allen Nutzern, Gruppen und Projekten endgültig löschen?\nZur Bestätigung den Namen eingeben:`,
  );
  if (eingabe !== m.name) return;
  sicher(async () => {
    await api(`/api/verwaltung/mandanten/${m.id}/loeschen`, {});
    if (MID === m.id) waehle(null);
    await ladeMandanten();
  }, 'm-mandanten');
}

// ---------- Ein Mandant ----------

function waehle(id) {
  MID = id ? Number(id) : null;
  $('bereich-mandant').classList.toggle('hide', !MID);
  $('wahl').value = MID ? String(MID) : '';
  if (MID) {
    zeigeMandant();
    $('bereich-mandant').scrollIntoView({ behavior: 'smooth' });
  }
}

async function zeigeMandant() {
  const m = mandant();
  $('mandant-titel').textContent = m.name;
  $('mandant-info').textContent =
    `Abo: ${m.abo} · Nutzer: ${m.nutzer} von ${m.max_nutzer} · gültig bis: ${m.gueltig_bis || 'unbefristet'}` +
    (m.status === 'aktiv' ? '' : ' · GESPERRT') +
    ` · Rechte: ${m.rechte.map(rechteName).join(', ') || 'keine'}`;
  await zeigeTab(tab);
}

async function zeigeTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  for (const x of ['nutzer', 'gruppen', 'protokoll']) $('tab-' + x).classList.toggle('hide', x !== t);
  GRUPPEN = (await api('/api/verwaltung/gruppen?mandant=' + MID)).gruppen;
  if (t === 'nutzer') await ladeNutzer();
  if (t === 'gruppen') ladeGruppen();
  if (t === 'protokoll') await ladeProtokoll();
}

// ---------- Nutzer ----------

async function ladeNutzer() {
  haken(
    $('n-gruppen'),
    GRUPPEN.map((g) => [g.id, g.name]),
    GRUPPEN.filter((g) => g.name === 'Alle').map((g) => g.id),
  );
  const L = (await api('/api/verwaltung/nutzer?mandant=' + MID)).nutzer;
  const tb = $('nutzer');
  tb.textContent = '';
  for (const n of L) {
    const ich = n.id === STAMM.ich.id;
    const akt = (text, fn, cls) =>
      el(
        'button',
        { type: 'button', className: cls || '', on: { click: () => sicher(fn, 'm-nutzer') } },
        text,
      );
    tb.append(
      el(
        'tr',
        {},
        el('td', {}, el('strong', {}, n.email)),
        el('td', {}, n.name || ''),
        el('td', {}, STAMM.rollen[n.rolle] || n.rolle),
        el(
          'td',
          {},
          n.gruppen.map((g) => el('span', { className: 'pill' }, g.name)),
        ),
        el(
          'td',
          {},
          n.rechte.map((r) => el('span', { className: 'pill' }, rechteName(r))),
        ),
        el('td', { className: 'st-' + n.status }, STATUS[n.status] || n.status),
        el('td', {}, zeit(n.letzte_anmeldung)),
        el(
          'td',
          { className: 'akt' },
          el('button', { type: 'button', on: { click: () => nutzerDialog(n) } }, 'Bearbeiten'),
          n.status !== 'gesperrt' &&
            akt(n.status === 'eingeladen' ? 'Einladung erneut' : 'Passwort-Link', async () => {
              const r = await api(`/api/verwaltung/nutzer/${n.id}/einladen`, {});
              $('m-nutzer').textContent = r.mail
                ? `Link an ${n.email} gesendet.`
                : 'E-Mail konnte nicht gesendet werden (siehe Protokoll).';
            }),
          !ich &&
            akt(n.status === 'gesperrt' ? 'Entsperren' : 'Sperren', async () => {
              await api('/api/verwaltung/nutzer/' + n.id, {
                status: n.status === 'gesperrt' ? 'entsperrt' : 'gesperrt',
              });
              await ladeNutzer();
            }),
          !ich &&
            akt(
              'Löschen',
              async () => {
                if (
                  !confirm(`„${n.email}“ endgültig löschen? Eigene Projekte bleiben im Mandanten erhalten.`)
                )
                  return;
                await api(`/api/verwaltung/nutzer/${n.id}/loeschen`, {});
                await ladeMandanten();
                await zeigeMandant();
              },
              'warn',
            ),
        ),
      ),
    );
  }
}

$('n-einladen').onclick = () =>
  sicher(async () => {
    $('m-nutzer').textContent = '';
    const r = await api('/api/verwaltung/nutzer', {
      mandant: MID,
      email: $('n-email').value,
      name: $('n-name').value,
      rolle: $('n-rolle').value,
      gruppen: gewaehlt($('n-gruppen'), true),
    });
    $('m-nutzer').textContent = r.mail
      ? `Einladung an ${r.nutzer.email} gesendet.`
      : 'Angelegt, aber die E-Mail konnte nicht gesendet werden (siehe Protokoll).';
    $('n-email').value = '';
    $('n-name').value = '';
    await ladeMandanten();
    await zeigeMandant();
  }, 'm-nutzer');

function nutzerDialog(n) {
  const d = dialog('d-nutzer');
  $('d-nutzer-titel').textContent = n.email;
  $('e-fehler').textContent = '';
  $('e-name').value = n.name || '';
  $('e-rolle').value = n.rolle;
  $('e-rolle').disabled = n.id === STAMM.ich.id;
  haken(
    $('e-gruppen'),
    GRUPPEN.map((g) => [g.id, g.name]),
    n.gruppen.map((g) => g.id),
  );
  $('f-nutzer').onsubmit = (ev) => {
    ev.preventDefault();
    sicher(async () => {
      const d2 = { name: $('e-name').value, gruppen: gewaehlt($('e-gruppen'), true) };
      if (n.id !== STAMM.ich.id) d2.rolle = $('e-rolle').value;
      await api('/api/verwaltung/nutzer/' + n.id, d2);
      d.close();
      await ladeNutzer();
    }, 'e-fehler');
  };
  d.showModal();
}

// ---------- Gruppen ----------

function ladeGruppen() {
  const tb = $('gruppen');
  tb.textContent = '';
  for (const g of GRUPPEN)
    tb.append(
      el(
        'tr',
        {},
        el('td', {}, el('strong', {}, g.name)),
        el(
          'td',
          {},
          g.rechte.map((r) => el('span', { className: 'pill' }, rechteName(r))),
        ),
        el('td', {}, String(g.mitglieder)),
        el(
          'td',
          { className: 'akt' },
          el('button', { type: 'button', on: { click: () => gruppeDialog(g) } }, 'Bearbeiten'),
          el(
            'button',
            {
              type: 'button',
              className: 'warn',
              on: {
                click: () =>
                  sicher(async () => {
                    if (
                      !confirm(
                        `Gruppe „${g.name}“ löschen? Die Mitglieder verlieren die Rechte dieser Gruppe.`,
                      )
                    )
                      return;
                    await api(`/api/verwaltung/gruppen/${g.id}/loeschen`, {});
                    await zeigeTab('gruppen');
                  }, 'm-gruppen'),
              },
            },
            'Löschen',
          ),
        ),
      ),
    );
}

function gruppeDialog(g) {
  const d = dialog('d-gruppe');
  $('d-gruppe-titel').textContent = g ? 'Gruppe bearbeiten' : 'Gruppe anlegen';
  $('g-fehler').textContent = '';
  $('g-name').value = g ? g.name : '';
  // nur Rechte, die der Mandant hat
  haken(
    $('g-rechte'),
    mandant().rechte.map((r) => [r, rechteName(r)]),
    g ? g.rechte : [],
  );
  $('f-gruppe').onsubmit = (ev) => {
    ev.preventDefault();
    sicher(async () => {
      const d2 = { name: $('g-name').value, rechte: gewaehlt($('g-rechte')) };
      if (g) await api('/api/verwaltung/gruppen/' + g.id, d2);
      else await api('/api/verwaltung/gruppen', { ...d2, mandant: MID });
      d.close();
      await zeigeTab('gruppen');
    }, 'g-fehler');
  };
  d.showModal();
}

// ---------- Protokoll ----------

async function ladeProtokoll() {
  const L = (await api('/api/verwaltung/protokoll?mandant=' + MID)).protokoll;
  const tb = $('protokoll');
  tb.textContent = '';
  for (const p of L)
    tb.append(
      el(
        'tr',
        {},
        el('td', {}, zeit(p.zeit)),
        el('td', {}, p.nutzer),
        el('td', {}, p.ereignis),
        el('td', {}, p.detail),
      ),
    );
}

// ---------- Kopfzeile ----------

$('abmelden').onclick = async () => {
  await api('/api/abmelden', {}).catch(() => {});
  location.href = '/anmelden';
};
$('pw-oeffnen').onclick = () => {
  const d = dialog('d-passwort');
  $('p-fehler').textContent = '';
  $('p-email').value = STAMM.ich.email;
  for (const id of ['p-alt', 'p-neu', 'p-neu2']) $(id).value = '';
  $('f-passwort').onsubmit = (ev) => {
    ev.preventDefault();
    if ($('p-neu').value !== $('p-neu2').value) {
      $('p-fehler').textContent = 'Die neuen Passwörter stimmen nicht überein.';
      return;
    }
    sicher(async () => {
      await api('/api/passwort-aendern', { alt: $('p-alt').value, neu: $('p-neu').value });
      d.close();
      alert('Passwort geändert. Andere Sitzungen wurden abgemeldet.');
    }, 'p-fehler');
  };
  d.showModal();
};
$('mandant-neu').onclick = () => mandantDialog(null);
$('wahl').onchange = () => waehle($('wahl').value);
for (const b of document.querySelectorAll('.tabs button'))
  b.onclick = () => sicher(() => zeigeTab(b.dataset.tab));
$('gruppe-neu').onclick = () => gruppeDialog(null);
$('kennung-pruefen').onclick = () =>
  sicher(async () => {
    const r = await api('/api/verwaltung/kennung?id=' + encodeURIComponent($('kennung').value.trim()));
    $('kennung-ergebnis').textContent = r.email ? 'gehört zu ' + r.email : 'unbekannt';
  });

// ---------- Start ----------

await sicher(async () => {
  STAMM = await api('/api/verwaltung/stammdaten');
  $('ich').textContent = `${STAMM.ich.email} · ${STAMM.rollen[STAMM.ich.rolle]}`;
  await ladeMandanten();
  if (betreiber()) {
    $('bereich-mandanten').classList.remove('hide');
  } else {
    $('wahl-zeile').classList.add('hide');
    waehle(MID);
  }
});
