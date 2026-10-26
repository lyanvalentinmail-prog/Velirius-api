# Velirius API

Web estilo [api.delirius.online](https://api.delirius.online/home) (tarjeta blanca punteada, borde negro,
tipografía mono, botones `VIEW` / `TEST`, barra de estado y buscador) con **78 endpoints REST sin token**
repartidos en **6 categorías**, lista para **Vercel** o **Render**.

- **Home:** `/home` · **Catálogo JSON:** `/docs` · **Info:** `/information`
- Sin claves de API: todo sale de fuentes públicas (nekos.best, waifu.pics, waifu.im, nekos.life, purrbot,
  otakugifs, PokeAPI, TikWM, YouTube InnerTube/Invidious/Piped, LRCLIB, Wikipedia, Google…).
- **Sin IA** (no hay generación con modelos) y **sin contenido NSFW**: Anime y Reactions usan únicamente
  rutas `/sfw/` o `is_nsfw=false`.
- El botón **`TEST`** de cada endpoint **se despliega hacia abajo** mostrando el probador con **parámetros
  modificables**: campos de texto, listas desplegables (`select`), subida de foto desde la galería,
  ejecución sin salir de la página, abrir el endpoint directo y copiar la URL final.
  Tocando `TEST` otra vez el panel se cierra (solo uno abierto a la vez).
- Páginas: `/anime` · `/canvas` · `/tools` · `/downloader` · `/searcher` · `/reactions`
  (los alias antiguos `/download` y `/search` redirigen a `/downloader` y `/searcher`).

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
| `zoom` | zoom de la foto del usuario (0.5 … 3) |
| `grayscale` | `true` = foto en blanco y negro |

| Endpoint | Plantilla (Drive) | Parámetros propios |
|---|---|---|
| `/canvas/quotly` | `quotly.png` | `image`, `username`, `text`, `bg` + estilo |
| `/canvas/brat` | (generado) | `text`, `bg`, `color`, `size`, `rotate` |
| `/canvas/bratvideo` | (generado, MP4) | `text`, `size`, `bg`, `color` |
| `/canvas/bratestirado` | `BratEstirado.jpg` | `text`, `color`, `size` |
| `/canvas/bratanime` | `bratanime.png` | `text` + estilo |
| `/canvas/bratcoyote` | `bratcoyote.png` | `text` + estilo |
| `/canvas/bratpinguino` | `BratPinguino.jpg` | `text` o `image`, `mode` + estilo |
| `/canvas/ttp` | (generado) | `text`, `color`, `bg`, `size` |
| `/canvas/attp` | (generado, WebM) | `text`, `size` |
| `/canvas/iqc` | `iqc.jpg` | `text`, `quote`, `username`, `time` |
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

## Desarrollo

```bash
npm install
npm start        # http://localhost:3000/home
npm run dev      # con --watch
npm test         # smoke: web, catálogo, tools, /docs y los 33 canvas
```

Estructura:

```
src/
  catalog.js            → catálogo único (home, categorías, /docs y probador TEST)
  server.js             → Express + CORS abierto + páginas + routers
  routes/
    anime.js            → /anime (neko, waifu, maid, pokemon)
    canvas.js           → /canvas/:id (PNG / MP4 / WebM)
    tools.js            → /tools (calculator, translator, morse)
    download.js         → /downloader (+ alias /download)
    searcher.js         → /searcher (+ alias /search)
    reactions.js        → /reactions
    pages.js            → web (/, /home, /<categoría>, /information, /docs)
  utils/
    providers.js        → todas las fuentes públicas (SFW)
    canvasEngine.js     → render de las 33 plantillas con parámetros
    video.js            → bratvideo (MP4) y attp (WebM)
    image.js            → helpers de sharp/SVG
scripts/smoke.js        → npm test
```

Despliegue: **Vercel** (`vercel.json` → `api/index.js`) o **Render** (`render.yaml` → `npm start`).
