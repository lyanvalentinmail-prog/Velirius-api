// src/routes/pages.js — Web estilo Delirius: /home, /<categoria>, /information, /docs
const express = require('express');
const config = require('../config');
const { CATEGORIES, totals, findCategory, exampleQuery } = require('../catalog');
const { absoluteUrl } = require('../utils/http');

const router = express.Router();
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Iconos SVG (trazo negro, como en las capturas)
const I = {
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  patreon: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="4.5" height="18"/><circle cx="15.5" cy="9" r="6.5"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.1 11.1 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><line x1="6" y1="6.5" x2="6.01" y2="6.5"/><line x1="6" y1="17.5" x2="6.01" y2="17.5"/></svg>'
};

function layout({ title, body, script = '', bare = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Velirius API — Anime, Canvas, Tools, Downloader, Searcher y Reactions. Sin token.">
<link rel="icon" href="/img/banner.jpg">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
${bare ? `<main class="page">${body}</main>` : `<div class="wrap"><main class="card">${body}</main></div>`}
${script}
</body>
</html>`;
}

function avatars(req) {
  return {
    a1: absoluteUrl(req, config.defaultAvatarPath),
    a2: absoluteUrl(req, '/img/default-avatar2.jpg')
  };
}

// ---------- / (portada) y /home (dashboard) ----------
// Portada calcada de la referencia: hoja de papel, titular grande, píldora de
// versión, hero con el video del dashboard, caja SECURITY ALERT y botón al dashboard.
router.get('/', (req, res) => {
  const base = absoluteUrl(req, '');
  const t = totals();
  const body = `
    <div class="paper">
      <div class="sheet">
        <header class="masthead">
          <h1 class="brand">VELIRIUS API</h1>
          <div class="pill">V. ${esc(config.version)} // STATUS: ONLINE</div>
        </header>

        <figure class="hero">
          <video src="/media/dashboardvid.mp4" poster="/img/banner.jpg" autoplay muted loop playsinline controls
                 aria-label="Velirius API en funcionamiento"></video>
        </figure>

        <p class="para"><strong>Velirius</strong> is a free-access API designed to optimize workflows without the friction of <strong>API Keys</strong>. What started as a personal toolset has evolved into a public resource driven by the community.</p>

        <p class="para">Every router &mdash; <strong>Anime</strong>, <strong>Canvas</strong>, <strong>Tools</strong>, <strong>Downloader</strong>, <strong>Searcher</strong> and <strong>Reactions</strong> &mdash; runs on <strong>Node.js + Sharp</strong>, so images, stickers and videos are generated on the fly and nothing depends on the fonts installed on the host.</p>

        <div class="alert">
          <span class="alert-tag">&#9888; Security alert</span>
          <p>If you detect third parties commercializing access to this API, report it immediately. This resource is free and open-source for all developers.</p>
        </div>

        <p class="para" style="font-size:13.5px">Explore the <a href="/home">dashboard</a> with all the folders, or read the <a href="/docs">JSON docs</a>. Base URL: <code>${esc(base)}</code> &middot; ${t.endpoints} endpoints in ${t.routers} routers.</p>

        <div class="cta-wrap"><a class="cta" href="/home">Initialize dashboard</a></div>

        <div class="sheet-footer">&copy; 2026 &mdash; ${esc(config.storeFooter)}</div>
      </div>
    </div>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: 'Velirius API', body, bare: true }));
});

// Alias antiguos → rutas nuevas
router.get('/download', (req, res) => res.redirect('/downloader'));
router.get('/search', (req, res) => res.redirect('/searcher'));

// ---------- /home (dashboard de carpetas) ----------
// Copia literal del panel de Apireon: intro + enlace de GitHub, cuatro píldoras de
// navegación, barra de estado (ESTADO / RUTAS / ENDPOINTS) y rejilla de tarjetas
// monoespaciadas con el contador de endpoints y el enlace VER.
router.get('/home', (req, res) => {
  const t = totals();
  const cards = CATEGORIES.map(c => `
      <a class="cat-card" href="/${c.id}">
        <span class="cat-name">${esc(c.id)}<em>\\</em></span>
        <span class="cat-count">${c.endpoints.length} endpoints</span>
        <span class="cat-ver">Ver</span>
      </a>`).join('');

  const body = `
    <h1 class="title">Velirius API</h1>
    <p class="intro">Aquí están las carpetas con todas las <strong>APIS</strong> disponibles en este sitio web.<br><strong>(No Requiere Token)</strong> <a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">Sigue mi cuenta de GitHub</a></p>

    <nav class="pills">
      <a href="/information" title="Información del Sistema">Información del Sistema</a>
      <a href="/docs" title="Catálogo JSON (/docs)">Catálogo JSON (/docs)</a>
      <a href="${esc(config.githubUrl)}" target="_blank" rel="noopener" title="Cuenta de GitHub">Cuenta de GitHub</a>
      <a href="${esc(config.repoUrl || config.githubUrl)}" target="_blank" rel="noopener" title="Repositorio Velirius">Repositorio Velirius</a>
    </nav>

    <div class="status">
      <span>Estado:&nbsp; En línea</span>
      <span class="right">
        <span class="stat">Rutas:&nbsp; ${t.routers}</span>
        <span class="stat">Endpoints:&nbsp; ${t.endpoints}</span>
      </span>
    </div>

    <div class="cards">${cards}</div>
    <div class="footer">© 2026 | ${esc(config.brand)}</div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: 'Velirius API - API REST', body, script: '<script src="/js/home.js"></script>' }));
});

// ---------- /information ----------
router.get('/information', (req, res) => {
  const t = totals();
  const base = absoluteUrl(req, '');
  const body = `
    <h1 class="title">Información del Sistema</h1>
    <p class="intro">Puedes hacer <strong>peticiones</strong> simplemente pulsando en <strong>test</strong><br>(el panel se abre hacia abajo con los parámetros editables)</p>
    <nav class="pills">
      <a href="/home" title="Inicio">Inicio</a>
      <a href="${esc(config.repoUrl)}" target="_blank" rel="noopener" title="Repositorio GitHub">Repositorio GitHub</a>
      <a href="/docs" title="Catálogo JSON (/docs)">Catálogo JSON (/docs)</a>
    </nav>
    <div class="status"><span>Red:&nbsp; En línea</span><span>Lista:&nbsp; ${t.endpoints}</span></div>
    <div class="info-block">
      <div><b>API:</b> Velirius API (estilo Delirius, sin token)</div>
      <div><b>Base URL:</b> ${esc(base)}/</div>
      <div><b>Routers:</b> ${CATEGORIES.map(c => `<a href="/${c.id}">${esc(c.id)}</a>`).join(' · ')}</div>
      <div><b>Formato:</b> JSON <code>{ creator, status, result }</code> · Canvas devuelve imagen/video directo</div>
      <div><b>Sin NSFW:</b> todas las fuentes de Anime y Reactions son SFW</div>
      <div><b>Texto limpio:</b> agrega <code>?format=text</code> a cualquier endpoint JSON</div>
      <div><b>Directo:</b> en Download usa <code>?direct=true|mp3|mp4</code> para el archivo (Range 206)</div>
      <div><b>Descargar:</b> agregá <code>?download=true</code> a cualquier endpoint y el archivo baja como adjunto</div>
      <div><b>Catálogo JSON:</b> <a href="/docs">/docs</a></div>
      <div><b>GitHub:</b> <a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">${esc(config.githubUrl.replace('https://', ''))}</a></div>
    </div>
    <div class="footer">© 2026 | ${esc(config.brand)}</div>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: 'Velirius API - Información del Sistema', body }));
});

// ---------- /docs (JSON) ----------
router.get('/docs', (req, res) => {
  const { a1, a2 } = avatars(req);
  const t = totals();
  return res.json({
    creator: config.creator,
    status: true,
    api: config.name,
    baseUrl: absoluteUrl(req, ''),
    routers: t.routers,
    endpoints: t.endpoints,
    categories: CATEGORIES.map(c => ({
      id: c.id,
      name: c.name,
      count: c.endpoints.length,
      ...(Array.isArray(c.groups) ? { groups: c.groups.map(g => ({ id: g.id, name: g.name, desc: g.desc || '' })) } : {}),
      endpoints: c.endpoints.map(e => ({
        id: e.id,
        method: 'GET',
        path: `/${c.id}/${e.id}`,
        description: e.desc,
        media: e.media || 'json',
        group: e.group || null,
        params: e.params.map(p => ({
          name: p.name,
          required: !!p.required,
          advanced: !!p.advanced,
          description: p.desc || '',
          ...(p.options ? { options: p.options.filter(Boolean) } : {})
        })),
        example: absoluteUrl(req, `/${c.id}/${e.id}${exampleQuery(e, a1, a2)}`)
      }))
    }))
  });
});

// ---------- /<categoria> ----------
router.get('/:category(anime|canvas|tools|downloader|searcher|reactions)', (req, res) => {
  const cat = findCategory(req.params.category);
  if (!cat) return res.status(404).send('Not found');
  const { a1, a2 } = avatars(req);

  const rowOf = e => {
    const paramsLine = e.params.length ? e.params.map(p => p.name).join(', ') : 'no params';
    return `
    <div class="row" data-endpoint="${esc(e.id)}" id="row-${esc(e.id)}">
      <div class="info">
        <h3>${esc(e.id.toUpperCase())}</h3>
        <div class="meta"><span class="get">GET</span> - ${esc(paramsLine)}</div>
      </div>
      <button type="button" class="btn" data-test-btn="${esc(e.id)}" aria-expanded="false" aria-controls="tester-${esc(e.id)}">Test</button>
    </div>`;
  };

  // Si la categoría trae `groups` (como las carpetas de Drive en Canvas), la
  // lista se muestra por secciones con un chip por grupo arriba.
  const groups = Array.isArray(cat.groups) && cat.groups.length ? cat.groups : null;
  const groupOf = e => e.group || (groups ? groups[0].id : null);
  const rows = groups
    ? groups.map(g => {
        const eps = cat.endpoints.filter(e => groupOf(e) === g.id);
        if (!eps.length) return '';
        return `
    <section class="group" id="grupo-${esc(g.id)}">
      <h2 class="group-head"><span>${esc(g.name)}</span><span class="group-count">${eps.length}</span></h2>
      ${eps.map(rowOf).join('')}
    </section>`;
      }).join('')
    : cat.endpoints.map(rowOf).join('');

  const chips = groups
    ? `<nav class="chips">${groups.map(g => {
        const n = cat.endpoints.filter(e => groupOf(e) === g.id).length;
        return n ? `<a class="chip" href="#grupo-${esc(g.id)}">${esc(g.name)} <b>${n}</b></a>` : '';
      }).join('')}</nav>`
    : '';

  const testerData = {
    category: cat.id,
    endpoints: cat.endpoints.map(e => ({
      id: e.id,
      desc: e.desc || '',
      media: e.media || null,
      params: e.params.map(p => ({
        name: p.name,
        desc: p.desc || '',
        required: !!p.required,
        options: p.options || null,
        advanced: !!p.advanced,
        value: p.example === '__AVATAR__' ? a1 : p.example === '__AVATAR2__' ? a2 : (p.example ?? '')
      }))
    }))
  };

  const body = `
    <p class="intro">Puedes hacer <strong>peticiones</strong> simplemente pulsando en <strong>test</strong></p>
    <nav class="pills">
      <a href="/home" title="Inicio">Inicio</a>
      <a href="${esc(config.repoUrl || config.githubUrl)}" target="_blank" rel="noopener" title="Repositorio GitHub">Repositorio GitHub</a>
      <a href="/information" title="Monitor del Sistema">Monitor del Sistema</a>
    </nav>
    <div class="status"><span>Red:&nbsp; En línea</span><span>Lista:&nbsp; ${cat.endpoints.length}</span></div>
    ${chips}
    <div class="list">${rows}</div>
    <div class="footer">© 2026 | ${esc(config.brand)}</div>`;

  const script = `<script>window.VELIRIUS=${JSON.stringify(testerData)};</script><script src="/js/category.js"></script>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: `Velirius 疯狂 - ${cat.name.charAt(0) + cat.name.slice(1).toLowerCase()}`, body, script }));
});

module.exports = router;
