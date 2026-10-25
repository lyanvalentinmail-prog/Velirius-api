// src/routes/search.js — Sticker, Sticker pack, Anime, TikTok, YouTube, Instagram, Lyric, Play
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError } = require('../utils/response');
const { absoluteUrl } = require('../utils/http');

const router = express.Router();
const q = req => String(req.query.query || req.query.q || req.query.text || '').trim();
const need = (req, res) => {
  const query = q(req);
  if (!query) { sendError(res, 400, 'Falta el parámetro query'); return null; }
  return query;
};
const handle = fn => async (req, res) => {
  try { const out = await fn(req, res); if (out !== undefined) return sendSuccess(res, out); }
  catch (e) { console.error('[search]', e.message); if (!res.headersSent) return sendError(res, e.status && e.status < 500 ? e.status : 502, e.message, e.details ? e.details.slice(0, 3).join(' · ') : undefined); }
};

router.get('/sticker', handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const results = await P.stickerSearch(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/stickerpack', '/stickerly', '/sticker-pack'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const results = await P.stickerPackSearch(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/anime', '/animesearch'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const results = await P.searchAnime(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/tiktok', '/tiktoksearch'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const results = await P.tiktokSearch(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/youtube', '/ytsearch', '/yt'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const { results, source } = await P.youtubeSearch(query, req.query.limit);
  return { query, source, count: results.length, results };
}));
router.get(['/instagram', '/igstalk', '/ig'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  return P.instagramProfile(query);
}));
router.get(['/lyric', '/lyrics'], handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const results = await P.lyricsSearch(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get('/play', handle(async (req, res) => {
  const query = need(req, res); if (!query) return;
  const { results, source } = await P.youtubeSearch(`${query}`, req.query.limit);
  return {
    query, source, count: results.length,
    results: results.map(r => ({
      ...r,
      playUrl: absoluteUrl(req, `/download/mp3?url=${encodeURIComponent(r.url)}&direct=true`),
      videoUrl: absoluteUrl(req, `/download/mp4?url=${encodeURIComponent(r.url)}&direct=true`)
    }))
  };
}));

module.exports = router;
