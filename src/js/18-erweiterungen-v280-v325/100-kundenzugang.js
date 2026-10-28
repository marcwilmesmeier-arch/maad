/* v305: Kundenzugang (nur aktiv, wenn der maad-Server window.MAAD_ACC einträgt; die Einzeldatei ohne Server bleibt unverändert) */
const ACC = window.MAAD_ACC || null;
const accCan = (k) =>
  !ACC || (ACC.mode === 'full' && (!ACC.user || !ACC.user.perms || ACC.user.perms.includes(k)));
function accDeny(k) {
  const demo = ACC && ACC.mode === 'demo';
  const m = demo
    ? 'Diese Funktion steht nach der Anmeldung zur Verfügung.'
    : 'Diese Funktion ist für Ihr Konto nicht freigegeben.';
  if (demo) {
    if (confirm(m + '\n\nJetzt anmelden?')) location.href = '/login';
  } else alert(m);
}
function accChip() {
  if (!ACC || !ACC.server || document.getElementById('accChip')) return;
  const d = document.createElement('div');
  d.id = 'accChip';
  d.style.cssText =
    'position:fixed;top:10px;right:10px;z-index:400;display:flex;gap:6px;align-items:center;background:#E9EDEF;border:1px solid #1d1d1b22;border-radius:22px;padding:4px 6px 4px 14px;font:600 12px lot_montserrat,system-ui,sans-serif;color:#1d1d1b;box-shadow:0 4px 14px #0002';
  const b = (t, f) => {
    const x = document.createElement('button');
    x.textContent = t;
    x.style.cssText =
      'border:0;border-radius:16px;min-height:28px;padding:0 12px;font:inherit;cursor:pointer;background:#1d1d1b;color:#fff';
    x.onclick = f;
    return x;
  };
  const s = document.createElement('span');
  if (ACC.mode === 'full' && ACC.user) {
    s.textContent = ACC.user.email;
    d.append(s);
    if (ACC.user.role === 'admin') d.append(b('Administration', () => (location.href = '/admin')));
    d.append(
      b('Abmelden', async () => {
        try {
          await fetch('/api/logout', {
            method: 'POST',
            headers: { 'X-Maad': '1', 'Content-Type': 'application/json' },
            body: '{}',
          });
        } catch (e) {
          logErr(e, 'accChip>anonym');
        }
        location.href = '/login';
      }),
    );
  } else {
    s.textContent = 'Demo';
    d.append(
      s,
      b('Anmelden', () => (location.href = '/login')),
    );
  }
  document.body.appendChild(d);
}
/* gesperrte Schaltflächen auf der Startseite markieren */
function accMark() {
  if (!ACC) return;
  const el = document.getElementById('hSide');
  if (!el) return;
  el.querySelectorAll('button.hbtn').forEach((b) => {
    const o = b.getAttribute('onclick') || '';
    const k = /homeCreate/.test(o) ? 'project_new' : /homePanel\('open'\)/.test(o) ? 'project_open' : '';
    if (k && !accCan(k)) {
      b.style.opacity = '.55';
      const sm = b.querySelector('small');
      if (sm) sm.textContent = ACC.mode === 'demo' ? '🔒 nach Anmeldung' : '🔒 nicht freigegeben';
      b.removeAttribute('onclick');
      b.onclick = () => accDeny(k);
    }
  });
}
if (ACC) {
  {
    const _d = homePanel;
    homePanel = async function (s) {
      const r = await _d.apply(this, arguments);
      try {
        accMark();
      } catch (e) {
        logErr(e, 'homePanel');
      }
      return r;
    };
  }
  {
    const _d = wzOpen;
    wzOpen = function () {
      if (!accCan('project_new')) return accDeny('project_new');
      return _d.apply(this, arguments);
    };
  }
  {
    const _d = projOpen;
    projOpen = async function () {
      if (!accCan('project_open')) return accDeny('project_open');
      return _d.apply(this, arguments);
    };
  }
  {
    const _d = xlExport;
    xlExport = async function () {
      if (!accCan('export_xlsx')) return accDeny('export_xlsx');
      return _d.apply(this, arguments);
    };
  }
  {
    const _d = ifcExport;
    ifcExport = async function () {
      if (!accCan('export_ifc')) return accDeny('export_ifc');
      return _d.apply(this, arguments);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', accChip);
  else accChip();
}
