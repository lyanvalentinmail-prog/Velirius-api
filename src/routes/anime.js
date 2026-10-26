// src/routes/anime.js — Proveedores de imágenes de anime: Neko, Waifu, Maid y Pokémon.
// Todas las fuentes son SFW (rutas /sfw/ o is_nsfw=false).
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError, proxyStream } = require('../utils/response');

const router = express.Router();

const handle = fn => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (out !== undefined) return sendSuccess(res, out);
  } catch (e) {
    console.error('[anime]', e.message);
    if (!res.headersSent) {
      return sendError(res, e.status && e.status < 500 ? e.status : 502, e.message,
        e.details ? e.details.slice(0, 4).join(' · ') : undefined);
    }
  }
};

const wantsDirect = req => ['true', '1', 'yes'].includes(String(req.query.direct || '').toLowerCase());
const amountOf = req => Math.min(10, Math.max(1, parseInt(req.query.amount, 10) || 1));

// ---------- Neko / Waifu / Maid ----------
for (const kind of ['neko', 'waifu', 'maid']) {
  router.get(`/${kind}`, handle(async (req, res) => {
    const amount = amountOf(req);
    const data = await P.animeImage(kind, { provider: req.query.provider || null, amount });
    const first = data.images[0];
    if (wantsDirect(req) && first) {
      return proxyStream(req, res, first.image, { filename: `velirius-${kind}.${/\.png/i.test(first.image) ? 'png' : /\.webp/i.test(first.image) ? 'webp' : 'jpg'}` });
    }
    return {
      kind: data.kind,
      provider: data.provider,
      count: data.count,
      image: first?.image || null,
      images: data.images.map(i => ({ url: i.image, artist: i.artist || null, artistUrl: i.artistUrl || null }))
    };
  }));
}

// ---------- Pokémon ----------
router.get('/pokemon', handle(async (req, res) => {
  const shiny = ['true', '1', 'yes', 'si', 'sí'].includes(String(req.query.shiny || '').toLowerCase());
  const data = await P.pokemon(req.query.query || req.query.q || req.query.name || 'pikachu', shiny);
  if (wantsDirect(req)) {
    if (!data.image) throw new Error('Este Pokémon no tiene arte oficial disponible');
    return proxyStream(req, res, data.image, { filename: `velirius-${data.name}.png` });
  }
  return data;
}));

module.exports = router;
