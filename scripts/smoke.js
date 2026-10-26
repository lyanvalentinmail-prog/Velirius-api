// scripts/smoke.js — npm test: levanta la app y verifica web, catálogo, tools y TODOS los canvas.
process.env.PORT = '0';
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/server');
const { CATEGORIES, totals } = require('../src/catalog');
const { generateCanvas, CANVAS_IDS } = require('../src/utils/canvasEngine');
const { sharp } = require('../src/utils/image');
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
    ok('GET /home', home.status === 200 && homeHtml.includes('Velirius API') && homeHtml.includes('Aquí están las carpetas'));
    ok('Home con las píldoras de Apireon', homeHtml.includes('Información del Sistema') && homeHtml.includes('Catálogo JSON (/docs)') && homeHtml.includes('Cuenta de GitHub'));
    ok('Home con barra de estado (ESTADO / RUTAS / ENDPOINTS)', /Estado:/i.test(homeHtml) && /Rutas:/i.test(homeHtml) && /Endpoints:/i.test(homeHtml));
    ok(`Home muestra ${t.routers} routers / ${t.endpoints} endpoints`, homeHtml.includes(String(t.endpoints)));
    ok('Home lista las 6 categorías en tarjetas', CATEGORIES.every(c => homeHtml.includes(`/${c.id}`)) && (homeHtml.match(/cat-card/g) || []).length === CATEGORIES.length);

    for (const cat of CATEGORIES) {
      const page = await get(port, `/${cat.id}`);
      const html = page.body.toString();
      ok(`GET /${cat.id} (${cat.endpoints.length})`, page.status === 200 && html.includes('data-test-btn=') && html.includes('>Test</button>'));
    }

    const catJs = (await get(port, '/js/category.js')).body.toString();
    const catCss = (await get(port, '/css/style.css')).body.toString();
    ok('Botón TEST despliega el panel hacia abajo', catJs.includes('function setOpen') && catJs.includes('tester-inner') && catCss.includes('grid-template-rows: 0fr') && catCss.includes('.tester.open'));
    ok('Parámetros modificables (texto + select + subir foto)', catJs.includes('data-param') && catJs.includes('<select data-param') && catJs.includes('Galería') && catJs.includes('Opcional • URL o galería'));
    ok('Panel con CÓMO USAR EL ENDPOINT + URL + fetch', catJs.includes('Cómo usar el endpoint') && catJs.includes('code-url') && catJs.includes('code-fetch'));
    ok('Chips REQUERIDO/OPCIONAL por parámetro', catJs.includes('chip-opt') && catJs.includes('Requerido') && catJs.includes('Opcional'));
    ok('Resultado con 200 OK, ms y DESCARGAR', catJs.includes('chip-status') && catJs.includes('res-meta') && catJs.includes('Descargar'));

    // ---- Portada (landing) estilo Delirius, con botón al dashboard ----
    const landing = await get(port, '/');
    const landingHtml = landing.body.toString();
    ok('GET / (portada con Initialize dashboard)', landing.status === 200 && landingHtml.includes('Initialize dashboard') && landingHtml.includes('href="/home"'));
    ok('La portada no es un redirect: es la primera pantalla', landing.type.includes('text/html') && landingHtml.includes('paper'));

    // ---- Portada con el video y probador sin marco ----
    ok('Portada con el video del dashboard', landingHtml.includes('/media/dashboardvid.mp4') && landingHtml.includes('class="hero"'));
    ok('Portada con la caja SECURITY ALERT y el CTA', landingHtml.includes('alert-tag') && landingHtml.includes('Initialize dashboard'));
    ok('La pieza del canvas se ve sin marco (damero)', catCss.includes('.preview') && /\.preview img[^{]*\{[^}]*border: 0/.test(catCss));

    // ---- Opciones avanzadas plegadas en el probador ----
    const advCount = CATEGORIES.reduce((n, c) => n + c.endpoints.reduce((m, e) => m + e.params.filter(p => p.advanced).length, 0), 0);
    ok(`Opciones avanzadas marcadas (${advCount})`, advCount > 0 && catJs.includes('adv-toggle') && catJs.includes('adv-fields') && catCss.includes('.adv-toggle'));
    ok('El campo de texto es multilínea (texto largo)', catJs.includes('<textarea data-param') && catCss.includes('.tester textarea'));

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

    // ---- vercel.json válido (la validación de Vercel corta el deploy antes del build) ----
    const vc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const fnKeys = Object.keys(vc.functions || {});
    const fnOpts = fnKeys.map(k => vc.functions[k]);
    ok('vercel.json: includeFiles es un string glob (no array)', fnOpts.every(o => o.includeFiles === undefined || typeof o.includeFiles === 'string'));
    ok('vercel.json: excludeFiles es un string glob (no array)', fnOpts.every(o => o.excludeFiles === undefined || typeof o.excludeFiles === 'string'));
    ok('vercel.json: maxDuration y memory son números', fnOpts.every(o => (o.maxDuration === undefined || typeof o.maxDuration === 'number' || o.maxDuration === 'max') && (o.memory === undefined || typeof o.memory === 'number')));
    ok('vercel.json: glob de assets incluye plantillas y fuentes', /assets/.test(fnOpts.map(o => o.includeFiles).join(',')) && fnKeys.includes('api/index.js'));

    // ---- Node soportado por Vercel/Render (20.x ya está discontinuado) ----
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    ok('package.json: engines.node soportado (24.x)', /^2[46]\.x$/.test(pkg.engines.node));
    ok('render.yaml: NODE_VERSION alineado con package.json', fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8').includes(`value: "${pkg.engines.node.replace('.x', '')}"`));

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

    // ---- iqc: la burbuja crece con el texto (como WhatsApp) ----
    const iqcCorto = await generateCanvas('iqc', { text: 'Hola' });
    const iqcLargo = await generateCanvas('iqc', { text: 'Mira, te voy a contar algo que nunca le dije a nadie: cuando nos conocimos en aquel viaje yo ya sabía que esto iba a pasar, pero no quería aceptarlo porque me daba miedo perderte.' });
    const hCorto = (await sharp(iqcCorto).metadata()).height;
    const hLargo = (await sharp(iqcLargo).metadata()).height;
    ok(`canvas/iqc crece con el texto (${hCorto} → ${hLargo})`, isPng(iqcCorto) && isPng(iqcLargo) && hLargo > hCorto + 200);

    // ---- Canvas por HTTP, con parámetros de estilo ----
    const via = await get(port, '/canvas/brat?text=Hola%20Velirius&color=ff2d55&size=1.4');
    ok('GET /canvas/brat?color&size PNG', via.status === 200 && via.type.includes('image/png') && isPng(via.body));
    const viaSign = await get(port, '/canvas/bratanime?text=Hola&rotate=12&uppercase=true&x=5');
    ok('GET /canvas/bratanime con overrides', viaSign.status === 200 && isPng(viaSign.body));
    const missing = await get(port, '/canvas/noexiste');
    ok('canvas inexistente → 404', missing.status === 404);

    // ---- Imágenes de la galería (data:) y subida con URL corta ----
    const rojo = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const dataUrl = 'data:image/png;base64,' + rojo.toString('base64');

    const post = (port2, p2, body) => new Promise((resolve, reject) => {
      const data = Buffer.from(JSON.stringify(body));
      const req = http.request({
        host: '127.0.0.1', port: port2, path: p2, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end(data);
    });

    const up = await post(port, '/upload', { image: dataUrl });
    let upJson = {};
    try { upJson = JSON.parse(up.body.toString()); } catch (_) { /* no-json */ }
    const upUrl = upJson?.result?.url || '';
    ok('POST /upload devuelve una URL corta', up.status === 201 && /\/upload\/[a-f0-9]{12,}/.test(upUrl), upUrl);

    const upGet = upUrl ? await get(port, new URL(upUrl).pathname) : { status: 0, type: '', body: Buffer.alloc(0) };
    ok('GET /upload/:id devuelve la imagen', upGet.status === 200 && upGet.type.startsWith('image/') && upGet.body.length > 50);

    const conGaleria = upUrl ? await get(port, `/canvas/sebusca?name=GALERIA&url=${encodeURIComponent(upUrl)}`) : { status: 0, body: Buffer.alloc(0) };
    ok('canvas usa la imagen subida (?url=/upload/…)', conGaleria.status === 200 && isPng(conGaleria.body));

    const conBody = await post(port, '/canvas/sebusca', { name: 'GALERIA', url: dataUrl });
    ok('canvas usa la imagen de la galería (POST con data:)', conBody.status === 200 && isPng(conBody.body));

    // La imagen enviada tiene que cambiar el resultado (antes caía a la foto por defecto).
    const porDefecto = await get(port, '/canvas/sebusca?name=GALERIA');
    ok('la imagen enviada cambia el resultado', isPng(porDefecto.body) && Buffer.compare(porDefecto.body, conBody.body) !== 0);

    const urlMala = await get(port, '/canvas/sebusca?url=no-es-una-url');
    ok('URL inválida → 400 (no foto por defecto)', urlMala.status === 400 && /no es una URL válida/i.test(urlMala.body.toString()));

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
