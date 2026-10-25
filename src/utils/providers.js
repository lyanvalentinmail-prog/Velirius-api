// src/utils/providers.js — Fuentes públicas SIN token: PokeAPI, Jikan, TikWM, YouTube
// (InnerTube + Invidious/Piped rotando), LRCLIB, Spotify oEmbed, Aptoide, Sticker.ly v3.1,
// Instagram (ddinstagram/perfil) y traductor (Google gtx + MyMemory).
const crypto = require('crypto');
const { fetchJson, postJson, fetchText, firstSuccess, UA_DESKTOP, UA_MOBILE } = require('./http');

const clampLimit = (v, def = 10, max = 25) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.max(1, Math.min(max, n));
};

// ---------------- Pokémon (PokeAPI) ----------------
async function pokemon(query, shiny = false) {
  let q = String(query || 'pikachu').trim().toLowerCase();
  if (q === 'random' || q === 'aleatorio') q = String(1 + Math.floor(Math.random() * 1025));
  const poke = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`);
  let species = null;
  try { species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(String(poke.id))}`); } catch (_) {}
  const flavor = species?.flavor_text_entries?.find(e => e.language.name === 'es') || species?.flavor_text_entries?.find(e => e.language.name === 'en');
  const art = poke.sprites?.other?.['official-artwork'];
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
    genus: species?.genera?.find(g => g.language.name === 'es')?.genus || species?.genera?.find(g => g.language.name === 'en')?.genus || '',
    image: shiny ? (art?.front_shiny || poke.sprites?.front_shiny || art?.front_default) : (art?.front_default || poke.sprites?.front_default),
    sprite: shiny ? poke.sprites?.front_shiny : poke.sprites?.front_default,
    cries: poke.cries?.latest || null
  };
}

// ---------------- Anime / Manga / Character (Jikan) ----------------
const JIKAN = 'https://api.jikan.moe/v4';
function mapAnime(a) {
  return {
    mal_id: a.mal_id,
    title: a.title,
    title_english: a.title_english || null,
    image: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    score: a.score, episodes: a.episodes, type: a.type, status: a.status,
    year: a.year || a.aired?.prop?.from?.year || null,
    genres: (a.genres || []).map(g => g.name),
    synopsis: a.synopsis || '',
    trailer: a.trailer?.url || null,
    url: a.url
  };
}
function mapManga(m) {
  return {
    mal_id: m.mal_id, title: m.title, title_english: m.title_english || null,
    image: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || null,
    score: m.score, chapters: m.chapters, volumes: m.volumes, type: m.type, status: m.status,
    authors: (m.authors || []).map(x => x.name),
    genres: (m.genres || []).map(g => g.name),
    synopsis: m.synopsis || '', url: m.url
  };
}
function mapCharacter(c) {
  return {
    mal_id: c.mal_id, name: c.name, name_kanji: c.name_kanji || null,
    nicknames: c.nicknames || [],
    image: c.images?.jpg?.image_url || null,
    favorites: c.favorites ?? null,
    about: c.about ? String(c.about).slice(0, 600) : null,
    url: c.url
  };
}
async function searchAnime(query, limit) {
  const j = await fetchJson(`${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=${clampLimit(limit)}&sfw=true&order_by=score&sort=desc`);
  return (j.data || []).map(mapAnime);
}
async function searchManga(query, limit) {
  const j = await fetchJson(`${JIKAN}/manga?q=${encodeURIComponent(query)}&limit=${clampLimit(limit)}&sfw=true&order_by=score&sort=desc`);
  return (j.data || []).map(mapManga);
}
async function searchCharacter(query, limit) {
  const j = await fetchJson(`${JIKAN}/characters?q=${encodeURIComponent(query)}&limit=${clampLimit(limit)}&order_by=favorites&sort=desc`);
  return (j.data || []).map(mapCharacter);
}
async function gacha() {
  let raw = null;
  try {
    const j = await fetchJson(`${JIKAN}/random/characters`);
    raw = j.data || null;
  } catch (_) { raw = null; }
  if (!raw) {
    // Fallback: página al azar del top de personajes
    const page = 1 + Math.floor(Math.random() * 20);
    const j = await fetchJson(`${JIKAN}/top/characters?page=${page}&limit=25`);
    const list = j.data || [];
    if (!list.length) throw new Error('Jikan no devolvió personajes ahora mismo');
    raw = list[Math.floor(Math.random() * list.length)];
  }
  const c = mapCharacter(raw);
  const fav = c.favorites || 0;
  const rarity = fav >= 10000 ? 'legendary' : fav >= 3000 ? 'epic' : fav >= 800 ? 'rare' : fav >= 100 ? 'uncommon' : 'common';
  return { ...c, rarity, power: Math.min(9999, 100 + Math.round(Math.log10(fav + 1) * 900) + Math.floor(Math.random() * 90)) };
}

// ---------------- Traductor ----------------
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

// ---------------- TikTok (TikWM, sin marca de agua) ----------------
function mapTikTokVideo(v) {
  const author = v.author || {};
  return {
    id: v.video_id || v.id || null,
    title: v.title || '',
    url: author.unique_id && (v.video_id || v.id) ? `https://www.tiktok.com/@${author.unique_id}/video/${v.video_id || v.id}` : null,
    cover: v.cover || v.origin_cover || null,
    duration: v.duration ?? null,
    video_nowatermark: v.hdplay || v.play || null,
    video_watermark: v.wmplay || null,
    audio: v.music || v.music_info?.play || null,
    music: v.music_info ? { title: v.music_info.title, author: v.music_info.author } : null,
    author: { nickname: author.nickname || '', username: author.unique_id || '', avatar: author.avatar || null },
    stats: { plays: v.play_count ?? null, likes: v.digg_count ?? null, comments: v.comment_count ?? null, shares: v.share_count ?? null }
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

// ---------------- YouTube ----------------
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
const PIPED = ['https://pipedapi.reallyaweso.me', 'https://pipedapi.leptons.xyz', 'https://pipedapi-libre.kavin.rocks', 'https://pipedapi.adminforge.de'];

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
        id: v.videoId, title: v.title, url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)}:${String(v.lengthSeconds % 60).padStart(2, '0')}` : null,
        author: v.author || '', views: v.viewCount ?? null, published: v.publishedText || null
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
        return { id, title: v.title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: v.thumbnail, duration: v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : null, author: v.uploaderName || '', views: v.views ?? null, published: v.uploadedDate || null };
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
  return audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || formats.filter(f => f.hasAudio).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
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
      for (const f of j.formatStreams || []) formats.push({ quality: f.qualityLabel || f.quality, height: parseInt(f.qualityLabel) || null, mime: f.type, url: f.url, hasVideo: true, hasAudio: true, bitrate: f.bitrate });
      for (const f of j.adaptiveFormats || []) {
        if (!f.url) continue;
        const isAudio = String(f.type || '').startsWith('audio/');
        formats.push({ quality: f.qualityLabel || (isAudio ? `${Math.round((f.bitrate || 0) / 1000)}kbps` : f.quality), height: parseInt(f.qualityLabel) || null, mime: f.type, url: f.url, hasVideo: !isAudio, hasAudio: isAudio, bitrate: f.bitrate });
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
      for (const f of j.audioStreams || []) formats.push({ quality: f.quality || `${Math.round((f.bitrate || 0) / 1000)}kbps`, height: null, mime: f.mimeType, url: f.url, hasVideo: false, hasAudio: true, bitrate: f.bitrate });
      for (const f of j.videoStreams || []) formats.push({ quality: f.quality, height: parseInt(f.quality) || f.height || null, mime: f.mimeType, url: f.url, hasVideo: true, hasAudio: !f.videoOnly, bitrate: f.bitrate });
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

// ---------------- Lyrics (LRCLIB + lyrics.ovh) ----------------
async function lyricsSearch(query, limit) {
  let j = null;
  try {
    j = await fetchJson(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, { headers: { 'Lrclib-Client': 'Velirius-API' } });
  } catch (_) { j = null; }
  if (!Array.isArray(j) || !j.length) {
    // Fallback: sugerencias de lyrics.ovh (sin letras hasta pedir /download/lyric)
    const sug = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
    return (sug?.data || []).slice(0, clampLimit(limit, 10, 30)).map(t => ({
      id: t.id, title: t.title, artist: t.artist?.name || '', album: t.album?.title || null,
      duration: t.duration || null, instrumental: false, hasSynced: false,
      plainLyrics: null, syncedLyrics: null
    }));
  }
  return j.slice(0, clampLimit(limit, 10, 30)).map(t => ({
    id: t.id, title: t.trackName, artist: t.artistName, album: t.albumName,
    duration: t.duration, instrumental: !!t.instrumental,
    hasSynced: !!t.syncedLyrics,
    plainLyrics: t.plainLyrics || null, syncedLyrics: t.syncedLyrics || null
  }));
}
async function lyricFor(query) {
  const list = await lyricsSearch(query, 5);
  const hit = list.find(t => t.plainLyrics || t.syncedLyrics) || list[0];
  if (hit && (hit.plainLyrics || hit.syncedLyrics)) return { ...hit, query, source: 'lrclib' };
  // Fallback lyrics.ovh: si el hit (suggest) no trae letra, se pide por artista/título
  if (hit && hit.title && hit.artist) {
    const lyr = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(hit.artist)}/${encodeURIComponent(hit.title)}`);
    if (lyr?.lyrics) return { ...hit, plainLyrics: lyr.lyrics, hasSynced: false, syncedLyrics: null, query, source: 'lyrics.ovh' };
  }
  const sug = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
  const song = sug?.data?.[0];
  if (!song) throw new Error('No se encontró la letra de esa canción');
  const lyr = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`);
  return { title: song.title, artist: song.artist.name, album: song.album?.title || null, duration: song.duration || null, hasSynced: false, plainLyrics: lyr.lyrics || null, syncedLyrics: null, query, source: 'lyrics.ovh' };
}

// ---------------- Spotify (oEmbed + match en YouTube) ----------------
async function spotifyInfo(url) {
  const j = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  let author = j.author_name || '';
  if (!author) {
    try {
      const html = await fetchText(String(url).split('?')[0], { headers: { 'User-Agent': UA_DESKTOP } });
      const m = html.match(/"artists":\[\{"[^}]*?"name":"([^"]+)"/) || html.match(/Song · ([^·<]+) ·/) || html.match(/song and lyrics by ([^<]+?) on Spotify/i);
      if (m) author = JSON.parse(`"${m[1].replace(/"/g, '')}"`);
    } catch (_) { /* el título alcanza para buscar en YouTube */ }
  }
  return { title: j.title || '', author, thumbnail: j.thumbnail_url || null, spotifyUrl: url, type: j.type || 'rich' };
}

// ---------------- Aptoide ----------------
async function aptoideSearch(query, limit) {
  const j = await fetchJson(`https://ws2.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=${clampLimit(limit, 10, 30)}&trusted=1`);
  const list = j?.datalist?.list || [];
  return list.map(a => ({
    name: a.name, package: a.package,
    icon: a.icon, size: a.size, downloads: a.stats?.downloads ?? a.downloads ?? null,
    rating: a.stats?.prating?.avg ?? a.stats?.rating?.avg ?? null,
    version: a.file?.vername || null,
    store: a.store?.name || null,
    aptoideUrl: a.package ? `https://${a.package}.en.aptoide.com/` : null,
    downloadUrl: a.file?.path || null
  }));
}

// ---------------- Instagram ----------------
function igShortcode(url) {
  const m = String(url || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([-\w]+)/);
  return m ? m[1] : null;
}
function metaContent(html, prop) {
  const m = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]*)"`, 'i')) || html.match(new RegExp(`content="([^"]*)"[^>]*property="${prop}"`, 'i'));
  return m ? m[1].replace(/&amp;/g, '&') : null;
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
      const dec = s => s ? JSON.parse(`"${s}"`) : null;
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
async function instagramProfile(username) {
  const user = String(username || '').replace(/^@/, '').trim();
  if (!user) throw new Error('Falta el usuario (query)');
  const headers = { 'User-Agent': UA_MOBILE, 'x-ig-app-id': '936619743392459', Accept: 'application/json' };
  const j = await fetchJson(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`, { headers });
  const u = j?.data?.user;
  if (!u) throw new Error('Perfil no encontrado o privado');
  return {
    username: u.username, name: u.full_name, biography: u.biography,
    avatar: u.profile_pic_url_hd || u.profile_pic_url,
    followers: u.edge_followed_by?.count ?? null,
    following: u.edge_follow?.count ?? null,
    postsCount: u.edge_owner_to_timeline_media?.count ?? null,
    isPrivate: !!u.is_private, isVerified: !!u.is_verified,
    url: `https://www.instagram.com/${u.username}/`,
    posts: (u.edge_owner_to_timeline_media?.edges || []).slice(0, 12).map(e => ({
      id: e.node.id, shortcode: e.node.shortcode,
      thumbnail: e.node.display_url, isVideo: !!e.node.is_video,
      url: `https://www.instagram.com/p/${e.node.shortcode}/`
    }))
  };
}

// ---------------- Sticker.ly v3.1 ----------------
const STICKER_UA = 'androidapp.stickerly/1.17.3 (G011A; U; Android 22; es-ES; es;)';
function stickerHeaders() {
  return { 'User-Agent': STICKER_UA, 'x-duid': crypto.randomUUID().replace(/-/g, ''), Accept: 'application/json' };
}
function mapStickerPack(p) {
  const packId = p.packId || p.id || p.stickerPackId || '';
  const prefix = p.resourceUrlPrefix || p.resourceURLPrefix || '';
  const join = f => !f ? null : (String(f).startsWith('http') ? f : `${prefix}${f}`);
  const stickers = (p.stickers || []).map(s => ({
    fileName: s.fileName || s.name || null,
    url: join(s.stickerImg || s.fileName || s.name)
  })).filter(s => s.url);
  return {
    packId,
    name: p.name || p.packName || '',
    author: p.author?.userName || p.author?.name || p.owner?.userName || '',
    isAnimated: !!(p.isAnimated ?? p.animated),
    views: p.viewCount ?? p.views ?? null,
    exports: p.exportCount ?? null,
    trayIcon: join(p.trayIconFile || p.trayIcon),
    shareUrl: packId ? `https://sticker.ly/s/${packId}` : null,
    stickerCount: stickers.length || p.stickerCount || null,
    stickers
  };
}
function extractPacks(json) {
  const candidates = [json?.result?.stickerPacks, json?.result?.packs, json?.data?.stickerPacks, json?.stickerPacks, json?.result?.stickers, Array.isArray(json?.result) ? json.result : null, Array.isArray(json) ? json : null];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}
async function stickerPackSearch(query, limit) {
  const j = await postJson('http://api.sticker.ly/v3.1/stickerPack/search', { keyword: query, cursor: 0 }, { headers: stickerHeaders() });
  if (j?.error) throw new Error(j.error.errorMessage || 'Sticker.ly error');
  return extractPacks(j).slice(0, clampLimit(limit, 10, 30)).map(mapStickerPack);
}
async function stickerSearch(query, limit) {
  const packs = await stickerPackSearch(query, 10);
  const out = [];
  for (const p of packs) {
    for (const s of p.stickers) {
      out.push({ url: s.url, fileName: s.fileName, packId: p.packId, packName: p.name, author: p.author, isAnimated: p.isAnimated, shareUrl: p.shareUrl });
      if (out.length >= clampLimit(limit, 20, 60)) return out;
    }
  }
  if (!out.length && packs.length) {
    // Los packs de búsqueda a veces vienen sin stickers: pedir detalle del primero
    for (const p of packs.slice(0, 3)) {
      try {
        const detail = await fetchJson(`http://api.sticker.ly/v3.1/stickerPack/${encodeURIComponent(p.packId)}`, { headers: stickerHeaders() });
        const full = mapStickerPack(detail?.result || detail?.data || {});
        for (const s of full.stickers) {
          out.push({ url: s.url, fileName: s.fileName, packId: p.packId, packName: p.name, author: p.author, isAnimated: p.isAnimated, shareUrl: p.shareUrl });
          if (out.length >= clampLimit(limit, 20, 60)) return out;
        }
      } catch (_) {}
    }
  }
  return out;
}

module.exports = {
  clampLimit, pokemon, searchAnime, searchManga, searchCharacter, gacha,
  translate, tiktokDownload, tiktokSearch, mapTikTokVideo,
  youtubeId, youtubeSearch, youtubeStreams, resolveYoutubeTarget, pickAudio, pickVideo,
  lyricsSearch, lyricFor, spotifyInfo, aptoideSearch,
  instagramDownload, instagramProfile, stickerPackSearch, stickerSearch
};
