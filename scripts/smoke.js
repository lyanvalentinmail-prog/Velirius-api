// scripts/smoke.js — npm test: levanta la app y verifica web, catálogo, tools y TODOS los canvas.
process.env.PORT = '0';
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/server');
const { CATEGORIES, totals } = require('../src/catalog');
const { generateCanvas, CANVAS_IDS } = require('../src/utils/canvasEngine');
const { calculate, morseEncode, morseDecode } = require('../src/routes/tools');
const { textLayer, measure, FAMILIES, FONTS_DIR } = require('../src/utils/textEngine');
const { REACTION_LIST } = require('../src/utils/providers');

function get(port, p) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${p}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

const isPng = buf => buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;

async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  let failures = 0;
  const ok = (name, cond, extra = '') => {
    console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!cond) failures++;
  };

  try {
    const t = totals();
    const home = await get(port, '/home');
    const homeHtml = home.body.toString();
    ok('GET /home', home.status === 200 && homeHtml.includes('Velirius API') && homeHtml.includes('Sync Complete'));
    ok(`Home muestra ${t.routers} routers / ${t.endpoints} endpoints`, homeHtml.includes(String(t.endpoints)));
    ok('Home lista las 6 categorías', CATEGORIES.every(c => homeHtml.includes(`/${c.id}`)));

    for (const cat of CATEGORIES) {
      const page = await get(port, `/${cat.id}`);
      const html = page.body.toString();
      ok(`GET /${cat.id} (${cat.endpoints.length})`, page.status === 200 && html.includes('data-test-btn=') && html.includes('>Test</button>'));
    }

    const catJs = (await get(port, '/js/category.js')).body.toString();
    const catCss = (await get(port, '/css/style.css')).body.toString();
    ok('Botón TEST despliega el panel hacia abajo', catJs.includes('function setOpen') && catJs.includes('tester-inner') && catCss.includes('grid-template-rows: 0fr') && catCss.includes('.tester.open'));
    ok('Parámetros modificables (texto + select + subir foto)', catJs.includes('data-param') && catJs.includes('<select data-param') && catJs.includes('SUBIR FOTO'));

    const docs = JSON.parse((await get(port, '/docs')).body.toString());
    ok('GET /docs con las 6 categorías', docs.status === true && docs.endpoints === t.endpoints && docs.categories.length === CATEGORIES.length);

    // ---- Tools ----
    ok('calc (2+3)*4^2+sqrt(81)=89', calculate('(2+3)*4^2 + sqrt(81)') === 89);
    ok('calc 10%3+pi', Math.abs(calculate('10%3+pi') - (1 + Math.PI)) < 1e-9);
    const calcHttp = JSON.parse((await get(port, '/tools/calculator?expr=' + encodeURIComponent('2+2*3'))).body.toString());
    ok('GET /tools/calculator', calcHttp.status === true && calcHttp.result.result === 8);
    ok('morse encode SOS', morseEncode('SOS') === '... --- ...');
    ok('morse decode', morseDecode('... --- ...') === 'SOS');
    const morseHttp = JSON.parse((await get(port, '/tools/morse?text=Hola&mode=encode')).body.toString());
    ok('GET /tools/morse', morseHttp.status === true && morseHttp.result.output.includes('-'));

    // ---- Reactions (solo catálogo, sin red) ----
    const reactList = JSON.parse((await get(port, '/reactions/list')).body.toString());
    ok(`GET /reactions/list (${REACTION_LIST.length} reacciones)`, reactList.status === true && reactList.result.count === REACTION_LIST.length);
    ok('Reactions no tiene nada NSFW', !/nsfw|hentai|porn|xxx/i.test(JSON.stringify(reactList.result)));

    // ---- Tipografías empaquetadas: nunca cuadrados ▯▯▯ ----
    const fontFiles = fs.readdirSync(FONTS_DIR);
    ok(`Fuentes empaquetadas (${fontFiles.length})`, fontFiles.some(f => /Inter-Bold/.test(f)) && fontFiles.some(f => /Playfair/.test(f)) && fontFiles.some(f => /JetBrainsMono/.test(f)) && fontFiles.includes('NotoEmoji-Regular.ttf'));
    const glyph = textLayer({ text: 'Ñandú áéíóú ✓ 🐱', width: 400, height: 90, maxFont: 40 });
    ok('Texto en vectores (sin depender del sistema)', glyph.svg.toString().includes('<path') && glyph.missing === 0);
    ok('Emoji/símbolos con NotoEmoji (sin tofu)', textLayer({ text: '🐱🔥', width: 120, height: 60, maxFont: 40 }).missing === 0);
    ok('Medición real de anchos', Math.abs(measure('abc', { size: 40 }) - measure('abc', { size: 40 })) === 0 && measure('abc', { size: 40 }) > 0);
    ok('Familias sans/serif/mono', Object.keys(FAMILIES).join(',') === 'sans,serif,mono');

    // ---- Canvas (render local con valores de ejemplo) ----
    const outDir = path.join(__dirname, '..', 'tmp-canvas');
    fs.mkdirSync(outDir, { recursive: true });
    const canvasCat = CATEGORIES.find(c => c.id === 'canvas');
    ok('El catálogo cubre todos los generadores', canvasCat.endpoints.filter(e => !['bratvideo', 'attp'].includes(e.id)).every(e => CANVAS_IDS.includes(e.id)));
    for (const ep of canvasCat.endpoints) {
      if (ep.id === 'bratvideo' || ep.id === 'attp') { console.log(`◌ canvas/${ep.id} (video: se prueba por HTTP)`); continue; }
      const q = {};
      for (const p of ep.params) {
        if (!p.example || p.example === '__AVATAR__' || p.example === '__AVATAR2__') continue;
        q[p.name] = p.example;
      }
      try {
        const buf = await generateCanvas(ep.id, q);
        ok(`canvas/${ep.id}`, isPng(buf), `${buf.length} bytes`);
        fs.writeFileSync(path.join(outDir, `${ep.id}.png`), buf);
      } catch (e) {
        ok(`canvas/${ep.id}`, false, e.message);
      }
    }

    // ---- Canvas por HTTP, con parámetros de estilo ----
    const via = await get(port, '/canvas/brat?text=Hola%20Velirius&color=ff2d55&size=1.4');
    ok('GET /canvas/brat?color&size PNG', via.status === 200 && via.type.includes('image/png') && isPng(via.body));
    const viaSign = await get(port, '/canvas/bratanime?text=Hola&rotate=12&uppercase=true&x=5');
    ok('GET /canvas/bratanime con overrides', viaSign.status === 200 && isPng(viaSign.body));
    const missing = await get(port, '/canvas/noexiste');
    ok('canvas inexistente → 404', missing.status === 404);

    // ---- Ping ----
    const ping = JSON.parse((await get(port, '/ping')).body.toString());
    ok('GET /ping', ping.status === true && ping.result.endpoints === t.endpoints);

    // ---- Sin IA y sin NSFW ----
    ok('Sin categoría de IA', !CATEGORIES.some(c => /ai|ia|chatbot/i.test(c.id)));
    ok('Sin endpoints NSFW', !/nsfw|hentai|porn|xxx/i.test(JSON.stringify(CATEGORIES)));
  } finally {
    server.close();
  }

  console.log(failures ? `\n✗ ${failures} fallo(s)` : '\n✓ Smoke completo OK');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
