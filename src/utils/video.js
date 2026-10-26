// src/utils/video.js — Canvas en video: bratvideo (MP4) y attp (WebM sticker).
// El texto de cada frame se dibuja en vectores (textEngine) para que no dependa de
// las fuentes del sistema del host.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { sharp } = require('./image');
const { textLayer } = require('./textEngine');

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

async function bratFrame(textSoFar, opts = {}) {
  const S = 512;
  const scale = clampScale(opts.size);
  const layer = textLayer({
    text: textSoFar.toLowerCase(),
    width: S,
    height: S,
    family: opts.font || 'sans',
    weight: 400,
    maxFont: Math.round(78 * scale),
    minFont: 12,
    maxLines: 8,
    lineHeight: 1.12,
    letterSpacing: -0.5,
    fill: opts.color || '#000000',
    align: 'start',
    padding: 30
  });
  const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
  return sharp({ create: { width: S, height: S, channels: 4, background: opts.bg || '#ffffff' } })
    .composite([{ input: blurred }])
    .png()
    .toBuffer();
}

async function bratVideo(text, opts = {}) {
  const clean = String(text || 'Welcome to Velirius API').trim().slice(0, 90);
  const key = `bratvideo:${clean}:${opts.size || 1}:${opts.bg || ''}:${opts.color || ''}:${opts.font || ''}`;
  if (cache.has(key)) return cache.get(key);
  const words = clean.split(/\s+/).filter(Boolean);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velirius-brat-'));
  try {
    for (let i = 0; i < words.length; i++) {
      const frame = await bratFrame(words.slice(0, i + 1).join(' '), opts);
      fs.writeFileSync(path.join(dir, `f-${String(i).padStart(3, '0')}.png`), frame);
    }
    const out = path.join(dir, 'out.mp4');
    await runFfmpeg([
      '-y', '-framerate', '2.2', '-i', path.join(dir, 'f-%03d.png'),
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
