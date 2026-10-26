// src/utils/youtube.js — Búsqueda y extracción de YouTube con youtubei.js.
//
// ¿Por qué este módulo? Porque los respaldos viejos (InnerTube a mano, Invidious,
// Piped) se fueron cayendo: hoy casi todas las instancias públicas tienen la API
// apagada (`api:false`). youtubei.js habla InnerTube con el player de YouTube
// actualizado, así que resuelve las firmas (`signatureCipher`) y el `n`-token
// sin que tengamos que reimplementarlos.
//
// Lo importante para el DOWNLOADER: casi siempre YouTube sólo publica los
// formatos buenos como DASH (video sin audio). Acá:
//   1. se busca un formato **progresivo** (video + audio en el mismo archivo),
//   2. si no hay, se bajan video y audio por separado y se **pegan con ffmpeg**.
// En los dos casos el resultado se reproduce con imagen y sonido.
//
// Si youtubei.js no está instalado (o falla), todas las funciones lanzan y quien
// llama sigue con los respaldos de providers.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { UA_DESKTOP } = require('./http');

// ---------------------------------------------------------------------------
// Cliente (se crea una sola vez por proceso)
// ---------------------------------------------------------------------------
let cliente = null;
let clienteError = null;
let clienteErrorAt = 0;

async function clienteYt() {
  if (cliente) return cliente;
  // Un fallo de red no debe envenenar el proceso para siempre: se reintenta a los 5 min.
  if (clienteError && Date.now() - clienteErrorAt < 300000) throw clienteError;
  try {
    const { Innertube } = require('youtubei.js');
    cliente = await Innertube.create({
      lang: 'es',
      location: 'US',
      retrieve_player: true,
      generate_session_locally: true
    });
    return cliente;
  } catch (e) {
    clienteError = new Error(`youtubei.js no está disponible (${e.message})`);
    clienteErrorAt = Date.now();
    throw clienteError;
  }
}

/**
 * Olvida el cliente y el último error. Se usa en los tests (y sirve para
 * reintentar enseguida después de un fallo de red).
 */
function reiniciar() {
  cliente = null;
  clienteError = null;
  clienteErrorAt = 0;
  cachePlay.clear();
}

/** true si el paquete está instalado (no prueba la red). */
function disponible() {
  try { require.resolve('youtubei.js'); return true; } catch (_) { return false; }
}

const segundos = s => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);
const texto = v => (v == null ? null : String(v.toString ? v.toString() : v));

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------
function mapVideo(v) {
  const id = v.video_id || v.id;
  const thumbs = v.thumbnails || [];
  return {
    id,
    title: texto(v.title) || '',
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnail: thumbs.length ? (thumbs[thumbs.length - 1].url || thumbs[0].url) : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: v.duration?.text || segundos(v.duration?.seconds),
    author: v.author?.name || '',
    views: texto(v.view_count) || null,
    published: texto(v.published) || null
  };
}

async function buscar(query, limit = 10) {
  const y = await clienteYt();
  const res = await y.search(query, { type: 'video' });
  const videos = res.videos || res.results || [];
  const items = videos.slice(0, limit).map(mapVideo).filter(v => v.id);
  if (!items.length) throw new Error('YouTube no devolvió resultados');
  return items;
}

// ---------------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------------
const esMp4 = f => /mp4/i.test(String(f.mime_type || ''));

/** Mejor formato progresivo (video + audio) que no pase de `quality`. */
function mejorProgresivo(lista, quality = 0) {
  if (!lista.length) return null;
  const mp4 = lista.filter(esMp4);
  const pool = mp4.length ? mp4 : lista;
  const q = Number(quality) || 0;
  const abajo = pool
    .filter(f => !q || (f.height || 0) <= q)
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  return abajo[0] || pool.slice().sort((a, b) => (b.height || 0) - (a.height || 0))[0] || null;
}

/** Video DASH: se prefiere mp4/avc para que el mp4 final abra en cualquier player. */
function mejorVideoDash(lista, quality = 0) {
  if (!lista.length) return null;
  const orden = l => l.slice().sort((a, b) => {
    const ah = (a.height || 0), bh = (b.height || 0);
    return bh - ah;
  });
  const mp4 = lista.filter(esMp4);
  const pool = mp4.length ? mp4 : lista;
  const q = Number(quality) || 0;
  const abajo = orden(pool.filter(f => !q || (f.height || 0) <= q));
  return abajo[0] || orden(pool)[0] || null;
}

/** Audio DASH: mp4a (AAC) primero, después lo que haya. */
function mejorAudioDash(lista) {
  if (!lista.length) return null;
  const aac = lista.filter(f => /mp4a/i.test(String(f.mime_type || '')));
  const pool = aac.length ? aac : lista;
  return pool.slice().sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
}

/**
 * Pide la info de un video y devuelve los grupos de formatos ya separados.
 * @param {string} id
 */
async function info(id) {
  const y = await clienteYt();
  const data = await y.getInfo(id);
  const estado = data.playability_status?.status;
  if (estado && estado !== 'OK') {
    const motivo = data.playability_status?.reason || estado;
    throw new Error(`YouTube no permite reproducir este video (${motivo})`);
  }
  const sd = data.streaming_data;
  if (!sd) throw new Error('YouTube no devolvió formatos para este video');
  return {
    y,
    data,
    meta: {
      id,
      title: texto(data.basic_info?.title) || '',
      author: texto(data.basic_info?.author) || '',
      duration: data.basic_info?.duration || null,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    },
    progressive: (sd.formats || []).filter(f => f.has_video && f.has_audio),
    videoOnly: (sd.adaptive_formats || []).filter(f => f.has_video && !f.has_audio),
    audioOnly: (sd.adaptive_formats || []).filter(f => !f.has_video && f.has_audio)
  };
}

const plain = f => ({
  itag: f.itag,
  quality: f.quality_label || f.quality || null,
  height: f.height || (f.quality_label ? parseInt(f.quality_label, 10) || null : null),
  mime: f.mime_type || null,
  hasVideo: !!f.has_video,
  hasAudio: !!f.has_audio,
  bitrate: f.bitrate || f.average_bitrate || null
});

/** Formatos para el JSON: los progresivos y el audio llevan URL reproducible. */
async function formatos(id) {
  const { y, meta, progressive, videoOnly, audioOnly } = await info(id);
  const player = y.session?.player;
  const out = [];
  for (const f of progressive.slice(0, 4)) {
    out.push({ ...plain(f), url: await f.decipher(player) });
  }
  for (const f of videoOnly.slice(0, 8)) out.push({ ...plain(f), url: null });
  for (const f of audioOnly.slice(0, 4)) {
    out.push({ ...plain(f), url: await f.decipher(player) });
  }
  return { meta, formats: out };
}

// ---------------------------------------------------------------------------
// Pegado video + audio (sólo cuando YouTube no da ningún formato progresivo)
// ---------------------------------------------------------------------------
function ffmpegPath() {
  try { return require('@ffmpeg-installer/ffmpeg').path; } catch (_) { return 'ffmpeg'; }
}

const MUX_DIR = path.join(os.tmpdir(), 'velirius-yt');
const MUX_TTL = 15 * 60 * 1000;

function limpiarTemporales() {
  try {
    if (!fs.existsSync(MUX_DIR)) return;
    const ahora = Date.now();
    for (const f of fs.readdirSync(MUX_DIR)) {
      const p = path.join(MUX_DIR, f);
      try {
        if (ahora - fs.statSync(p).mtimeMs > MUX_TTL) fs.unlinkSync(p);
      } catch (_) { /* archivo en uso */ }
    }
  } catch (_) { /* sin permiso: no pasa nada */ }
}

/** Une pista de video + pista de audio en un solo MP4 (sin recodificar). */
function pegar(videoUrl, audioUrl, id) {
  fs.mkdirSync(MUX_DIR, { recursive: true });
  limpiarTemporales();
  const salida = path.join(MUX_DIR, `${id || 'video'}-${Date.now()}.mp4`);
  // googlevideo rechaza peticiones sin User-Agent de navegador; `-headers` es la
  // forma portable de mandarlo (el build de ffmpeg de Vercel no trae -user_agent).
  const entrada = url => (/^https?:/i.test(String(url))
    ? ['-headers', `User-Agent: ${UA_DESKTOP}\r\n`]
    : []);
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), [
      '-y', '-hide_banner', '-loglevel', 'error',
      ...entrada(videoUrl), '-i', videoUrl,
      ...entrada(audioUrl), '-i', audioUrl,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c', 'copy', '-movflags', '+faststart',
      salida
    ], { timeout: 150000, maxBuffer: 1024 * 1024 }, err => {
      if (err) {
        try { fs.unlinkSync(salida); } catch (_) { /* nada */ }
        return reject(new Error(`No se pudo pegar el audio con el video (ffmpeg): ${String(err.message).slice(-180)}`));
      }
      resolve(salida);
    });
  });
}

// ---------------------------------------------------------------------------
// Resultado reproducible
// ---------------------------------------------------------------------------
const cachePlay = new Map(); // `${id}:${quality}` -> { at, value }
const PLAY_TTL = 20 * 60 * 1000;

/**
 * Devuelve algo que se puede reproducir CON audio y video.
 * @param {string} id
 * @param {number|'auto'} quality alto máximo preferido (0/'auto' = el mejor)
 * @returns {Promise<{url?:string, file?:string, hasAudio:boolean, height?:number, quality?:string, muxed:boolean}>}
 */
async function videoReproducible(id, quality = 0) {
  const key = `${id}:${quality || 'auto'}`;
  const hit = cachePlay.get(key);
  if (hit && Date.now() - hit.at < PLAY_TTL && (!hit.value.file || fs.existsSync(hit.value.file))) return hit.value;

  const { y, progressive, videoOnly, audioOnly } = await info(id);
  const player = y.session?.player;
  let salida;

  const prog = mejorProgresivo(progressive, quality);
  if (prog) {
    salida = {
      url: await prog.decipher(player),
      height: prog.height || null,
      quality: prog.quality_label || null,
      mime: 'video/mp4',
      hasAudio: true,
      muxed: false
    };
  } else {
    const v = mejorVideoDash(videoOnly, quality);
    const a = mejorAudioDash(audioOnly);
    if (!v) throw new Error('YouTube no ofrece video para este video');
    if (!a) throw new Error('YouTube no ofrece audio para este video');
    const file = await pegar(await v.decipher(player), await a.decipher(player), id);
    salida = {
      file,
      height: v.height || null,
      quality: v.quality_label || null,
      mime: 'video/mp4',
      hasAudio: true,
      muxed: true
    };
  }

  cachePlay.set(key, { at: Date.now(), value: salida });
  return salida;
}

/** URL del mejor audio suelto (para /mp3 y /play). */
async function audioReproducible(id) {
  const { y, audioOnly, progressive } = await info(id);
  const a = mejorAudioDash(audioOnly);
  if (a) {
    return {
      url: await a.decipher(y.session?.player),
      mime: a.mime_type || 'audio/mp4',
      bitrate: a.bitrate || null,
      quality: a.quality_label || null
    };
  }
  const prog = mejorProgresivo(progressive, 0);
  if (!prog) throw new Error('YouTube no ofrece audio para este video');
  return {
    url: await prog.decipher(y.session?.player),
    mime: 'video/mp4',
    bitrate: prog.bitrate || null,
    quality: prog.quality_label || null
  };
}

module.exports = {
  disponible,
  reiniciar,
  buscar,
  info,
  formatos,
  videoReproducible,
  audioReproducible,
  mejorProgresivo,
  mejorVideoDash,
  mejorAudioDash,
  limpiarTemporales,
  MUX_DIR
};
