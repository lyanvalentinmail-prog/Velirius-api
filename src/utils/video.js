// src/utils/video.js — Canvas en video: bratvideo (MP4) y attp (WebM sticker)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { sharp, escapeXml, wrapText, svgToPng } = require('./image');

function ffmpegPath() {
  try { return require('@ffmpeg-installer/ffmpeg').path; } catch (_) { return 'ffmpeg'; }
}

function runFfmpeg(args, timeoutMs = 40000) {
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

async function bratFrame(textSoFar, opts = {}) {
  const S = 512;
  const scale = Math.max(0.3, Math.min(2.5, Number(opts.size) || 1));
  const bg = opts.bg || '#ffffff';
  const fill = opts.color || '#000000';
  const lines = wrapText(textSoFar.toLowerCase(), Math.max(6, Math.round(12 / scale)), 6);
  const fontSize = Math.round(62 * scale);
  const totalH = lines.length * fontSize * 1.12;
  const startY = (S - totalH) / 2 + fontSize * 0.9;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${bg}"/>` +
    lines.map((ln, i) => `<text x="36" y="${Math.round(startY + i * fontSize * 1.12)}" font-family="DejaVu Sans, Arial" font-size="${fontSize}" fill="${fill}">${escapeXml(ln)}</text>`).join('') +
    `</svg>`
  );
  const png = await svgToPng(svg);
  return sharp(png).blur(0.6).png().toBuffer();
}

async function bratVideo(text, opts = {}) {
  const clean = String(text || 'Welcome to Velirius API').trim().slice(0, 90);
  const key = `bratvideo:${clean}:${opts.size || 1}:${opts.bg || ''}:${opts.color || ''}`;
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
    // Congela el último frame ~0.8s agregando copias si hay pocas palabras: el loop de entrada ya dura words/2.2s
    return cached(key, fs.readFileSync(out));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const ATTP_COLORS = ['#ff004d', '#ff8a00', '#ffe600', '#00e05a', '#00c2ff', '#8a2be2', '#ff5da2', '#ffffff'];
async function attpFrame(text, color, dx, opts = {}) {
  const S = 512;
  const scale = Math.max(0.3, Math.min(2.5, Number(opts.size) || 1));
  const lines = wrapText(text, Math.max(4, Math.round(9 / scale)), 4);
  const fontSize = Math.round(78 * scale);
  const totalH = lines.length * fontSize * 1.15;
  const startY = (S - totalH) / 2 + fontSize * 0.9;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">` +
    lines.map((ln, i) => `<text x="${S / 2 + dx}" y="${Math.round(startY + i * fontSize * 1.15)}" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="900" font-size="${fontSize}" fill="${color}" stroke="#000000" stroke-width="7" paint-order="stroke">${escapeXml(ln)}</text>`).join('') +
    `</svg>`
  );
  return svgToPng(svg);
}

async function attpVideo(text, opts = {}) {
  const clean = String(text || 'Welcome to Velirius').trim().slice(0, 60);
  const key = `attp:${clean}:${opts.size || 1}`;
  if (cache.has(key)) return cache.get(key);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velirius-attp-'));
  try {
    const frames = 16;
    for (let i = 0; i < frames; i++) {
      const frame = await attpFrame(clean, ATTP_COLORS[i % ATTP_COLORS.length], i % 2 === 0 ? -3 : 3, opts);
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

module.exports = { bratVideo, attpVideo };
