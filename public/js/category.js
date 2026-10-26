// public/js/category.js — Buscador + probador TEST (diseño de las capturas).
// El botón TEST de cada endpoint despliega el panel: la fila se pone negra, arriba
// se ve CÓMO USAR EL ENDPOINT con la URL y el fetch, después PARÁMETROS con chips
// REQUERIDO/OPCIONAL (los estilos van plegados en "Opciones avanzadas"), el botón
// TEST grande y el resultado con 200 OK + tipo + ms + DESCARGAR sobre damero.
(function () {
  const data = window.VELIRIUS || { category: '', endpoints: [] };
  const byId = {};
  data.endpoints.forEach(e => { byId[e.id] = e; });

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const IMAGE_PARAMS = ['url', 'image', 'img', 'avatar', 'image1', 'image2', 'url1', 'url2', 'url3'];
  // Sólo las frases largas van en <textarea>; el resto (incluido `text`) es un
  // campo de una línea, como en la captura de referencia.
  const LONG_PARAMS = ['quote', 'caption', 'description', 'message'];
  const isImageParam = name => IMAGE_PARAMS.includes(String(name).toLowerCase());
  const isLongParam = name => LONG_PARAMS.includes(String(name).toLowerCase());

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
      document.querySelectorAll('.list .row[data-endpoint]').forEach(row => {
        const ep = byId[row.dataset.endpoint] || {};
        // Se busca en el nombre, la descripción y los parámetros del endpoint.
        const hay = `${row.textContent} ${ep.desc || ''} ${(ep.params || []).map(p => `${p.name} ${p.desc || ''}`).join(' ')}`.toLowerCase();
        row.style.display = !term || hay.includes(term) ? '' : 'none';
      });
      // Ocultar las secciones (grupos) que se quedaron sin resultados.
      document.querySelectorAll('.group').forEach(group => {
        const visible = [...group.querySelectorAll('.row[data-endpoint]')].some(r => r.style.display !== 'none');
        group.style.display = visible ? '' : 'none';
      });
      document.querySelectorAll('.chips .chip').forEach(chip => {
        const target = chip.getAttribute('href').slice(1);
        const group = document.getElementById(target);
        chip.style.display = group && group.style.display === 'none' ? 'none' : '';
      });
      document.querySelectorAll('.tester.open').forEach(t => {
        const row = t.previousElementSibling;
        if (row && row.style.display === 'none') setOpen(t, false);
      });
    });
  }

  // ---------- Utilidades ----------
  function fileToDataUrl(file, cb) {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      // 1600 px de lado mayor: la foto llega con buena resolución al canvas
      // (se sube por POST, así que el tamaño no rompe ninguna URL).
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objUrl);
      cb(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = objUrl;
  }

  // Parámetros "normales" del probador (sin las imágenes locales).
  function paramValues(tester) {
    const out = {};
    tester.querySelectorAll('[data-param]').forEach(inp => {
      const v = String(inp.value || '').trim();
      if (v && !v.startsWith('data:')) out[inp.dataset.param] = v;
    });
    return out;
  }

  // Imágenes elegidas de la galería (siempre guardadas como data:).
  function allLocalImages(tester) {
    const out = {};
    tester.querySelectorAll('[data-local]').forEach(inp => {
      const v = String(inp.dataset.local || '');
      if (v.startsWith('data:')) out[inp.dataset.param] = v;
    });
    return out;
  }

  // Imágenes que van en el cuerpo del POST: sólo las que no tienen URL corta
  // (un `data:` de varios KB no entra en una URL GET).
  function localImages(tester) {
    const out = {};
    tester.querySelectorAll('[data-local]').forEach(inp => {
      const url = String(inp.value || '').trim();
      if (url && !url.startsWith('data:')) return;
      const v = String(inp.dataset.local || '');
      if (v.startsWith('data:')) out[inp.dataset.param] = v;
    });
    return out;
  }

  // fetch del endpoint: POST si hay imagen local; si el GET falla (por ejemplo la
  // subida caducó), reintenta con la imagen de la galería en el cuerpo.
  async function callEndpoint(tester, path) {
    const local = localImages(tester);
    if (Object.keys(local).length) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-velirius-client': 'ui' },
        body: JSON.stringify({ ...paramValues(tester), ...local })
      });
    }
    const res = await fetch(path, { headers: { 'x-velirius-client': 'ui' } });
    const saved = allLocalImages(tester);
    if (!res.ok && Object.keys(saved).length) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-velirius-client': 'ui' },
        body: JSON.stringify({ ...paramValues(tester), ...saved })
      });
    }
    return res;
  }

  // Miniatura de la imagen elegida (así se ve que quedó cargada).
  function showThumb(row, dataUrl, title = 'Imagen') {
    if (!row) return;
    let img = row.querySelector('.up-thumb');
    if (!img) {
      img = document.createElement('img');
      img.className = 'up-thumb';
      img.alt = 'imagen elegida';
      row.appendChild(img);
    }
    img.src = dataUrl;
    img.title = title;
  }

  function buildPath(tester) {
    const cat = tester.dataset.category;
    const id = tester.dataset.endpoint;
    const params = new URLSearchParams(paramValues(tester));
    const qs = params.toString();
    return `/${cat}/${id}${qs ? '?' + qs : ''}`;
  }

  function absolutePath(tester) {
    return location.origin + buildPath(tester);
  }

  function refreshUrl(tester) {
    const path = buildPath(tester);
    const urlEl = tester.querySelector('.code-url');
    if (urlEl) urlEl.textContent = location.origin + path;
    const fetchEl = tester.querySelector('.code-fetch');
    if (fetchEl) {
      const short = path.length > 96 ? path.slice(0, 93) + '…' : path;
      fetchEl.textContent = `fetch("${short}")\n  .then(r => r.blob())\n  .then(b => URL.createObjectURL(b));`;
    }
  }

  function findPreviewImage(json) {
    try {
      const r = json && json.result;
      if (!r) return null;
      if (typeof r.image === 'string') return r.image;
      if (typeof r.gif === 'string') return r.gif;
      if (typeof r.thumbnail === 'string') return r.thumbnail;
      if (typeof r.cover === 'string') return r.cover;
      const first = Array.isArray(r.results) ? r.results[0] : null;
      if (first) return first.image || first.gif || first.thumbnail || first.cover || first.trayIcon || first.url || null;
      if (Array.isArray(r) && r[0]) return r[0].image || r[0].gif || r[0].cover || r[0].url || null;
      if (Array.isArray(r.images) && r.images[0]) return r.images[0].url || r.images[0].image || null;
    } catch (_) { /* noop */ }
    return null;
  }

  // Busca algo reproducible dentro del JSON (video con audio o audio suelto).
  function findPlayable(json) {
    try {
      const r = json && json.result;
      if (!r) return null;
      const esUrl = v => typeof v === 'string' && /^(https?:|\/)/.test(v);
      const video = [
        r.video && r.video.url,
        r.playable && r.playable.url,
        r.video_nowatermark,
        r.directUrls && r.directUrls.mp4,
        r.media && Array.isArray(r.media) && r.media[0] && r.media[0].type === 'video' ? r.media[0].url : null,
        r.formats && Array.isArray(r.formats) && (r.formats.find(f => f && f.hasVideo && f.hasAudio && f.url) || {}).url
      ].find(esUrl);
      if (video) return { type: 'video', url: video };
      const audio = [
        r.audio && r.audio.url,
        r.playUrl,
        r.directUrls && r.directUrls.mp3
      ].find(esUrl);
      if (audio) return { type: 'audio', url: audio };
    } catch (_) { /* noop */ }
    return null;
  }

  // ---------- Descargas ----------
  // `?download=true` en cualquier endpoint devuelve el archivo como adjunto
  // (Content-Disposition: attachment), venga de donde venga el medio.
  function withParams(path, extra) {
    return `${path}${path.includes('?') ? '&' : '?'}${extra}`;
  }
  const binaria = type => /^(image|video|audio)\//.test(String(type || ''));
  function downloadHref(path, json, type) {
    const r = (json && json.result) || {};
    const dicho = r.downloadUrl
      || (r.video && r.video.downloadUrl)
      || (r.audio && r.audio.downloadUrl)
      || (r.media && r.media[0] && r.media[0].downloadUrl);
    if (dicho) return dicho;
    if (binaria(type)) return withParams(path, 'download=true');
    return withParams(path, 'direct=true&download=true');
  }
  const btnDescargar = (href, nombre) =>
    `<a class="chip-btn dl" href="${esc(href)}" download="${esc(nombre || 'velirius')}" rel="noopener" title="Descargar ${esc(nombre || 'archivo')}">Descargar</a>`;

  /**
   * Botón de descarga para CUALQUIER endpoint: si el JSON trae un archivo
   * (imagen, video, audio) se baja a través de /downloader/file; si no, se baja
   * el JSON mismo como archivo. Así "Descargar" funciona en todos lados.
   */
  const esUrl = v => typeof v === 'string' && /^(https?:|\/)/.test(v);
  const archivoDe = (json, type) => {
    const r = (json && json.result) || {};
    const candidatos = [
      r.downloadUrl,
      r.image, r.gif, r.thumbnail, r.cover,
      r.playUrl,
      r.url,
      r.video && r.video.downloadUrl,
      r.video && r.video.url,
      r.audio && r.audio.downloadUrl,
      r.audio && r.audio.url,
      Array.isArray(r.media) && r.media[0] && (r.media[0].downloadUrl || r.media[0].url),
      Array.isArray(r.results) && r.results[0] && (r.results[0].downloadUrl || r.results[0].url || r.results[0].image)
    ];
    const directo = candidatos.find(esUrl);
    if (!directo) return null;
    // Si es una URL de nuestra propia API, ya sabe descargar.
    if (directo.startsWith('/') || /^(https?:)\/\/[^/]+\/(canvas|downloader|anime|searcher|reactions|tools)\//.test(directo)) {
      return { href: directo, proxy: false };
    }
    const nombre = (r.title || r.query || tester.dataset.endpoint || 'velirius').toString();
    const ext = /video|mp4/i.test(type) ? 'mp4' : /audio|mpeg|mp3/i.test(type) ? 'mp3' : (String(directo).match(/\.([a-z0-9]{2,5})(?:\?|$)/i) || [])[1] || 'jpg';
    return {
      href: `/downloader/file?url=${encodeURIComponent(directo)}&filename=${encodeURIComponent(nombre)}.${ext}&download=true`,
      proxy: true
    };
  };
  // Descarga un texto/JSON creado en el navegador (endpoints sin archivo).
  function btnDescargarTexto(nombre) {
    return `<button type="button" class="chip-btn dl" data-dl-text title="Descargar ${esc(nombre)}">Descargar</button>`;
  }
  function bajarTexto(texto, nombre) {
    const blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Reproductor con sonido: sin `muted` para que se escuche al darle play. */
  function playerHtml(p) {
    if (!p) return '';
    if (p.type === 'audio') {
      return `<div class="preview" style="padding:12px"><audio src="${esc(p.url)}" controls preload="metadata" style="width:100%"></audio></div>`;
    }
    return `<div class="preview"><video src="${esc(p.url)}" controls playsinline preload="metadata"></video></div>`;
  }

  // ---------- Ejecutar ----------
  async function executeTest(tester) {
    const result = tester.querySelector('.result');
    const runBtn = tester.querySelector('[data-act="exec"]');
    const path = buildPath(tester);
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Probando…'; }
    result.innerHTML = '<div class="loading">CARGANDO…</div>';
    const t0 = performance.now();
    try {
      const res = await callEndpoint(tester, path);
      const ms = Math.round(performance.now() - t0);
      const type = (res.headers.get('content-type') || '').toLowerCase();
      const okChip = `<span class="chip-status${res.ok ? '' : ' bad'}">${res.status} ${res.ok ? 'OK' : 'ERROR'}</span>`;

      if (type.startsWith('image/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const kb = Math.round(blob.size / 1024);
        const ext = (type.split('/')[1] || 'png').split(';')[0].replace('jpeg', 'jpg');
        result.innerHTML = `
          <div class="res-bar">${okChip}<span class="res-meta">Imagen HD · ${ms} ms</span>
            ${btnDescargar(downloadHref(path, null, type), `${tester.dataset.endpoint}.${ext}`)}</div>
          <div class="preview"><img src="${url}" alt="resultado de ${esc(tester.dataset.endpoint)}"></div>`;
      } else if (type.startsWith('video/')) {
        // Se usa la URL del endpoint (no un blob) para que el navegador pida
        // rangos y pueda buscar dentro del video. Sin `muted`: con sonido.
        const kb = Math.round(Number(res.headers.get('content-length') || 0) / 1024);
        result.innerHTML = `
          <div class="res-bar">${okChip}<span class="res-meta">Video HD · ${ms} ms${kb ? ' · ' + kb + ' KB' : ''}</span>
            <a class="chip-btn" href="${path}" target="_blank" rel="noopener">Abrir</a>
            ${btnDescargar(downloadHref(path, null, type), `${tester.dataset.endpoint}.mp4`)}</div>
          <div class="preview"><video src="${path}" controls autoplay playsinline preload="metadata"></video></div>`;
      } else if (type.startsWith('audio/')) {
        const ext = /mpeg|mp3/.test(type) ? 'mp3' : (type.split('/')[1] || 'm4a').split(';')[0];
        result.innerHTML = `
          <div class="res-bar">${okChip}<span class="res-meta">Audio · ${ms} ms</span>
            ${btnDescargar(downloadHref(path, null, type), `${tester.dataset.endpoint}.${ext}`)}</div>
          <div class="preview" style="padding:10px"><audio src="${path}" controls autoplay style="width:100%"></audio></div>`;
      } else if (type.includes('application/json')) {
        const json = await res.json();
        const playable = findPlayable(json);
        const preview = findPreviewImage(json);
        const archivo = archivoDe(json, playable ? `${playable.type}/` : 'image/');
        const nombreJson = `${tester.dataset.endpoint}.json`;
        const nombreArch = `${tester.dataset.endpoint}.${playable ? (playable.type === 'audio' ? 'mp3' : 'mp4') : 'jpg'}`;
        const btn = archivo ? btnDescargar(archivo.href, nombreArch) : btnDescargarTexto(nombreJson);
        result.innerHTML = `
          <div class="res-bar">${okChip}<span class="res-meta">JSON · ${ms} ms</span>${btn}</div>
          ${playable ? playerHtml(playable) : preview ? `<div class="preview"><img src="${esc(preview)}" alt=""></div>` : ''}
          <pre>${esc(JSON.stringify(json, null, 2))}</pre>`;
        const bajar = result.querySelector('[data-dl-text]');
        if (bajar) bajar.addEventListener('click', () => bajarTexto(JSON.stringify(json, null, 2), nombreJson));
      } else {
        const text = await res.text();
        const nombreTxt = `${tester.dataset.endpoint}.txt`;
        result.innerHTML = `
          <div class="res-bar">${okChip}<span class="res-meta">Texto · ${ms} ms</span>
            ${btnDescargarTexto(nombreTxt)}</div>
          <pre>${esc(text.slice(0, 8000))}</pre>`;
        const bajar = result.querySelector('[data-dl-text]');
        if (bajar) bajar.addEventListener('click', () => {
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombreTxt;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        });
      }
    } catch (e) {
      result.innerHTML = `
        <div class="res-bar"><span class="chip-status bad">ERROR DE RED</span><span class="res-meta">0 ms</span></div>
        <div class="error-box">${esc(e.message)}\n\nPrueba con el botón ABRIR o revisa que el servidor esté levantado.</div>`;
    } finally {
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Test'; }
    }
  }

  // ---------- Abrir / cerrar ----------
  function setOpen(tester, open) {
    if (open) {
      document.querySelectorAll('.tester.open').forEach(other => {
        if (other !== tester) setOpen(other, false);
      });
    }
    tester.classList.toggle('open', open);
    tester.setAttribute('aria-hidden', String(!open));
    if ('inert' in tester) tester.inert = !open;
    const row = tester.previousElementSibling;
    const btn = row ? row.querySelector('[data-test-btn]') : null;
    if (row) row.classList.toggle('open', open);
    if (btn) {
      btn.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = 'Test';
    }
    if (open) setTimeout(() => tester.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 380);
  }

  // ---------- Construir el probador ----------
  document.querySelectorAll('.row[data-endpoint]').forEach(row => {
    const id = row.dataset.endpoint;
    const ep = byId[id];
    if (!ep) return;

    const tester = document.createElement('div');
    tester.className = 'tester';
    tester.id = `tester-${id}`;
    tester.dataset.category = data.category;
    tester.dataset.endpoint = id;
    tester.setAttribute('aria-hidden', 'true');
    if ('inert' in tester) tester.inert = true;

    const fieldOf = p => {
      const gallery = isImageParam(p.name);
      const up = gallery
        ? `<div class="gallery-row"><label class="upload">Galería<input type="file" accept="image/*" hidden data-upload-for="${esc(p.name)}"></label><button type="button" class="chip-btn" data-clear="${esc(p.name)}">✕ Quitar</button></div>`
        : '';
      let control;
      if (Array.isArray(p.options) && p.options.length) {
        control = `<select data-param="${esc(p.name)}">${p.options.map(o =>
          `<option value="${esc(o)}"${String(o) === String(p.value || '') ? ' selected' : ''}>${esc(o === '' ? 'automático' : o)}</option>`).join('')}</select>`;
      } else if (isLongParam(p.name)) {
        control = `<textarea data-param="${esc(p.name)}" rows="2" spellcheck="false" placeholder="${esc(p.value || '')}">${esc(p.value || '')}</textarea>`;
      } else {
        control = `<input type="text" data-param="${esc(p.name)}" value="${esc(p.value || '')}" spellcheck="false" placeholder="${esc(p.value || '')}">`;
      }
      return `<div class="param">
        <div class="param-top"><b>${esc(p.name)}</b><span class="chip-opt${p.required ? ' req' : ''}">${p.required ? 'Requerido' : (gallery ? 'Opcional • URL o galería' : 'Opcional')}</span></div>
        ${p.desc ? `<div class="param-desc">${esc(p.desc)}</div>` : ''}
        <div class="field-row">${control}${up}</div>
      </div>`;
    };

    const basic = ep.params.filter(p => !p.advanced);
    const adv = ep.params.filter(p => p.advanced);
    const advBlock = adv.length
      ? `<button type="button" class="btn small ghost adv-toggle" data-act="adv" aria-expanded="false">Opciones avanzadas (${adv.length})</button>
         <div class="adv-fields" hidden>${adv.map(fieldOf).join('')}</div>`
      : '';

    tester.innerHTML = `
      <div class="tester-inner"><div class="t-pad">
        ${ep.desc ? `<p class="t-desc">${esc(ep.desc)}</p>` : ''}

        <div class="t-use-head">
          <h4>Cómo usar el endpoint</h4>
          <div class="t-use-actions">
            <button type="button" class="chip-btn" data-act="copy">Copiar URL</button>
            <button type="button" class="chip-btn" data-act="open">Abrir ↗</button>
          </div>
        </div>
        <div class="code">
          <div class="code-line"><span class="chip-get">GET</span><span class="code-url"></span></div>
          <div class="code-line faint code-fetch"></div>
        </div>

        ${ep.params.length ? '<div class="t-params-head">Parámetros</div>' : '<div class="t-params-head">Parámetros</div><div class="param-desc">Este endpoint no necesita parámetros.</div>'}
        ${basic.map(fieldOf).join('')}
        ${advBlock}

        <button type="button" class="run" data-act="exec">Test</button>
        <div class="result"></div>
      </div></div>`;

    row.insertAdjacentElement('afterend', tester);
    refreshUrl(tester);

    tester.addEventListener('input', () => refreshUrl(tester));
    tester.addEventListener('change', () => refreshUrl(tester));
    tester.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.matches('input[data-param]')) { ev.preventDefault(); executeTest(tester); }
    });
    tester.querySelectorAll('input[type="file"][data-upload-for]').forEach(fileInp => {
      fileInp.addEventListener('change', () => {
        const file = fileInp.files && fileInp.files[0];
        if (!file) return;
        const name = fileInp.dataset.uploadFor;
        const target = tester.querySelector(`[data-param="${CSS.escape(name)}"]`);
        const row = fileInp.closest('.gallery-row');
        const label = fileInp.closest('label');
        if (!target) return;
        const before = label ? label.textContent : '';
        if (label) { label.textContent = 'Subiendo…'; label.classList.add('busy'); }
        fileToDataUrl(file, async dataUrl => {
          // La imagen queda guardada igual: si la subida falla, el test la manda
          // en el cuerpo del POST y el canvas la usa de todas formas.
          target.dataset.local = dataUrl;
          let remote = '';
          try {
            const res = await fetch('/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: dataUrl })
            });
            const json = await res.json().catch(() => null);
            if (res.ok && json && json.result && json.result.url) remote = json.result.url;
          } catch (_) { /* sin red: se usa el POST */ }
          target.value = remote || '';
          showThumb(row, dataUrl, remote ? 'Imagen subida' : 'Imagen de tu galería');
          if (label) { label.textContent = before || 'Galería'; label.classList.remove('busy'); }
          fileInp.value = '';
          refreshUrl(tester);
        });
      });
    });

    const advBtn = tester.querySelector('[data-act="adv"]');
    if (advBtn) {
      advBtn.addEventListener('click', () => {
        const box = tester.querySelector('.adv-fields');
        const opening = box.hasAttribute('hidden');
        if (opening) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
        advBtn.setAttribute('aria-expanded', String(opening));
        advBtn.textContent = opening
          ? 'Ocultar opciones avanzadas'
          : `Opciones avanzadas (${tester.querySelectorAll('.adv-fields [data-param]').length})`;
      });
    }

    tester.querySelectorAll('[data-clear]').forEach(clearBtn => {
      clearBtn.addEventListener('click', () => {
        const target = tester.querySelector(`[data-param="${CSS.escape(clearBtn.dataset.clear)}"]`);
        if (target) { target.value = ''; delete target.dataset.local; }
        const thumb = clearBtn.closest('.gallery-row')?.querySelector('.up-thumb');
        if (thumb) thumb.remove();
        clearBtn.textContent = '✕ Quitar';
        refreshUrl(tester);
      });
    });

    tester.querySelector('[data-act="exec"]').addEventListener('click', () => executeTest(tester));
    tester.querySelector('[data-act="open"]').addEventListener('click', () => {
      if (Object.keys(localImages(tester)).length) {
        window.alert('Esa imagen está en tu galería y no se pudo subir: probala con el botón Test (se envía junto al test).');
        return;
      }
      window.open(buildPath(tester), '_blank', 'noopener');
    });
    tester.querySelector('[data-act="copy"]').addEventListener('click', async ev => {
      if (Object.keys(localImages(tester)).length) {
        window.alert('Esa imagen está en tu galería y no se pudo subir: la URL no la incluye. Probala con el botón Test.');
        return;
      }
      try {
        await navigator.clipboard.writeText(absolutePath(tester));
        ev.target.textContent = '¡Copiada!';
        setTimeout(() => { ev.target.textContent = 'Copiar URL'; }, 1400);
      } catch (_) {
        window.prompt('Copia la URL:', absolutePath(tester));
      }
    });

    const testBtn = row.querySelector('[data-test-btn]');
    if (testBtn) testBtn.addEventListener('click', () => setOpen(tester, !tester.classList.contains('open')));
    if (location.hash === '#' + id) setOpen(tester, true);
  });

  // ---------- Enlaces directos (#endpoint, #row-endpoint o ?ep=) ----------
  // El buscador del home linkea a /<categoría>#row-<endpoint>: acá se abre ese
  // probador solo, se scrollea y se limpia cualquier filtro del buscador.
  function openFromHash() {
    const hash = decodeURIComponent(String(location.hash || '').replace(/^#/, ''));
    if (!hash) return;
    const id = hash.replace(/^row-/, '');
    const tester = document.getElementById(`tester-${id}`);
    if (!tester) return;
    const input = searchInput;
    if (input && input.value) { input.value = ''; input.dispatchEvent(new Event('input')); }
    setOpen(tester, true);
    const row = tester.previousElementSibling;
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
