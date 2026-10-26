// src/routes/canvas.js — GET /canvas/:id → PNG (o MP4/WebM en bratvideo/attp).
// Todos los canvas aceptan parámetros modificables (ver /docs o la web).
const express = require('express');
const { generateCanvas, txt, styleOf } = require('../utils/canvasEngine');
const { bratVideo, attpVideo } = require('../utils/video');
const { sendPng, sendMedia, sendError } = require('../utils/response');
const { findEndpoint } = require('../catalog');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  if (!findEndpoint('canvas', id)) {
    return sendError(res, 404, `Canvas "${id}" no existe`, 'Revisa la lista en /canvas');
  }
  try {
    if (id === 'bratvideo') {
      // Mismas opciones que /canvas/brat (tipografía y colores) + `words`
      // (cuántas palabras entran por pantalla, 5 por defecto).
      const ov = styleOf(req.query);
      const buf = await bratVideo(txt(req.query, 'Welcome to Velirius API'), {
        size: ov.scale,
        bg: ov.bg,
        color: ov.fill,
        font: ov.font,
        uppercase: ov.uppercase,
        spacing: ov.spacing,
        words: req.query.words,
        canvasSize: req.query['canvas.size']
      });
      return sendMedia(res, buf, 'video/mp4', 'velirius-bratvideo.mp4');
    }
    if (id === 'attp') {
      const buf = await attpVideo(txt(req.query, 'Welcome to Velirius'), { size: styleOf(req.query).scale });
      return sendMedia(res, buf, 'video/webm', 'velirius-attp.webm');
    }
    const buf = await generateCanvas(id, req.query);
    if (!buf) return sendError(res, 404, `Canvas "${id}" no existe`, 'Revisa la lista en /canvas');
    return sendPng(res, buf, `velirius-${id}.png`);
  } catch (e) {
    console.error(`[canvas/${id}]`, e.message);
    return sendError(res, 500, 'No se pudo generar el canvas', e.message);
  }
});

module.exports = router;
