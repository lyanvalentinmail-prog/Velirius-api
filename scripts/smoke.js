// scripts/smoke.js — npm test: levanta la app y verifica web, catálogo, calculadora y TODOS los canvas.
process.env.PORT = '0';
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/server');
const { CATEGORIES, totals } = require('../src/catalog');
const { generateCanvas } = require('../src/utils/canvasEngine');
const { calculate } = require('../src/routes/tools');

function get(port, p) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${p}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

function isPng(buf) {
  return buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  let failures = 0;
  const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failures++; };

  try {
    const home = await get(port, '/home');
    const t = totals();
    ok('GET /home estilo Delirius', home.status === 200 && home.body.toString().includes('Velirius API') && home.body.toString().includes('Sync Complete'));
    ok(`Home cuenta ${t.routers} routers / ${t.endpoints} endpoints`, home.body.toString().includes(`Endpoints:`) && home.body.toString().includes(String(t.endpoints)));

    for (const cat of CATEGORIES) {
      const page = await get(port, `/${cat.id}`);
      ok(`GET /${cat.id} lista ${cat.endpoints.length}`, page.status === 200 && page.body.toString().includes(`List:`) && page.body.toString().includes('You can do <strong>fetching</strong>'));
    }

    const docs = JSON.parse((await get(port, '/docs')).body.toString());
    ok('GET /docs catálogo completo', docs.status === true && docs.endpoints === t.endpoints && docs.categories.length === 5);

    // Calculadora (sin red)
    ok('calc (2+3)*4^2+sqrt(81)=89', calculate('(2+3)*4^2 + sqrt(81)') === 89);
    ok('calc 10%3+pi≈4.1415…', Math.abs(calculate('10%3+pi') - (1 + Math.PI)) < 1e-9);
    const calcHttp = JSON.parse((await get(port, '/tools/calculator?expr=' + encodeURIComponent('2+2*3'))).body.toString());
    ok('GET /tools/calculator', calcHttp.status === true && calcHttp.result.result === 8);

    // Todos los canvas estáticos con los valores por defecto del catálogo (avatar local)
    const outDir = path.join(__dirname, '..', 'tmp-canvas');
    fs.mkdirSync(outDir, { recursive: true });
    const canvasCat = CATEGORIES.find(c => c.id === 'canvas');
    for (const ep of canvasCat.endpoints) {
      if (ep.id === 'bratvideo' || ep.id === 'attp') { console.log(`◌ canvas/${ep.id} (video: probado por HTTP aparte)`); continue; }
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

    // Canvas por HTTP (content-type imagen)
    const via = await get(port, '/canvas/brat?text=Hola%20Velirius');
    ok('GET /canvas/brat PNG por HTTP', via.status === 200 && via.type.includes('image/png') && isPng(via.body));

    // Ping
    const ping = JSON.parse((await get(port, '/ping')).body.toString());
    ok('GET /ping', ping.status === true);
  } finally {
    server.close();
  }

  console.log(failures ? `\n✗ ${failures} fallo(s)` : '\n✓ Smoke completo OK');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
