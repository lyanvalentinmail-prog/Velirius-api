// src/routes/searcher.js — SEARCHER: TikTok · YouTube · Google · Wikipedia
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

const q = req => String(req.query.query || req.query.q || req.query.text || req.query.search || '').trim();

/** Envuelve un handler que recibe (query, req) y exige el parámetro query. */
const search = fn => async (req, res) => {
  const query = q(req);
  if (!query) return sendError(res, 400, 'Falta el parámetro query', `Ejemplo: ${req.baseUrl}${req.path}?query=Twice`);
  try {
    return sendSuccess(res, await fn(query, req));
  } catch (e) {
    console.error('[searcher]', e.message);
    return sendError(res, e.status && e.status < 500 ? e.status : 502, e.message,
      e.details ? e.details.slice(0, 3).join(' · ') : undefined);
  }
};

// ---------- TikTok ----------
router.get(['/tiktok', '/tiktoksearch'], search(async (query, req) => {
  const results = await P.tiktokSearch(query, req.query.limit);
  return { query, count: results.length, results };
}));

// ---------- YouTube ----------
router.get(['/youtube', '/yt'], search(async (query, req) => {
  const { results, source } = await P.youtubeSearch(query, req.query.limit);
  return { query, source, count: results.length, results };
}));

// ---------- Google ----------
router.get(['/google', '/web'], search(async (query, req) =>
  P.googleSearch(query, req.query.limit, req.query.lang || 'es')));

// ---------- Wikipedia ----------
router.get(['/wikipedia', '/wiki'], search(async (query, req) =>
  P.wikipediaSearch(query, req.query.limit, req.query.lang || req.query.wiki || 'es')));

module.exports = router;
