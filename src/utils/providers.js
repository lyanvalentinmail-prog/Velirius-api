// src/utils/providers.js — Fuentes públicas SIN token para toda la API.
//
// Reglas del proyecto:
//  · Nada de contenido NSFW: todas las fuentes usan rutas /sfw/ o el filtro
//    is_nsfw=false. No existe ningún endpoint para adultos.
//  · Nada de IA: no hay generación de texto/imagen por modelos, solo APIs públicas.
//
// Fuentes: PokeAPI · nekos.best · waifu.pics · waifu.im · nekos.life · purrbot ·
// otakugifs · TikWM · YouTube (InnerTube + Invidious/Piped) · Facebook · Instagram
// · LRCLIB/lyrics.ovh · Google · DuckDuckGo · Wikipedia · Google Translate · MyMemory.
const { fetchJson, postJson, fetchText, firstSuccess, UA_DESKTOP, UA_MOBILE } = require('./http');

const clampLimit = (v, def = 10, max = 25) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.max(1, Math.min(max, n));
};
/** Convierte errores de red feos ("fetch failed") en mensajes entendibles. */
const friendly = e => (/(fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|aborted)/i.test(String(e && e.message))
  ? new Error('No se pudo contactar con la fuente (sin conexión o servicio caído)')
  : e);
const clampAmount = (v, def = 1, max = 10) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.max(1, Math.min(max, n));
};

// ==========================================================================
// 1) ANIME — proveedores de imágenes (Neko / Waifu / Maid / Pokémon)
// ==========================================================================

async function nekosBest(tag, amount = 1) {
  const n = clampAmount(amount, 1, 20);
  const j = await fetchJson(`https://nekos.best/api/v2/${tag}?amount=${n}`, { timeoutMs: 12000 });
  const list = (j?.results || []).filter(r => r && r.url).map(r => ({
    image: r.url,
    provider: 'nekos.best',
    artist: r.artist_name || null,
    artistUrl: r.artist_href || null,
    sourceUrl: r.source_url || null
  }));
  if (!list.length) throw new Error('nekos.best sin imágenes');
  return list;
}

async function waifuPics(tag, amount = 1) {
  const n = clampAmount(amount, 1, 10);
  const list = [];
  for (let i = 0; i < n; i++) {
    const j = await fetchJson(`https://api.waifu.pics/sfw/${tag}`, { timeoutMs: 10000 });
    if (j?.url) list.push({ image: j.url, provider: 'waifu.pics' });
  }
  if (!list.length) throw new Error('waifu.pics sin imágenes');
  return list;
}

async function waifuIm(tag, amount = 1) {
  const n = clampAmount(amount, 1, 30);
  const params = new URLSearchParams({ included_tags: tag, is_nsfw: 'false' });
  if (n > 1) { params.set('many', 'true'); params.set('limit', String(n)); }
  const j = await fetchJson(`https://api.waifu.im/search?${params.toString()}`, { timeoutMs: 12000 });
  const list = (j?.images || []).map(img => ({
    image: img.url,
    provider: 'waifu.im',
    artist: img.artist?.name || null,
    artistUrl: img.artist?.pixiv || null,
    sourceUrl: img.source || null,
    tags: (img.tags || []).map(t => t.name)
  }));
  if (!list.length) throw new Error('waifu.im sin imágenes');
  return list;
}

async function nekosLife(tag, amount = 1) {
  const list = [];
  for (let i = 0; i < clampAmount(amount, 1, 5); i++) {
    const j = await fetchJson(`https://nekos.life/api/v2/img/${tag}`, { timeoutMs: 10000 });
    if (j?.url) list.push({ image: j.url, provider: 'nekos.life' });
  }
  if (!list.length) throw new Error('nekos.life sin imágenes');
  return list;
}

// Cada tipo de anime tiene su cadena de proveedores (siempre SFW).
const ANIME_SOURCES = {
  neko: {
    'nekos.best': (n) => nekosBest('neko', n),
    'waifu.pics': (n) => waifuPics('neko', n),
    'waifu.im': (n) => waifuIm('neko', n),
    'nekos.life': (n) => nekosLife('neko', n)
  },
  waifu: {
    'nekos.best': (n) => nekosBest('waifu', n),
    'waifu.pics': (n) => waifuPics('waifu', n),
    'waifu.im': (n) => waifuIm('waifu', n)
  },
  maid: {
    'nekos.best': (n) => nekosBest('maid', n),
    'waifu.im': (n) => waifuIm('maid', n)
  }
};

const ANIME_KINDS = Object.keys(ANIME_SOURCES);

/**
 * Devuelve imágenes SFW de un tipo de anime.
 * @param {'neko'|'waifu'|'maid'} kind
 * @param {{provider?:string, amount?:number}} opts
 */
async function animeImage(kind, { provider = null, amount = 1 } = {}) {
  const key = String(kind || '').toLowerCase();
  const sources = ANIME_SOURCES[key];
  if (!sources) throw new Error(`Tipo desconocido "${kind}". Usa: ${ANIME_KINDS.join(', ')}`);

  if (provider) {
    const name = Object.keys(sources).find(k => k.toLowerCase() === String(provider).toLowerCase());
    if (!name) throw new Error(`Proveedor no disponible para ${key}. Usa: ${Object.keys(sources).join(', ')}`);
    const images = await sources[name](amount);
    return { kind: key, provider: name, count: images.length, images };
  }

  const producers = Object.entries(sources).map(([name, fn]) => [name, () => fn(amount)]);
  const { value, source } = await firstSuccess(producers);
  return { kind: key, provider: source, count: value.length, images: value };
}

// ---------------- Pokémon (PokeAPI) ----------------
async function pokemon(query, shiny = false) {
  let q = String(query || 'pikachu').trim().toLowerCase();
  if (q === 'random' || q === 'aleatorio' || q === '') q = String(1 + Math.floor(Math.random() * 1025));
  const poke = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`);
  let species = null;
  try { species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(String(poke.id))}`); } catch (_) { /* opcional */ }
  const flavor = species?.flavor_text_entries?.find(e => e.language.name === 'es')
    || species?.flavor_text_entries?.find(e => e.language.name === 'en');
  const art = poke.sprites?.other?.['official-artwork'];
  const home = poke.sprites?.other?.home;
  return {
    id: poke.id,
    name: poke.name,
    shiny: !!shiny,
    types: (poke.types || []).map(t => t.type.name),
    abilities: (poke.abilities || []).map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
    height_m: poke.height / 10,
    weight_kg: poke.weight / 10,
    stats: Object.fromEntries((poke.stats || []).map(s => [s.stat.name, s.base_stat])),
    description: flavor ? flavor.flavor_text.replace(/\s+/g, ' ') : '',
    genus: species?.genera?.find(g => g.language.name === 'es')?.genus
      || species?.genera?.find(g => g.language.name === 'en')?.genus || '',
    image: shiny
      ? (art?.front_shiny || poke.sprites?.front_shiny || art?.front_default)
      : (art?.front_default || home?.front_default || poke.sprites?.front_default),
    sprite: shiny ? poke.sprites?.front_shiny : poke.sprites?.front_default,
    cries: poke.cries?.latest || null
  };
}

// ==========================================================================
// 2) REACTIONS — proveedores de GIFs (100% SFW)
// ==========================================================================
const REACTION_PROVIDERS = {
  'nekos.best': async (r) => {
    const j = await fetchJson(`https://nekos.best/api/v2/${r}?amount=1`, { timeoutMs: 10000 });
    const u = j?.results?.[0]?.url;
    if (!u) throw new Error('sin gif');
    return u;
  },
  'waifu.pics': async (r) => {
    const j = await fetchJson(`https://api.waifu.pics/sfw/${r}`, { timeoutMs: 10000 });
    const u = j?.url;
    if (!u) throw new Error('sin gif');
    return u;
  },
  purrbot: async (r) => {
    const j = await fetchJson(`https://purrbot.site/api/img/sfw/${r}/gif`, { timeoutMs: 10000 });
    const u = j?.link;
    if (!u) throw new Error('sin gif');
    return u;
  },
  otakugifs: async (r) => {
    const j = await fetchJson(`https://api.otakugifs.xyz/gif?reaction=${r}&format=gif`, { timeoutMs: 10000 });
    const u = j?.url;
    if (!u) throw new Error('sin gif');
    return u;
  }
};

// Lista blanca de reacciones (solo SFW). El id del endpoint = la reacción.
const REACTIONS = {
  hug: 'Abrazo',
  kiss: 'Beso',
  pat: 'Caricia en la cabeza',
  slap: 'Bofetada de broma',
  cuddle: 'Acurrucarse',
  wave: 'Saludo con la mano',
  wink: 'Guiño',
  blush: 'Sonrojo',
  smile: 'Sonrisa',
  happy: 'Felicidad',
  dance: 'Baile',
  cry: 'Llanto',
  poke: 'Toque con el dedo',
  tickle: 'Cosquillas',
  highfive: 'Choca esos cinco',
  handhold: 'Tomados de la mano',
  nom: 'Comer algo',
  bite: 'Mordisco de broma',
  bonk: 'Bonk',
  baka: 'Baka!',
  smug: 'Cara de suficiencia',
  laugh: 'Risa',
  shrug: 'Encogimiento de hombros',
  sleep: 'Dormir',
  think: 'Pensando',
  thumbsup: 'Pulgar arriba'
};

const REACTION_LIST = Object.keys(REACTIONS);

/**
 * Devuelve el GIF de una reacción probando los proveedores en orden.
 * @param {string} name
 * @param {{provider?:string}} opts
 */
async function reaction(name, { provider = null } = {}) {
  const key = String(name || '').toLowerCase();
  if (!REACTION_LIST.includes(key)) throw new Error(`Reacción desconocida "${name}". Usa: ${REACTION_LIST.join(', ')}`);

  if (provider) {
    const fn = REACTION_PROVIDERS[String(provider).toLowerCase()];
    if (!fn) throw new Error(`Proveedor no disponible. Usa: ${Object.keys(REACTION_PROVIDERS).join(', ')}`);
    return { reaction: key, label: REACTIONS[key], provider: String(provider).toLowerCase(), gif: await fn(key) };
  }

  const producers = Object.entries(REACTION_PROVIDERS)
    .map(([label, fn]) => [label, () => fn(key)]);
  try {
    const { value, source } = await firstSuccess(producers);
    return { reaction: key, label: REACTIONS[key], provider: source, gif: value };
  } catch (e) {
    e.message = `Ningún proveedor de GIFs tiene la reacción "${key}" ahora mismo.`;
    throw e;
  }
}

// ==========================================================================
// 3) TOOLS — traductor
// ==========================================================================
async function translate(text, to = 'en', from = 'auto') {
  const tl = String(to || 'en').toLowerCase();
  const sl = String(from || 'auto').toLowerCase();
  const { value } = await firstSuccess([
    ['google-gtx', async () => {
      const j = await fetchJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`);
      const translated = (j[0] || []).map(seg => seg[0]).join('');
      if (!translated) throw new Error('sin traducción');
      return { originalText: text, translatedText: translated, from: j[2] || sl, to: tl, engine: 'google-gtx' };
    }],
    ['mymemory', async () => {
      const pair = `${sl === 'auto' ? 'autodetect' : sl}|${tl}`;
      const j = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`);
      const translated = j?.responseData?.translatedText;
      if (!translated) throw new Error('sin traducción');
      return { originalText: text, translatedText: translated, from: sl, to: tl, engine: 'mymemory' };
    }]
  ]);
  return value;
}

// ==========================================================================
// 4) DOWNLOADER — TikTok / YouTube / Facebook / Instagram / MP3 / MP4 / Lyric
// ==========================================================================

// ---------------- TikTok (TikWM, sin marca de agua) ----------------
function mapTikTokVideo(v) {
  const author = v.author || {};
  const id = v.video_id || v.id || null;
  return {
    id,
    title: v.title || '',
    url: author.unique_id && id ? `https://www.tiktok.com/@${author.unique_id}/video/${id}` : null,
    cover: v.cover || v.origin_cover || null,
    duration: v.duration ?? null,
    video_nowatermark: v.hdplay || v.play || null,
    video_watermark: v.wmplay || null,
    audio: v.music || v.music_info?.play || null,
    music: v.music_info ? { title: v.music_info.title, author: v.music_info.author } : null,
    author: { nickname: author.nickname || '', username: author.unique_id || '', avatar: author.avatar || null },
    stats: {
      plays: v.play_count ?? null,
      likes: v.digg_count ?? null,
      comments: v.comment_count ?? null,
      shares: v.share_count ?? null
    }
  };
}
async function tiktokDownload(url) {
  const j = await fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
  if (j.code !== 0 || !j.data) throw new Error(j.msg || 'TikWM no pudo resolver el enlace');
  const d = mapTikTokVideo(j.data);
  return { ...d, watermark: false, images: j.data.images || null };
}
async function tiktokSearch(query, limit) {
  const count = clampLimit(limit, 10, 30);
  const j = await fetchJson(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=${count}&cursor=0`);
  if (j.code !== 0) throw new Error(j.msg || 'TikWM search falló');
  return (j.data?.videos || []).map(mapTikTokVideo);
}

// ---------------- YouTube (InnerTube + Invidious/Piped) ----------------
function youtubeId(input) {
  const s = String(input || '');
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/|music\?v=))([\w-]{11})/) || s.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
const INVIDIOUS_FALLBACK = ['https://yt.chocolatemoo53.com'];
let invidiousCache = { at: 0, list: INVIDIOUS_FALLBACK };
async function invidiousInstances() {
  if (Date.now() - invidiousCache.at < 3600000 && invidiousCache.list.length) return invidiousCache.list;
  try {
    const j = await fetchJson('https://api.invidious.io/instances.json', { timeoutMs: 7000 });
    const list = (Array.isArray(j) ? j : [])
      .map(([, info]) => info)
      .filter(info => info && info.type === 'https' && info.api === true && info.uri && !(info.monitor && info.monitor.down))
      .map(info => String(info.uri).replace(/\/$/, ''));
    if (list.length) invidiousCache = { at: Date.now(), list: [...new Set([...list, ...INVIDIOUS_FALLBACK])] };
  } catch (_) { /* se usa el respaldo */ }
  return invidiousCache.list;
}
const PIPED = [
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi-libre.kavin.rocks',
  'https://pipedapi.adminforge.de'
];

async function youtubeSearchInnerTube(query, limit) {
  const body = {
    context: { client: { clientName: 'WEB', clientVersion: '2.20240111.09.00', hl: 'es', gl: 'US' } },
    query
  };
  const j = await postJson('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', body, { headers: { 'User-Agent': UA_DESKTOP } });
  const sections = j?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const items = [];
  for (const sec of sections) {
    for (const it of sec?.itemSectionRenderer?.contents || []) {
      const v = it?.videoRenderer;
      if (!v?.videoId) continue;
      items.push({
        id: v.videoId,
        title: (v.title?.runs || []).map(r => r.text).join(''),
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: v.thumbnail?.thumbnails?.at(-1)?.url || null,
        duration: v.lengthText?.simpleText || null,
        author: (v.ownerText?.runs || []).map(r => r.text).join(''),
        views: v.viewCountText?.simpleText || null,
        published: v.publishedTimeText?.simpleText || null
      });
      if (items.length >= limit) return items;
    }
  }
  if (!items.length) throw new Error('InnerTube sin resultados');
  return items;
}

async function youtubeSearch(query, limit) {
  const n = clampLimit(limit, 10, 30);
  const producers = [['innertube', () => youtubeSearchInnerTube(query, n)]];
  for (const base of await invidiousInstances()) {
    producers.push([base, async () => {
      const j = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, { timeoutMs: 10000 });
      const items = (Array.isArray(j) ? j : []).filter(v => v.type === 'video').slice(0, n).map(v => ({
        id: v.videoId,
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)}:${String(v.lengthSeconds % 60).padStart(2, '0')}` : null,
        author: v.author || '',
        views: v.viewCount ?? null,
        published: v.publishedText || null
      }));
      if (!items.length) throw new Error('sin resultados');
      return items;
    }]);
  }
  for (const base of PIPED) {
    producers.push([base, async () => {
      const j = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`, { timeoutMs: 10000 });
      const items = (j.items || []).filter(v => v.url?.includes('watch')).slice(0, n).map(v => {
        const id = (v.url.match(/v=([\w-]{11})/) || [])[1];
        return {
          id,
          title: v.title,
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: v.thumbnail,
          duration: v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : null,
          author: v.uploaderName || '',
          views: v.views ?? null,
          published: v.uploadedDate || null
        };
      }).filter(v => v.id);
      if (!items.length) throw new Error('sin resultados');
      return items;
    }]);
  }
  const { value, source } = await firstSuccess(producers);
  return { results: value, source };
}

function pickAudio(formats) {
  const audios = formats.filter(f => f.hasAudio && !f.hasVideo);
  return audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
    || formats.filter(f => f.hasAudio).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
    || null;
}
function pickVideo(formats, quality = 720) {
  const muxed = formats.filter(f => f.hasVideo && f.hasAudio);
  const under = muxed.filter(f => (f.height || 0) <= quality).sort((a, b) => (b.height || 0) - (a.height || 0));
  if (under[0]) return under[0];
  if (muxed[0]) return muxed.sort((a, b) => (a.height || 0) - (b.height || 0))[0];
  const vids = formats.filter(f => f.hasVideo).sort((a, b) => Math.abs((a.height || 0) - quality) - Math.abs((b.height || 0) - quality));
  return vids[0] || null;
}

async function youtubeStreams(id) {
  const producers = [];
  for (const base of await invidiousInstances()) {
    producers.push([base, async () => {
      const j = await fetchJson(`${base}/api/v1/videos/${id}`, { timeoutMs: 12000 });
      if (!j || j.error) throw new Error(j?.error || 'sin datos');
      const formats = [];
      for (const f of j.formatStreams || []) {
        formats.push({ quality: f.qualityLabel || f.quality, height: parseInt(f.qualityLabel) || null, mime: f.type, url: f.url, hasVideo: true, hasAudio: true, bitrate: f.bitrate });
      }
      for (const f of j.adaptiveFormats || []) {
        if (!f.url) continue;
        const isAudio = String(f.type || '').startsWith('audio/');
        formats.push({
          quality: f.qualityLabel || (isAudio ? `${Math.round((f.bitrate || 0) / 1000)}kbps` : f.quality),
          height: parseInt(f.qualityLabel) || null,
          mime: f.type,
          url: f.url,
          hasVideo: !isAudio,
          hasAudio: isAudio,
          bitrate: f.bitrate
        });
      }
      if (!formats.length) throw new Error('sin formatos');
      return { id, title: j.title, author: j.author, duration: j.lengthSeconds, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, formats };
    }]);
  }
  for (const base of PIPED) {
    producers.push([base, async () => {
      const j = await fetchJson(`${base}/streams/${id}`, { timeoutMs: 12000 });
      if (!j || j.error) throw new Error(j?.error || 'sin datos');
      const formats = [];
      for (const f of j.audioStreams || []) {
        formats.push({ quality: f.quality || `${Math.round((f.bitrate || 0) / 1000)}kbps`, height: null, mime: f.mimeType, url: f.url, hasVideo: false, hasAudio: true, bitrate: f.bitrate });
      }
      for (const f of j.videoStreams || []) {
        formats.push({ quality: f.quality, height: parseInt(f.quality) || f.height || null, mime: f.mimeType, url: f.url, hasVideo: true, hasAudio: !f.videoOnly, bitrate: f.bitrate });
      }
      if (!formats.length) throw new Error('sin formatos');
      return { id, title: j.title, author: j.uploader, duration: j.duration, thumbnail: j.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, formats };
    }]);
  }
  const { value, source } = await firstSuccess(producers);
  return { ...value, source };
}

async function resolveYoutubeTarget({ url, query }) {
  if (url) {
    const id = youtubeId(url);
    if (!id) throw new Error('URL de YouTube inválida. Ejemplo: https://www.youtube.com/watch?v=XXXXXXXXXXX');
    return youtubeStreams(id);
  }
  if (!query) throw new Error('Falta el parámetro url o query');
  const { results } = await youtubeSearch(query, 1);
  if (!results.length) throw new Error('Sin resultados para esa búsqueda');
  const info = await youtubeStreams(results[0].id);
  return { ...info, searchResult: results[0] };
}

// ---------------- Facebook ----------------
function fbVideoId(url) {
  const s = String(url || '');
  const m = s.match(/\/videos\/(?:[^/]+\/)?(\d{6,})/)
    || s.match(/[?&]v=(\d{6,})/)
    || s.match(/\/reel\/(\d{6,})/)
    || s.match(/\/watch\/?\?v=(\d{6,})/);
  return m ? m[1] : null;
}
function unescapeJs(s) {
  if (!s) return null;
  try { return JSON.parse(`"${String(s).replace(/"/g, '\\"')}"`); } catch (_) { return String(s).replace(/\\u0025/g, '%').replace(/\\\//g, '/'); }
}
function metaContent(html, prop) {
  const m = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`content="([^"]*)"[^>]*property="${prop}"`, 'i'));
  return m ? m[1].replace(/&amp;/g, '&') : null;
}
function parseFacebookHtml(html) {
  const pick = [
    /"playable_url_quality_hd":"([^"]+)"/,
    /"browser_native_hd_url":"([^"]+)"/,
    /hd_src(?:_no_ratelimit)?:"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /sd_src(?:_no_ratelimit)?:"([^"]+)"/,
    /property="og:video(?::url)?"[^>]*content="([^"]+)"/
  ];
  const found = pick.map(re => {
    const m = html.match(re);
    return m ? unescapeJs(m[1]) : null;
  }).filter(Boolean).map(u => u.replace(/\\u0025/g, '%').replace(/\\\//g, '/'));
  const unique = [...new Set(found)];
  const hd = unique.find(u => /hd|quality_hd/i.test(u)) || unique[0] || null;
  const sd = unique.find(u => u !== hd) || null;
  const title = metaContent(html, 'og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || 'Facebook video';
  const thumbnail = metaContent(html, 'og:image');
  return { hd, sd, title: String(title).replace(/\s+/g, ' ').trim(), thumbnail };
}
async function facebookDownload(url) {
  const target = String(url || '').trim();
  if (!/facebook\.com|fb\.watch/i.test(target)) throw new Error('URL de Facebook inválida (usa facebook.com/… o fb.watch/…)');
  const id = fbVideoId(target);
  const producers = [
    ['facebook-mobile', async () => {
      const html = await fetchText(target, { headers: { 'User-Agent': UA_MOBILE, 'Accept-Language': 'en-US,en;q=0.9' }, timeoutMs: 20000 });
      const parsed = parseFacebookHtml(html);
      if (!parsed.hd && !parsed.sd) throw new Error('sin video público (¿es privado?)');
      return parsed;
    }],
    ['facebook-embed', async () => {
      const html = await fetchText(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(target)}&show_text=false`, {
        headers: { 'User-Agent': UA_MOBILE, 'Accept-Language': 'en-US,en;q=0.9' },
        timeoutMs: 20000
      });
      const parsed = parseFacebookHtml(html);
      if (!parsed.hd && !parsed.sd) throw new Error('sin video en el embed');
      return parsed;
    }]
  ];
  if (id) {
    producers.push(['facebook-watch', async () => {
      const html = await fetchText(`https://www.facebook.com/watch/?v=${id}`, { headers: { 'User-Agent': UA_DESKTOP }, timeoutMs: 20000 });
      const parsed = parseFacebookHtml(html);
      if (!parsed.hd && !parsed.sd) throw new Error('sin video');
      return parsed;
    }]);
  }
  const { value, source } = await firstSuccess(producers);
  return {
    id: id || null,
    title: value.title || 'Facebook video',
    thumbnail: value.thumbnail,
    hd: value.hd,
    sd: value.sd,
    video: value.hd || value.sd,
    url: target,
    source
  };
}

// ---------------- Instagram ----------------
function igShortcode(url) {
  const m = String(url || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([-\w]+)/);
  return m ? m[1] : null;
}
async function instagramDownload(url) {
  const code = igShortcode(url);
  if (!code) throw new Error('URL de Instagram inválida (usa /p/… o /reel/…)');
  const kind = /\/reel/.test(url) ? 'reel' : 'p';
  const { value } = await firstSuccess([
    ['ddinstagram', async () => {
      const html = await fetchText(`https://www.ddinstagram.com/${kind}/${code}`, { headers: { 'User-Agent': UA_MOBILE } });
      const video = metaContent(html, 'og:video');
      const image = metaContent(html, 'og:image');
      const title = metaContent(html, 'og:title') || '';
      if (!video && !image) throw new Error('sin media');
      const media = [];
      if (video) media.push({ type: 'video', url: video, thumbnail: image });
      else media.push({ type: 'image', url: image, thumbnail: image });
      return { shortcode: code, title, media };
    }],
    ['instagram-embed', async () => {
      const html = await fetchText(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { 'User-Agent': UA_DESKTOP } });
      const vm = html.match(/"video_url":"([^"]+)"/);
      const im = html.match(/"display_url":"([^"]+)"/);
      const dec = s => (s ? JSON.parse(`"${s}"`) : null);
      const video = vm ? dec(vm[1]) : null;
      const image = im ? dec(im[1]) : null;
      if (!video && !image) throw new Error('sin media');
      const media = [];
      if (video) media.push({ type: 'video', url: video, thumbnail: image });
      else media.push({ type: 'image', url: image, thumbnail: image });
      return { shortcode: code, title: '', media };
    }]
  ]);
  return value;
}

// ---------------- Lyric (LRCLIB + lyrics.ovh) ----------------
async function lyricsSearch(query, limit) {
  let j = null;
  try {
    j = await fetchJson(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, { headers: { 'Lrclib-Client': 'Velirius-API' } });
  } catch (_) { j = null; }
  if (!Array.isArray(j) || !j.length) {
    const sug = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
    return (sug?.data || []).slice(0, clampLimit(limit, 10, 30)).map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist?.name || '',
      album: t.album?.title || null,
      duration: t.duration || null,
      instrumental: false,
      hasSynced: false,
      plainLyrics: null,
      syncedLyrics: null
    }));
  }
  return j.slice(0, clampLimit(limit, 10, 30)).map(t => ({
    id: t.id,
    title: t.trackName,
    artist: t.artistName,
    album: t.albumName,
    duration: t.duration,
    instrumental: !!t.instrumental,
    hasSynced: !!t.syncedLyrics,
    plainLyrics: t.plainLyrics || null,
    syncedLyrics: t.syncedLyrics || null
  }));
}
async function lyricFor(query) {
  const list = await lyricsSearch(query, 5);
  const hit = list.find(t => t.plainLyrics || t.syncedLyrics) || list[0];
  if (hit && (hit.plainLyrics || hit.syncedLyrics)) return { ...hit, query, source: 'lrclib' };
  if (hit && hit.title && hit.artist) {
    const lyr = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(hit.artist)}/${encodeURIComponent(hit.title)}`);
    if (lyr?.lyrics) return { ...hit, plainLyrics: lyr.lyrics, hasSynced: false, syncedLyrics: null, query, source: 'lyrics.ovh' };
  }
  const sug = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
  const song = sug?.data?.[0];
  if (!song) throw new Error('No se encontró la letra de esa canción');
  const lyr = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`);
  return {
    title: song.title,
    artist: song.artist.name,
    album: song.album?.title || null,
    duration: song.duration || null,
    hasSynced: false,
    plainLyrics: lyr.lyrics || null,
    syncedLyrics: null,
    query,
    source: 'lyrics.ovh'
  };
}

// ==========================================================================
// 5) SEARCHER — TikTok / YouTube / Google / Wikipedia
// ==========================================================================
const stripTags = html => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

function decodeGoogleUrl(href) {
  if (!href) return null;
  if (href.startsWith('/url?q=')) {
    const raw = href.slice(7).split('&')[0];
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  }
  if (href.startsWith('http')) return href;
  return null;
}

function parseGoogle(html, limit) {
  const out = [];
  const re = /<a[^>]+href="(\/url\?q=[^"]+|https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const url = decodeGoogleUrl(m[1]);
    if (!url) continue;
    if (/google\.|gstatic\.|youtube\.com\/redirect|accounts\./.test(url)) continue;
    const title = stripTags(m[2]);
    if (!title || title.length < 3) continue;
    if (out.some(r => r.url === url)) continue;
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 900);
    const snippet = stripTags(after).slice(0, 260);
    out.push({ title, url, snippet });
  }
  return out;
}

function parseDuckDuckGo(html, limit) {
  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    let url = m[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) { try { url = decodeURIComponent(uddg[1]); } catch (_) { /* deja la original */ } }
    const title = stripTags(m[2]);
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 1200);
    const sn = after.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    out.push({ title, url, snippet: sn ? stripTags(sn[1]).slice(0, 260) : '' });
  }
  return out;
}

async function googleSearch(query, limit, lang = 'es') {
  const n = clampLimit(limit, 10, 20);
  const headers = { 'User-Agent': UA_DESKTOP, 'Accept-Language': `${lang}-ES,${lang};q=0.9` };
  let results, source;
  try {
    ({ value: results, source } = await firstSuccess([
      ['google', async () => {
        const html = await fetchText(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=${n}&hl=${encodeURIComponent(lang)}&pws=0`, { headers, timeoutMs: 15000 });
        const found = parseGoogle(html, n);
        if (!found.length) throw new Error('Google sin resultados parseables');
        return found;
      }],
      ['duckduckgo', async () => {
        const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`, { headers, timeoutMs: 15000 });
        const found = parseDuckDuckGo(html, n);
        if (!found.length) throw new Error('DuckDuckGo sin resultados');
        return found;
      }]
    ]));
  } catch (e) {
    const err = friendly(e);
    if (!err.details && e.details) err.details = e.details.map(d => d.replace(/fetch failed/gi, 'sin conexión'));
    throw err;
  }
  return { query, engine: source, count: results.length, results };
}

async function wikipediaSearch(query, limit, lang = 'es') {
  const n = clampLimit(limit, 8, 20);
  const code = String(lang || 'es').toLowerCase().slice(0, 5).replace(/[^a-z-]/g, '') || 'es';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(n),
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    piprop: 'thumbnail',
    pithumbsize: '420',
    inprop: 'url',
    format: 'json',
    origin: '*'
  });
  let j;
  try {
    j = await fetchJson(`https://${code}.wikipedia.org/w/api.php?${params.toString()}`, { timeoutMs: 15000 });
  } catch (e) {
    throw friendly(e);
  }
  const pages = Object.values(j?.query?.pages || {});
  const results = pages
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map(p => ({
      id: p.pageid,
      title: p.title,
      extract: (p.extract || '').trim(),
      image: p.thumbnail?.source || null,
      url: p.fullurl || `https://${code}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`
    }))
    .filter(p => p.title);
  if (!results.length) throw new Error('Wikipedia no encontró artículos para esa búsqueda');
  return { query, lang: code, count: results.length, results };
}

module.exports = {
  clampLimit,
  // anime
  ANIME_KINDS, animeImage, pokemon,
  // reactions
  REACTIONS, REACTION_LIST, REACTION_PROVIDERS, reaction,
  // tools
  translate,
  // downloader
  tiktokDownload, tiktokSearch, mapTikTokVideo,
  youtubeId, youtubeSearch, youtubeStreams, resolveYoutubeTarget, pickAudio, pickVideo,
  facebookDownload, instagramDownload,
  lyricsSearch, lyricFor,
  // searcher
  googleSearch, wikipediaSearch
};
