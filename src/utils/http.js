// src/utils/http.js — Cliente HTTP con timeout para APIs públicas sin token
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MOBILE =
  'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, { headers = {}, timeoutMs = 15000, method = 'GET', body } = {}) {
  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers: { 'User-Agent': UA_DESKTOP, Accept: 'application/json, text/plain, */*', ...headers },
      body
    },
    timeoutMs
  );
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* no-json */ }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} en ${new URL(url).hostname}`);
    err.status = res.status; err.body = text.slice(0, 400); err.json = json;
    throw err;
  }
  if (json === null) throw new Error(`Respuesta no-JSON de ${new URL(url).hostname}`);
  return json;
}

async function postJson(url, data, { headers = {}, timeoutMs = 15000 } = {}) {
  return fetchJson(url, {
    method: 'POST',
    timeoutMs,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  });
}

async function fetchText(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA_DESKTOP, ...headers } }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP ${res.status} en ${new URL(url).hostname}`); e.status = res.status; throw e; }
  return res.text();
}

async function fetchBuffer(url, { headers = {}, timeoutMs = 20000, maxBytes = 25 * 1024 * 1024 } = {}) {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA_DESKTOP, ...headers } }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP ${res.status} al descargar ${new URL(url).hostname}`); e.status = res.status; throw e; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('El archivo remoto supera el tamaño máximo (25 MB)');
  return buf;
}

/** Ejecuta productores en orden hasta que uno responda; acumula errores. */
async function firstSuccess(producers) {
  const errors = [];
  for (const [label, fn] of producers) {
    try {
      const value = await fn();
      if (value !== null && value !== undefined) return { value, source: label, errors };
      errors.push(`${label}: sin datos`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
    }
  }
  const err = new Error('Ninguna fuente pública respondió. Intenta de nuevo en unos segundos.');
  err.details = errors;
  throw err;
}

function absoluteUrl(req, path) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
  return `${proto}://${host}${path}`;
}

module.exports = { UA_DESKTOP, UA_MOBILE, fetchWithTimeout, fetchJson, postJson, fetchText, fetchBuffer, firstSuccess, absoluteUrl };
