// src/routes/canvas.js — GET /canvas/:id → PNG (o MP4/WebM en bratvideo/attp)
const express = require('express');
const { generateCanvas, txt } = require('../utils/canvasEngine');
const { bratVideo, attpVideo } = require('../utils/video');
const { sendPng, sendMedia, sendError } = require('../utils/response');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  try {
    if (id === 'bratvideo') {
      const buf = await bratVideo(txt(req.query, 'Welcome to Velirius API'));
      return sendMedia(res, buf, 'video/mp4', 'velirius-bratvideo.mp4');
    }
    if (id === 'attp') {
      const buf = await attpVideo(txt(req.query, 'Welcome to Velirius'));
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
