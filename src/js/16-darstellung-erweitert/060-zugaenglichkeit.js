/* Zugänglichkeit der Oberfläche (Prüfung nach web-design-guidelines, .claude/skills):
   – Symbol-Buttons ohne sichtbaren Text bekommen ihr title als aria-label (Bildschirmleser, Sprachsteuerung).
   – Anklickbare div/span (onclick) werden per Tastatur bedienbar: role="button", tabindex="0", Enter/Leertaste lösen
     den Klick aus.
   Gilt für alles, was die Oberfläche später einfügt (Panels werden laufend neu gezeichnet). Aufruf aus start(). */
function uiZugangKnoten(wurzel) {
  if (!wurzel || !wurzel.querySelectorAll) return;
  const alle = [wurzel, ...wurzel.querySelectorAll('button,[onclick]')];
  alle.forEach((el) => {
    if (!el.tagName) return;
    if (el.tagName === 'BUTTON') {
      if (!el.hasAttribute('aria-label') && el.title && !el.textContent.trim())
        el.setAttribute('aria-label', el.title);
      return;
    }
    if (
      (el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'LI') &&
      el.hasAttribute('onclick')
    ) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('aria-label') && el.title && !el.textContent.trim())
        el.setAttribute('aria-label', el.title);
    }
  });
}
function uiZugang() {
  uiZugangKnoten(document.body);
  new MutationObserver((L) =>
    L.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && uiZugangKnoten(n))),
  ).observe(document.body, { childList: true, subtree: true });
  // Enter/Leertaste auf einem fokussierten div/span-Button wie ein Klick
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      t &&
      t.getAttribute &&
      t.getAttribute('role') === 'button' &&
      t.tagName !== 'BUTTON'
    ) {
      e.preventDefault();
      t.click();
    }
  });
}
