// Gemeinsame Hilfen der Server-Seiten.
export const $ = (id) => document.getElementById(id);

/** JSON-Anfrage an die API; wirft bei Fehlern mit der Meldung des Servers. */
export async function api(pfad, body) {
  const opt =
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Maad': '1' },
          body: JSON.stringify(body),
        };
  let r;
  try {
    r = await fetch(pfad, opt);
  } catch {
    throw new Error('Server nicht erreichbar.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || 'Fehler ' + r.status);
    e.status = r.status;
    throw e;
  }
  return j;
}

/** Element bauen: el('td', { className: 'x' }, 'Text', kind) – Text wird nie als HTML gedeutet. */
export function el(tag, props, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

export function zeige(id, ...andere) {
  for (const a of andere) $(a).classList.add('hide');
  $(id).classList.remove('hide');
}
