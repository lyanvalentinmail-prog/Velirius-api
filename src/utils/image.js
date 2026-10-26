// src/utils/image.js — Utilidades de imagen (sharp + SVG) para los Canvas
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { fetchBuffer } = require('./http');

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(ROOT, 'assets', 'templates');
const DEFAULTS_DIR = path.join(ROOT, 'assets', 'defaults');

const imageCache = new Map();
const MAX_CACHE = 30;

function escapeXml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapText(text, maxChars = 18, maxLines = 4) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const w of words) {
    const word = w.length > maxChars ? w.slice(0, maxChars) : w;
    const test = line ? `${line} ${word}` : word;
    if (test.length <= maxChars) line = test;
    else { if (line) lines.push(line); line = word; if (lines.length >= maxLines) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  if (words.join(' ').length > lines.join(' ').length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/…?$/, '…');
  }
  return lines;
}

async function loadImageBuffer(url, fallbackFile = 'avatar1.jpg') {
  const raw = String(url || '').trim();
  if (!raw) return fs.readFileSync(path.join(DEFAULTS_DIR, fallbackFile));
  if (raw.startsWith('data:')) {
    const b64 = raw.split(',')[1] || '';
    return Buffer.from(b64, 'base64');
  }
  if (!/^https?:\/\//i.test(raw)) return fs.readFileSync(path.join(DEFAULTS_DIR, fallbackFile));
  if (imageCache.has(raw)) return imageCache.get(raw);
  const buf = await fetchBuffer(raw, { timeoutMs: 15000, maxBytes: 15 * 1024 * 1024 });
  imageCache.set(raw, buf);
  while (imageCache.size > MAX_CACHE) imageCache.delete(imageCache.keys().next().value);
  return buf;
}

function templateBuffer(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name));
}

async function templateMeta(name) {
  const buf = templateBuffer(name);
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

/** SVG de texto centrado multilinea. Devuelve buffer SVG listo para composite/raster. */
function textSvg({ width, height, lines, fontSize = 48, fill = '#111111', fontFamily = 'DejaVu Sans, Arial, sans-serif', fontWeight = '700', lineHeight = 1.15, anchor = 'middle', x = null, startY = null, stroke = null, strokeWidth = 0, letterSpacing = 0, uppercase = false }) {
  const cx = x === null ? width / 2 : x;
  const totalH = lines.length * fontSize * lineHeight;
  const y0 = startY === null ? (height - totalH) / 2 + fontSize * 0.85 : startY;
  const tspans = lines.map((ln, i) =>
    `<text x="${cx}" y="${Math.round(y0 + i * fontSize * lineHeight)}" text-anchor="${anchor}" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fontSize}" letter-spacing="${letterSpacing}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke"` : ''}>${escapeXml(uppercase ? String(ln).toUpperCase() : ln)}</text>`
  ).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${tspans}</svg>`);
}

function svgBuffer(svg) { return Buffer.from(svg); }

async function svgToPng(svgBuf, width) {
  let pipe = sharp(svgBuf);
  if (width) pipe = pipe.resize(width);
  return pipe.png().toBuffer();
}

/** Imagen de usuario recortada cover a w×h (PNG). Opciones: circle, radius, rotate, grayscale, negate. */
async function shapedImage(userBuf, w, h, { circle = false, radius = 0, rotate = 0, grayscale = false, zoom = 1 } = {}) {
  let img = sharp(userBuf).rotate();
  if (grayscale) img = img.grayscale();
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const z = Math.max(0.2, Math.min(4, Number(zoom) || 1));
  if (rotate) img = sharp(await img.png().toBuffer()).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  let resized = await img.resize(Math.max(2, Math.round(W * z)), Math.max(2, Math.round(H * z)), { fit: 'cover', position: 'centre' }).png().toBuffer();
  if (Math.abs(z - 1) > 0.001) {
    const meta = await sharp(resized).metadata();
    const cw = Math.min(W, meta.width), ch = Math.min(H, meta.height);
    resized = await sharp(resized)
      .extract({ left: Math.round((meta.width - cw) / 2), top: Math.round((meta.height - ch) / 2), width: cw, height: ch })
      .png().toBuffer();
  }
  if (circle || radius > 0) {
    const meta = await sharp(resized).metadata();
    const W = meta.width, H = meta.height;
    const rx = circle ? Math.min(W, H) / 2 : radius;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" rx="${rx}" ry="${rx}" fill="#fff"/></svg>`);
    resized = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  return resized;
}

async function circleImage(userBuf, size) {
  return shapedImage(userBuf, size, size, { circle: true });
}

async function heartImage(userBuf, w, h) {
  const resized = await sharp(userBuf).rotate().resize(Math.round(w), Math.round(h), { fit: 'cover' }).png().toBuffer();
  const heart = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 100 92"><path d="M50 86 C20 62 4 44 4 28 C4 13 15 4 27 4 C37 4 46 10 50 19 C54 10 63 4 73 4 C85 4 96 13 96 28 C96 44 80 62 50 86Z" fill="#fff"/></svg>`
  );
  return sharp(resized).composite([{ input: heart, blend: 'dest-in' }]).png().toBuffer();
}

/** Texto ajustado a un área: reduce fuente hasta que entran las líneas (sin cortar palabras). */
function fitTextLines(text, areaW, areaH, { maxFont = 64, minFont = 16, maxLines = 5, charWidthRatio = 0.58 } = {}) {
  const longestWord = String(text || '').split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  let font = maxFont;
  while (font > minFont) {
    const maxChars = Math.max(4, Math.floor(areaW / (font * charWidthRatio)));
    if (maxChars < longestWord) { font -= 4; continue; }
    const lines = wrapText(text, maxChars, maxLines + 2);
    if (lines.length <= maxLines && lines.length * font * 1.18 <= areaH) return { lines, fontSize: font };
    font -= 4;
  }
  const maxChars = Math.max(4, Math.floor(areaW / (minFont * charWidthRatio)));
  return { lines: wrapText(text, maxChars, maxLines), fontSize: minFont };
}

function hexToRgb(hex, fallback = '#ffffff') {
  let h = String(hex || fallback).replace('#', '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = String(fallback).replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

module.exports = {
  sharp, escapeXml, wrapText, loadImageBuffer, templateBuffer, templateMeta,
  textSvg, svgBuffer, svgToPng, shapedImage, circleImage, heartImage, fitTextLines, hexToRgb,
  TEMPLATES_DIR, DEFAULTS_DIR
};
