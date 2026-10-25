// src/routes/download.js — Downloader: TikTok (sin marca de agua), YouTube, MP3, MP4,
// Play, Spotify, Instagram, Aptoide y Lyric. ?direct= devuelve el archivo (con Range 206).
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError, sendText, proxyStream } = require('../utils/response');
const { absoluteUrl } = require('../utils/http');

const router = express.Router();
const wantDirect = (req, kinds = ['true']) => {
  const d = String(req.query.direct || '').toLowerCase();
  return kinds.includes(d) ? d : null;
};
const cleanName = (s, fb = 'Velirius') =>
  String(s || fb).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[<>:\"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 60) || fb;

const handle = fn => async (req, res) => {
  try { return await fn(req, res); }
  catch (e) {
    console.error('[download]', e.message);
    if (!res.headersSent) return sendError(res, e.status && e.status < 500 ? e.status : 502, e.message, e.details ? e.details.slice(0, 3).join(' · ') : undefined);
  }
};

// ---------- TikTok sin marca de agua ----------
router.get('/tiktok', handle(async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return sendError(res, 400, 'Falta el parámetro url', 'Ejemplo: /download/tiktok?url=https://vt.tiktok.com/…');
  const info = await P.tiktokDownload(url);
  const direct = wantDirect(req, ['true', 'mp4', 'mp3', 'video', 'audio']);
  if (direct === 'mp3' || direct === 'audio') {
    if (!info.audio) throw new Error('Este TikTok no tiene audio extraíble');
    return proxyStream(req, res, info.audio, { filename: `${cleanName(info.title)}.mp3` });
  }
  if (direct) {
    if (!info.video_nowatermark) throw new Error('No hay video sin marca de agua para este enlace');
    return proxyStream(req, res, info.video_nowatermark, { filename: `${cleanName(info.title)}.mp4` });
  }
  return sendSuccess(res, info);
}));

// ---------- YouTube (info + formatos) ----------
router.get(['/youtube', '/yt'], handle(async (req, res) => {
  const info = await P.resolveYoutubeTarget({ url: req.query.url, query: req.query.query || req.query.q });
  const quality = parseInt(req.query.quality || '720', 10) || 720;
  const audio = P.pickAudio(info.formats);
  const video = P.pickVideo(info.formats, quality);
  const direct = wantDirect(req, ['true', 'mp4', 'mp3', 'video', 'audio']);
  if (direct === 'mp3' || direct === 'audio') {
    if (!audio) throw new Error('Sin formato de audio disponible');
    return proxyStream(req, res, audio.url, { filename: `${cleanName(info.title)}.mp3` });
  }
  if (direct) {
    if (!video) throw new Error('Sin formato de video disponible');
    return proxyStream(req, res, video.url, { filename: `${cleanName(info.title)}.mp4` });
  }
  return sendSuccess(res, {
    id: info.id, title: info.title, author: info.author, duration: info.duration,
    thumbnail: info.thumbnail, url: `https://www.youtube.com/watch?v=${info.id}`,
    audio, video, formats: info.formats,
    direct: {
      mp3: absoluteUrl(req, `/download/youtube?url=https://www.youtube.com/watch?v=${info.id}&direct=mp3`),
      mp4: absoluteUrl(req, `/download/youtube?url=https://www.youtube.com/watch?v=${info.id}&direct=mp4&quality=${quality}`)
    }
  });
}));

// ---------- MP3 ----------
router.get(['/mp3', '/ytmp3'], handle(async (req, res) => {
  const info = await P.resolveYoutubeTarget({ url: req.query.url, query: req.query.query || req.query.q });
  const audio = P.pickAudio(info.formats);
  if (wantDirect(req, ['true', 'mp3', 'audio', '1'])) {
    if (!audio) throw new Error('Sin formato de audio disponible');
    return proxyStream(req, res, audio.url, { filename: `${cleanName(info.title)}.mp3` });
  }
  return sendSuccess(res, {
    id: info.id, title: info.title, author: info.author, duration: info.duration, thumbnail: info.thumbnail,
    audio, directUrl: absoluteUrl(req, `/download/mp3?url=https://www.youtube.com/watch?v=${info.id}&direct=true`)
  });
}));

// ---------- MP4 ----------
router.get(['/mp4', '/ytmp4'], handle(async (req, res) => {
  const info = await P.resolveYoutubeTarget({ url: req.query.url, query: req.query.query || req.query.q });
  const quality = parseInt(String(req.query.quality || req.query.format || '360').replace(/[^0-9]/g, ''), 10) || 360;
  const video = P.pickVideo(info.formats, quality);
  if (wantDirect(req, ['true', 'mp4', 'video', '1'])) {
    if (!video) throw new Error('Sin formato de video disponible');
    return proxyStream(req, res, video.url, { filename: `${cleanName(info.title)}.mp4` });
  }
  return sendSuccess(res, {
    id: info.id, title: info.title, author: info.author, duration: info.duration, thumbnail: info.thumbnail,
    requestedQuality: quality, video, hasAudio: !!video?.hasAudio,
    directUrl: absoluteUrl(req, `/download/mp4?url=https://www.youtube.com/watch?v=${info.id}&quality=${quality}&direct=true`)
  });
}));

// ---------- Play (audio por búsqueda) ----------
router.get('/play', handle(async (req, res) => {
  const query = String(req.query.query || req.query.q || req.query.text || '').trim();
  if (!query) return sendError(res, 400, 'Falta el parámetro query', 'Ejemplo: /download/play?query=Lisa+Money');
  const info = await P.resolveYoutubeTarget({ query });
  const audio = P.pickAudio(info.formats);
  if (wantDirect(req, ['true', 'mp3', 'audio', '1'])) {
    if (!audio) throw new Error('Sin formato de audio disponible');
    return proxyStream(req, res, audio.url, { filename: `${cleanName(info.title)}.mp3` });
  }
  return sendSuccess(res, {
    query, id: info.id, title: info.title, author: info.author, duration: info.duration, thumbnail: info.thumbnail,
    youtubeUrl: `https://www.youtube.com/watch?v=${info.id}`,
    audio, playUrl: absoluteUrl(req, `/download/play?query=${encodeURIComponent(query)}&direct=true`)
  });
}));

// ---------- Spotify ----------
router.get(['/spotify', '/spotifydl'], handle(async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url.includes('spotify')) return sendError(res, 400, 'Falta una URL válida de Spotify', 'Ejemplo: /download/spotify?url=https://open.spotify.com/track/…');
  const meta = await P.spotifyInfo(url);
  const searchTerm = `${meta.title} ${meta.author}`.trim();
  const info = await P.resolveYoutubeTarget({ query: searchTerm });
  const audio = P.pickAudio(info.formats);
  if (wantDirect(req, ['true', 'mp3', 'audio', '1'])) {
    if (!audio) throw new Error('No se encontró audio equivalente');
    return proxyStream(req, res, audio.url, { filename: `${cleanName(`${meta.title} - ${meta.author}`)}.mp3` });
  }
  return sendSuccess(res, {
    ...meta,
    matched: { id: info.id, title: info.title, author: info.author, duration: info.duration, youtubeUrl: `https://www.youtube.com/watch?v=${info.id}` },
    audio, playUrl: absoluteUrl(req, `/download/spotify?url=${encodeURIComponent(url)}&direct=true`)
  });
}));

// ---------- Instagram ----------
router.get(['/instagram', '/ig', '/instagramdl'], handle(async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return sendError(res, 400, 'Falta el parámetro url', 'Ejemplo: /download/instagram?url=https://www.instagram.com/reel/…');
  const info = await P.instagramDownload(url);
  if (wantDirect(req, ['true', '1']) && info.media?.[0]) {
    const m = info.media[0];
    return proxyStream(req, res, m.url, { filename: `velirius-ig-${info.shortcode}.${m.type === 'video' ? 'mp4' : 'jpg'}` });
  }
  return sendSuccess(res, info);
}));

// ---------- Aptoide ----------
router.get(['/aptoide', '/apk'], handle(async (req, res) => {
  const query = String(req.query.query || req.query.q || '').trim();
  if (!query) return sendError(res, 400, 'Falta el parámetro query', 'Ejemplo: /download/aptoide?query=WhatsApp');
  const results = await P.aptoideSearch(query, req.query.limit);
  return sendSuccess(res, { query, count: results.length, results });
}));

// ---------- Lyric ----------
router.get(['/lyric', '/lyrics'], handle(async (req, res) => {
  const query = String(req.query || req.query.query || req.query.q || req.query.text || '').trim();
  if (!query) return sendError(res, 400, 'Falta el parámetro query', 'Ejemplo: /download/lyric?query=Twice+Feel+Special');
  const song = await P.lyricFor(query);
  const format = String(req.query.format || 'json').toLowerCase();
  const base = cleanName(`${song.title} - ${song.artist}`);
  if (format === 'lrc') {
    const body = song.syncedLyrics || song.plainLyrics || '';
    return sendText(res, body, `${base}.lrc`);
  }
  if (format === 'txt' || format === 'text') {
    return sendText(res, `${song.title} — ${song.artist}\n\n${song.plainLyrics || song.syncedLyrics || ''}\n`, `${base}.txt`);
  }
  return sendSuccess(res, song);
}));

module.exports = router;
