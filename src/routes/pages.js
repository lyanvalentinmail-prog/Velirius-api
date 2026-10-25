// src/routes/pages.js — Web idéntica a Delirius: /home, /<categoria>, /information, /docs
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

function layout({ title, body, script = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Velirius API — Canvas, Anime, Download, Search y Tools. Sin token.">
<link rel="icon" href="/img/banner.jpg">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="wrap"><main class="card">
${body}
</main></div>
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

// ---------- / y /home ----------
router.get('/', (req, res) => res.redirect('/home'));
router.get('/downloader', (req, res) => res.redirect('/download'));

router.get('/home', (req, res) => {
  const t = totals();
  const rows = CATEGORIES.map(c => `
    <div class="row">
      <span class="folder">${I.folder}</span>
      <div class="info">
        <h3>${esc(c.name)}</h3>
        <div class="meta">${c.endpoints.length} endpoints</div>
      </div>
      <a class="btn" href="/${c.id}">View</a>
    </div>`).join('');

  const body = `
    <h1 class="title">Velirius API</h1>
    <div class="sync">Sync Complete</div>
    <p class="intro">Here are the folders with all the <strong>APIS</strong> available on this website.<br><strong>(Not Required Token)</strong></p>
    <div class="follow"><a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">Follow my github account</a></div>
    <div class="icons">
      <div class="left">
        <a href="/information" title="Information">${I.activity}</a>
        <a href="${esc(config.supportUrl)}" target="_blank" rel="noopener" title="Support">${I.patreon}</a>
        <a href="${esc(config.githubUrl)}" target="_blank" rel="noopener" title="GitHub Account">${I.github}</a>
        <a href="/docs" title="Main Website">${I.external}</a>
      </div>
      <button type="button" data-search-btn title="Search" aria-label="Search">${I.search}</button>
    </div>
    <div class="searchbox"><input type="text" placeholder="Search endpoints… (ej: brat, tiktok, pokemon)"><div class="search-results"></div></div>
    <div class="status">
      <span>Status:&nbsp; Online</span>
      <span class="right">
        <span class="stat">${I.folder} Routers:&nbsp; ${t.routers}</span>
        <span class="stat">${I.stack} Endpoints:&nbsp; ${t.endpoints}</span>
      </span>
    </div>
    <div class="list">${rows}</div>
    <div class="footer">© 2026 | ${esc(config.storeFooter)}</div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: 'Velirius 疯狂 - API Rest', body, script: '<script src="/js/home.js"></script>' }));
});

// ---------- /information ----------
router.get('/information', (req, res) => {
  const t = totals();
  const base = absoluteUrl(req, '');
  const body = `
    <h1 class="title">Information</h1>
    <div class="sync">Database Synced</div>
    <p class="intro">You can do <strong>fetching</strong> just by clicking on the run</p>
    <div class="icons">
      <div class="left">
        <a href="/home" title="Home">${I.home}</a>
        <a href="/docs" title="Docs JSON">${I.external}</a>
        <a href="${esc(config.supportUrl)}" target="_blank" rel="noopener" title="Support">${I.patreon}</a>
      </div>
      <span></span>
    </div>
    <div class="status"><span>Net:&nbsp; Online</span><span>List:&nbsp; ${t.endpoints}</span></div>
    <div class="info-block">
      <div><b>API:</b> Velirius API (estilo Delirius, sin token)</div>
      <div><b>Base URL:</b> ${esc(base)}/</div>
      <div><b>Routers:</b> ${CATEGORIES.map(c => `<a href="/${c.id}">${esc(c.id)}</a>`).join(' · ')}</div>
      <div><b>Formato:</b> JSON <code>{ creator, status, result }</code> · Canvas devuelve imagen/video directo</div>
      <div><b>Texto limpio:</b> agrega <code>?format=text</code> a cualquier endpoint JSON</div>
      <div><b>Directo:</b> en Download usa <code>?direct=true|mp3|mp4</code> para el archivo (Range 206)</div>
      <div><b>Catálogo JSON:</b> <a href="/docs">/docs</a></div>
      <div><b>GitHub:</b> <a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">${esc(config.githubUrl.replace('https://', ''))}</a></div>
    </div>
    <div class="footer">© 2026 | ${esc(config.brand)}</div>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: 'Velirius 疯狂 - Information', body }));
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
      endpoints: c.endpoints.map(e => ({
        id: e.id,
        method: 'GET',
        path: `/${c.id}/${e.id}`,
        description: e.desc,
        params: e.params.map(p => ({ name: p.name, required: !!p.required, description: p.desc || '' })),
        example: absoluteUrl(req, `/${c.id}/${e.id}${exampleQuery(e, a1, a2)}`)
      }))
    }))
  });
});

// ---------- /<categoria> ----------
router.get('/:category(anime|canvas|download|search|tools)', (req, res) => {
  const cat = findCategory(req.params.category);
  if (!cat) return res.status(404).send('Not found');
  const { a1, a2 } = avatars(req);

  const rows = cat.endpoints.map(e => {
    const paramsLine = e.params.length ? e.params.map(p => p.name).join(', ') : 'no params';
    const runUrl = `/${cat.id}/${e.id}${exampleQuery(e, a1, a2)}`;
    return `
    <div class="row" data-endpoint="${esc(e.id)}" id="row-${esc(e.id)}">
      <div class="info">
        <h3><span class="bullet">■</span> ${esc(e.id.toUpperCase())}</h3>
        <div class="meta"><span class="get">GET</span> - ${esc(paramsLine)}</div>
        <div class="desc">${esc(e.desc)} · toca para probar ✎</div>
      </div>
      <a class="btn" href="${esc(runUrl)}" target="_blank" rel="noopener">Run</a>
    </div>`;
  }).join('');

  const testerData = {
    category: cat.id,
    endpoints: cat.endpoints.map(e => ({
      id: e.id,
      params: e.params.map(p => ({
        name: p.name,
        desc: p.desc || '',
        required: !!p.required,
        value: p.example === '__AVATAR__' ? a1 : p.example === '__AVATAR2__' ? a2 : (p.example ?? '')
      }))
    }))
  };

  const body = `
    <h1 class="title">${esc(cat.name)}</h1>
    <div class="sync">Database Synced</div>
    <p class="intro">You can do <strong>fetching</strong> just by clicking on the run</p>
    <div class="icons">
      <div class="left">
        <a href="/home" title="Home">${I.home}</a>
        <a href="/docs" title="Main Website">${I.external}</a>
        <a href="${esc(config.supportUrl)}" target="_blank" rel="noopener" title="Patreon">${I.patreon}</a>
      </div>
      <button type="button" data-search-btn title="Search" aria-label="Search">${I.search}</button>
    </div>
    <div class="searchbox"><input type="text" placeholder="Search in ${esc(cat.name)}…"></div>
    <div class="status"><span>Net:&nbsp; Online</span><span>List:&nbsp; ${cat.endpoints.length}</span></div>
    <div class="list">${rows}</div>
    <div class="footer">© 2026 | ${esc(config.brand)}</div>`;

  const script = `<script>window.VELIRIUS=${JSON.stringify(testerData)};</script><script src="/js/category.js"></script>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(layout({ title: `Velirius 疯狂 - ${cat.name.charAt(0) + cat.name.slice(1).toLowerCase()}`, body, script }));
});

module.exports = router;
