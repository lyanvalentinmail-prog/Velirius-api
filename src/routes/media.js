// src/routes/media.js — Multimedia de la web servido desde Google Drive.
//
// El video del dashboard vive en Drive y el navegador no puede leerlo de forma
// fiable (los enlaces de descarga redirigen y a veces piden confirmación), así que
// se pasa por aquí: se descarga una vez, se guarda en memoria y se entrega con
// Cache-Control largo. Si el servidor no tiene salida a internet, el <video> de la
// web cae automáticamente al enlace directo de Drive.
const express = require('express');
const config = require('../config');
const { fetchBuffer } = require('../utils/http');

const router = express.Router();

// URL pública de una imagen de Drive (CDN). w = ancho máximo solicitado.
const driveImage = (id, w = 1600) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;

const videoCache = { buf: null, at: 0 };
const VIDEO_TTL = 6 * 60 * 60 * 1000; // 6 h

router.get('/media/dashboardvid.mp4', async (req, res) => {
  const fresh = videoCache.buf && Date.now() - videoCache.at < VIDEO_TTL;
  try {
    if (!fresh) {
      videoCache.buf = await fetchBuffer(config.media.video.direct, { timeoutMs: 30000 });
      videoCache.at = Date.now();
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', String(videoCache.buf.length));
    return res.end(videoCache.buf);
  } catch (e) {
    // Sin salida a Drive: se redirige al enlace directo (el navegador sí puede).
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, config.media.video.direct);
  }
});

router.get('/media/status', (req, res) => res.json({
  creator: config.creator,
  status: true,
  result: {
    folder: config.media.driveFolder,
    video: { ...config.media.video, public: true, cached: !!videoCache.buf },
    dashboard: config.media.dashboard.map(f => ({ ...f, url: driveImage(f.id, 1600) })),
    captures: config.media.captures.map(f => ({ ...f, url: driveImage(f.id, 1400) }))
  }
}));

module.exports = { router, driveImage };
