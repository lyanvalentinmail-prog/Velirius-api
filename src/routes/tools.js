// src/routes/tools.js — TOOLS: Calculator · Translator · Morse
const express = require('express');
const P = require('../utils/providers');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

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

module.exports = router;
module.exports.calculate = calculate;
module.exports.morseEncode = morseEncode;
module.exports.morseDecode = morseDecode;
