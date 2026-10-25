// src/routes/anime.js — Pokémon, Gacha, Character, Manga, Anime
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();
const q = req => String(req.query.query || req.query.q || req.query.text || '').trim();
const handle = fn => async (req, res) => {
  try { return sendSuccess(res, await fn(req)); }
  catch (e) { console.error('[anime]', e.message); return sendError(res, e.status === 404 ? 404 : 502, e.message); }
};

router.get('/pokemon', handle(async req => {
  const shiny = ['true', '1', 'yes'].includes(String(req.query.shiny || '').toLowerCase());
  return P.pokemon(q(req) || 'pikachu', shiny);
}));
router.get('/gacha', handle(async () => P.gacha()));
router.get('/character', handle(async req => {
  const query = q(req);
  if (!query) return P.gacha();
  const results = await P.searchCharacter(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/manga', '/mangasearch'], handle(async req => {
  const query = q(req);
  if (!query) throw Object.assign(new Error('Falta el parámetro query (ej: ?query=Berserk)'), { status: 400 });
  const results = await P.searchManga(query, req.query.limit);
  return { query, count: results.length, results };
}));
router.get(['/anime', '/animesearch', '/search'], handle(async req => {
  const query = q(req);
  if (!query) throw Object.assign(new Error('Falta el parámetro query (ej: ?query=Naruto)'), { status: 400 });
  const results = await P.searchAnime(query, req.query.limit);
  return { query, count: results.length, results };
}));

module.exports = router;
