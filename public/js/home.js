// public/js/home.js — Buscador global del home: filtra categorías y encuentra endpoints vía /docs
(function () {
  const btn = document.querySelector('[data-search-btn]');
  const box = document.querySelector('.searchbox');
  const input = box ? box.querySelector('input') : null;
  const results = box ? box.querySelector('.search-results') : null;
  if (!btn || !box || !input) return;

  btn.addEventListener('click', () => {
    box.classList.toggle('open');
    if (box.classList.contains('open')) input.focus();
  });

  let docsCache = null;
  async function getDocs() {
    if (docsCache) return docsCache;
    const res = await fetch('/docs');
    docsCache = await res.json();
    return docsCache;
  }

  input.addEventListener('input', async () => {
    const term = input.value.trim().toLowerCase();
    document.querySelectorAll('.list .row').forEach(row => {
      row.style.display = !term || row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
    if (!results) return;
    if (!term || term.length < 2) { results.innerHTML = ''; return; }
    try {
      const docs = await getDocs();
      const matches = [];
      (docs.categories || []).forEach(cat => {
        (cat.endpoints || []).forEach(ep => {
          const hay = `${cat.id} ${ep.id} ${ep.description || ''}`.toLowerCase();
          if (hay.includes(term)) matches.push({ cat: cat.id, ep });
        });
      });
      results.innerHTML = matches.slice(0, 12).map(m =>
        `<a href="/${m.cat}#${m.ep.id}">GET /${m.cat}/${m.ep.id} — ${(m.ep.description || '').replace(/</g, '&lt;')}</a>`
      ).join('') || '<a href="#">Sin resultados…</a>';
    } catch (_) { results.innerHTML = ''; }
  });
})();
