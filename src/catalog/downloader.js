// src/catalog/downloader.js — Endpoints de la categoría **DOWNLOADER**.
//
// ▸ AGREGAR un endpoint: copiá una entrada de la lista y cambiá `id`, `desc` y `params`.
// ▸ EDITAR uno: cambiá su `desc`, el orden en la lista o cualquiera de sus `params`.
// ▸ BORRAR uno: quitá la entrada (y su ruta en src/routes/download.js).
//
// Formato de una entrada:
//
//   {
//     id: 'miEndpoint',          // = la ruta: GET /downloader/miEndpoint  (minúsculas, sin espacios)
//     desc: 'Qué hace',          // se ve en la web, en /docs y en el README
//     media: 'image',            // opcional: 'image' | 'video' | 'audio' (vista previa en la web)
//     params: [
//       P('text', 'hola', 'Texto principal'),   // requerido
//       O('size', '1', 'Escala (0.5 - 2)')      // opcional
//     ]
//   }
//
// Ayudas (src/catalog/helpers.js): P, O, S, AV, AV2, textStyle(), photoStyle().
const { P, O, S } = require('./helpers');

module.exports = {
  id: 'downloader',
  name: 'DOWNLOADER',
  endpoints: [
    { id: 'tiktok', desc: 'TikTok SIN marca de agua (video HD + audio MP3)', params: [
      P('url', 'https://vt.tiktok.com/ZS43DntHW/', 'URL del TikTok'),
      S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4', 'mp3'])
    ] },
    { id: 'youtube', desc: 'Info y formatos de un video de YouTube (siempre con audio)', params: [
      O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL del video'),
      O('query', '', 'O busca por nombre'),
      S('quality', 'auto', 'Calidad preferida (auto = la mejor que traiga audio)', ['auto', '360', '480', '720', '1080']),
      S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4', 'mp3'])
    ] },
    { id: 'facebook', desc: 'Descarga videos públicos de Facebook (HD/SD)', params: [
      P('url', 'https://www.facebook.com/watch/?v=10153231379946729', 'URL del video o reel público'),
      S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4']),
      S('quality', '', 'Preferencia de calidad', ['', 'hd', 'sd'])
    ] },
    { id: 'instagram', desc: 'Reels, videos y fotos de Instagram', params: [
      P('url', 'https://www.instagram.com/reel/C7cVzn2yzXB/', 'URL del post/reel'),
      O('direct', 'false', 'true = media directa')
    ] },
    { id: 'mp3', desc: 'Audio MP3 real desde YouTube (URL o búsqueda)', media: 'audio', params: [
      O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'),
      O('query', 'Twice I Cant Stop Me', 'O busca por nombre'),
      O('direct', 'true', 'true = audio directo en streaming'),
      O('download', 'false', 'true = descarga el MP3 como archivo')
    ] },
    { id: 'mp4', desc: 'Video MP4 con audio desde YouTube (URL o búsqueda)', media: 'video', params: [
      O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'),
      O('query', 'Twice', 'O busca por nombre'),
      S('quality', 'auto', 'Calidad: auto = la mejor con audio', ['auto', '360', '480', '720', '1080']),
      O('direct', 'true', 'true = video directo en streaming')
    ] },
    { id: 'play', desc: 'Busca una canción y devuelve el MP3 listo para reproducir (si YouTube falla, preview de Deezer/iTunes)', media: 'audio', params: [
      P('query', 'Lisa Money', 'Canción o artista'),
      O('direct', 'true', 'true = audio directo en streaming'),
      O('download', 'false', 'true = descarga el MP3 como archivo')
    ] },
    { id: 'lyric', desc: 'Letra de una canción (JSON, .txt o .lrc sincronizada)', params: [
      P('query', 'Kendrick Lamar Humble', 'Artista + canción'),
      S('format', 'json', 'Formato de salida', ['json', 'txt', 'lrc'])
    ] }
  ]
};
