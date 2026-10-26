# Velirius API

Web calcada del panel de [Apireon](https://apireon-36er.vercel.app/home) (tarjeta blanca punteada, borde
negro, tipografía mono, píldoras de navegación, rejilla de carpetas con `VER`, barra de estado y
buscador) con **78 endpoints REST sin token** repartidos en **6 categorías**, lista para **Vercel** o **Render**.

- **Home:** `/home` · **Catálogo JSON:** `/docs` · **Info:** `/information`
- Sin claves de API: todo sale de fuentes públicas (nekos.best, waifu.pics, waifu.im, nekos.life, purrbot,
  otakugifs, PokeAPI, TikWM, YouTube InnerTube/Invidious/Piped, LRCLIB, Wikipedia, Google…).
- **Sin IA** (no hay generación con modelos) y **sin contenido NSFW**: Anime y Reactions usan únicamente
  rutas `/sfw/` o `is_nsfw=false`.
- El probador sigue el diseño de las capturas: al abrir, la fila se pone **negra** con el botón TEST
invertido, arriba aparece **CÓMO USAR EL ENDPOINT** (GET + URL + snippet `fetch`, con COPIAR URL y
ABRIR), después **PARÁMETROS** con chip `REQUERIDO`/`OPCIONAL` por campo y el botón **TEST** grande.

La pieza se muestra **sin marco**, sobre un **damero de transparencia**, con la barra de estado
(`200 OK · Imagen HD · ms`) y el botón **DESCARGAR**.

El botón **`TEST`** de cada endpoint **se despliega hacia abajo** mostrando el probador con **parámetros
  modificables**: campos de texto, listas desplegables (`select`), subida de foto desde la galería,
  ejecución sin salir de la página, abrir el endpoint directo y copiar la URL final.
  Tocando `TEST` otra vez el panel se cierra (solo uno abierto a la vez).
- **Portada** (`/`) con el diseño de las capturas de referencia: hoja de papel rayado con marco
  negro, titular mono espaciado, píldora `V. x.y.z // STATUS: ONLINE`, **video del dashboard** como
  hero (con sombra dura), caja `SECURITY ALERT` y botón **`INITIALIZE DASHBOARD`** que entra a `/home`.
- **Dashboard** (`/home`) copia literal de Apireon: intro *"Aquí están las carpetas con todas las APIS…"*,
  *(No Requiere Token)* + enlace a GitHub, cuatro píldoras (`Información del Sistema`, `Catálogo JSON (/docs)`,
  `Cuenta de GitHub`, `Repositorio Velirius`), barra negra `ESTADO: EN LÍNEA · RUTAS · ENDPOINTS` y rejilla
  de tarjetas monoespaciadas (`anime\`, `canvas\`…) con el contador de endpoints y el enlace **VER**.
- **Parámetros con los mismos nombres que Apireon** en los canvas: `quotly` (`text, username, image, bg`),
  `iqc` (`text, replyText, replyName, time`), `ship`/`friendship` (`name1, name2, percentage, text, image1,
  image2`, avatares opcionales), `gaycard` (`name, percentage, url`), `bratestirado`/`bratvideo` (`bg, color`).
- El video vive en `public/media/dashboardvid.mp4` (se sirve directo, sin depender de Drive).
- Los parámetros de estilo (`color`, `size`, `font`, `rotate`, `zoom`…) están **plegados** detrás del botón
  **`⚙ OPCIONES AVANZADAS`** dentro del probador: solo se ven los campos que importan y el panel no queda
  lleno. Los campos de texto libre se escriben en un **área multilínea** (texto largo sin scroll horizontal).
- Páginas: `/anime` · `/canvas` · `/tools` · `/downloader` · `/searcher` · `/reactions`
  (los alias antiguos `/download` y `/search` redirigen a `/downloader` y `/searcher`).
- **¿Agregar o editar un endpoint?** → tutorial [`Cómo agregar o editar un endpoint`](#-cómo-agregar-o-editar-un-endpoint)
  y guía completa en [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Formato de respuesta

```json
{ "creator": "Velirius", "status": true, "result": { } }
```

- `?format=text` en cualquier endpoint JSON → texto plano (útil para bots).
- En **Downloader**, `?direct=` devuelve el archivo en streaming con `Range 206`
  (`mp4`, `mp3`, `true` según el endpoint).
- **Canvas** devuelve la imagen (PNG) o el video (MP4/WebM) directamente.
- Errores: `{ "creator", "status": false, "error", "hint" }`.

---

## ⛩️ Anime — 4 (proveedores de imágenes)

| Endpoint | Proveedores | Parámetros |
|---|---|---|
| `GET /anime/neko` | nekos.best · waifu.pics · waifu.im · nekos.life | `provider`, `amount`, `direct` |
| `GET /anime/waifu` | nekos.best · waifu.pics · waifu.im | `provider`, `amount`, `direct` |
| `GET /anime/maid` | nekos.best · waifu.im | `provider`, `amount`, `direct` |
| `GET /anime/pokemon` | PokeAPI | `query`, `shiny`, `direct` |

- `provider` fuerza una fuente; si se deja vacío se prueban en orden hasta que una responda.
- `amount` (1-10) devuelve varias imágenes: `result.images[]` además de `result.image`.
- `direct=true` entrega la imagen/GIF en vez del JSON.

```bash
curl "https://<host>/anime/neko?amount=3"
curl "https://<host>/anime/waifu?provider=waifu.im&direct=true" -o waifu.jpg
curl "https://<host>/anime/pokemon?query=charizard&shiny=true"
```

## 🎨 Canvas — 33 (plantillas de la carpeta `CategoriaCanvas` de Drive)

Todas las plantillas están en `assets/templates` (mismos archivos de Drive) y **todos los parámetros son
modificables por query**. Sin parámetros usan los valores de ejemplo y el avatar por defecto.

### Tipografías: nunca más cuadrados ▯▯▯

El texto **no** se dibuja con `<text font-family="…">`. Cada letra se traduce a un **path vectorial**
(`src/utils/textEngine.js` + `opentype.js`) usando las fuentes empaquetadas en `assets/fonts`:

| Familia (`font=`) | Fuente incluida | Pesos |
|---|---|---|
| `sans` (por defecto) | Inter | 400 / 700 / 900 |
| `serif` | Playfair Display | 400 / 700 / 900 |
| `mono` | JetBrains Mono | 400 / 700 |

Los emojis y símbolos que no están en esas fuentes se dibujan con **NotoEmoji** (también incluida), así que
tampoco aparecen cuadrados en textos como `hola 🐱🔥`. Todo el render es idéntico en local, Render o Vercel
porque **no depende de las tipografías del sistema** (fontconfig).

**Parámetros de estilo válidos en cualquier canvas**

| Parámetro | Qué hace |
|---|---|
| `color` | color del texto (hex `ff2d55`, `#ff2d55` o nombre: `white`, `black`, `red`…) |
| `bg` | fondo (canvas generados: `brat`, `ttp`, `quotly`, `ship`…) |
| `size` | escala del texto (`0.5` = mitad, `2` = doble) |
| `font` | `sans` · `serif` · `mono` |
| `uppercase` | `true` = MAYÚSCULAS |
| `x`, `y` | desplazamiento en % (-50 … 50) |
| `rotate` | rotación en grados (-180 … 180) |
| `spacing` | espacio extra entre letras en px |
| `zoom` | zoom de la foto del usuario (0.5 … 3) |
| `grayscale` | `true` = foto en blanco y negro |
| `shadow` | `true` = sombra suave bajo el texto (mejor lectura sobre fotos) |

Los canvas con plantilla de Drive están **calibrados con las coordenadas reales de cada imagen**
(burbuja de cita de `iqc`, fila de `cuentatiktok`, cartel del pingüino, hoja de Bob Esponja, marco de
`sebusca`…).

**El texto nunca lleva una caja de fondo.** El texto de ejemplo de la plantilla se borra detectando su
caja real y repintando esa zona con el color mediano del propio fondo, con bordes difuminados; después
se escribe el texto nuevo encima. Resultado: la letra se apoya directo sobre el cartel, el papel o la
foto, sin el recuadro que se notaba antes.

### Chat con burbuja que crece (`iqc`)

`iqc` está armado **por partes**: bloque de cita (nombre + texto citado), bloque de mensaje y hora.

- El mensaje se mide con las fuentes del repo y se parte en líneas como WhatsApp.
- Si el mensaje es largo se agregan líneas y la **burbuja crece** como en WhatsApp.
- El menú de abajo (Conservar / Responder / …) **baja** lo necesario y el alto de la imagen se ajusta.
- La hora queda abajo a la derecha, igual que en la app.
- La cita se recorta con `…` en una sola línea, como el reply real.

### Estiramiento esférico (`bratestirado`)

El cartel se dibuja plano y después pasa por una **lente esférica** (`lensWarp`): la distancia al centro
se normaliza igual en X y en Y, así el bulto es un **círculo** y las letras se curvan alrededor del
centro en vez de estirarse en franjas.

- `lens.stretch` — cuánto se agranda el centro (`1` = plano, `1.55` por defecto, hasta `3`).
- `lens.aspect` — estirón vertical del texto (`1` = normal, `1.35` por defecto): letras más altas.
- `lens.radius` — tamaño del bulto (`1` = llega a los bordes del lado corto, `0.6` = esfera chica y marcada).
- `lens.y` — altura del centro de la lente (`0.5` = medio del lienzo).

El texto se maqueta más chico de lo que se ve (`fitLines` + el margen que la lente se va a comer), así
que la deformación **nunca recorta** ni deja el texto pegado al borde, y con `lens.stretch=1&lens.aspect=1`
queda el brat normal, plano.

### Brat y bratvideo (palabras por pantalla)

`brat` y `bratvideo` usan **la misma tipografía** (`src/canvas/layouts.js` → `brat`): minúsculas,
Inter 700, interlineado apretado, texto alineado arriba a la izquierda y grano sutil. Comparten los
mismos parámetros, así el video se ve igual que la imagen:

- `text` — la frase (en el video, palabra por palabra).
- `bg`, `color`, `size`, `uppercase`, `spacing`, `font`, `canvas.size`.

`bratvideo` además pagina el texto:

- **Máximo 5 palabras por pantalla** (`?words=1..8` para cambiarlo).
- Las palabras de la página aparecen **de a una** y, cuando la página se completa, se queda quieta un
  instante y aparece la siguiente tanda. Nunca se ven más de 5 palabras a la vez.
- El tamaño de letra se calcula **una sola vez** (el que entra en la página más larga), así el texto
  no baila ni cambia de tamaño entre frames.

| Endpoint | Plantilla (Drive) | Parámetros propios |
|---|---|---|
| `/canvas/quotly` | `quotly.png` | `image`, `username`, `text`, `bg` + estilo |
| `/canvas/brat` | (generado) | `text`, `bg`, `color`, `size`, `rotate`, `uppercase` + tipografía (`text.*`) |
| `/canvas/bratvideo` | (generado, MP4) | `text`, `words` (5 por pantalla), `size`, `bg`, `color`, `uppercase` |
| `/canvas/bratestirado` | (generado) | `text`, `color`, `size` + lente esférica (`lens.stretch`, `lens.aspect`, `lens.radius`, `lens.y`) |
| `/canvas/bratanime` | `bratanime.png` | `text` + estilo |
| `/canvas/bratcoyote` | `bratcoyote.png` | `text` + estilo |
| `/canvas/bratpinguino` | `BratPinguino.jpg` | `text` o `image`, `mode` + estilo |
| `/canvas/ttp` | (generado) | `text`, `color`, `bg`, `size` |
| `/canvas/attp` | (generado, WebM) | `text`, `size` |
| `/canvas/iqc` | `iqc.jpg` | `text` (la burbuja crece), `quote`, `username`, `time` + estilo |
| `/canvas/cuentatiktok` | `CuentaTiktok.jpg` | `username`, `image`, `status` |
| `/canvas/storyreply` | `StoryReply.jpg` | `url`, `text`, `color`, `size`, `zoom` |
| `/canvas/absolutecinema` | `AbsoluteCinema.jpg` | `text`, `subtext`, `url`, `color`, `size` |
| `/canvas/bobesponja` | `BobEsponja.jpg` | `text` o `url`, `mode` + estilo |
| `/canvas/bobesponja2` | `BobEsponja2.jpg` | `text` o `url`, `mode` + estilo |
| `/canvas/bobesponja3` | `BobEsponja3.jpg` | `text` o `url`, `mode` + estilo |
| `/canvas/canvatextoxd` | `CanvaTextoxD.jpg` | `text` o `url`, `mode` + estilo |
| `/canvas/imagencanba` | `ImagenCanba.jpg` | `url` o `text`, `mode`, `zoom` + estilo |
| `/canvas/canvaimagen` | `CanvaImagen.jpg` | `url`, `zoom`, `grayscale`, `rotate` |
| `/canvas/fotopc` | `FotoPc.jpg` | `url`, `zoom`, `grayscale`, `rotate` |
| `/canvas/sebusca` | `SeBusca.jpg` | `url`, `name`, `reward`, `zoom` |
| `/canvas/pokemoncard` | `PokemonCard.jpg` | `name`, `hp`, `url`, `type`, `attack`, `damage`, `description` |
| `/canvas/ship` | `ship.png` | `image1`, `name1`, `image2`, `name2`, `percentage`, `text`, `color` |
| `/canvas/friendship` | `friendship.png` | igual que `ship` (círculos + 👍) |
| `/canvas/gaycard` | `gaycard.png` | `url`, `name`, `rank` |
| `/canvas/gay` | `gay.png` | `url`, `opacity` |
| `/canvas/invert` | `invert.png` | `url` |
| `/canvas/rata` | `Canvas Personajes/Rata.jpg` | `url`, `zoom`, `rotate`, `grayscale` |
| `/canvas/banana` | `Canvas Personajes/Banana.jpg` | `url`, `zoom`, `rotate`, `grayscale` |
| `/canvas/arandano` | `Canvas Personajes/Arandano.jpg` | `url` (chroma-key) |
| `/canvas/pan` | `Canvas Personajes/Pan.jpg` | `url` (chroma-key) |
| `/canvas/galletita` | `Canvas Personajes/Galletita.jpg` | `url`, `zoom`, `rotate` |
| `/canvas/minions` | `Canvas Personajes/Minions.jpg` | `url`, `url2`, `url3`, `zoom` |

En los carteles con texto **o** imagen: deja `text` vacío y envía `url`/`image` (o `mode=image`)
para pegar la foto en el cartel. También acepta imágenes `data:` (así funciona "SUBIR FOTO" del probador).

```bash
curl "https://<host>/canvas/brat?text=hola%20mundo&color=ff2d55&size=1.4&rotate=-6" -o brat.png
curl "https://<host>/canvas/bratvideo?text=uno%20dos%20tres%20cuatro%20cinco%20seis&words=5" -o brat.mp4
curl "https://<host>/canvas/bratanime?text=Velirius%20API&uppercase=true&font=serif" -o anime.png
```

## 🛠️ Tools — 3

| Endpoint | Parámetros |
|---|---|
| `GET /tools/calculator` | `expr` (`+ - * / % ^ ( ) sqrt() cbrt() sin() cos() tan() ln() log() abs() fact() pi e tau phi`), `degrees` |
| `GET /tools/translator` | `text`, `to` (en, es, pt…), `from` (auto) |
| `GET /tools/morse` | `text`, `mode` (`encode` / `decode`), `separator` |

```bash
curl "https://<host>/tools/calculator?expr=(2+3)*4^2%2Bsqrt(81)"
curl "https://<host>/tools/translator?text=Hola&to=en"
curl "https://<host>/tools/morse?text=SOS"                 # → "... --- ..."
curl "https://<host>/tools/morse?text=...%20---%20...&mode=decode"
```

## 📥 Downloader — 8

| Endpoint | Parámetros |
|---|---|
| `GET /downloader/tiktok` | `url`, `direct` (`mp4` / `mp3`) — sin marca de agua |
| `GET /downloader/youtube` | `url` o `query`, `quality`, `direct` (`mp4` / `mp3`) |
| `GET /downloader/facebook` | `url`, `direct` (`mp4`), `quality` (`hd` / `sd`) |
| `GET /downloader/instagram` | `url`, `direct` |
| `GET /downloader/mp3` | `url` o `query`, `direct` |
| `GET /downloader/mp4` | `url` o `query`, `quality`, `direct` |
| `GET /downloader/play` | `query`, `direct` |
| `GET /downloader/lyric` | `query`, `format` (`json` / `txt` / `lrc`) |

```bash
curl "https://<host>/downloader/tiktok?url=https://vt.tiktok.com/ZS43DntHW/"          # JSON
curl "https://<host>/downloader/tiktok?url=https://vt.tiktok.com/ZS43DntHW/&direct=mp4" -o video.mp4
curl "https://<host>/downloader/mp3?query=Twice%20I%20Cant%20Stop%20Me&direct=true"   -o cancion.mp3
curl "https://<host>/downloader/lyric?query=Kendrick%20Lamar%20Humble&format=lrc"
```

## 🔎 Searcher — 4

| Endpoint | Parámetros |
|---|---|
| `GET /searcher/tiktok` | `query`, `limit` |
| `GET /searcher/youtube` | `query`, `limit` |
| `GET /searcher/google` | `query`, `limit`, `lang` (respaldo automático en DuckDuckGo) |
| `GET /searcher/wikipedia` | `query`, `limit`, `lang` (extracto + imagen + URL) |

## 💞 Reactions — 26 (proveedores de GIFs)

`hug`, `kiss`, `pat`, `slap`, `cuddle`, `wave`, `wink`, `blush`, `smile`, `happy`, `dance`, `cry`, `poke`,
`tickle`, `highfive`, `handhold`, `nom`, `bite`, `bonk`, `baka`, `smug`, `laugh`, `shrug`, `sleep`, `think`,
`thumbsup`.

- `GET /reactions/<reaccion>` → `{ reaction, label, provider, gif }`
- Parámetros: `provider` (`nekos.best` · `waifu.pics` · `purrbot` · `otakugifs`), `direct=true` para el GIF.
- `GET /reactions/list` → catálogo de reacciones y proveedores.

```bash
curl "https://<host>/reactions/hug"
curl "https://<host>/reactions/pat?provider=purrbot&direct=true" -o pat.gif
```

---

## 🧩 Cómo agregar o editar un endpoint

Todo se toca, como mucho, en **3 archivos** y **sin clonar el repo**: en GitHub, abrí el archivo y
tocá el lápiz (**Edit file**) → *Commit changes* → *Propose changes* → *Create pull request*.

| Archivo | Qué se edita ahí | ¿Obligatorio? |
|---|---|---|
| [`src/catalog/<categoría>.js`](src/catalog) | La **ficha**: `id`, `desc` y `params`. Alimenta `/docs`, la web y el probador TEST. | ✅ Siempre |
| [`src/routes/<categoría>.js`](src/routes) | El **código** que responde `GET /<categoría>/:id`. | Solo si es nuevo |
| [`src/canvas/generators/<id>.js`](src/canvas/generators) | El **dibujo** (PNG) de un canvas. | Solo en canvas |

Guía completa y plantillas para copiar: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

Atajos para editar directo en GitHub (`✏️`):

| Categoría | Ficha (parámetros y textos) | Código (respuesta) |
|---|---|---|
| **Anime** | [`src/catalog/anime.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/anime.js) | [`src/routes/anime.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/anime.js) |
| **Canvas** | [`src/catalog/canvas.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/canvas.js) | [`src/routes/canvas.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/canvas.js) |
| **Tools** | [`src/catalog/tools.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/tools.js) | [`src/routes/tools.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/tools.js) |
| **Downloader** | [`src/catalog/downloader.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/downloader.js) | [`src/routes/download.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/download.js) |
| **Searcher** | [`src/catalog/searcher.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/searcher.js) | [`src/routes/searcher.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/searcher.js) |
| **Reactions** | [`src/catalog/reactions.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/catalog/reactions.js) | [`src/routes/reactions.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/routes/reactions.js) |
| **Canvas: medidas** | [`src/canvas/layouts.js`](https://github.com/lyanvalentinmail-prog/Velirius-api/edit/main/src/canvas/layouts.js) | [`src/canvas/generators/`](https://github.com/lyanvalentinmail-prog/Velirius-api/tree/main/src/canvas/generators) |

### Editar algo que ya existe

- **Descripción, ejemplo o parámetros** → `src/catalog/<categoría>.js`. Es texto: cambiá lo que
  quieras y listo (la web y `/docs` lo leen de ahí).
- **Valores por defecto de un canvas** (posición, color, tamaño) → `src/canvas/layouts.js`, en el
  bloque del canvas (`text`, `photo`, `bubble`, `msg`, `time`…).
- **El dibujo de un canvas** → `src/canvas/generators/<id>.js`. Cada canvas es **un archivo suelto**
  con una sola función.
- **Una fuente nueva para Downloader/Reactions** → `src/utils/providers.js` (primero
  [`assets/defaults/`](assets/defaults) y luego el `try/catch` de fuentes ya existente).

### Agregar un endpoint de texto/JSON (3 pasos)

1. **La ruta** — `src/routes/tools.js`:

   ```js
   router.get('/emoji', (req, res) => {
     const text = String(req.query.text || 'hola').slice(0, 100);
     return sendSuccess(res, { text, length: text.length });
   });
   ```

2. **La ficha** — `src/catalog/tools.js`:

   ```js
   { id: 'emoji', desc: 'Cuenta las letras de un texto', params: [
     P('text', 'hola', 'Texto a medir'),
     O('upper', 'false', 'true = devolver en MAYÚSCULAS')
   ] },
   ```

3. **Validar** — `npm run check` y `npm test`. La ruta aparece sola en `/home`, `/docs` y la web
   (los routers se montan una sola vez en `src/server.js`).

Parámetros: `P()` requerido · `O()` opcional · `S()` opcional con lista desplegable ·
`AV`/`AV2` avatar por defecto · `...textStyle()` / `...photoStyle()` estilos de texto y foto.

### Agregar un canvas (imagen) (4 pasos)

1. **El generador** — creá `src/canvas/generators/<id>.js` (se registra solo, no hay índice que
   tocar):

   ```js
   // src/canvas/generators/ejemplo.js
   const { sharp, P, partsOf, boxOf, txt, textLayer, templateMeta } = require('./_helpers');

   module.exports = async function ejemplo(q) {
     const parts = partsOf('ejemplo');
     const { buf, width: W, height: H } = await templateMeta(parts.template);
     const box = boxOf('ejemplo', 'text', q);
     const layer = textLayer({
       text: txt(q, 'Mi texto'), width: Math.round((box.x1 - box.x0) * W),
       height: Math.round((box.y1 - box.y0) * H), family: 'sans', weight: 700,
       maxFont: 64, maxLines: 3, align: 'middle', fill: '#ffffff'
     });
     return sharp(buf).composite([{
       input: layer.svg, left: Math.round(box.x0 * W), top: Math.round(box.y0 * H)
     }]).png().toBuffer();
   };
   ```

2. **Las medidas** — `src/canvas/layouts.js`:

   ```js
   ejemplo: {
     label: 'Ejemplo',
     parts: {
       template: 'ejemplo.jpg',                    // assets/templates/
       text: { box: { x0: 0.08, y0: 0.55, x1: 0.92, y1: 0.8 },
               font: { family: 'sans', weight: 700, maxFont: 64 }, fill: '#ffffff' }
     }
   },
   ```

3. **La ficha** — `src/catalog/canvas.js`:

   ```js
   { id: 'ejemplo', desc: 'Plantilla de ejemplo con tu texto', params: [
     P('text', 'Mi texto', 'Texto del cartel'), ...textStyle()
   ] },
   ```

4. **Validar** — `npm run check` + `npm test`, y mirá `GET /canvas/ejemplo?text=hola`.

**Reglas de oro de los canvas** (para no romper la fidelidad):

- Nada de `<text>` en SVG: siempre `textLayer()` (fuentes empaquetadas → nunca `▯▯▯`).
- El texto **crece** hacia abajo (más líneas, no letra más chica) y nunca se corta.
- Sin medidas clavadas en el código: van en `layouts.js` y se leen con `P`/`boxOf`.
- Todo parámetro nuevo tiene que poder pisarse por query (`<parte>.<clave>=valor`).

### Editar sin tocar código

Cada clave de `layouts.js` se puede pisar por URL:

```bash
curl "http://localhost:3000/canvas/iqc?msg.size=1.3&msg.color=ffe066&time.color=9ad0ff"
curl "http://localhost:3000/canvas/brat?text.size=1.2&text.fill=ff0044&canvas.bg=8ACE00"
```

| Clave | Qué controla |
|---|---|
| `x0, y0, x1, y1` | Área en fracciones (0–1) del lienzo/plantilla |
| `fill` / `color` / `bg` | Colores (hex sin `#`, o `white`, `black`…) |
| `size`, `font`, `weight`, `align`, `spacing`, `lineHeight`, `uppercase`, `rotate` | Tipografía |
| `radius`, `pad`, `zoom`, `opacity` | Formas, márgenes y foto |

### Antes de abrir el Pull Request

```bash
npm run check   # catálogo: ids, desc, parámetros, routers y canvas ↔ catálogo
npm test        # smoke: web, tools, /docs y los 31 canvas
```

La CI (`.github/workflows/ci.yml`) corre los dos comandos en cada PR. Hay además una plantilla de
PR con el checklist y un formulario de *issue* para pedir endpoints nuevos.

## Desarrollo

```bash
npm install
npm start        # http://localhost:3000/home
npm run dev      # con --watch
npm run check    # valida el catálogo (ids, parámetros, canvas ↔ catálogo)
npm test         # smoke: web, catálogo, tools, /docs y los 31 canvas
```

Estructura:

```
src/
  catalog/                → el catálogo (home, categorías, /docs y probador TEST)
    index.js              → junta las categorías y define el orden de /home
    helpers.js            → P(), O(), S(), AV, AV2, textStyle(), photoStyle()
    anime.js canvas.js tools.js downloader.js searcher.js reactions.js
  server.js               → Express + CORS abierto + páginas + routers
  routes/
    anime.js canvas.js tools.js download.js searcher.js reactions.js pages.js
  canvas/                 → motor de las 33 plantillas
    generators/           → un archivo por canvas (se cargan solos)
      _helpers.js         → piezas compartidas (carteles, huecos, medidores)
    layouts.js            → medidas y estilos por defecto de cada canvas
    parts.js              → overrides por query (<parte>.<clave>=valor)
    core.js               → sharp, texto, máscaras, lente…
  utils/
    providers.js          → todas las fuentes públicas (SFW)
    textEngine.js         → texto vectorial con fuentes empaquetadas (sin tofu)
    canvasEngine.js       → fachada de src/canvas
    video.js              → bratvideo (MP4) y attp (WebM)
    image.js              → helpers de sharp/SVG
assets/
  templates/              → plantillas de la carpeta CategoriaCanvas de Drive
  fonts/                  → Inter, Playfair Display, JetBrains Mono y NotoEmoji
scripts/
  smoke.js                → npm test
  validate-catalog.js     → npm run check
.github/workflows/ci.yml  → corre check + test en cada PR
```

### Despliegue

**Render** (`render.yaml`): build `npm install`, start `npm start`. Es la opción recomendada para los
endpoints de descarga (sin límite de tamaño de respuesta).

**Vercel**: `vercel.json` ya declara `"framework": null` para que Vercel **no** intente usar el preset de
Next.js (`NEXT_NO_VERSION`), empaqueta `assets/**` (plantillas de Canvas), `public/**` y el binario de
ffmpeg, y enruta todo a la función `api/index.js`.

1. Importa el repo en Vercel y elige **Framework Preset: Other**.
2. En *Settings → Git → Production Branch* selecciona **`main`** (no una rama de `arena/…`).
3. Redeploy.

> En Vercel las respuestas de una función tienen un tope de ~4.5 MB: los Canvas (PNG/MP4/WebM) caben
> sin problema, pero los archivos grandes de `/downloader/*?direct=…` conviene servirlos desde Render.

