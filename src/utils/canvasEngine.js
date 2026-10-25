// src/utils/canvasEngine.js — Genera los 33 Canvas de Drive con parámetros modificables.
// Plantillas base en assets/templates (las mismas imágenes de la carpeta CategoriaCanvas de Drive).
const { sharp, escapeXml, wrapText, loadImageBuffer, templateMeta, textSvg, svgBuffer, svgToPng, shapedImage, circleImage, heartImage, fitTextLines, hexToRgb } = require('./image');
const { fetchBuffer } = require('./http');

const FONT = 'DejaVu Sans, Arial, sans-serif';
const SERIF = 'DejaVu Serif, Georgia, serif';

function txt(q, fallback) {
  const v = String(q.text ?? q.txt ?? '').trim();
  return v || fallback;
}
function imgParam(q, ...names) {
  for (const n of names) { const v = String(q[n] ?? '').trim(); if (v) return v; }
  return '';
}
function parsePercent(v) {
  if (v === undefined || v === null || String(v).trim() === '') return Math.floor(Math.random() * 101);
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? Math.floor(Math.random() * 101) : Math.max(0, Math.min(100, n));
}

/**
 * Reemplazo por chroma-key: pinta la foto del usuario SOLO donde la plantilla es verde
 * (pantallas verdes y círculos verde/lima). Pixel-perfect con la forma original.
 */
async function chromaInsert(file, userBuf, bbox = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const { buf, width: W, height: H } = await templateMeta(file);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const x0 = Math.round(bbox.x0 * W), y0 = Math.round(bbox.y0 * H);
  const x1 = Math.round(bbox.x1 * W), y1 = Math.round(bbox.y1 * H);
  const bw = Math.max(2, x1 - x0), bh = Math.max(2, y1 - y0);
  const maskRaw = Buffer.alloc(bw * bh * 4);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const o = ((y - y0) * bw + (x - x0)) * 4;
      maskRaw[o] = 255; maskRaw[o + 1] = 255; maskRaw[o + 2] = 255;
      maskRaw[o + 3] = (g > 135 && g > r * 1.22 && g > b * 1.22) ? 255 : 0;
    }
  }
  // Suaviza el borde y refuerza el alfa para tapar el filo verde del JPEG
  const mask = await sharp(maskRaw, { raw: { width: bw, height: bh, channels: 4 } }).blur(1).linear([1, 1, 1, 1.7], [0, 0, 0, 8]).png().toBuffer();
  const userPiece = await sharp(userBuf).rotate().resize(bw, bh, { fit: 'cover' }).ensureAlpha().png().toBuffer();
  const masked = await sharp(userPiece).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(buf).composite([{ input: masked, left: x0, top: y0 }]).png().toBuffer();
}

async function ellipseImage(userBuf, w, h) {
  const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
  const resized = await sharp(userBuf).rotate().resize(W, H, { fit: 'cover' }).png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="#fff"/></svg>`);
  return sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** Coloca imagen (cover) en un área fraccional de la plantilla. */
async function placeImageArea(base, W, H, area, userBuf, opts = {}) {
  const w = (area.x1 - area.x0) * W, h = (area.y1 - area.y0) * H;
  const piece = await shapedImage(userBuf, w, h, { radius: opts.radius ?? 0, rotate: opts.rotate ?? 0, grayscale: !!opts.grayscale });
  const meta = await sharp(piece).metadata();
  const left = Math.round(area.x0 * W + (w - meta.width) / 2);
  const top = Math.round(area.y0 * H + (h - meta.height) / 2);
  return { input: piece, left, top };
}

/** Coloca texto centrado en un área fraccional (con fondo de cobertura opcional). */
function placeTextArea(W, H, area, text, opts = {}) {
  const x0 = Math.round(area.x0 * W), y0 = Math.round(area.y0 * H);
  const w = Math.round((area.x1 - area.x0) * W), h = Math.round((area.y1 - area.y0) * H);
  const pad = opts.pad ?? 14;
  const { lines, fontSize } = fitTextLines(text, w - pad * 2, h - pad * 2, {
    maxFont: opts.maxFont ?? 72, minFont: opts.minFont ?? 15, maxLines: opts.maxLines ?? 6,
    charWidthRatio: opts.charWidthRatio ?? 0.60
  });
  const cover = opts.cover
    ? `<rect x="0" y="0" width="${w}" height="${h}" rx="${opts.coverRadius ?? 0}" fill="${opts.cover}"/>`
    : '';
  const totalH = lines.length * fontSize * 1.18;
  const startY = (h - totalH) / 2 + fontSize * 0.9;
  const align = opts.align || 'middle';
  const anchorX = align === 'start' ? pad : align === 'end' ? w - pad : w / 2;
  const tspans = lines.map((ln, i) =>
    `<text x="${anchorX}" y="${Math.round(startY + i * fontSize * 1.18)}" text-anchor="${align}" font-family="${opts.fontFamily || FONT}" font-weight="${opts.fontWeight || '700'}" font-size="${fontSize}" fill="${opts.fill || '#111111'}"${opts.italic ? ' font-style="italic"' : ''}>${escapeXml(opts.uppercase ? String(ln).toUpperCase() : ln)}</text>`
  ).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cover}${tspans}</svg>`);
  return { input: svg, left: x0, top: y0 };
}

async function renderTemplate(file, composites) {
  const { buf, width, height } = await templateMeta(file);
  const layers = [];
  for (const c of composites) layers.push(typeof c === 'function' ? await c(width, height) : c);
  return sharp(buf).composite(layers.flat()).png().toBuffer();
}

/** Plantilla de cartel: texto por defecto; imagen si viene `image/url` sin `text` (o mode=image). */
async function signCanvas(file, area, q, opts = {}) {
  const { buf, width: W, height: H } = await templateMeta(file);
  const mode = String(q.mode || '').toLowerCase();
  const imageUrl = imgParam(q, 'url', 'image', 'img');
  const text = String(q.text ?? '').trim();
  const layers = [];
  if (mode === 'image' || (imageUrl && !text) || (opts.preferImage && !text)) {
    const user = await loadImageBuffer(imageUrl);
    layers.push(await placeImageArea(buf, W, H, area, user, opts.imageOpts || {}));
  } else {
    layers.push(placeTextArea(W, H, area, text || opts.defaultText || 'Welcome to Velirius API', opts.textOpts || {}));
  }
  return sharp(buf).composite(layers).png().toBuffer();
}

/** Plantilla de personajes: caras elípticas en los huecos. */
async function faceCanvas(file, holes, q) {
  let { buf, width: W, height: H } = await templateMeta(file);
  if (W < 500) { // rata es chica: upscale para que la cara no salga pixelada
    buf = await sharp(buf).resize(W * 3, H * 3).png().toBuffer();
    W *= 3; H *= 3;
  }
  const urls = [
    imgParam(q, 'url', 'image', 'img', 'url1', 'image1'),
    imgParam(q, 'url2', 'image2'),
    imgParam(q, 'url3', 'image3')
  ];
  const layers = [];
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    const user = await loadImageBuffer(urls[i] || urls[0] || '', i === 1 ? 'avatar2.jpg' : 'avatar1.jpg');
    const w = hole.rx * 2 * W, h = hole.ry * 2 * H;
    const piece = await ellipseImage(user, w, h);
    layers.push({ input: piece, left: Math.round(hole.cx * W - w / 2), top: Math.round(hole.cy * H - h / 2) });
  }
  return sharp(buf).composite(layers).png().toBuffer();
}

let twemojiCache = new Map();
async function twemoji(code) {
  if (twemojiCache.has(code)) return twemojiCache.get(code);
  try {
    const buf = await fetchBuffer(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`, { timeoutMs: 8000 });
    twemojiCache.set(code, buf);
    return buf;
  } catch (_) { return null; }
}

// ---------- Generadores por endpoint ----------
const GENERATORS = {
  async brat(q) {
    const text = txt(q, 'Welcome to Velirius API').toLowerCase();
    const bg = `#${String(q.bg || 'ffffff').replace('#', '')}`;
    const color = `#${String(q.color || '000000').replace('#', '')}`;
    const S = 512;
    const { lines, fontSize } = fitTextLines(text, S - 72, S - 80, { maxFont: 84, minFont: 26, maxLines: 6, charWidthRatio: 0.52 });
    const totalH = lines.length * fontSize * 1.12;
    const startY = (S - totalH) / 2 + fontSize * 0.9;
    const textLayer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${lines.map((ln, i) => `<text x="36" y="${Math.round(startY + i * fontSize * 1.12)}" font-family="${FONT}" font-weight="400" font-size="${fontSize}" fill="${color}">${escapeXml(ln)}</text>`).join('')}</svg>`
    );
    const blurred = await sharp(textLayer).blur(0.7).png().toBuffer();
    return sharp({ create: { width: S, height: S, channels: 4, background: bg } }).composite([{ input: blurred }]).png().toBuffer();
  },

  async bratestirado(q) {
    const text = txt(q, 'i <3 money');
    const S = 736;
    const { lines, fontSize } = fitTextLines(text, S - 96, S - 120, { maxFont: 172, minFont: 56, maxLines: 3, charWidthRatio: 0.80 });
    const mid = (lines.length - 1) / 2;
    let y = S * 0.30;
    const rows = lines.map((ln, i) => {
      const boost = 1 + 0.16 * (1 - Math.abs(i - mid)); // linea central mas grande (ojo de pez)
      const fs = Math.round(fontSize * boost);
      const row = `<text x="0" y="0" text-anchor="middle" font-family="${FONT}" font-weight="900" font-style="italic" font-size="${fs}" fill="#000000" transform="translate(${S / 2} ${Math.round(y)}) rotate(-3) scale(1 1.32)">${escapeXml(ln)}</text>`;
      y += fs * 1.28;
      return row;
    }).join('');
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#ffffff"/>${rows}</svg>`);
    return svgToPng(svg);
  },

  async bratanime(q) {
    return signCanvas('bratanime.png', { x0: 0.162, y0: 0.498, x1: 0.82, y1: 0.812 }, { text: txt(q, 'Welcome to Velirius API') },
      { textOpts: { cover: '#ffffff', coverRadius: 4, fontFamily: SERIF, fill: '#111111', maxFont: 92 } });
  },

  async bratcoyote(q) {
    return signCanvas('bratcoyote.png', { x0: 0.045, y0: 0.085, x1: 0.545, y1: 0.475 }, { text: txt(q, 'WELCOME TO VELIRIUS API') },
      { textOpts: { cover: '#f3e6cf', coverRadius: 6, fill: '#111111', maxFont: 96, uppercase: true, fontWeight: '900', charWidthRatio: 0.72 } });
  },

  async bratpinguino(q) {
    return signCanvas('bratpinguino.jpg', { x0: 0.325, y0: 0.525, x1: 0.885, y1: 0.875 }, q,
      { defaultText: 'Welcome to Velirius API', textOpts: { fill: '#23281a', maxFont: 76 } });
  },

  async quotly(q) {
    const username = String(q.username || q.name || 'Velirius Api').slice(0, 40);
    const text = txt(q, 'Welcome to Velirius Api');
    const bgHex = String(q.bg || '000000').replace('#', '');
    const bg = /^[0-9a-fA-F]{6}$/.test(bgHex) ? `#${bgHex}` : '#000000';
    const dark = bg.toLowerCase() === '#000000' || bg.toLowerCase() === '#111111';
    const lines = wrapText(text, 42, 8);
    const W = 800, H = Math.max(140, 92 + lines.length * 40);
    const avatar = await circleImage(await loadImageBuffer(imgParam(q, 'image', 'url', 'avatar')), 76);
    const textSvgBuf = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<text x="122" y="62" font-family="${FONT}" font-weight="700" font-size="31" fill="#f59e0b">${escapeXml(username)}</text>` +
      lines.map((ln, i) => `<text x="122" y="${106 + i * 40}" font-family="${FONT}" font-size="31" fill="${dark ? '#ffffff' : '#111111'}">${escapeXml(ln)}</text>`).join('') +
      `</svg>`
    );
    return sharp({ create: { width: W, height: H, channels: 4, background: bg } })
      .composite([{ input: avatar, left: 24, top: 28 }, { input: textSvgBuf, left: 0, top: 0 }]).png().toBuffer();
  },

  async ttp(q) {
    const text = txt(q, 'Hola');
    const COLOR_MAP = { white: '#ffffff', black: '#000000', red: '#ff2d2d', green: '#22ff88', blue: '#38bdf8', yellow: '#ffe600', pink: '#ff5da2', purple: '#a78bfa', orange: '#ff9f1a' };
    const colorIn = String(q.color || 'white').toLowerCase();
    const fill = COLOR_MAP[colorIn] || (colorIn.startsWith('#') ? colorIn : '#ffffff');
    const bgIn = String(q.bg || '000000').toLowerCase();
    const S = 512;
    const rawLines = wrapText(text, 8, 4);
    const lines = rawLines.map(l => l.split('').join(' '));
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    const fontSize = Math.max(26, Math.min(120, Math.floor((S - 64) / (longest * 0.60)), Math.floor((S - 80) / (lines.length * 1.25))));
    const totalH = lines.length * fontSize * 1.25;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bgIn === 'transparent' ? '' : `<rect width="${S}" height="${S}" fill="#${bgIn.replace('#', '')}"/>`}${lines.map((ln, i) => `<text x="${S / 2}" y="${Math.round((S - totalH) / 2 + fontSize * 0.92 + i * fontSize * 1.25)}" text-anchor="middle" font-family="${FONT}" font-weight="300" font-size="${fontSize}" fill="${fill}">${escapeXml(ln)}</text>`).join('')}</svg>`
    );
    return svgToPng(svg);
  },

  async iqc(q) {
    const message = txt(q, 'Yo siempre te voy a amar');
    const quote = String(q.quote ?? q.quoted ?? 'vooooss seguro').slice(0, 60);
    const username = String(q.username ?? q.name ?? 'Tú').slice(0, 24);
    const time = String(q.time ?? '7:32 p. m.').slice(0, 14);
    return renderTemplate('iqc.jpg', [(W, H) => {
      const x0 = Math.round(0.035 * W), y0 = Math.round(0.420 * H);
      const w = Math.round(0.645 * W), h = Math.round(0.158 * H);
      const quoteH = Math.round(h * 0.52);
      const msg = fitTextLines(message, w - 98, 36, { maxFont: 24, minFont: 12, maxLines: 1, charWidthRatio: 0.52 });
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<rect width="${w}" height="${quoteH}" rx="11" fill="#202c33"/>` +
        `<rect y="${quoteH - 4}" width="${w}" height="${h - quoteH + 4}" fill="#0b141a"/>` +
        `<rect x="0" y="9" width="4" height="${quoteH - 18}" fill="#f15b6c"/>` +
        `<text x="14" y="38" font-family="${FONT}" font-weight="700" font-size="20" fill="#f15b6c">${escapeXml(username)}</text>` +
        `<text x="14" y="74" font-family="${FONT}" font-size="19" fill="#aebac1">${escapeXml(quote)}</text>` +
        `<text x="9" y="${h - 18}" font-family="${FONT}" font-size="${msg.fontSize}" fill="#e9edef">${escapeXml(msg.lines[0] || '')}</text>` +
        `<text x="${w - 7}" y="${h - 18}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#8696a0">${escapeXml(time)}</text>` +
        `</svg>`
      );
      return [{ input: svg, left: x0, top: y0 }];
    }]);
  },

  async cuentatiktok(q) {
    const username = String(q.username ?? q.name ?? 'Account not found').slice(0, 36);
    const status = String(q.status ?? q.text ?? 'Sent').slice(0, 24);
    const { buf, width: W, height: H } = await templateMeta('cuentatiktok.jpg');
    const boxW = Math.round(0.74 * W), boxH = Math.round(0.078 * H);
    const nameFit = fitTextLines(username, boxW - 8, 34, { maxFont: 25, minFont: 13, maxLines: 1, charWidthRatio: 0.55 });
    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">` +
      `<rect width="${boxW}" height="${boxH}" fill="#000000"/>` +
      `<text x="2" y="34" font-family="${FONT}" font-weight="600" font-size="${nameFit.fontSize}" fill="#ffffff">${escapeXml(nameFit.lines[0] || username)}</text>` +
      `<text x="2" y="68" font-family="${FONT}" font-size="18" fill="#9a9a9a">${escapeXml(status)}</text>` +
      `</svg>`
    );
    const layers = [{ input: overlay, left: Math.round(0.182 * W), top: Math.round(0.344 * H) }];
    const avatarUrl = imgParam(q, 'image', 'url', 'avatar');
    if (avatarUrl) {
      const d = Math.round(0.088 * W);
      const av = await circleImage(await loadImageBuffer(avatarUrl), d);
      layers.push({ input: av, left: Math.round(0.102 * W - d / 2), top: Math.round(0.380 * H - d / 2) });
    }
    return sharp(buf).composite(layers).png().toBuffer();
  },

  async storyreply(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = await chromaInsert('storyreply.jpg', user, { x0: 0.055, y0: 0.11, x1: 0.375, y1: 0.70 });
    const reply = txt(q, '');
    if (!reply) return base;
    const meta = await sharp(base).metadata();
    const layer = placeTextArea(meta.width, meta.height, { x0: 0.05, y0: 0.705, x1: 0.95, y1: 0.895 }, reply,
      { fill: '#ffffff', align: 'start', maxFont: 30, minFont: 14, maxLines: 2, pad: 22, fontWeight: '400' });
    return sharp(base).composite([layer]).png().toBuffer();
  },

  async absolutecinema(q) {
    const main = String(q.text || 'CINEMA').toUpperCase().slice(0, 24);
    const sub = String(q.subtext || q.sub || 'ABSOLUTE').toUpperCase().slice(0, 24);
    const url = imgParam(q, 'url', 'image', 'img');
    let base, W, H;
    if (url) {
      const user = await loadImageBuffer(url);
      base = await sharp(user).rotate().resize(900, 737, { fit: 'cover' }).grayscale().png().toBuffer();
      W = 900; H = 737;
    } else {
      const t = await templateMeta('absolutecinema.jpg');
      base = t.buf; W = t.width; H = t.height;
    }
    const barH = Math.round(H * 0.315);
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barH}">` +
      `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="1"/><stop offset="100%" stop-color="#000" stop-opacity="1"/></linearGradient></defs>` +
      `<rect width="${W}" height="${barH}" fill="url(#d)"/>` +
      `<text x="${W / 2}" y="${Math.round(barH * 0.42)}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${Math.round(H * 0.052)}" letter-spacing="6" fill="#ffffff">${escapeXml(sub)}</text>` +
      `<text x="${W / 2}" y="${Math.round(barH * 0.83)}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${Math.round(H * 0.125)}" letter-spacing="2" fill="#ffffff">${escapeXml(main)}</text>` +
      `</svg>`
    );
    return sharp(base).composite([{ input: svg, left: 0, top: H - barH }]).png().toBuffer();
  },

  bobesponja: q => signCanvas('bobesponja.jpg', { x0: 0.20, y0: 0.33, x1: 0.75, y1: 0.74 }, q, { defaultText: 'Welcome to Velirius API', textOpts: { maxFont: 44 } }),
  bobesponja2: q => signCanvas('bobesponja2.jpg', { x0: 0.12, y0: 0.08, x1: 0.41, y1: 0.34 }, q, { defaultText: 'mi tarea', textOpts: { maxFont: 30 } }),
  bobesponja3: q => signCanvas('bobesponja3.jpg', { x0: 0.53, y0: 0.14, x1: 0.87, y1: 0.55 }, q, { defaultText: 'Welcome to Velirius API', textOpts: { maxFont: 54 } }),
  canvatextoxd: q => signCanvas('canvatextoxd.jpg', { x0: 0.30, y0: 0.395, x1: 0.83, y1: 0.725 }, q, { defaultText: 'tu texto aquí', textOpts: { maxFont: 44, fill: '#222222' } }),
  bratpinguino2: null,

  async imagencanba(q) {
    return signCanvas('imagencanba.jpg', { x0: 0.138, y0: 0.12, x1: 0.948, y1: 0.715 }, q,
      { defaultText: 'dibujo god', preferImage: true, textOpts: { maxFont: 64 } });
  },

  async canvaimagen(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('canvaimagen.jpg', user);
  },

  async fotopc(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('fotopc.jpg', user, { x0: 0.52, y0: 0.29, x1: 1, y1: 0.68 });
  },

  async sebusca(q) {
    const { buf, width: W, height: H } = await templateMeta('sebusca.jpg');
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const layers = [await placeImageArea(buf, W, H, { x0: 0.272, y0: 0.298, x1: 0.783, y1: 0.648 }, user, {})];
    const name = String(q.name ?? q.text ?? '').trim();
    if (name) {
      const bandW = Math.round(0.511 * W), bandH = Math.round(0.055 * H);
      const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bandW}" height="${bandH}"><rect width="${bandW}" height="${bandH}" fill="#000000" fill-opacity="0.72"/><text x="${bandW / 2}" y="${Math.round(bandH * 0.72)}" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="21" fill="#ffffff">${escapeXml(name.toUpperCase().slice(0, 26))}</text></svg>`);
      layers.push({ input: band, left: Math.round(0.272 * W), top: Math.round(0.648 * H) - bandH });
    }
    const reward = String(q.reward ?? q.recompensa ?? '').trim();
    if (reward) {
      layers.push(placeTextArea(W, H, { x0: 0.08, y0: 0.728, x1: 0.915, y1: 0.842 }, reward, { cover: '#d9c69c', fontFamily: SERIF, fontWeight: '900', fill: '#1a1207', maxFont: 58, maxLines: 1, pad: 6 }));
    }
    return sharp(buf).composite(layers).png().toBuffer();
  },

  async pokemoncard(q) {
    const { buf, width: W, height: H } = await templateMeta('pokemoncard.jpg');
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const name = String(q.name || 'Velirius').slice(0, 20);
    const hp = String(q.hp || '120').replace(/[^0-9]/g, '').slice(0, 4) || '120';
    const type = String(q.type || 'Legendario').slice(0, 22);
    const attack = String(q.attack || 'Golpe API').slice(0, 26);
    const damage = String(q.damage || '90').replace(/[^0-9+]/g, '').slice(0, 5) || '90';
    const description = String(q.description || q.desc || 'Una carta creada con Velirius API.').slice(0, 220);
    const layers = [await placeImageArea(buf, W, H, { x0: 0.085, y0: 0.105, x1: 0.915, y1: 0.47 }, user, {})];
    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<text x="${Math.round(W * 0.215)}" y="${Math.round(H * 0.068)}" font-family="${FONT}" font-weight="700" font-size="34" fill="#222222">${escapeXml(name)}</text>` +
      `<text x="${Math.round(W * 0.862)}" y="${Math.round(H * 0.068)}" text-anchor="end" font-family="${FONT}" font-weight="700" font-size="27" fill="#c0392b">${escapeXml(hp)}</text>` +
      `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.512)}" font-family="${FONT}" font-style="italic" font-size="21" fill="#444444">${escapeXml(type)}</text>` +
      `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.598)}" font-family="${FONT}" font-weight="700" font-size="36" fill="#222222">${escapeXml(attack)}</text>` +
      `<text x="${Math.round(W * 0.895)}" y="${Math.round(H * 0.598)}" text-anchor="end" font-family="${FONT}" font-weight="700" font-size="36" fill="#222222">${escapeXml(damage)}</text>` +
      wrapText(description, 31, 6).map((ln, i) => `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.662 + i * 36)}" font-family="${FONT}" font-size="25" fill="#333333">${escapeXml(ln)}</text>`).join('') +
      `</svg>`
    );
    layers.push({ input: overlay, left: 0, top: 0 });
    return sharp(buf).composite(layers).png().toBuffer();
  },

  async _meter(q, kind) {
    const isShip = kind === 'ship';
    const W = 1200, H = 512;
    const name1 = String(q.name1 || 'Velirius').slice(0, 20);
    const name2 = String(q.name2 || 'dls').slice(0, 20);
    const pct = parsePercent(q.percentage ?? q.percent ?? q.rank);
    const phrase = String(q.text || 'Best Friends').slice(0, 26);
    const accent = isShip ? '#ff2d55' : '#00e05a';
    const title = isShip ? '~Medidor de compatibilidad~' : '~Medidor de amistad~';
    const img1 = await loadImageBuffer(imgParam(q, 'image1', 'url1', 'image', 'url'), 'avatar1.jpg');
    const img2 = await loadImageBuffer(imgParam(q, 'image2', 'url2'), 'avatar2.jpg');
    const S = 295;
    const piece1 = isShip ? await heartImage(img1, S, S * 0.92) : await circleImage(img1, S);
    const piece2 = isShip ? await heartImage(img2, S, S * 0.92) : await circleImage(img2, S);
    const centerIcon = isShip
      ? `<path d="M600 128 C588 108 556 104 548 124 C541 141 556 158 600 182 C644 158 659 141 652 124 C644 104 612 108 600 128Z" fill="#ff2d55"/>`
      : '';
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="#23272e"/>` +
      `<text x="${W / 2}" y="52" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="700" font-size="27" fill="${isShip ? '#ff7a92' : '#2ee06d'}">${escapeXml(title)}</text>` +
      (isShip ? centerIcon : `<text x="${W / 2}" y="172" text-anchor="middle" font-family="${FONT}" font-size="58" fill="#ffc93c">★</text>`) +
      `<text x="${W / 2}" y="258" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-weight="700" font-size="37" fill="${accent}">~${pct}%~</text>` +
      `<text x="${W / 2}" y="304" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-weight="700" font-size="34" fill="${accent}">${escapeXml(phrase)}</text>` +
      `<text x="300" y="478" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="700" font-size="25" fill="#ffffff">${escapeXml(name1)}</text>` +
      `<text x="900" y="478" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="700" font-size="25" fill="#ffffff">${escapeXml(name2)}</text>` +
      `</svg>`
    );
    const base = await svgToPng(svg);
    const layers = [
      { input: piece1, left: Math.round(300 - S / 2), top: 118 },
      { input: piece2, left: Math.round(900 - S / 2), top: 118 }
    ];
    if (!isShip) {
      const thumb = await twemoji('1f44d');
      if (thumb) layers.push({ input: await sharp(thumb).resize(58, 58).png().toBuffer(), left: W / 2 - 29, top: 108 });
    }
    return sharp(base).composite(layers).png().toBuffer();
  },
  ship: q => GENERATORS._meter(q, 'ship'),
  friendship: q => GENERATORS._meter(q, 'friendship'),

  async gaycard(q) {
    const W = 600, H = 450;
    const name = String(q.name || q.username || 'Velirius').slice(0, 22);
    const pct = parsePercent(q.rank ?? q.percentage ?? q.percent);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    let avatar = await circleImage(user, 178);
    const rainbow = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="178" height="178">${['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'].map((c, i) => `<rect y="${i * 30}" width="178" height="30" fill="${c}" fill-opacity="0.55"/>`).join('')}</svg>`
    );
    avatar = await sharp(avatar).composite([{ input: rainbow }]).png().toBuffer();
    avatar = await (async () => {
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="178" height="178"><circle cx="89" cy="89" r="89" fill="#fff"/></svg>`);
      return sharp(avatar).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    })();
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<defs><linearGradient id="rw" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ff004d"/><stop offset="25%" stop-color="#ff8a00"/><stop offset="50%" stop-color="#ffee00"/><stop offset="70%" stop-color="#00e05a"/><stop offset="88%" stop-color="#0088ff"/><stop offset="100%" stop-color="#8a2be2"/></linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="#141414"/>` +
      `<polygon points="0,0 190,0 0,150" fill="#000000"/><polygon points="${W},${H} ${W - 190},${H} ${W},${H - 150}" fill="#000000"/>` +
      `<text x="${W / 2}" y="62" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-weight="700" font-size="31" letter-spacing="2" fill="url(#rw)">GAY PERCENTAGE</text>` +
      `<circle cx="${W / 2}" cy="188" r="94" fill="none" stroke="#ffffff" stroke-width="3"/>` +
      `<text x="${W / 2}" y="332" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="700" font-size="28" fill="#ffffff">~${escapeXml(name)}~</text>` +
      `<rect x="${W / 2 - 92}" y="356" width="184" height="52" rx="26" fill="#ffffff"/>` +
      `<text x="${W / 2}" y="392" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="30" fill="#ff2d78">~ ${pct}% ~</text>` +
      `</svg>`
    );
    const base = await svgToPng(svg);
    return sharp(base).composite([{ input: avatar, left: W / 2 - 89, top: 99 }]).png().toBuffer();
  },

  async gay(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = sharp(user).rotate();
    const meta = await base.metadata();
    const W = Math.min(meta.width || 512, 1024);
    const resized = await base.resize(W).png().toBuffer();
    const m2 = await sharp(resized).metadata();
    const opacity = Math.max(0, Math.min(1, parseFloat(q.opacity ?? '0.45') || 0.45));
    const colors = ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'];
    const band = Math.ceil(m2.height / colors.length);
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m2.width}" height="${m2.height}">${colors.map((c, i) => `<rect y="${i * band}" width="${m2.width}" height="${band}" fill="${c}" fill-opacity="${opacity}"/>`).join('')}</svg>`);
    return sharp(resized).composite([{ input: overlay }]).png().toBuffer();
  },

  async invert(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return sharp(user).rotate().negate({ alpha: false }).png().toBuffer();
  },

  rata: q => faceCanvas('rata.jpg', [{ cx: 0.626, cy: 0.534, rx: 0.129, ry: 0.174 }], q),
  banana: q => faceCanvas('banana.jpg', [{ cx: 0.53, cy: 0.45, rx: 0.153, ry: 0.156 }], q),
  arandano: async q => chromaInsert('arandano.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.24, y0: 0.20, x1: 0.71, y1: 0.75 }),
  pan: async q => chromaInsert('pan.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.29, y0: 0.34, x1: 0.74, y1: 0.78 }),
  galletita: q => faceCanvas('galletita.jpg', [{ cx: 0.467, cy: 0.502, rx: 0.16, ry: 0.148 }], q),
  minions: q => faceCanvas('minions.jpg', [
    { cx: 0.33, cy: 0.478, rx: 0.108, ry: 0.082 },
    { cx: 0.526, cy: 0.440, rx: 0.138, ry: 0.095 },
    { cx: 0.763, cy: 0.478, rx: 0.122, ry: 0.091 }
  ], q)
};
delete GENERATORS.bratpinguino2;

async function generateCanvas(id, query) {
  const fn = GENERATORS[String(id).toLowerCase()];
  if (!fn) return null;
  return fn(query || {});
}

module.exports = { generateCanvas, GENERATORS, txt };
