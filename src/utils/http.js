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

/**
 * Igual que `firstSuccess` pero **en paralelo**: dispara todos los productores a
 * la vez y devuelve el primero que responda. Sirve para no comerse el límite de
 * tiempo de Vercel (10 s) cuando la primera fuente está caída o lenta: antes se
 * probaban una por una y una fuente muerta (12-15 s) tumbaba la petición entera.
 *
 * `timeoutMs` es el presupuesto TOTAL: si nadie contestó en ese tiempo, corta.
 */
function firstFast(producers, { timeoutMs = 7000 } = {}) {
  const lista = (producers || []).filter(p => p && typeof p[1] === 'function');
  const errors = [];
  const fallo = (extra) => {
    const err = new Error('Ninguna fuente pública respondió a tiempo. Intenta de nuevo en unos segundos.');
    err.details = extra ? errors.concat(extra) : errors.slice();
    return err;
  };
  if (!lista.length) return Promise.reject(fallo('sin proveedores'));
  return new Promise((resolve, reject) => {
    let resuelto = false;
    let pendientes = lista.length;
    const timer = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      reject(fallo(`tiempo agotado (${timeoutMs} ms)`));
    }, timeoutMs);
    const terminar = (fn, arg) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timer);
      fn(arg);
    };
    const restar = () => {
      pendientes -= 1;
      if (pendientes <= 0 && !resuelto) terminar(reject, fallo());
    };
    for (const [label, fn] of lista) {
      Promise.resolve()
        .then(fn)
        .then(valor => {
          if (valor === null || valor === undefined) {
            errors.push(`${label}: sin datos`);
            return restar();
          }
          terminar(resolve, { value: valor, source: label, errors });
        })
        .catch(e => {
          errors.push(`${label}: ${(e && e.message) || e}`);
          restar();
        });
    }
  });
}

function absoluteUrl(req, path) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
  return `${proto}://${host}${path}`;
}

module.exports = { UA_DESKTOP, UA_MOBILE, fetchWithTimeout, fetchJson, postJson, fetchText, fetchBuffer, firstSuccess, firstFast, absoluteUrl };
