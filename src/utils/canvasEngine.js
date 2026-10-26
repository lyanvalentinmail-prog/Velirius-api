// src/utils/canvasEngine.js — Render de los Canvas con las plantillas de la carpeta
// "CategoriaCanvas" de Drive (assets/templates) y parámetros modificables en caliente.
//
// Parámetros de estilo comunes (todos opcionales, funcionan en cualquier canvas):
//   color      color del texto (hex con/sin # o nombre: white, black, red…)
//   bg         fondo (canvas generados: brat, ttp, quotly…)
//   size       escala del texto (0.5 = mitad, 2 = doble)
//   font       sans | serif | mono
//   uppercase  true = MAYÚSCULAS
//   x, y       desplazamiento en % (-50 … 50)
//   rotate     rotación en grados (-180 … 180)
//   zoom       zoom de la foto del usuario (0.5 … 3)
//   grayscale  true = foto en blanco y negro
const {
  sharp, escapeXml, wrapText, loadImageBuffer, templateMeta,
  svgToPng, shapedImage, circleImage, heartImage, fitTextLines
} = require('./image');
const { fetchBuffer } = require('./http');

const FONT = 'DejaVu Sans, Arial, sans-serif';
const SERIF = 'DejaVu Serif, Georgia, serif';
const MONO = 'DejaVu Sans Mono, monospace';

// ---------- helpers de parámetros ----------
const txt = (q, fallback) => {
  const v = String(q.text ?? q.txt ?? '').trim();
  return v || fallback;
};
const imgParam = (q, ...names) => {
  for (const n of names) {
    const v = String(q[n] ?? '').trim();
    if (v) return v;
  }
  return '';
};
const numberIn = (v, def, min, max) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};
const flag = v => ['true', '1', 'yes', 'si', 'sí'].includes(String(v ?? '').toLowerCase());
const parsePercent = v => {
  if (v === undefined || v === null || String(v).trim() === '') return Math.floor(Math.random() * 101);
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? Math.floor(Math.random() * 101) : Math.max(0, Math.min(100, n));
};

const NAMED_COLORS = ['white', 'black', 'red', 'green', 'blue', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'gold', 'cyan', 'magenta', 'brown', 'navy', 'teal', 'lime', 'silver', 'maroon', 'olive', 'transparent'];
function normColor(value, fallback = null) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (NAMED_COLORS.includes(lower)) return lower;
  let hex = lower.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.split('').map(c => c + c).join('');
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
  return fallback;
}
function fontFamilyOf(name) {
  const key = String(name || '').toLowerCase();
  if (key === 'serif') return SERIF;
  if (key === 'mono' || key === 'monoespaciada') return MONO;
  return FONT;
}

/** Lee todos los overrides de estilo del query string. */
function styleOf(q = {}) {
  return {
    fill: normColor(q.color ?? q.fill ?? q.textcolor ?? q.fontcolor, null),
    bg: normColor(q.bg ?? q.background, null),
    scale: numberIn(q.size ?? q.scale ?? q.fontsize, 1, 0.2, 3),
    dx: numberIn(q.x, 0, -100, 100) / 100,
    dy: numberIn(q.y, 0, -100, 100) / 100,
    rotate: numberIn(q.rotate ?? q.rot, 0, -180, 180),
    font: String(q.font ?? '').toLowerCase(),
    uppercase: flag(q.uppercase ?? q.mayusculas),
    zoom: numberIn(q.zoom, 1, 0.2, 4),
    grayscale: flag(q.grayscale ?? q.blanconegro),
    opacity: numberIn(q.opacity, 0.45, 0, 1)
  };
}

// ---------- piezas de imagen ----------

/**
 * Reemplazo por chroma-key: pinta la foto del usuario SOLO donde la plantilla es verde
 * (pantallas verdes y círculos verde/lima). Pixel-perfect con la forma original.
 */
async function chromaInsert(file, userBuf, bbox = { x0: 0, y0: 0, x1: 1, y1: 1 }, opts = {}) {
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
  const mask = await sharp(maskRaw, { raw: { width: bw, height: bh, channels: 4 } })
    .blur(1).linear([1, 1, 1, 1.7], [0, 0, 0, 8]).png().toBuffer();
  const userPiece = await shapedImage(userBuf, bw, bh, {
    zoom: opts.zoom ?? 1,
    rotate: opts.rotate ?? 0,
    grayscale: !!opts.grayscale
  });
  const masked = await sharp(userPiece).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(buf).composite([{ input: masked, left: x0, top: y0 }]).png().toBuffer();
}

async function ellipseImage(userBuf, w, h, opts = {}) {
  const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
  const resized = await shapedImage(userBuf, W, H, {
    zoom: opts.zoom ?? 1,
    rotate: opts.rotate ?? 0,
    grayscale: !!opts.grayscale
  });
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="#fff"/></svg>`);
  return sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** Coloca imagen (cover) en un área fraccional de la plantilla. */
async function placeImageArea(W, H, area, userBuf, opts = {}) {
  const w = (area.x1 - area.x0) * W, h = (area.y1 - area.y0) * H;
  const piece = await shapedImage(userBuf, w, h, {
    radius: opts.radius ?? 0,
    rotate: opts.rotate ?? 0,
    grayscale: !!opts.grayscale,
    zoom: opts.zoom ?? 1
  });
  const meta = await sharp(piece).metadata();
  const left = Math.round(area.x0 * W + (w - meta.width) / 2);
  const top = Math.round(area.y0 * H + (h - meta.height) / 2);
  return { input: piece, left, top };
}

/**
 * Coloca texto ajustado dentro de un área fraccional (con fondo de cobertura opcional).
 * Respeta color, tamaño, tipografía, mayúsculas, desplazamiento y rotación del query.
 */
function placeTextArea(W, H, area, text, opts = {}) {
  const ov = opts.ov || {};
  const shiftX = Math.round((ov.dx || 0) * W);
  const shiftY = Math.round((ov.dy || 0) * H);
  const x0 = Math.round(area.x0 * W) + shiftX;
  const y0 = Math.round(area.y0 * H) + shiftY;
  const w = Math.max(8, Math.round((area.x1 - area.x0) * W));
  const h = Math.max(8, Math.round((area.y1 - area.y0) * H));
  const pad = opts.pad ?? 14;
  const scale = ov.scale || 1;
  const baseMax = opts.maxFont ?? 72;
  const baseMin = opts.minFont ?? 15;
  const { lines, fontSize } = fitTextLines(text, w - pad * 2, h - pad * 2, {
    maxFont: Math.max(6, Math.round(baseMax * scale)),
    minFont: Math.max(5, Math.round(baseMin * Math.min(scale, 1.4))),
    maxLines: opts.maxLines ?? 6,
    charWidthRatio: opts.charWidthRatio ?? 0.60
  });
  const cover = opts.cover
    ? `<rect x="0" y="0" width="${w}" height="${h}" rx="${opts.coverRadius ?? 0}" fill="${opts.cover}"/>`
    : '';
  const totalH = lines.length * fontSize * 1.18;
  const startY = (h - totalH) / 2 + fontSize * 0.9;
  const align = opts.align || 'middle';
  const anchorX = align === 'start' ? pad : align === 'end' ? w - pad : w / 2;
  const fill = ov.fill || opts.fill || '#111111';
  const fontFamily = ov.font ? fontFamilyOf(ov.font) : (opts.fontFamily || FONT);
  const upper = opts.uppercase || ov.uppercase;
  const tspans = lines.map((ln, i) =>
    `<text x="${anchorX}" y="${Math.round(startY + i * fontSize * 1.18)}" text-anchor="${align}" font-family="${fontFamily}" font-weight="${opts.fontWeight || '700'}" font-size="${fontSize}" fill="${fill}"${opts.italic ? ' font-style="italic"' : ''}>${escapeXml(upper ? String(ln).toUpperCase() : ln)}</text>`
  ).join('');
  const rotate = ov.rotate
    ? ` transform="rotate(${ov.rotate} ${w / 2} ${h / 2})"`
    : '';
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cover}<g${rotate}>${tspans}</g></svg>`);
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
  const ov = styleOf(q);
  const mode = String(q.mode || '').toLowerCase();
  const imageUrl = imgParam(q, 'url', 'image', 'img');
  const text = String(q.text ?? '').trim();
  const useImage = mode === 'image' || (mode !== 'text' && imageUrl && !text) || (opts.preferImage && !text && imageUrl);
  const layers = [];
  if (useImage) {
    const user = await loadImageBuffer(imageUrl);
    layers.push(await placeImageArea(buf, W, H, area, user, { zoom: ov.zoom, rotate: ov.rotate, grayscale: ov.grayscale }));
  } else {
    layers.push(placeTextArea(W, H, area, text || opts.defaultText || 'Welcome to Velirius API', { ...(opts.textOpts || {}), ov }));
  }
  return sharp(buf).composite(layers).png().toBuffer();
}

/** Plantilla de personajes: caras elípticas en los huecos (con zoom/rotación opcionales). */
async function faceCanvas(file, holes, q) {
  let { buf, width: W, height: H } = await templateMeta(file);
  if (W < 500) { // la rata es chica: upscale para que la cara no salga pixelada
    buf = await sharp(buf).resize(W * 3, H * 3).png().toBuffer();
    W *= 3; H *= 3;
  }
  const ov = styleOf(q);
  const urls = [
    imgParam(q, 'url', 'image', 'img', 'url1', 'image1'),
    imgParam(q, 'url2', 'image2'),
    imgParam(q, 'url3', 'image3')
  ];
  const layers = [];
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    const user = await loadImageBuffer(urls[i] || urls[0] || '', i === 1 ? 'avatar2.jpg' : 'avatar1.jpg');
    const w = hole.rx * 2 * W * ov.zoom, h = hole.ry * 2 * H * ov.zoom;
    const piece = await ellipseImage(user, w, h, { zoom: ov.zoom, rotate: ov.rotate, grayscale: ov.grayscale });
    const cx = (hole.cx + ov.dx) * W, cy = (hole.cy + ov.dy) * H;
    layers.push({ input: piece, left: Math.round(cx - w / 2), top: Math.round(cy - h / 2) });
  }
  return sharp(buf).composite(layers).png().toBuffer();
}

// ---------- utilidades ----------
let twemojiCache = new Map();
async function twemoji(code) {
  if (twemojiCache.has(code)) return twemojiCache.get(code);
  try {
    const buf = await fetchBuffer(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`, { timeoutMs: 8000 });
    twemojiCache.set(code, buf);
    return buf;
  } catch (_) { return null; }
}

// ---------- generadores ----------
const GENERATORS = {
  // ---------------- Brat ----------------
  async brat(q) {
    const ov = styleOf(q);
    const text = txt(q, 'Welcome to Velirius API').toLowerCase();
    const bg = ov.bg || normColor(q.bg, '#ffffff');
    const color = ov.fill || normColor(q.color, '#000000');
    const S = 512;
    const { lines, fontSize } = fitTextLines(text, S - 72, S - 80, {
      maxFont: Math.max(20, Math.round(74 * ov.scale)), minFont: 14, maxLines: 6, charWidthRatio: 0.63
    });
    const totalH = lines.length * fontSize * 1.12;
    const startY = (S - totalH) / 2 + fontSize * 0.9;
    const rotate = ov.rotate ? ` transform="rotate(${ov.rotate} ${S / 2} ${S / 2})"` : '';
    const textLayer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><g${rotate}>${lines.map((ln, i) =>
        `<text x="${36 + Math.round(ov.dx * S)}" y="${Math.round(startY + i * fontSize * 1.12 + ov.dy * S)}" font-family="${ov.font ? fontFamilyOf(ov.font) : FONT}" font-weight="400" font-size="${fontSize}" fill="${color}">${escapeXml(ov.uppercase ? String(ln).toUpperCase() : ln)}</text>`).join('')}</g></svg>`
    );
    const blurred = await sharp(textLayer).blur(0.7).png().toBuffer();
    return sharp({ create: { width: S, height: S, channels: 4, background: bg } }).composite([{ input: blurred }]).png().toBuffer();
  },

  async bratestirado(q) {
    const ov = styleOf(q);
    const text = txt(q, 'i <3 money');
    const S = 736;
    const color = ov.fill || normColor(q.color, '#000000');
    const { lines, fontSize } = fitTextLines(text, S - 96, S - 120, {
      maxFont: Math.max(30, Math.round(172 * ov.scale)), minFont: 24, maxLines: 3, charWidthRatio: 0.80
    });
    const mid = (lines.length - 1) / 2;
    let y = S * 0.30 + ov.dy * S;
    const rows = lines.map((ln, i) => {
      const boost = 1 + 0.16 * (1 - Math.abs(i - mid)); // la línea central es más grande (ojo de pez)
      const fs = Math.round(fontSize * boost);
      const row = `<text x="0" y="0" text-anchor="middle" font-family="${ov.font ? fontFamilyOf(ov.font) : FONT}" font-weight="900" font-style="italic" font-size="${fs}" fill="${color}" transform="translate(${S / 2 + ov.dx * S} ${Math.round(y)}) rotate(${-3 + ov.rotate}) scale(1 1.32)">${escapeXml(ov.uppercase ? String(ln).toUpperCase() : ln)}</text>`;
      y += fs * 1.28;
      return row;
    }).join('');
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${ov.bg || '#ffffff'}"/>${rows}</svg>`);
    return svgToPng(svg);
  },

  // ---------------- Carteles con personajes ----------------
  bratanime: q => signCanvas('bratanime.png', { x0: 0.162, y0: 0.498, x1: 0.82, y1: 0.812 }, q,
    { textOpts: { cover: '#ffffff', coverRadius: 4, fontFamily: SERIF, fill: '#111111', maxFont: 92 } }),

  bratcoyote: q => signCanvas('bratcoyote.png', { x0: 0.045, y0: 0.085, x1: 0.545, y1: 0.475 }, q,
    { textOpts: { cover: '#f3e6cf', coverRadius: 6, fill: '#111111', maxFont: 96, uppercase: true, fontWeight: '900', charWidthRatio: 0.72 } }),

  bratpinguino: q => signCanvas('bratpinguino.jpg', { x0: 0.325, y0: 0.525, x1: 0.885, y1: 0.875 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { fill: '#23281a', maxFont: 76 } }),

  bobesponja: q => signCanvas('bobesponja.jpg', { x0: 0.20, y0: 0.33, x1: 0.75, y1: 0.74 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { maxFont: 44 } }),
  bobesponja2: q => signCanvas('bobesponja2.jpg', { x0: 0.12, y0: 0.08, x1: 0.41, y1: 0.34 }, q,
    { defaultText: 'mi tarea', textOpts: { maxFont: 30 } }),
  bobesponja3: q => signCanvas('bobesponja3.jpg', { x0: 0.53, y0: 0.14, x1: 0.87, y1: 0.55 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { maxFont: 54 } }),
  canvatextoxd: q => signCanvas('canvatextoxd.jpg', { x0: 0.30, y0: 0.395, x1: 0.83, y1: 0.725 }, q,
    { defaultText: 'tu texto aquí', textOpts: { maxFont: 44, fill: '#222222' } }),
  imagencanba: q => signCanvas('imagencanba.jpg', { x0: 0.138, y0: 0.12, x1: 0.948, y1: 0.715 }, q,
    { defaultText: 'dibujo god', preferImage: true, textOpts: { maxFont: 64 } }),

  // ---------------- quotly ----------------
  async quotly(q) {
    const ov = styleOf(q);
    const username = String(q.username || q.name || 'Velirius Api').slice(0, 40);
    const text = txt(q, 'Welcome to Velirius Api');
    const bg = ov.bg && ov.bg !== 'transparent' ? ov.bg : normColor(q.bg, '#000000');
    const dark = ['#000000', '#111111', 'black'].includes(String(bg).toLowerCase());
    const color = ov.fill || (dark ? '#ffffff' : '#111111');
    const lines = wrapText(text, Math.max(12, Math.round(42 / ov.scale)), 8);
    const scale = ov.scale;
    const fontSize = Math.round(31 * scale);
    const lineH = Math.round(fontSize * 1.3);
    const W = 800, H = Math.max(140, Math.round(92 + lines.length * lineH));
    const avatar = await circleImage(await loadImageBuffer(imgParam(q, 'image', 'url', 'avatar')), Math.round(76 * Math.min(scale, 1.6)));
    const fontFamily = ov.font ? fontFamilyOf(ov.font) : FONT;
    const cap = ov.uppercase ? String(username).toUpperCase() : username;
    const rotate = ov.rotate ? ` transform="rotate(${ov.rotate} ${W / 2} ${H / 2})"` : '';
    const textSvgBuf = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g${rotate}>` +
      `<text x="${122 + Math.round(ov.dx * W)}" y="${62 + Math.round(ov.dy * H)}" font-family="${fontFamily}" font-weight="700" font-size="${Math.round(fontSize * 0.95)}" fill="${ov.fill || '#f59e0b'}">${escapeXml(cap)}</text>` +
      lines.map((ln, i) => `<text x="${122 + Math.round(ov.dx * W)}" y="${106 + Math.round(ov.dy * H) + i * lineH}" font-family="${fontFamily}" font-size="${fontSize}" fill="${color}">${escapeXml(ov.uppercase ? String(ln).toUpperCase() : ln)}</text>`).join('') +
      `</g></svg>`
    );
    return sharp({ create: { width: W, height: H, channels: 4, background: bg } })
      .composite([{ input: avatar, left: 24, top: 28 }, { input: textSvgBuf, left: 0, top: 0 }])
      .png().toBuffer();
  },

  // ---------------- ttp ----------------
  async ttp(q) {
    const ov = styleOf(q);
    const text = txt(q, 'Hola');
    const colorIn = String(q.color || 'white');
    const fill = normColor(colorIn, '#ffffff');
    const bgIn = String(q.bg || 'transparent').toLowerCase();
    const bg = bgIn === 'transparent' ? null : normColor(bgIn, '#000000');
    const S = 512;
    const lines = wrapText(text, Math.max(4, Math.round(8 / ov.scale)), 4).map(l => l.split('').join(' '));
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    const fontSize = Math.max(14, Math.min(160, Math.round(Math.min((S - 64) / (longest * 0.60), (S - 80) / (lines.length * 1.25)) * ov.scale)));
    const totalH = lines.length * fontSize * 1.25;
    const rotate = ov.rotate ? ` transform="rotate(${ov.rotate} ${S / 2} ${S / 2})"` : '';
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg ? `<rect width="${S}" height="${S}" fill="${bg}"/>` : ''}<g${rotate}>` +
      lines.map((ln, i) => `<text x="${S / 2 + ov.dx * S}" y="${Math.round((S - totalH) / 2 + fontSize * 0.92 + i * fontSize * 1.25 + ov.dy * S)}" text-anchor="middle" font-family="${ov.font ? fontFamilyOf(ov.font) : FONT}" font-weight="300" font-size="${fontSize}" fill="${fill}">${escapeXml(ln)}</text>`).join('') +
      `</g></svg>`
    );
    return svgToPng(svg);
  },

  // ---------------- iqc (chat falso de WhatsApp) ----------------
  async iqc(q) {
    const message = txt(q, 'Yo siempre te voy a amar');
    const quote = String(q.quote ?? q.quoted ?? 'vooooss seguro').slice(0, 60);
    const username = String(q.username ?? q.name ?? 'Tú').slice(0, 24);
    const time = String(q.time ?? q.hour ?? '7:32 p. m.').slice(0, 14);
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

  // ---------------- cuentatiktok ----------------
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

  // ---------------- storyreply ----------------
  async storyreply(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = await chromaInsert('storyreply.jpg', user, { x0: 0.055, y0: 0.11, x1: 0.375, y1: 0.70 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
    const reply = txt(q, '');
    if (!reply) return base;
    const meta = await sharp(base).metadata();
    const layer = placeTextArea(meta.width, meta.height, { x0: 0.05, y0: 0.705, x1: 0.95, y1: 0.895 }, reply,
      { fill: '#ffffff', align: 'start', maxFont: 30, minFont: 14, maxLines: 2, pad: 22, fontWeight: '400', ov });
    return sharp(base).composite([layer]).png().toBuffer();
  },

  // ---------------- absolutecinema ----------------
  async absolutecinema(q) {
    const ov = styleOf(q);
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
    const color = ov.fill || normColor(q.color, '#ffffff');
    const barH = Math.round(H * 0.315);
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${barH}">` +
      `<rect width="${W}" height="${barH}" fill="#000000"/>` +
      `<text x="${W / 2 + ov.dx * W}" y="${Math.round(barH * 0.42)}" text-anchor="middle" font-family="${ov.font ? fontFamilyOf(ov.font) : FONT}" font-weight="700" font-size="${Math.round(H * 0.052 * ov.scale)}" letter-spacing="6" fill="${color}">${escapeXml(sub)}</text>` +
      `<text x="${W / 2 + ov.dx * W}" y="${Math.round(barH * 0.83)}" text-anchor="middle" font-family="${ov.font ? fontFamilyOf(ov.font) : FONT}" font-weight="900" font-size="${Math.round(H * 0.125 * ov.scale)}" letter-spacing="2" fill="${color}">${escapeXml(main)}</text>` +
      `</svg>`
    );
    return sharp(base).composite([{ input: svg, left: 0, top: H - barH }]).png().toBuffer();
  },

  // ---------------- imagenes en pantalla verde ----------------
  async canvaimagen(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('canvaimagen.jpg', user, { x0: 0, y0: 0, x1: 1, y1: 1 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },

  async fotopc(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('fotopc.jpg', user, { x0: 0.52, y0: 0.29, x1: 1, y1: 0.68 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },

  // ---------------- sebusca ----------------
  async sebusca(q) {
    const ov = styleOf(q);
    const { buf, width: W, height: H } = await templateMeta('sebusca.jpg');
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const layers = [await placeImageArea(W, H, { x0: 0.272, y0: 0.298, x1: 0.783, y1: 0.648 }, user, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate })];
    const name = String(q.name ?? '').trim();
    if (name) {
      const bandW = Math.round(0.511 * W), bandH = Math.round(0.055 * H);
      const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bandW}" height="${bandH}"><rect width="${bandW}" height="${bandH}" fill="#000000" fill-opacity="0.72"/><text x="${bandW / 2}" y="${Math.round(bandH * 0.72)}" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="21" fill="${ov.fill || '#ffffff'}">${escapeXml(name.toUpperCase().slice(0, 26))}</text></svg>`);
      layers.push({ input: band, left: Math.round(0.272 * W), top: Math.round(0.648 * H) - bandH });
    }
    const reward = String(q.reward ?? q.recompensa ?? '').trim();
    if (reward) {
      layers.push(placeTextArea(W, H, { x0: 0.08, y0: 0.728, x1: 0.915, y1: 0.842 }, reward,
        { cover: '#d9c69c', fontFamily: SERIF, fontWeight: '900', fill: '#1a1207', maxFont: 58, maxLines: 1, pad: 6, ov }));
    }
    return sharp(buf).composite(layers).png().toBuffer();
  },

  // ---------------- pokemoncard ----------------
  async pokemoncard(q) {
    const ov = styleOf(q);
    const { buf, width: W, height: H } = await templateMeta('pokemoncard.jpg');
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const name = String(q.name || 'Velirius').slice(0, 20);
    const hp = String(q.hp || '120').replace(/[^0-9]/g, '').slice(0, 4) || '120';
    const type = String(q.type || 'Legendario').slice(0, 22);
    const attack = String(q.attack || 'Golpe API').slice(0, 26);
    const damage = String(q.damage || '90').replace(/[^0-9+]/g, '').slice(0, 5) || '90';
    const description = String(q.description || q.desc || 'Una carta creada con Velirius API.').slice(0, 220);
    const layers = [await placeImageArea(W, H, { x0: 0.085, y0: 0.105, x1: 0.915, y1: 0.47 }, user, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate })];
    const font = ov.font ? fontFamilyOf(ov.font) : FONT;
    const s = ov.scale;
    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<text x="${Math.round(W * 0.215)}" y="${Math.round(H * 0.068)}" font-family="${font}" font-weight="700" font-size="${Math.round(34 * s)}" fill="${ov.fill || '#222222'}">${escapeXml(name)}</text>` +
      `<text x="${Math.round(W * 0.862)}" y="${Math.round(H * 0.068)}" text-anchor="end" font-family="${font}" font-weight="700" font-size="${Math.round(27 * s)}" fill="#c0392b">${escapeXml(hp)}</text>` +
      `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.512)}" font-family="${font}" font-style="italic" font-size="${Math.round(21 * s)}" fill="#444444">${escapeXml(type)}</text>` +
      `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.598)}" font-family="${font}" font-weight="700" font-size="${Math.round(36 * s)}" fill="${ov.fill || '#222222'}">${escapeXml(attack)}</text>` +
      `<text x="${Math.round(W * 0.895)}" y="${Math.round(H * 0.598)}" text-anchor="end" font-family="${font}" font-weight="700" font-size="${Math.round(36 * s)}" fill="${ov.fill || '#222222'}">${escapeXml(damage)}</text>` +
      wrapText(description, 31, 6).map((ln, i) => `<text x="${Math.round(W * 0.105)}" y="${Math.round(H * 0.662 + i * 36)}" font-family="${font}" font-size="${Math.round(25 * s)}" fill="#333333">${escapeXml(ln)}</text>`).join('') +
      `</svg>`
    );
    layers.push({ input: overlay, left: 0, top: 0 });
    return sharp(buf).composite(layers).png().toBuffer();
  },

  // ---------------- ship / friendship ----------------
  async _meter(q, kind) {
    const ov = styleOf(q);
    const isShip = kind === 'ship';
    const W = 1200, H = 512;
    const name1 = String(q.name1 || 'Velirius').slice(0, 20);
    const name2 = String(q.name2 || 'dls').slice(0, 20);
    const pct = parsePercent(q.percentage ?? q.percent ?? q.rank);
    const phrase = String(q.text || 'Best Friends').slice(0, 26);
    const accent = ov.fill || (isShip ? '#ff2d55' : '#00e05a');
    const title = isShip ? '~Medidor de compatibilidad~' : '~Medidor de amistad~';
    const bg = ov.bg || '#23272e';
    const img1 = await loadImageBuffer(imgParam(q, 'image1', 'url1', 'image', 'url'), 'avatar1.jpg');
    const img2 = await loadImageBuffer(imgParam(q, 'image2', 'url2'), 'avatar2.jpg');
    const S = Math.round(295 * Math.min(ov.zoom, 1.6));
    const piece1 = isShip ? await heartImage(img1, S, S * 0.92) : await circleImage(img1, S);
    const piece2 = isShip ? await heartImage(img2, S, S * 0.92) : await circleImage(img2, S);
    const heart = `<path d="M600 128 C588 108 556 104 548 124 C541 141 556 158 600 182 C644 158 659 141 652 124 C644 104 612 108 600 128Z" fill="${isShip ? accent : '#ff2d55'}"/>`;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${bg}"/>` +
      `<text x="${W / 2}" y="52" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="700" font-size="27" fill="${isShip ? '#ff7a92' : '#2ee06d'}">${escapeXml(title)}</text>` +
      (isShip ? heart : `<text x="${W / 2}" y="172" text-anchor="middle" font-family="${FONT}" font-size="58" fill="#ffc93c">★</text>`) +
      `<text x="${W / 2}" y="258" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="${Math.round(37 * ov.scale)}" fill="${accent}">~${pct}%~</text>` +
      `<text x="${W / 2}" y="304" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="${Math.round(34 * ov.scale)}" fill="${accent}">${escapeXml(phrase)}</text>` +
      `<text x="300" y="478" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="700" font-size="25" fill="#ffffff">${escapeXml(name1)}</text>` +
      `<text x="900" y="478" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="700" font-size="25" fill="#ffffff">${escapeXml(name2)}</text>` +
      `</svg>`
    );
    const base = await svgToPng(svg);
    const layers = [
      { input: piece1, left: Math.round(300 - S / 2), top: 118 + Math.round((295 - S) / 2) },
      { input: piece2, left: Math.round(900 - S / 2), top: 118 + Math.round((295 - S) / 2) }
    ];
    if (!isShip) {
      const thumb = await twemoji('1f44d');
      if (thumb) layers.push({ input: await sharp(thumb).resize(58, 58).png().toBuffer(), left: W / 2 - 29, top: 108 });
    }
    return sharp(base).composite(layers).png().toBuffer();
  },
  ship: q => GENERATORS._meter(q, 'ship'),
  friendship: q => GENERATORS._meter(q, 'friendship'),

  // ---------------- gaycard ----------------
  async gaycard(q) {
    const ov = styleOf(q);
    const W = 600, H = 450;
    const name = String(q.name || q.username || 'Velirius').slice(0, 22);
    const pct = parsePercent(q.rank ?? q.percentage ?? q.percent);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    let avatar = await circleImage(user, 178);
    const rainbow = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="178" height="178">${['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'].map((c, i) => `<rect y="${i * 30}" width="178" height="30" fill="${c}" fill-opacity="0.55"/>`).join('')}</svg>`
    );
    avatar = await sharp(avatar).composite([{ input: rainbow }]).png().toBuffer();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="178" height="178"><circle cx="89" cy="89" r="89" fill="#fff"/></svg>`);
    avatar = await sharp(avatar).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<defs><linearGradient id="rw" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ff004d"/><stop offset="25%" stop-color="#ff8a00"/><stop offset="50%" stop-color="#ffee00"/><stop offset="70%" stop-color="#00e05a"/><stop offset="88%" stop-color="#0088ff"/><stop offset="100%" stop-color="#8a2be2"/></linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="${ov.bg || '#141414'}"/>` +
      `<polygon points="0,0 190,0 0,150" fill="#000000"/><polygon points="${W},${H} ${W - 190},${H} ${W},${H - 150}" fill="#000000"/>` +
      `<text x="${W / 2}" y="62" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="31" letter-spacing="2" fill="url(#rw)">GAY PERCENTAGE</text>` +
      `<circle cx="${W / 2}" cy="188" r="94" fill="none" stroke="#ffffff" stroke-width="3"/>` +
      `<text x="${W / 2}" y="332" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-weight="700" font-size="28" fill="${ov.fill || '#ffffff'}">~${escapeXml(name)}~</text>` +
      `<rect x="${W / 2 - 92}" y="356" width="184" height="52" rx="26" fill="#ffffff"/>` +
      `<text x="${W / 2}" y="392" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${Math.round(30 * ov.scale)}" fill="#ff2d78">~ ${pct}% ~</text>` +
      `</svg>`
    );
    const base = await svgToPng(svg);
    return sharp(base).composite([{ input: avatar, left: W / 2 - 89, top: 99 }]).png().toBuffer();
  },

  // ---------------- filtros ----------------
  async gay(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = sharp(user).rotate().grayscale(ov.grayscale);
    const meta = await base.metadata();
    const W = Math.min(meta.width || 512, 1024);
    const resized = await base.resize(W).png().toBuffer();
    const m2 = await sharp(resized).metadata();
    const colors = ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'];
    const band = Math.ceil(m2.height / colors.length);
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m2.width}" height="${m2.height}">${colors.map((c, i) => `<rect y="${i * band}" width="${m2.width}" height="${band}" fill="${c}" fill-opacity="${ov.opacity}"/>`).join('')}</svg>`);
    return sharp(resized).composite([{ input: overlay }]).png().toBuffer();
  },

  async invert(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return sharp(user).rotate().negate({ alpha: false }).png().toBuffer();
  },

  // ---------------- personajes ----------------
  rata: q => faceCanvas('rata.jpg', [{ cx: 0.626, cy: 0.534, rx: 0.129, ry: 0.174 }], q),
  banana: q => faceCanvas('banana.jpg', [{ cx: 0.53, cy: 0.45, rx: 0.153, ry: 0.156 }], q),
  galletita: q => faceCanvas('galletita.jpg', [{ cx: 0.467, cy: 0.502, rx: 0.16, ry: 0.148 }], q),
  minions: q => faceCanvas('minions.jpg', [
    { cx: 0.33, cy: 0.478, rx: 0.108, ry: 0.082 },
    { cx: 0.526, cy: 0.440, rx: 0.138, ry: 0.095 },
    { cx: 0.763, cy: 0.478, rx: 0.122, ry: 0.091 }
  ], q),
  arandano: async q => {
    const ov = styleOf(q);
    return chromaInsert('arandano.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.24, y0: 0.20, x1: 0.71, y1: 0.75 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },
  pan: async q => {
    const ov = styleOf(q);
    return chromaInsert('pan.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.29, y0: 0.34, x1: 0.74, y1: 0.78 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  }
};

const CANVAS_IDS = Object.keys(GENERATORS).filter(id => typeof GENERATORS[id] === 'function' && !id.startsWith('_'));

async function generateCanvas(id, query) {
  const fn = GENERATORS[String(id).toLowerCase()];
  if (typeof fn !== 'function') return null;
  return fn(query || {});
}

module.exports = { generateCanvas, GENERATORS, CANVAS_IDS, styleOf, txt, placeTextArea, chromaInsert, faceCanvas };
