// src/routes/tools.js — TOOLS: Calculator · Translator · Morse · TextToSpeech · SpeechToText · Rezize
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError, sendMedia, wantsDownload } = require('../utils/response');
const { textoAVoz, vozATexto, proveedoresSTT } = require('../utils/audio');
const { loadImageBuffer } = require('../utils/image');
const { fetchBuffer, absoluteUrl, UA_DESKTOP } = require('../utils/http');
const sharp = require('sharp');

const router = express.Router();
// El audio para transcribir llega en el cuerpo (data: o base64), así que el
// límite es el mismo que usa /canvas con las fotos de la galería.
const jsonBody = express.json({ limit: '24mb' });

const directo = req => ['true', '1', 'yes', 'si', 'sí'].includes(String(req.query.direct || '').toLowerCase()) || wantsDownload(req);
const slug = s => String(s || 'velirius').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'velirius';

// ==========================================================================
// Calculator — parser seguro (sin eval)
// ==========================================================================
const FUNCS = {
  sqrt: x => Math.sqrt(x), cbrt: x => Math.cbrt(x),
  sin: x => Math.sin(x), cos: x => Math.cos(x), tan: x => Math.tan(x),
  asin: x => Math.asin(x), acos: x => Math.acos(x), atan: x => Math.atan(x),
  ln: x => Math.log(x), log: x => Math.log10(x), log2: x => Math.log2(x),
  abs: x => Math.abs(x), round: x => Math.round(x), floor: x => Math.floor(x), ceil: x => Math.ceil(x),
  exp: x => Math.exp(x), sign: x => Math.sign(x), fact: x => {
    const n = Math.floor(x);
    if (n < 0 || n > 170) throw new Error('fact() admite enteros entre 0 y 170');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

function calculate(input, degrees = false) {
  const src = String(input || '')
    .replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi')
    .trim().toLowerCase();
  if (!src) throw new Error('Expresión vacía');
  if (src.length > 200) throw new Error('Expresión demasiado larga');
  let pos = 0;
  const skip = () => { while (src[pos] === ' ') pos++; };
  const eat = ch => { if (src[pos] === ch) { pos++; return true; } return false; };

  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      skip();
      if (eat('+')) v += parseTerm();
      else if (eat('-')) v -= parseTerm();
      else return v;
    }
  }
  function parseTerm() {
    let v = parseFactor();
    for (;;) {
      skip();
      if (eat('*')) v *= parseFactor();
      else if (eat('/')) {
        const d = parseFactor();
        if (d === 0) throw new Error('División por cero');
        v /= d;
      } else if (eat('%')) {
        const d = parseFactor();
        if (d === 0) throw new Error('Módulo por cero');
        v %= d;
      } else return v;
    }
  }
  function parseFactor() {
    let base = parseUnary();
    skip();
    if (eat('^')) base = Math.pow(base, parseFactor());
    return base;
  }
  function parseUnary() {
    skip();
    if (eat('+')) return parseUnary();
    if (eat('-')) return -parseUnary();
    return parsePrimary();
  }
  function parsePrimary() {
    skip();
    if (eat('(')) {
      const v = parseExpr();
      skip();
      if (!eat(')')) throw new Error('Falta el paréntesis de cierre');
      return v;
    }
    const numMatch = /^[0-9]*\.?[0-9]+/.exec(src.slice(pos));
    if (numMatch) { pos += numMatch[0].length; return parseFloat(numMatch[0]); }
    const nameMatch = /^[a-z][a-z0-9]*/.exec(src.slice(pos));
    if (nameMatch) {
      const name = nameMatch[0];
      pos += name.length;
      if (name in CONSTS) return CONSTS[name];
      if (name in FUNCS) {
        skip();
        if (!eat('(')) throw new Error(`La función ${name}() requiere paréntesis`);
        let arg = parseExpr();
        skip();
        if (!eat(')')) throw new Error('Falta el paréntesis de cierre');
        if (degrees && ['sin', 'cos', 'tan'].includes(name)) arg = arg * Math.PI / 180;
        let out = FUNCS[name](arg);
        if (degrees && ['asin', 'acos', 'atan'].includes(name)) out = out * 180 / Math.PI;
        return out;
      }
      throw new Error(`Nombre no reconocido: ${name}`);
    }
    throw new Error(`Carácter inesperado: "${src[pos] ?? 'fin de la expresión'}"`);
  }

  const value = parseExpr();
  skip();
  if (pos < src.length) throw new Error(`Sobran caracteres: "${src.slice(pos)}"`);
  if (!Number.isFinite(value)) throw new Error('El resultado no es finito');
  return Math.round(value * 1e12) / 1e12;
}

router.get(['/calculator', '/calc', '/calculadora'], (req, res) => {
  const expr = req.query.expr || req.query.q || req.query.text || req.query.query;
  if (!expr) return sendError(res, 400, 'Falta el parámetro expr', 'Ejemplo: /tools/calculator?expr=(2+3)*4^2');
  try {
    const degrees = ['true', '1'].includes(String(req.query.degrees || req.query.deg || '').toLowerCase());
    const result = calculate(expr, degrees);
    return sendSuccess(res, { expression: String(expr), result, degrees });
  } catch (e) {
    return sendError(res, 400, `Expresión inválida: ${e.message}`, 'Usa + - * / % ^ ( ) sqrt() sin() cos() pi e…');
  }
});

// ==========================================================================
// Translator
// ==========================================================================
router.get(['/translator', '/translate', '/traductor'], async (req, res) => {
  const text = String(req.query.text || req.query.q || '').trim();
  if (!text) return sendError(res, 400, 'Falta el parámetro text', 'Ejemplo: /tools/translator?text=Hola&to=en');
  const to = String(req.query.to || req.query.language || req.query.lang || 'en').toLowerCase();
  const from = String(req.query.from || 'auto').toLowerCase();
  try {
    return sendSuccess(res, await P.translate(text.slice(0, 2000), to, from));
  } catch (e) {
    return sendError(res, 502, 'No se pudo traducir ahora mismo', e.details ? e.details.join(' · ') : e.message);
  }
});

// ==========================================================================
// Morse
// ==========================================================================
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.', '¿': '..-.-', '¡': '--...-'
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function morseEncode(text, separator = '/') {
  return String(text || '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.split('').map(ch => MORSE[ch] ?? '').filter(Boolean).join(' '))
    .filter(Boolean)
    .join(` ${separator} `);
}

function morseDecode(code) {
  return String(code || '')
    .replace(/[·•]/g, '.')
    .replace(/[–—_−]/g, '-')
    .replace(/\s*\/\s*/g, ' | ')
    .split(/\s*\|\s*|\s{3,}/)
    .map(word => word.trim().split(/\s+/).filter(Boolean).map(sym => MORSE_REVERSE[sym] ?? '').join(''))
    .filter(Boolean)
    .join(' ');
}

router.get(['/morse', '/morsecode'], (req, res) => {
  const input = String(req.query.text ?? req.query.q ?? req.query.code ?? req.query.query ?? '').trim();
  if (!input) return sendError(res, 400, 'Falta el parámetro text', 'Ejemplos: /tools/morse?text=SOS  ·  /tools/morse?text=...%20---%20...&mode=decode');
  const mode = String(req.query.mode || req.query.type || 'encode').toLowerCase();
  if (!['encode', 'decode', 'codificar', 'decodificar'].includes(mode)) {
    return sendError(res, 400, 'Modo inválido', 'Usa mode=encode o mode=decode');
  }
  const isDecode = mode === 'decode' || mode === 'decodificar';
  const separator = String(req.query.separator || '/').slice(0, 3) || '/';
  const output = isDecode ? morseDecode(input) : morseEncode(input, separator);
  if (!output) return sendError(res, 400, 'No se pudo procesar el texto', 'Usa letras A-Z, números 0-9 y signos comunes');
  return sendSuccess(res, {
    mode: isDecode ? 'decode' : 'encode',
    input,
    output,
    ...(isDecode ? {} : { separator })
  });
});

// ==========================================================================
// Rezize — cambia el alto y el ancho de una imagen
// ==========================================================================
const FITS = ['cover', 'contain', 'fill', 'inside', 'outside'];
const FORMATOS = ['png', 'jpg', 'jpeg', 'webp', 'avif'];

router.get(['/resize', '/rezize', '/redimensionar'], async (req, res) => {
  const entrada = String(req.query.url || req.query.image || req.query.img || '').trim();
  if (!entrada) {
    return sendError(res, 400, 'Falta el parámetro url',
      'Ejemplo: /tools/resize?url=https://…/foto.jpg&width=512&height=512');
  }
  const ancho = parseInt(req.query.width ?? req.query.w ?? req.query.ancho, 10);
  const alto = parseInt(req.query.height ?? req.query.h ?? req.query.alto, 10);
  const escala = parseFloat(req.query.scale ?? req.query.escala);
  const fit = FITS.includes(String(req.query.fit || '').toLowerCase()) ? String(req.query.fit).toLowerCase() : 'cover';
  const formato = FORMATOS.includes(String(req.query.format || '').toLowerCase()) ? String(req.query.format).toLowerCase() : 'png';
  const calidad = Math.max(1, Math.min(100, parseInt(req.query.quality ?? req.query.calidad, 10) || 90));
  const fondo = /^#?[0-9a-f]{3,8}$/i.test(String(req.query.bg || '')) ? `#${String(req.query.bg).replace(/^#/, '')}` : null;

  try {
    const original = await loadImageBuffer(entrada);
    const meta = await sharp(original).metadata();
    const baseW = meta.width || 0;
    const baseH = meta.height || 0;
    if (!baseW || !baseH) return sendError(res, 400, 'La imagen de entrada no se pudo leer', 'Probá con otra URL o subí la foto desde Galería');

    // Medidas finales: width/height > scale (%) > tamaño original.
    let outW = Number.isFinite(ancho) && ancho > 0 ? ancho : null;
    let outH = Number.isFinite(alto) && alto > 0 ? alto : null;
    if (!outW && !outH && Number.isFinite(escala) && escala > 0) {
      outW = Math.round(baseW * (escala / 100));
      outH = Math.round(baseH * (escala / 100));
    }
    if (!outW && !outH) {
      return sendError(res, 400, 'Falta width o height (o scale)',
        'Ejemplo: /tools/resize?url=…&width=512&height=512 · scale=50 = mitad de tamaño');
    }
    if (outW && !outH) outH = Math.round(baseH * (outW / baseW));
    if (outH && !outW) outW = Math.round(baseW * (outH / baseH));
    outW = Math.max(1, Math.min(4096, outW));
    outH = Math.max(1, Math.min(4096, outH));

    let pipe = sharp(original).rotate();
    if (fit === 'cover' && fondo) pipe = pipe.flatten({ background: fondo });
    pipe = pipe.resize(outW, outH, { fit, position: String(req.query.position || 'centre'), background: fondo || undefined, withoutEnlargement: false });
    if (formato === 'jpg' || formato === 'jpeg') pipe = pipe.flatten({ background: fondo || '#ffffff' }).jpeg({ quality: calidad });
    else if (formato === 'webp') pipe = pipe.webp({ quality: calidad });
    else if (formato === 'avif') pipe = pipe.avif({ quality: calidad });
    else pipe = pipe.png({ compressionLevel: 9 });

    const salida = await pipe.toBuffer();
    const mime = formato === 'jpg' || formato === 'jpeg' ? 'image/jpeg' : `image/${formato}`;
    const nombre = `velirius-${outW}x${outH}.${formato === 'jpeg' ? 'jpg' : formato}`;
    if (String(req.query.json || '') === 'true' || req.query.format === 'json') {
      const self = req.originalUrl.split('?')[0];
      const q = new URLSearchParams(req.query);
      q.set('direct', 'true');
      return sendSuccess(res, {
        width: outW, height: outH,
        original: { width: baseW, height: baseH },
        fit, format: formato, bytes: salida.length,
        image: absoluteUrl(req, `${self}?${q.toString()}`)
      });
    }
    return sendMedia(res, salida, mime, nombre);
  } catch (e) {
    const code = e.status && (e.status < 500 || e.status === 501) ? e.status : 502;
    return sendError(res, code, code === 502 ? 'No se pudo redimensionar la imagen' : e.message, e.hint || e.message);
  }
});

// ==========================================================================
// TextToSpeech — texto → MP3
// ==========================================================================
router.get(['/tts', '/texttospeech', '/speech', '/voz'], async (req, res) => {
  const texto = String(req.query.text ?? req.query.q ?? req.query.query ?? req.query.message ?? '').trim();
  if (!texto) {
    return sendError(res, 400, 'Falta el parámetro text',
      'Ejemplo: /tools/tts?text=Hola%20Velirius&lang=es · agregá &direct=true para el MP3');
  }
  if (texto.length > 3000) return sendError(res, 400, 'El texto es demasiado largo', 'Máximo 3000 caracteres por pedido');
  const lang = String(req.query.lang || req.query.language || req.query.idioma || 'es');
  try {
    const audio = await textoAVoz(texto, {
      lang,
      voice: req.query.voice ?? req.query.voz,
      engine: req.query.engine ?? req.query.motor,
      slow: ['true', '1'].includes(String(req.query.slow ?? req.query.lento ?? '').toLowerCase())
    });
    const self = req.originalUrl.split('?')[0];
    const q = new URLSearchParams(req.query);
    q.set('direct', 'true');
    const url = absoluteUrl(req, `${self}?${q.toString()}`);
    if (directo(req)) return sendMedia(res, audio.buffer, audio.mime, `velirius-${slug(texto).slice(0, 24)}.mp3`);
    return sendSuccess(res, {
      text: texto,
      lang: audio.lang || lang,
      engine: audio.engine,
      chunks: audio.chunks,
      mime: audio.mime,
      bytes: audio.buffer.length,
      audio: url,
      downloadUrl: absoluteUrl(req, `${self}?${q.toString()}&download=true`)
    });
  } catch (e) {
    const code = e.status && (e.status < 500 || e.status === 501) ? e.status : 502;
    return sendError(res, code, e.message, e.hint);
  }
});

// ==========================================================================
// SpeechToText — audio → texto (necesita una clave configurada)
// ==========================================================================
router.get(['/stt', '/speechtotext', '/transcribir'], jsonBody, async (req, res) => {
  const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
  const fuente = String(req.query.url || req.query.audio || req.query.file || cuerpo.url || cuerpo.audio || cuerpo.file || '').trim();
  const listos = proveedoresSTT();
  if (!fuente) {
    return sendError(res, 400, 'Falta el audio',
      'Pasá ?url=https://…/audio.mp3 o hacé POST con {"audio":"data:audio/mpeg;base64,…"}');
  }
  try {
    let buffer;
    let mime = String(req.query.mime || cuerpo.mime || 'audio/mpeg');
    if (/^data:/i.test(fuente)) {
      mime = fuente.slice(5, fuente.indexOf(';')) || mime;
      buffer = Buffer.from(fuente.split(',')[1] || '', 'base64');
    } else if (/^https?:/i.test(fuente)) {
      buffer = await fetchBuffer(fuente, {
        headers: { 'User-Agent': UA_DESKTOP },
        timeoutMs: 30000,
        maxBytes: 24 * 1024 * 1024
      });
      if (req.query.mime) mime = String(req.query.mime);
    } else {
      buffer = Buffer.from(fuente, 'base64');
    }
    if (!buffer || !buffer.length) return sendError(res, 400, 'El audio llegó vacío', 'Revisá el link o el archivo que mandaste');
    const salida = await vozATexto(buffer, { mime, language: req.query.lang || req.query.language || cuerpo.lang });
    return sendSuccess(res, {
      text: salida.text,
      empty: !salida.text,
      provider: salida.provider,
      mime,
      bytes: buffer.length,
      availableProviders: listos
    });
  } catch (e) {
    const code = e.status && (e.status < 500 || e.status === 501) ? e.status : 502;
    return sendError(res, code, e.message, e.hint);
  }
});

module.exports = router;
module.exports.calculate = calculate;
module.exports.morseEncode = morseEncode;
module.exports.morseDecode = morseDecode;
