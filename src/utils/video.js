// src/utils/video.js — Canvas en video: bratvideo (MP4) y attp (WebM sticker).
// El texto de cada frame se dibuja en vectores (textEngine) para que no dependa de
// las fuentes del sistema del host. La tipografía sale de src/canvas/layouts.js
// (la misma que usa /canvas/brat), así el video y la imagen se ven iguales.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { sharp } = require('./image');
const { textLayer, wrapLines, fitText } = require('./textEngine');
const L = require('../canvas/layouts');

function ffmpegPath() {
  try { return require('@ffmpeg-installer/ffmpeg').path; } catch (_) { return 'ffmpeg'; }
}

function runFfmpeg(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), args, { timeout: timeoutMs }, (err, _out, stderr) => {
      if (err) return reject(new Error(`ffmpeg: ${String(stderr || err.message).slice(-300)}`));
      resolve();
    });
  });
}

const cache = new Map();
function cached(key, buf) {
  cache.set(key, buf);
  while (cache.size > 12) cache.delete(cache.keys().next().value);
  return buf;
}

const clampScale = v => Math.max(0.3, Math.min(2.5, Number(v) || 1));

/** Acepta '8ACE00', '#8ACE00', 'white'… y devuelve algo que sharp entienda. */
function asColor(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  if (/^[0-9a-f]{3,8}$/i.test(s)) return `#${s}`;
  return s;
}

// ======================= BRAT (imagen y video) =======================
// Cuántas palabras entran como máximo en una pantalla del video.
const BRAT_WORDS_PER_PAGE = 5;
// Cuántos frames se queda quieta la página completa antes de pasar a la otra.
const BRAT_HOLD_FRAMES = 2;

/** Tipografía del brat: layouts.js + overrides de la query. */
function bratSpec(opts = {}) {
  const parts = L.get('brat').parts;
  const S = Math.round(Math.max(200, Math.min(2000, Number(opts.canvasSize) || parts.canvas.width)));
  const pad = Math.round((opts.pad ?? parts.text.pad ?? 0.06) * S);
  return {
    S,
    pad,
    box: parts.text.box,
    bg: asColor(opts.bg) || parts.canvas.bg,
    fill: asColor(opts.color) || parts.text.fill,
    family: opts.font || parts.text.font.family,
    weight: opts.weight || parts.text.font.weight,
    lineHeight: parts.text.font.lineHeight,
    maxFont: Math.round(parts.text.font.maxFont * clampScale(opts.size)),
    spacing: parts.text.font.spacing + (Number(opts.spacing) || 0),
    uppercase: Boolean(opts.uppercase),
    align: parts.text.font.align || 'start'
  };
}

function grainSvg(S) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<rect width="${S}" height="${S}" filter="url(#n)" opacity="0.035"/></svg>`
  );
}

/** Un frame del sticker brat con un tamaño de letra FIJO (no baila entre frames). */
async function bratFrame(text, opts = {}, size = null) {
  const spec = opts.spec || bratSpec(opts);
  const { S, pad } = spec;
  const font = size || fitText(String(text), {
    width: S - pad * 2, height: S - pad * 2, maxFont: spec.maxFont, minFont: 12,
    maxLines: 8, lineHeight: spec.lineHeight, letterSpacing: spec.spacing,
    family: spec.family, weight: spec.weight
  }).fontSize;

  const body = spec.uppercase ? String(text).toUpperCase() : String(text).toLowerCase();
  const lines = wrapLines(body, S - pad * 2, {
    family: spec.family, weight: spec.weight, size: font,
    letterSpacing: spec.spacing, maxLines: 8
  });
  const layer = textLayer({
    text: lines.join('\n'),
    width: S,
    height: S,
    family: spec.family,
    weight: spec.weight,
    fontSize: font,
    autoFit: false,
    maxLines: lines.length,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.spacing,
    fill: spec.fill,
    align: spec.align,
    padding: pad
  });
  const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
  const flat = await sharp({ create: { width: S, height: S, channels: 4, background: spec.bg } })
    .composite([{ input: blurred }])
    .png()
    .toBuffer();
  return sharp(flat).composite([{ input: grainSvg(S) }]).png().toBuffer();
}

/**
 * bratvideo: las palabras aparecen de a una, pero en pantalla nunca hay más de
 * `words` (5 por defecto). Cuando la página se llena, se queda quieta un toque y
 * en la siguiente aparecen las palabras que siguen.
 */
async function bratVideo(text, opts = {}) {
  const perPage = Math.max(1, Math.min(8, Math.round(Number(opts.words) || BRAT_WORDS_PER_PAGE)));
  const clean = String(text || 'Welcome to Velirius API').trim().slice(0, 200);
  const spec = bratSpec(opts);
  const words = clean.split(/\s+/).filter(Boolean).slice(0, perPage * 8);
  if (!words.length) words.push('brat');

  const key = `bratvideo:${clean}:${perPage}:${spec.S}:${opts.size || 1}:${spec.bg}:${spec.fill}:${spec.family}:${spec.weight}:${spec.uppercase}`;
  if (cache.has(key)) return cache.get(key);

  // ---- páginas: máximo `perPage` palabras cada una ----
  const pages = [];
  for (let i = 0; i < words.length; i += perPage) pages.push(words.slice(i, i + perPage));

  // ---- un solo tamaño de letra para todo el video ----
  // El que entra en la página más pesada (la más larga en ancho/alto). Como una
  // página tiene como máximo `perPage` palabras, acá el texto puede ir más grande
  // que en el sticker fijo: así llena el lienzo como el bratvideo original.
  let size = Math.round(spec.maxFont * 1.5);
  for (const page of pages) {
    const fitted = fitText(page.join(' '), {
      width: spec.S - spec.pad * 2,
      height: spec.S - spec.pad * 2,
      maxFont: size,
      minFont: 12,
      maxLines: 3,
      lineHeight: spec.lineHeight,
      letterSpacing: spec.spacing,
      family: spec.family,
      weight: spec.weight
    });
    size = Math.min(size, fitted.fontSize);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velirius-brat-'));
  try {
    let n = 0;
    for (const page of pages) {
      // las palabras de la página aparecen de a una
      for (let i = 1; i <= page.length; i++) {
        const frame = await bratFrame(page.slice(0, i).join(' '), { ...opts, spec }, size);
        fs.writeFileSync(path.join(dir, `f-${String(n++).padStart(3, '0')}.png`), frame);
      }
      // pausa con la página completa antes de pasar a la siguiente
      for (let h = 0; h < BRAT_HOLD_FRAMES; h++) {
        const frame = await bratFrame(page.join(' '), { ...opts, spec }, size);
        fs.writeFileSync(path.join(dir, `f-${String(n++).padStart(3, '0')}.png`), frame);
      }
    }
    const out = path.join(dir, 'out.mp4');
    await runFfmpeg([
      '-y', '-framerate', '2.4', '-i', path.join(dir, 'f-%03d.png'),
      '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
      '-movflags', '+faststart', out
    ]);
    return cached(key, fs.readFileSync(out));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const ATTP_COLORS = ['#ff004d', '#ff8a00', '#ffe600', '#00e05a', '#00c2ff', '#8a2be2', '#ff5da2', '#ffffff'];

async function attpFrame(text, color, dx, opts = {}) {
  const S = 512;
  const scale = clampScale(opts.size);
  const layer = textLayer({
    text,
    width: S,
    height: S,
    family: opts.font || 'sans',
    weight: 800,
    maxFont: Math.round(84 * scale),
    minFont: 14,
    maxLines: 4,
    lineHeight: 1.15,
    letterSpacing: 1,
    fill: color,
    align: 'middle',
    padding: 22,
    offsetX: dx,
    stroke: '#000000',
    strokeWidth: Math.max(5, 8 * scale)
  });
  return sharp(layer.svg).png().toBuffer();
}

async function attpVideo(text, opts = {}) {
  const clean = String(text || 'Welcome to Velirius').trim().slice(0, 60);
  const key = `attp:${clean}:${opts.size || 1}`;
  if (cache.has(key)) return cache.get(key);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velirius-attp-'));
  try {
    const frames = 16;
    for (let i = 0; i < frames; i++) {
      const frame = await attpFrame(clean, ATTP_COLORS[i % ATTP_COLORS.length], i % 2 === 0 ? -4 : 4, opts);
      fs.writeFileSync(path.join(dir, `f-${String(i).padStart(3, '0')}.png`), frame);
    }
    const out = path.join(dir, 'out.webm');
    await runFfmpeg([
      '-y', '-stream_loop', '2', '-framerate', '10', '-i', path.join(dir, 'f-%03d.png'),
      '-t', '3.2', '-vf', 'fps=20', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
      '-b:v', '600k', '-auto-alt-ref', '0', out
    ]);
    return cached(key, fs.readFileSync(out));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Endpoints de video: no viven en src/canvas/generators (son MP4/WebM animados)
// sino acá. `scripts/validate-catalog.js` los usa para cuadrar el catálogo.
const VIDEO_IDS = ['bratvideo', 'attp'];

module.exports = { bratVideo, attpVideo, bratFrame, attpFrame, VIDEO_IDS };
