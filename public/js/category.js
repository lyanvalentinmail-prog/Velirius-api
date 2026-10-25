// public/js/category.js — Buscador + probador RUN con parámetros modificables.
// El botón RUN abre el endpoint directo (como Delirius). Tocando el nombre del
// endpoint se despliega el probador: edita parámetros (o sube una foto), ejecuta
// sin salir de la página y copia la URL final.
(function () {
  const data = window.VELIRIUS || { category: '', endpoints: [] };
  const byId = {};
  data.endpoints.forEach(e => { byId[e.id] = e; });

  // ---------- Buscador ----------
  const searchBtn = document.querySelector('[data-search-btn]');
  const searchBox = document.querySelector('.searchbox');
  const searchInput = searchBox ? searchBox.querySelector('input') : null;
  if (searchBtn && searchBox) {
    searchBtn.addEventListener('click', () => {
      searchBox.classList.toggle('open');
      if (searchBox.classList.contains('open') && searchInput) searchInput.focus();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('.list .row').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = !term || text.includes(term) ? '' : 'none';
      });
      document.querySelectorAll('.tester').forEach(t => {
        const row = t.previousElementSibling;
        if (row && row.style.display === 'none') t.classList.remove('open');
      });
    });
  }

  // ---------- Helpers ----------
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const IMAGE_PARAMS = ['url', 'image', 'img', 'avatar', 'image1', 'image2', 'url1', 'url2', 'url3'];

  function isImageParam(name) { return IMAGE_PARAMS.includes(String(name).toLowerCase()); }

  function fileToDataUrl(file, cb) {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objUrl);
      cb(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = objUrl;
  }

  function buildPath(tester) {
    const cat = tester.dataset.category;
    const id = tester.dataset.endpoint;
    const params = new URLSearchParams();
    tester.querySelectorAll('input[data-param]').forEach(inp => {
      const v = inp.value.trim();
      if (v) params.set(inp.dataset.param, v);
    });
    const qs = params.toString();
    return `/${cat}/${id}${qs ? '?' + qs : ''}`;
  }

  function refreshUrlLine(tester) {
    const line = tester.querySelector('.url-line');
    if (line) line.textContent = location.origin + buildPath(tester);
  }

  function findPreviewImage(json) {
    try {
      const r = json && json.result;
      if (!r) return null;
      if (typeof r.image === 'string') return r.image;
      if (typeof r.thumbnail === 'string') return r.thumbnail;
      if (typeof r.cover === 'string') return r.cover;
      const first = Array.isArray(r.results) ? r.results[0] : null;
      if (first) return first.image || first.thumbnail || first.trayIcon || first.url || null;
      if (Array.isArray(r) && r[0]) return r[0].image || r[0].url || null;
    } catch (_) {}
    return null;
  }

  async function runTest(tester) {
    const result = tester.querySelector('.result');
    const path = buildPath(tester);
    result.innerHTML = '<div class="loading">CARGANDO…</div>';
    try {
      const res = await fetch(path, { headers: { 'x-velirius-client': 'ui' } });
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (type.startsWith('image/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        result.innerHTML = `<img src="${url}" alt="canvas"><a class="dl" href="${url}" download>⬇ DESCARGAR IMAGEN</a>`;
      } else if (type.startsWith('video/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        result.innerHTML = `<video src="${url}" controls autoplay loop muted playsinline></video><a class="dl" href="${path}" target="_blank" rel="noopener">↗ ABRIR VIDEO DIRECTO</a>`;
      } else if (type.startsWith('audio/')) {
        result.innerHTML = `<audio src="${path}" controls autoplay></audio><a class="dl" href="${path}" target="_blank" rel="noopener">↗ ABRIR AUDIO DIRECTO</a>`;
      } else if (type.includes('application/json')) {
        const json = await res.json();
        const preview = findPreviewImage(json);
        result.innerHTML = `${preview ? `<img src="${esc(preview)}" alt="">` : ''}<pre>${esc(JSON.stringify(json, null, 2))}</pre>`;
      } else {
        const text = await res.text();
        result.innerHTML = `<pre>${esc(text.slice(0, 8000))}</pre>`;
      }
    } catch (e) {
      result.innerHTML = `<pre>Error de red: ${esc(e.message)}\n\nPrueba con el botón ABRIR (endpoint directo).</pre>`;
    }
  }

  // ---------- Construir probadores ----------
  document.querySelectorAll('.row[data-endpoint]').forEach(row => {
    const id = row.dataset.endpoint;
    const ep = byId[id];
    if (!ep) return;
    const tester = document.createElement('div');
    tester.className = 'tester';
    tester.dataset.category = data.category;
    tester.dataset.endpoint = id;

    let fields = '';
    if (!ep.params.length) fields = '<label>Este endpoint no necesita parámetros.</label>';
    ep.params.forEach(p => {
      const up = isImageParam(p.name)
        ? `<label class="upload">SUBIR FOTO<input type="file" accept="image/*" hidden data-upload-for="${esc(p.name)}"></label>`
        : '';
      fields += `<label><b>?${esc(p.name)}</b>${p.required ? '' : ' (opcional)'}${p.desc ? ' — ' + esc(p.desc) : ''}</label>
        <div class="field-row"><input type="text" data-param="${esc(p.name)}" value="${esc(p.value || '')}" spellcheck="false">${up}</div>`;
    });

    tester.innerHTML = `
      <div class="t-title">▶ Probar · GET /${esc(data.category)}/${esc(id)}</div>
      ${fields}
      <div class="url-line"></div>
      <div class="actions">
        <button type="button" class="btn small" data-act="run">Run</button>
        <button type="button" class="btn small ghost" data-act="open">Abrir</button>
        <button type="button" class="btn small ghost" data-act="copy">Copiar URL</button>
      </div>
      <div class="result"></div>`;

    row.insertAdjacentElement('afterend', tester);
    refreshUrlLine(tester);

    tester.addEventListener('input', () => refreshUrlLine(tester));
    tester.querySelectorAll('input[type="file"][data-upload-for]').forEach(fileInp => {
      fileInp.addEventListener('change', () => {
        const file = fileInp.files && fileInp.files[0];
        if (!file) return;
        fileToDataUrl(file, dataUrl => {
          const target = tester.querySelector(`input[data-param="${CSS.escape(fileInp.dataset.uploadFor)}"]`);
          if (target) { target.value = dataUrl; refreshUrlLine(tester); }
        });
      });
    });
    tester.querySelector('[data-act="run"]').addEventListener('click', () => runTest(tester));
    tester.querySelector('[data-act="open"]').addEventListener('click', () => window.open(buildPath(tester), '_blank', 'noopener'));
    tester.querySelector('[data-act="copy"]').addEventListener('click', async ev => {
      try { await navigator.clipboard.writeText(location.origin + buildPath(tester)); ev.target.textContent = '¡Copiada!'; setTimeout(() => { ev.target.textContent = 'Copiar URL'; }, 1400); }
      catch (_) { window.prompt('Copia la URL:', location.origin + buildPath(tester)); }
    });

    const info = row.querySelector('.info');
    if (info) {
      info.title = 'Toca para probar con parámetros modificables';
      info.addEventListener('click', () => tester.classList.toggle('open'));
    }
    if (location.hash === '#' + id) tester.classList.add('open');
  });
})();
