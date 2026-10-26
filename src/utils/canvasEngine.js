// src/utils/canvasEngine.js — Render de los Canvas con las plantillas de Drive
// (assets/templates) y parámetros modificables en caliente.
//
// Todo el texto se dibuja como VECTORES (src/utils/textEngine.js) con las fuentes
// empaquetadas en assets/fonts: el resultado es idéntico en local, Render o Vercel
// y no aparecen cuadrados ▯▯▯ cuando el host no tiene tipografías instaladas.
//
// Parámetros de estilo comunes (opcionales, funcionan en cualquier canvas):
//   color      color del texto (hex con/sin # o nombre: white, black, red…)
//   bg         fondo (canvas generados: brat, ttp, quotly, ship…)
//   size       escala del texto (0.5 = mitad, 2 = doble)
//   font       sans (Inter) | serif (Playfair Display) | mono (JetBrains Mono)
//   uppercase  true = MAYÚSCULAS
//   x, y       desplazamiento en % (-50 … 50)
//   rotate     rotación en grados (-180 … 180)
//   spacing    letter-spacing extra en px
//   zoom       zoom de la foto del usuario (0.5 … 3)
//   grayscale  true = foto en blanco y negro
//   shadow     true = sombra suave bajo el texto (mejor legibilidad sobre fotos)
const {
  sharp, loadImageBuffer, templateMeta, shapedImage, circleImage, heartImage
} = require('./image');
const { textLayer, measure, wrapLines } = require('./textEngine');
const { fetchBuffer } = require('./http');

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
const flag = v => ['true', '1', 'yes', 'si', 'sí', 'on'].includes(String(v ?? '').toLowerCase());
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
    spacing: numberIn(q.spacing ?? q.letterspacing ?? q.tracking, 0, -50, 200),
    zoom: numberIn(q.zoom, 1, 0.2, 4),
    grayscale: flag(q.grayscale ?? q.blanconegro),
    opacity: numberIn(q.opacity, 0.45, 0, 1),
    shadow: flag(q.shadow ?? q.sombra)
  };
}

// ---------- piezas de imagen ----------

/** Sombra interior suave para que la foto se integre en la plantilla. */
function innerShade(w, h, shape = 'ellipse') {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const blur = Math.max(1.5, Math.min(W, H) * 0.05);
  const stroke = Math.max(2, Math.min(W, H) * 0.09);
  const el = shape === 'rect'
    ? `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#000000" stroke-opacity="0.5" stroke-width="${stroke}" filter="url(#b)"/>`
    : `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - stroke / 3}" ry="${H / 2 - stroke / 3}" fill="none" stroke="#000000" stroke-opacity="0.5" stroke-width="${stroke}" filter="url(#b)"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter></defs>` +
    el + `</svg>`
  );
}

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
  const radius = opts.radius ? Math.round(bw * Number(opts.radius)) : 0;
  let userPiece = await shapedImage(userBuf, bw, bh, {
    zoom: opts.zoom ?? 1,
    rotate: opts.rotate ?? 0,
    grayscale: !!opts.grayscale,
    radius
  });
  userPiece = await sharp(userPiece)
    .composite([{ input: innerShade(bw, bh, radius ? 'rect' : 'ellipse'), blend: 'atop' }])
    .png().toBuffer();
  const masked = await sharp(userPiece).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(buf).composite([{ input: masked, left: x0, top: y0 }]).png().toBuffer();
}

async function ellipseImage(userBuf, w, h, opts = {}) {
  const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
  let piece = await shapedImage(userBuf, W, H, {
    zoom: opts.zoom ?? 1,
    rotate: opts.rotate ?? 0,
    grayscale: !!opts.grayscale
  });
  piece = await sharp(piece)
    .composite([{ input: innerShade(W, H, 'ellipse'), blend: 'atop' }])
    .png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="#fff"/></svg>`);
  return sharp(piece).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
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
 * Coloca texto (en vectores) dentro de un área fraccional, con cobertura opcional.
 * Respeta color, tamaño, tipografía, mayúsculas, spacing, sombra y desplazamientos.
 */
function placeTextArea(W, H, area, text, opts = {}) {
  const ov = opts.ov || {};
  const shiftX = Math.round((ov.dx || 0) * W);
  const shiftY = Math.round((ov.dy || 0) * H);
  const x0 = Math.round(area.x0 * W) + shiftX;
  const y0 = Math.round(area.y0 * H) + shiftY;
  const w = Math.max(8, Math.round((area.x1 - area.x0) * W));
  const h = Math.max(8, Math.round((area.y1 - area.y0) * H));
  const pad = opts.pad ?? Math.round(Math.min(w, h) * 0.06);

  const layer = textLayer({
    text,
    width: w,
    height: h,
    family: ov.font || opts.family || 'sans',
    weight: opts.weight ?? 700,
    maxFont: Math.round((opts.maxFont ?? 72) * (ov.scale || 1)),
    minFont: Math.max(6, Math.round((opts.minFont ?? 14) * Math.min(ov.scale || 1, 1.4))),
    maxLines: opts.maxLines ?? 6,
    lineHeight: opts.lineHeight ?? 1.16,
    letterSpacing: (opts.letterSpacing ?? 0) + (ov.spacing || 0),
    fill: ov.fill || opts.fill || '#111111',
    align: opts.align || 'middle',
    uppercase: opts.uppercase || ov.uppercase,
    italic: !!opts.italic,
    padding: pad,
    rotate: ov.rotate || opts.rotate || 0,
    stroke: opts.stroke || null,
    strokeWidth: opts.strokeWidth || 0
  });

  const cover = opts.cover
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${opts.coverRadius ?? 0}" fill="${opts.cover}"/></svg>`)
    : null;

  const shade = opts.shadow
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.max(1.5, (layer.fontSize || 24) * 0.06)}"/></filter></defs><g filter="url(#s)" opacity="0.55" transform="translate(0 ${Math.max(1, (layer.fontSize || 24) * 0.045)})">${layer.svg.toString().replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></svg>`)
    : null;

  return {
    inputs: [cover, layer.svg, shade].filter(Boolean),
    left: x0,
    top: y0
  };
}

/** Expande una capa (que puede traer varias piezas) a entradas de composite. */
function expandLayer(layer) {
  if (!layer) return [];
  if (Array.isArray(layer)) return layer.flatMap(expandLayer);
  if (Array.isArray(layer.inputs)) return layer.inputs.map(input => ({ input, left: layer.left, top: layer.top }));
  return [layer];
}
const flat = layers => layers.flatMap(expandLayer);

/** Inserta `rows` filas de fondo (foto estirada) en `cut`, empujando lo de abajo. */
async function insertRows(buf, W, H, rows, cut) {
  const extra = Math.max(0, Math.round(rows));
  if (!extra) return buf;
  const newH = H + extra;
  const stripTop = Math.max(0, Math.min(H - 12, cut + 10));
  const stripH = Math.max(6, Math.min(64, H - stripTop));
  const backdrop = await sharp(buf)
    .extract({ left: 0, top: stripTop, width: W, height: stripH })
    .resize(W, newH, { fit: 'fill' })
    .blur(Math.max(4, Math.round(W * 0.01)))
    .png().toBuffer();
  const top = await sharp(buf).extract({ left: 0, top: 0, width: W, height: cut }).png().toBuffer();
  const bottom = await sharp(buf).extract({ left: 0, top: cut, width: W, height: H - cut }).png().toBuffer();
  return sharp(backdrop).composite([
    { input: top, left: 0, top: 0 },
    { input: bottom, left: 0, top: cut + extra }
  ]).png().toBuffer();
}

async function renderTemplate(file, composites) {
  const { buf, width, height } = await templateMeta(file);
  const layers = [];
  for (const c of composites) layers.push(typeof c === 'function' ? await c(width, height) : c);
  return sharp(buf).composite(flat(layers)).png().toBuffer();
}


/**
 * Borra el texto de ejemplo de una plantilla SIN dejar un recuadro visible:
 * detecta la caja del texto (píxeles claramente más oscuros que el fondo),
 * toma el color mediano del propio fondo y repinta solo esa caja con bordes
 * difuminados. Así el texto nuevo se apoya directo sobre el cartel/papel.
 */
async function eraseSampleText(buf, W, H, area, opts = {}) {
  const inset = opts.inset ?? 0.08;
  const ax = Math.round(area.x0 * W), ay = Math.round(area.y0 * H);
  const aw = Math.round((area.x1 - area.x0) * W), ah = Math.round((area.y1 - area.y0) * H);
  if (aw < 8 || ah < 8) return null;
  const ix = Math.round(aw * inset), iy = Math.round(ah * inset);
  const x = ax + ix, y = ay + iy;
  const w = Math.max(8, aw - ix * 2), h = Math.max(8, ah - iy * 2);
  const { data, info } = await sharp(buf)
    .extract({ left: x, top: y, width: w, height: h })
    .raw().toBuffer({ resolveWithObject: true });
  const C = info.channels;
  const lum = i => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const samples = [];
  for (let i = 0; i < data.length; i += C) samples.push(lum(i));
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length * 0.5)];
  const thr = median * 0.66;
  let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * C;
      if (lum(i) < thr) {
        if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx;
        if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
      }
    }
  }
  if (bx1 < 0 || (bx1 - bx0 + 1) * (by1 - by0 + 1) > w * h * 0.92) return null;
  // color del fondo = mediana por canal de los píxeles NO oscuros
  const ch = [0, 0, 0].map((_, c) => {
    const arr = [];
    for (let i = 0; i < data.length; i += C) if (lum(i) >= thr) arr.push(data[i + c]);
    arr.sort((a, b) => a - b);
    return arr.length ? arr[Math.floor(arr.length / 2)] : 255;
  });
  const fill = '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
  const pad = Math.max(4, Math.round(Math.min(w, h) * 0.03));
  const cx = Math.max(0, bx0 - pad), cy = Math.max(0, by0 - pad);
  const cw = Math.min(w - cx, bx1 - bx0 + 1 + pad * 2);
  const chh = Math.min(h - cy, by1 - by0 + 1 + pad * 2);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${chh}">` +
    `<rect width="${cw}" height="${chh}" fill="${fill}"/></svg>`
  );
  const feathered = await sharp(svg).blur(Math.max(1.2, Math.min(cw, chh) * 0.035)).png().toBuffer();
  return { input: feathered, left: x + cx, top: y + cy };
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
    layers.push(await placeImageArea(W, H, area, user, {
      zoom: ov.zoom, rotate: ov.rotate, grayscale: ov.grayscale, radius: opts.imageRadius ?? 0
    }));
  } else {
    const textOpts = opts.textOpts || {};
    // sin recuadro de fondo: se borra el texto de ejemplo y se escribe encima
    if (textOpts.cover !== false) {
      const erase = await eraseSampleText(buf, W, H, area, { inset: textOpts.eraseInset ?? 0.08 });
      if (erase) layers.push(erase);
    }
    layers.push(placeTextArea(W, H, area, text || opts.defaultText || 'Welcome to Velirius API', {
      ...textOpts, cover: null, ov
    }));
  }
  return sharp(buf).composite(flat(layers)).png().toBuffer();
}

/** Plantilla de personajes: caras elípticas en los huecos (con zoom/rotación opcionales). */
async function faceCanvas(file, holes, q) {
  let { buf, width: W, height: H } = await templateMeta(file);
  if (W < 500) { // la rata es chica: upscale para que la cara no salga pixelada
    buf = await sharp(buf).resize(W * 3, H * 3, { kernel: 'lanczos3' }).png().toBuffer();
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
  return sharp(buf).composite(flat(layers)).png().toBuffer();
}

// ---------- utilidades ----------
const twemojiCache = new Map();
async function twemoji(code) {
  if (twemojiCache.has(code)) return twemojiCache.get(code);
  try {
    const buf = await fetchBuffer(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`, { timeoutMs: 8000 });
    twemojiCache.set(code, buf);
    return buf;
  } catch (_) { return null; }
}

const svgPng = async (svg, density = 1) => sharp(svg, { density: 72 * density }).png().toBuffer();

// ---------- generadores ----------
const GENERATORS = {
  // ======================= BRAT =======================
  async brat(q) {
    const ov = styleOf(q);
    const text = txt(q, 'Welcome to Velirius API').toLowerCase();
    const bg = ov.bg || normColor(q.bg, '#ffffff');
    const color = ov.fill || normColor(q.color, '#000000');
    const S = 512;
    const layer = textLayer({
      text,
      width: S,
      height: S,
      family: ov.font || 'sans',
      weight: 400,
      maxFont: Math.round(78 * ov.scale),
      minFont: 12,
      maxLines: 8,
      lineHeight: 1.12,
      letterSpacing: (ov.spacing || 0) - 0.5,
      fill: color,
      align: 'start',
      padding: 30,
      uppercase: ov.uppercase,
      rotate: ov.rotate,
      offsetX: Math.round(ov.dx * S),
      offsetY: Math.round(ov.dy * S)
    });
    const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
    const base = sharp({ create: { width: S, height: S, channels: 4, background: bg } });
    const withText = await base.composite([{ input: blurred }]).png().toBuffer();
    // grano sutil: el sticker brat real no es un plano perfecto
    const grain = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${S}" height="${S}" filter="url(#n)" opacity="0.035"/></svg>`);
    return sharp(withText).composite([{ input: grain }]).png().toBuffer();
  },

  async bratestirado(q) {
    const ov = styleOf(q);
    const text = txt(q, 'i <3 money');
    const S = 736;
    const color = ov.fill || normColor(q.color, '#000000');
    const family = ov.font || 'sans';
    const words = text.split(/\s+/).filter(Boolean);
    const maxFont = Math.round(150 * ov.scale);
    const oneLine = words.join(' ');
    const lines = measure(oneLine, { family, weight: 800, size: maxFont }) <= S - 70
      ? [oneLine]
      : (() => {
          const half = Math.ceil(words.length / 2);
          return [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean);
        })();
    const widest = Math.max(...lines.map(l => measure(l, { family, weight: 800, size: maxFont })), 1);
    const size = Math.round(Math.min(maxFont * ((S - 90) / widest + 0.15), (S - 90) / Math.max(1, lines.length) / 0.86));
    const rows = [];
    let y = Math.round(S * 0.16 + ov.dy * S);
    for (const ln of lines) {
      const layer = textLayer({
        text: ln, width: S, height: Math.round(size * 1.45), family, weight: 800,
        maxFont: size, minFont: 16, maxLines: 1, fill: color, align: 'middle',
        uppercase: ov.uppercase, letterSpacing: ov.spacing || 0,
        rotate: -2 + ov.rotate
      });
      rows.push({ input: layer.svg, left: 0, top: y });
      y += Math.round(size * 1.12);
    }
    const base = await sharp({ create: { width: S, height: S, channels: 4, background: ov.bg || '#ffffff' } }).png().toBuffer();
    const composed = await sharp(base).composite(rows).png().toBuffer();
    // ojo de pez: se estira la franja central y se recompone (sin blur)
    const bandH = Math.round(S * 0.52);
    const top = Math.round((S - bandH) / 2);
    const band = await sharp(composed)
      .extract({ left: 0, top, width: S, height: bandH })
      .resize(S, Math.round(bandH * 1.14), { fit: 'fill' })
      .png().toBuffer();
    const bandTop = Math.round((S - bandH * 1.14) / 2);
    return sharp(composed).composite([{ input: band, left: 0, top: bandTop }]).png().toBuffer();
  },

  // ======================= CARTELES CON PERSONAJES =======================
  bratanime: q => signCanvas('bratanime.png', { x0: 0.163, y0: 0.497, x1: 0.818, y1: 0.810 }, q,
    { textOpts: { family: 'serif', weight: 700, fill: '#111111', maxFont: 96, maxLines: 4 } }),

  bratcoyote: q => signCanvas('bratcoyote.png', { x0: 0.052, y0: 0.092, x1: 0.538, y1: 0.468 }, q,
    { textOpts: { family: 'sans', weight: 900, fill: '#111111', maxFont: 104, uppercase: true, maxLines: 4 } }),

  bratpinguino: q => signCanvas('bratpinguino.jpg', { x0: 0.335, y0: 0.545, x1: 0.875, y1: 0.855 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { family: 'sans', weight: 700, fill: '#2b3020', maxFont: 74, maxLines: 4, rotate: -1.2 } }),

  bobesponja: q => signCanvas('bobesponja.jpg', { x0: 0.205, y0: 0.335, x1: 0.745, y1: 0.735 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { family: 'sans', weight: 700, maxFont: 46, maxLines: 5 } }),

  bobesponja2: q => signCanvas('bobesponja2.jpg', { x0: 0.125, y0: 0.085, x1: 0.405, y1: 0.335 }, q,
    { defaultText: 'mi tarea', textOpts: { family: 'sans', weight: 700, maxFont: 32, maxLines: 4 } }),

  bobesponja3: q => signCanvas('bobesponja3.jpg', { x0: 0.535, y0: 0.145, x1: 0.865, y1: 0.545 }, q,
    { defaultText: 'Welcome to Velirius API', textOpts: { family: 'sans', weight: 700, maxFont: 56, maxLines: 5 } }),

  canvatextoxd: q => signCanvas('canvatextoxd.jpg', { x0: 0.405, y0: 0.425, x1: 0.885, y1: 0.735 }, q,
    { defaultText: 'tu texto aquí', textOpts: { family: 'sans', weight: 700, fill: '#3a3a3a', maxFont: 46, maxLines: 4, rotate: -1.5 } }),

  imagencanba: async q => {
    const { buf, width: W, height: H } = await templateMeta('imagencanba.jpg');
    const ov = styleOf(q);
    const imageUrl = imgParam(q, 'url', 'image', 'img');
    const text = String(q.text ?? '').trim();
    const mode = String(q.mode || '').toLowerCase();
    const useImage = mode === 'image' || (mode !== 'text' && imageUrl && !text);
    const layers = [];
    if (useImage) {
      const user = await loadImageBuffer(imageUrl);
      layers.push(await placeImageArea(W, H, { x0: 0.152, y0: 0.128, x1: 0.935, y1: 0.700 }, user, { zoom: ov.zoom }));
    } else {
      layers.push(placeTextArea(W, H, { x0: 0.152, y0: 0.128, x1: 0.935, y1: 0.700 }, text || 'dibujo god', {
        family: 'sans', weight: 700, fill: '#1f2937', maxFont: 72, maxLines: 4, ov
      }));
    }
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= QUOTLY (Telegram) =======================
  async quotly(q) {
    const ov = styleOf(q);
    const username = String(q.username || q.name || 'Velirius Api').slice(0, 40);
    const text = txt(q, 'Welcome to Velirius Api');
    const bg = ov.bg && ov.bg !== 'transparent' ? ov.bg : normColor(q.bg, '#000000');
    const dark = ['#000000', '#111111', '#17212b', 'black'].includes(String(bg).toLowerCase());
    const bodyColor = ov.fill || (dark ? '#ffffff' : '#111111');
    const nameColor = ov.fill || '#f59e0b';
    const family = ov.font || 'sans';

    const fontSize = Math.round(32 * ov.scale);
    const lineHeight = 1.34;
    const avatarSize = Math.round(84 * Math.min(ov.scale, 1.4));
    const padX = 24, padY = 22, gap = 20;
    const nameSize = Math.round(fontSize * 0.98);
    const nameH = Math.round(nameSize * 1.35);

    // 1) medir el texto con margen suficiente y decidir el ancho del lienzo
    const textPad = 6;
    const narrow = Math.max(60, ...wrapLines(text, 560 - textPad * 2, { family, weight: 400, size: fontSize })
      .map(l => measure(l, { family, weight: 400, size: fontSize })));
    const W = Math.round(Math.min(1000, Math.max(400, padX * 2 + avatarSize + gap + Math.ceil(narrow) + 14 + textPad * 2)));
    const textW = Math.max(80, W - padX * 2 - avatarSize - gap);

    // 2) renderizar el texto con el ancho definitivo (altura exacta de las líneas)
    const lines = wrapLines(text, textW - textPad * 2, { family, weight: 400, size: fontSize });
    const bodyH = Math.max(Math.round(fontSize * lineHeight), Math.round(lines.length * fontSize * lineHeight) + 2);
    const body = textLayer({
      text, width: textW, height: bodyH, family, weight: 400,
      maxFont: fontSize, minFont: 12, maxLines: lines.length, lineHeight,
      fill: bodyColor, align: 'start', autoFit: false, fontSize, padding: textPad
    });
    const H = Math.round(padY * 2 + nameH + bodyH);

    const nameLayer = textLayer({
      text: ov.uppercase ? username.toUpperCase() : username,
      width: textW, height: nameH, family, weight: 600,
      maxFont: nameSize, minFont: 9, maxLines: 1, fill: nameColor, align: 'start', padding: textPad
    });
    const rounded = await circleImage(await loadImageBuffer(imgParam(q, 'image', 'url', 'avatar')), avatarSize);
    const rim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 1}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/></svg>`);
    const avatar = await sharp(rounded).composite([{ input: rim }]).png().toBuffer();

    const left = padX + avatarSize + gap;
    const composed = await sharp({ create: { width: W, height: H, channels: 4, background: bg } })
      .composite([
        { input: avatar, left: padX, top: Math.round((H - avatarSize) / 2) },
        { input: nameLayer.svg, left, top: padY },
        { input: body.svg, left, top: padY + nameH }
      ])
      .png().toBuffer();

    if (!ov.rotate && !ov.dx && !ov.dy) return composed;
    const rotated = await sharp(composed)
      .rotate(ov.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    if (!ov.dx && !ov.dy) return rotated;
    const meta = await sharp(rotated).metadata();
    return sharp({ create: { width: meta.width + 80, height: meta.height + 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rotated, left: Math.round(40 + ov.dx * 80), top: Math.round(40 + ov.dy * 80) }])
      .png().toBuffer();
  },

  // ======================= TTP / ATPP =======================
  async ttp(q) {
    const ov = styleOf(q);
    const text = txt(q, 'Hola');
    const fill = normColor(q.color, '#ffffff');
    const bgIn = String(q.bg || 'transparent').toLowerCase();
    const bg = bgIn === 'transparent' ? null : normColor(bgIn, '#000000');
    const S = 512;
    const fontSize = Math.round(72 * ov.scale);
    const layer = textLayer({
      text,
      width: S,
      height: S,
      family: ov.font || 'sans',
      weight: 700,
      maxFont: fontSize,
      minFont: 18,
      maxLines: 3,
      lineHeight: 1.34,
      letterSpacing: fontSize * 0.24 + (ov.spacing || 0),
      fill,
      align: 'middle',
      padding: 24,
      uppercase: ov.uppercase,
      rotate: ov.rotate,
      offsetX: Math.round(ov.dx * S),
      offsetY: Math.round(ov.dy * S),
      stroke: '#000000',
      strokeWidth: Math.max(4, fontSize * 0.09)
    });
    const canvas = sharp({ create: { width: S, height: S, channels: 4, background: bg || { r: 0, g: 0, b: 0, alpha: 0 } } });
    return canvas.composite([{ input: layer.svg }]).png().toBuffer();
  },

  // ======================= IQC (chat falso) =======================
  // La burbuja se arma por partes (cita + mensaje + hora) y CRECE hacia abajo
  // como en WhatsApp: si la respuesta es larga se agregan líneas, la burbuja se
  // estira y el menú de abajo baja lo necesario (el alto de la imagen se ajusta).
  async iqc(q) {
    const ov = styleOf(q);
    const message = txt(q, 'Yo siempre te voy a amar');
    const quoteRaw = String(q.quote ?? q.quoted ?? 'vooooss seguro').trim();
    // la cita de WhatsApp va en una sola línea con "…" al final
    const quote = quoteRaw.length > 46 ? quoteRaw.slice(0, 44).trimEnd() + '…' : quoteRaw;
    const username = String(q.username ?? q.name ?? 'Tú').slice(0, 28);
    const time = String(q.time ?? q.hour ?? '7:32 p. m.').slice(0, 18);
    const { buf, width: W, height: H } = await templateMeta('iqc.jpg');

    // --- medidas tomadas de iqc.jpg (736x1308) ---
    const bubbleX = Math.round(0.0408 * W);          // 30
    const bubbleW = Math.round(0.7092 * W);          // 522
    const quoteTop = Math.round(0.4434 * H);         // 580
    const quoteH = Math.round(0.0948 * H);           // 124
    const quoteBottom = quoteTop + quoteH;           // 704
    const msgTop = Math.round(0.5397 * H);           // 706
    const baseBottom = Math.round(0.5841 * H);       // 764 (burbuja con 1 línea)
    const textPadX = Math.round(0.0435 * W);         // 32
    const hourW = Math.round(0.105 * W);
    const family = ov.font || 'sans';
    const weight = 400;

    // --- mensaje: se mide y se envuelve como WhatsApp ---
    const fontSize = Math.max(10, Math.round(0.0225 * H * ov.scale));
    const lineHeight = 1.36;
    const msgW = Math.max(40, bubbleW - textPadX - Math.round(0.016 * W) - hourW);
    const lines = wrapLines(message, msgW, { family, weight, size: fontSize, letterSpacing: ov.spacing || 0, maxLines: 16 });
    const blockH = Math.round(Math.max(1, lines.length) * fontSize * lineHeight);
    const bottomPad = Math.round(0.0145 * H);        // 19
    const bubbleBottom = msgTop + blockH + bottomPad;
    const delta = Math.max(0, bubbleBottom - baseBottom);   // lo que crece la burbuja

    // --- cita (nombre + texto citado) ---
    const quoteLayer = textLayer({
      text: quote, width: bubbleW - textPadX - Math.round(0.03 * W), height: Math.round(quoteH * 0.30),
      family, weight: 400, maxFont: Math.round(0.0232 * H), minFont: 14, maxLines: 1,
      align: 'start', fill: '#e9edef', letterSpacing: ov.spacing || 0
    });
    const nameLayer = textLayer({
      text: username, width: bubbleW - textPadX - Math.round(0.03 * W), height: Math.round(quoteH * 0.22),
      family, weight: 600, maxFont: Math.round(0.0198 * H), minFont: 9, maxLines: 1,
      align: 'start', fill: '#e8848c'
    });

    // --- mensaje + hora ---
    const msgLayer = textLayer({
      text: lines.join('\n'), width: msgW, height: blockH,
      family, weight, fontSize, autoFit: false, maxLines: lines.length,
      lineHeight, align: 'start', fill: ov.fill || '#e9edef', letterSpacing: ov.spacing || 0
    });
    const hourH = Math.round(0.020 * H);
    const hourLayer = textLayer({
      text: time, width: hourW, height: hourH, family, weight: 400,
      maxFont: Math.round(0.0165 * H), minFont: 8, maxLines: 1,
      align: 'end', fill: '#a9b4bb'
    });

    // --- si la burbuja crece, se insertan filas de fondo y el menú baja ---
    const base = delta > 0 ? await insertRows(buf, W, H, delta, Math.round(0.5887 * H)) : buf;

    // --- se redibuja SOLO la parte de abajo de la burbuja (sin cajas blancas) ---
    const bubbleExt = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bubbleW}" height="${bubbleBottom - quoteBottom + 2}">` +
      `<rect width="${bubbleW}" height="${bubbleBottom - quoteBottom + 2}" rx="${Math.round(bubbleW * 0.032)}" fill="#2a2a2a"/>` +
      `<rect width="${bubbleW}" height="${Math.round((bubbleBottom - quoteBottom) * 0.55)}" fill="#2a2a2a"/>` +
      `</svg>`
    );

    // limpia el texto de ejemplo de la cita pintando el propio panel (#212121)
    const quoteCover = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bubbleW - 28}" height="${quoteH - 8}">` +
      `<rect width="${bubbleW - 28}" height="${quoteH - 8}" rx="8" fill="#212121"/></svg>`
    );

    return sharp(base).composite([
      { input: bubbleExt, left: bubbleX, top: quoteBottom - 1 },
      { input: quoteCover, left: bubbleX + 22, top: quoteTop + 4 },
      { input: nameLayer.svg, left: bubbleX + textPadX, top: quoteTop + Math.round(quoteH * 0.10) },
      { input: quoteLayer.svg, left: bubbleX + textPadX, top: quoteTop + Math.round(quoteH * 0.46) },
      { input: msgLayer.svg, left: bubbleX + textPadX, top: msgTop + Math.round(bottomPad * 0.25) },
      { input: hourLayer.svg, left: bubbleX + bubbleW - hourW - Math.round(0.014 * W), top: bubbleBottom - bottomPad - hourH + Math.round(bottomPad * 0.35) }
    ]).png().toBuffer();
  },

  // ======================= CUENTA TIKTOK =======================
  async cuentatiktok(q) {
    const username = String(q.username ?? q.name ?? 'Account not found').slice(0, 36);
    const status = String(q.status ?? q.text ?? 'Sent').slice(0, 24);
    const { buf, width: W, height: H } = await templateMeta('cuentatiktok.jpg');
    // Fila negra: x 5.4%-96.7%, y 33.3%-41.4%. Avatar 36.5%-40.6% y texto tras él.
    const rowLeft = Math.round(0.054 * W);
    const rowW = Math.round(0.913 * W);
    const rowTop = Math.round(0.333 * H);
    const rowH = Math.round(0.081 * H);
    const avatarD = Math.round(0.055 * W);
    const textLeft = Math.round(0.232 * W);
    const textW = rowLeft + rowW - textLeft - Math.round(0.015 * W);

    const name = textLayer({
      text: username, width: textW, height: Math.round(rowH * 0.42), family: 'sans', weight: 600,
      maxFont: Math.round(rowH * 0.30), minFont: 9, maxLines: 1, align: 'start', fill: '#ffffff'
    });
    const sub = textLayer({
      text: status, width: textW, height: Math.round(rowH * 0.30), family: 'sans', weight: 400,
      maxFont: Math.round(rowH * 0.21), minFont: 7, maxLines: 1, align: 'start', fill: '#9a9a9a'
    });
    const coverName = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${textW}" height="${Math.round(rowH * 0.42)}"><rect width="100%" height="100%" fill="#000000"/></svg>`);
    const coverSub = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${textW}" height="${Math.round(rowH * 0.30)}"><rect width="100%" height="100%" fill="#000000"/></svg>`);
    const nameTop = rowTop + Math.round(rowH * 0.13);
    const subTop = rowTop + Math.round(rowH * 0.59);
    const layers = [
      { input: coverName, left: textLeft, top: nameTop },
      { input: coverSub, left: textLeft, top: subTop },
      { input: name.svg, left: textLeft, top: nameTop },
      { input: sub.svg, left: textLeft, top: subTop }
    ];
    const avatarUrl = imgParam(q, 'image', 'url', 'avatar');
    if (avatarUrl) {
      const av = await circleImage(await loadImageBuffer(avatarUrl), avatarD);
      layers.push({ input: av, left: Math.round(0.081 * W), top: Math.round(0.347 * H) });
    }
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= STORY REPLY =======================
  async storyreply(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = await chromaInsert('storyreply.jpg', user, { x0: 0.060, y0: 0.125, x1: 0.360, y1: 0.700 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate, radius: 0.16 });
    const reply = txt(q, '');
    if (!reply) return base;
    const meta = await sharp(base).metadata();
    const layer = placeTextArea(meta.width, meta.height, { x0: 0.075, y0: 0.745, x1: 0.905, y1: 0.880 }, reply, {
      family: ov.font || 'sans', weight: 500, fill: '#ffffff', align: 'start',
      maxFont: 32, minFont: 14, maxLines: 2, rotate: ov.rotate, ov
    });
    return sharp(base).composite(expandLayer(layer)).png().toBuffer();
  },

  // ======================= ABSOLUTE CINEMA =======================
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
    const barH = Math.round(H * 0.32);
    const bar = await sharp({ create: { width: W, height: barH, channels: 4, background: '#000000' } }).png().toBuffer();
    const subLayer = textLayer({
      text: sub, width: W - 60, height: Math.round(barH * 0.36), family: ov.font || 'sans',
      weight: 600, maxFont: Math.round(H * 0.05 * ov.scale), minFont: 10, maxLines: 1,
      letterSpacing: Math.max(4, H * 0.008), fill: color, align: 'middle', offsetX: Math.round(ov.dx * W)
    });
    const mainLayer = textLayer({
      text: main, width: W - 40, height: Math.round(barH * 0.54), family: ov.font || 'sans',
      weight: 900, maxFont: Math.round(H * 0.13 * ov.scale), minFont: 14, maxLines: 1,
      letterSpacing: Math.max(1, H * 0.003), fill: color, align: 'middle', offsetX: Math.round(ov.dx * W)
    });
    return sharp(base)
      .composite([
        { input: bar, left: 0, top: H - barH },
        { input: subLayer.svg, left: 30, top: H - barH + Math.round(barH * 0.10) },
        { input: mainLayer.svg, left: 20, top: H - barH + Math.round(barH * 0.38) }
      ])
      .png().toBuffer();
  },

  // ======================= PANTALLAS VERDES =======================
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

  // ======================= SE BUSCA =======================
  async sebusca(q) {
    const ov = styleOf(q);
    const { buf, width: W, height: H } = await templateMeta('sebusca.jpg');
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const layers = [
      await placeImageArea(W, H, { x0: 0.278, y0: 0.302, x1: 0.777, y1: 0.645 }, user, {
        zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate
      })
    ];
    // marco de la foto (como el cartel original)
    const frameW = Math.round(0.529 * W), frameH = Math.round(0.367 * H);
    const frame = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW + 12}" height="${frameH + 12}">` +
      `<rect x="1" y="1" width="${frameW + 10}" height="${frameH + 10}" rx="3" fill="none" stroke="#f2e7c9" stroke-width="6"/>` +
      `<rect x="4" y="4" width="${frameW + 4}" height="${frameH + 4}" rx="2" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.5"/>` +
      `</svg>`
    );
    layers.push({ input: frame, left: Math.round(0.272 * W), top: Math.round(0.296 * H) });

    const name = String(q.name ?? '').trim();
    if (name) {
      const bandW = Math.round(0.499 * W), bandH = Math.round(0.05 * H);
      const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bandW}" height="${bandH}"><rect width="${bandW}" height="${bandH}" fill="#000000" fill-opacity="0.74"/></svg>`);
      const bandTop = Math.round(0.645 * H) - bandH;
      const nameLayer = textLayer({
        text: name.toUpperCase().slice(0, 26), width: bandW - 12, height: bandH - 6,
        family: 'serif', weight: 900, maxFont: Math.round(bandH * 0.62), minFont: 8,
        maxLines: 1, fill: ov.fill || '#ffffff', align: 'middle'
      });
      layers.push({ input: band, left: Math.round(0.278 * W), top: bandTop });
      layers.push({ input: nameLayer.svg, left: Math.round(0.278 * W) + 6, top: bandTop + 3 });
    }

    const reward = String(q.reward ?? q.recompensa ?? '').trim();
    if (reward) {
      layers.push(placeTextArea(W, H, { x0: 0.09, y0: 0.735, x1: 0.905, y1: 0.838 }, reward, {
        family: 'serif', weight: 900, fill: '#1a1207',
        maxFont: 56, maxLines: 1, pad: 4, ov: { ...ov, scale: ov.scale * 0.92 }
      }));
    }
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= POKEMON CARD =======================
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

    const layers = [
      await placeImageArea(W, H, { x0: 0.088, y0: 0.108, x1: 0.912, y1: 0.468 }, user, {
        zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate, radius: 6
      })
    ];
    const s = ov.scale;
    const family = ov.font || 'sans';
    const put = (text, { x, y, size, weight = 700, fill = '#222222', align = 'start', width = 400, height = 60, italic = false }) => {
      const layer = textLayer({
        text, width, height, family, weight, maxFont: Math.round(size * s), minFont: 8,
        maxLines: 2, fill: ov.fill && fill === '#222222' ? ov.fill : fill, align,
        autoFit: false, fontSize: Math.round(size * s)
      });
      if (italic) return { input: layer.svg, left: x, top: y };
      return { input: layer.svg, left: x, top: y };
    };

    layers.push(put(name, { x: Math.round(W * 0.205), y: Math.round(H * 0.043), size: 36, width: Math.round(W * 0.55), height: 54, align: 'start' }));
    layers.push(put(hp, { x: Math.round(W * 0.80), y: Math.round(H * 0.046), size: 29, fill: '#c0392b', width: Math.round(W * 0.1), height: 46, align: 'end' }));
    layers.push(put(type, { x: Math.round(W * 0.105), y: Math.round(H * 0.498), size: 22, weight: 400, fill: '#4a4a4a', width: Math.round(W * 0.6), height: 34 }));
    layers.push(put(attack, { x: Math.round(W * 0.105), y: Math.round(H * 0.585), size: 38, width: Math.round(W * 0.62), height: 54 }));
    layers.push(put(damage, { x: Math.round(W * 0.72), y: Math.round(H * 0.585), size: 38, width: Math.round(W * 0.18), height: 54, align: 'end' }));

    const descLayer = textLayer({
      text: description, width: Math.round(W * 0.79), height: Math.round(H * 0.13), family,
      weight: 400, maxFont: Math.round(26 * s), minFont: 10, maxLines: 5, lineHeight: 1.3,
      fill: '#333333', align: 'start'
    });
    layers.push({ input: descLayer.svg, left: Math.round(W * 0.105), top: Math.round(H * 0.652) });
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= SHIP / FRIENDSHIP =======================
  async _meter(q, kind) {
    const ov = styleOf(q);
    const isShip = kind === 'ship';
    const W = 1200, H = 512;
    const name1 = String(q.name1 || 'Velirius').slice(0, 20);
    const name2 = String(q.name2 || 'dls').slice(0, 20);
    const pct = parsePercent(q.percentage ?? q.percent ?? q.rank);
    const phrase = String(q.text || 'Best Friends').slice(0, 26);
    const accent = ov.fill || (isShip ? '#ff2d55' : '#00e05a');
    const title = isShip ? 'Medidor de compatibilidad' : 'Medidor de amistad';
    const bg = ov.bg || '#23272e';
    const img1 = await loadImageBuffer(imgParam(q, 'image1', 'url1', 'image', 'url'), 'avatar1.jpg');
    const img2 = await loadImageBuffer(imgParam(q, 'image2', 'url2'), 'avatar2.jpg');
    const S = Math.round(295 * Math.min(ov.zoom, 1.6));
    const piece1 = isShip ? await heartImage(img1, S, S * 0.92) : await circleImage(img1, S);
    const piece2 = isShip ? await heartImage(img2, S, S * 0.92) : await circleImage(img2, S);
    const heart = `<path d="M600 118 C586 96 552 92 544 114 C536 133 553 152 600 177 C647 152 664 133 656 114 C648 92 614 96 600 118Z" fill="${isShip ? accent : '#ff2d55'}"/>`;
    const star = `<text x="${W / 2}" y="170" text-anchor="middle" font-family="sans-serif" font-size="58" fill="#ffc93c">★</text>`;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${bg}"/>` +
      `<text x="${W / 2}" y="50" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="28" fill="${isShip ? '#ff7a92' : '#2ee06d'}">~ ${title} ~</text>` +
      (isShip ? heart : star) +
      `</svg>`
    );
    const base = await svgPng(svg);
    const pctLayer = textLayer({
      text: `~${pct}%~`, width: 600, height: Math.round(70 * ov.scale), family: 'mono', weight: 700,
      maxFont: Math.round(42 * ov.scale), minFont: 12, maxLines: 1, fill: accent, align: 'middle'
    });
    const phraseLayer = textLayer({
      text: phrase, width: 700, height: Math.round(56 * ov.scale), family: 'mono', weight: 700,
      maxFont: Math.round(34 * ov.scale), minFont: 10, maxLines: 1, fill: accent, align: 'middle'
    });
    const name1Layer = textLayer({
      text: name1, width: 300, height: 42, family: 'sans', weight: 700, maxFont: 27, minFont: 10,
      maxLines: 1, fill: '#ffffff', align: 'middle'
    });
    const name2Layer = textLayer({
      text: name2, width: 300, height: 42, family: 'sans', weight: 700, maxFont: 27, minFont: 10,
      maxLines: 1, fill: '#ffffff', align: 'middle'
    });
    const layers = [
      { input: piece1, left: Math.round(300 - S / 2), top: 118 + Math.round((295 - S) / 2) },
      { input: piece2, left: Math.round(900 - S / 2), top: 118 + Math.round((295 - S) / 2) },
      { input: pctLayer.svg, left: 300, top: 196 },
      { input: phraseLayer.svg, left: 250, top: 262 },
      { input: name1Layer.svg, left: 150, top: 452 },
      { input: name2Layer.svg, left: 750, top: 452 }
    ];
    if (!isShip) {
      const thumb = await twemoji('1f44d');
      if (thumb) layers.push({ input: await sharp(thumb).resize(60, 60).png().toBuffer(), left: W / 2 - 30, top: 104 });
    }
    return sharp(base).composite(layers).png().toBuffer();
  },
  ship: q => GENERATORS._meter(q, 'ship'),
  friendship: q => GENERATORS._meter(q, 'friendship'),

  // ======================= GAY CARD =======================
  async gaycard(q) {
    const ov = styleOf(q);
    const W = 600, H = 450;
    const size = 178;
    const name = String(q.name || q.username || 'Velirius').slice(0, 22);
    const pct = parsePercent(q.rank ?? q.percentage ?? q.percent);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));

    // avatar: foto → arcoíris → recorte circular → aro blanco
    let avatar = await shapedImage(user, size, size, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
    const rainbowBands = ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'];
    const bandH = size / rainbowBands.length;
    const rainbow = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${rainbowBands.map((c, i) => `<rect y="${i * bandH}" width="${size}" height="${bandH + 1}" fill="${c}" fill-opacity="0.5"/>`).join('')}</svg>`
    );
    avatar = await sharp(avatar).composite([{ input: rainbow }]).png().toBuffer();
    const circleMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    avatar = await sharp(avatar).composite([{ input: circleMask, blend: 'dest-in' }]).png().toBuffer();
    const rim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="#ffffff" stroke-width="4"/></svg>`);
    avatar = await sharp(avatar).composite([{ input: rim }]).png().toBuffer();

    const title = textLayer({
      text: 'GAY PERCENTAGE', width: 540, height: 44, family: 'mono', weight: 700,
      maxFont: 32, minFont: 12, maxLines: 1, letterSpacing: 2,
      fill: 'url(#rw)', align: 'middle'
    });
    const nameLayer = textLayer({
      text: name, width: 480, height: 46, family: 'serif', weight: 700, maxFont: 31, minFont: 10,
      maxLines: 1, fill: ov.fill || '#ffffff', align: 'middle'
    });
    const pctLayer = textLayer({
      text: `~ ${pct}% ~`, width: 170, height: 44, family: 'sans', weight: 700,
      maxFont: Math.round(30 * ov.scale), minFont: 10, maxLines: 1, fill: '#ff2d78', align: 'middle'
    });
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<defs><linearGradient id="rw" x1="0" y1="0" x2="1" y2="0">${rainbowBands.map((c, i) => `<stop offset="${(i / (rainbowBands.length - 1)) * 100}%" stop-color="${c}"/>`).join('')}</linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="${ov.bg || '#141414'}"/>` +
      `<polygon points="0,0 190,0 0,150" fill="#000000"/><polygon points="${W},${H} ${W - 190},${H} ${W},${H - 150}" fill="#000000"/>` +
      `<circle cx="${W / 2}" cy="196" r="94" fill="none" stroke="#ffffff" stroke-width="3"/>` +
      `<rect x="${W / 2 - 92}" y="356" width="184" height="52" rx="26" fill="#ffffff"/>` +
      `</svg>`
    );
    const base = await svgPng(svg);
    return sharp(base)
      .composite([
        { input: avatar, left: W / 2 - size / 2, top: 196 - size / 2 },
        { input: title.svg, left: W / 2 - 270, top: 24 },
        { input: nameLayer.svg, left: W / 2 - 240, top: 314 },
        { input: pctLayer.svg, left: W / 2 - 85, top: 360 }
      ])
      .png().toBuffer();
  },

  // ======================= FILTROS =======================
  async gay(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = sharp(user).rotate();
    if (ov.grayscale) base.grayscale();
    const meta = await base.metadata();
    const W = Math.min(meta.width || 512, 1024);
    const resized = await base.resize(W, null, { kernel: 'lanczos3' }).png().toBuffer();
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

  // ======================= PERSONAJES =======================
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

module.exports = {
  generateCanvas, GENERATORS, CANVAS_IDS, styleOf, txt,
  placeTextArea, placeImageArea, chromaInsert, faceCanvas, innerShade, expandLayer
};
