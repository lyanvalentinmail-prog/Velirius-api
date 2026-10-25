# Velirius API

Web **idéntica a [api.delirius.online/home](https://api.delirius.online/home)** (tarjeta blanca punteada, borde negro, tipografía mono, botones `VIEW` / `RUN`, barra de estado y buscador) con **57 endpoints REST sin token** en 5 categorías, lista para **Vercel** o **Render**.

- **Home:** `/home` · **Catálogo JSON:** `/docs` · **Info:** `/information`
- Sin claves de API: todo sale de fuentes públicas (PokeAPI, Jikan, TikWM, YouTube InnerTube/Invidious, LRCLIB, Aptoide, Sticker.ly…).
- Tocando el nombre de cualquier endpoint en la web se abre el **probador con parámetros modificables** (editar valores, subir una foto desde la galería, ejecutar sin salir de la página y copiar la URL). El botón `RUN` abre el endpoint directo, igual que en Delirius.

---

## Endpoints (57)

Formato general JSON: `{ "creator": "Velirius", "status": true, "result": { … } }`.
A cualquier endpoint JSON se le puede agregar `?format=text` para texto limpio (útil para bots).
En **Download**, `?direct=true|mp3|mp4` devuelve el archivo en streaming con `Range 206` (reproducible en navegador/WhatsApp).

### 🎨 Canvas — 33 (todas las plantillas de la carpeta `CategoriaCanvas` de Drive)

Devuelven **imagen directa** (PNG; `bratvideo` → MP4 y `attp` → WebM). Todos los parámetros son modificables por query; sin parámetros usan valores de ejemplo y el avatar por defecto (`FotoPredeterminada.jpg` / `FotoShipGirlPred.jpg`).

| Endpoint | Plantilla (Drive) | Parámetros |
|---|---|---|
| `GET /canvas/quotly` | `quotly.png` | `image`, `username`, `text`, `bg` |
| `GET /canvas/brat` | `brat.jpg` | `text`, `bg`, `color` |
| `GET /canvas/bratvideo` | `bratvideo.mp4` | `text` (MP4 palabra por palabra) |
| `GET /canvas/bratestirado` | `BratEstirado.jpg` | `text` (estirado ojo de pez) |
| `GET /canvas/bratanime` | `bratanime.png` | `text` (maid con cartel) |
| `GET /canvas/bratcoyote` | `bratcoyote.png` | `text` (Coyote con cartel) |
| `GET /canvas/bratpinguino` | `BratPinguino.jpg` | `text` o `image` (Gunter con cartel) |
| `GET /canvas/ttp` | `ttp.png` | `text`, `color` |
| `GET /canvas/attp` | `attp.webm` | `text` (WebM arcoíris animado) |
| `GET /canvas/iqc` | `iqc.jpg` | `text`, `quote`, `username`, `time` (chat falso de WhatsApp) |
| `GET /canvas/cuentatiktok` | `CuentaTiktok.jpg` | `username`, `image` (avatar), `status` |
| `GET /canvas/storyreply` | `StoryReply.jpg` | `url` (historia), `text` (respuesta) |
| `GET /canvas/absolutecinema` | `AbsoluteCinema.jpg` | `text`, `subtext`, `url` (foto B/N opcional) |
| `GET /canvas/bobesponja` | `BobEsponja.jpg` | `text` o `url` en la hoja |
| `GET /canvas/bobesponja2` | `BobEsponja2.jpg` | `text` o `url` (cómic 4 viñetas) |
| `GET /canvas/bobesponja3` | `BobEsponja3.jpg` | `text` o `url` en el cartel |
| `GET /canvas/canvatextoxd` | `CanvaTextoxD.jpg` | `text` o `url` (muñeco 3D) |
| `GET /canvas/imagencanba` | `ImagenCanba.jpg` | `url` o `text` dentro de MS Paint |
| `GET /canvas/canvaimagen` | `CanvaImagen.jpg` | `url` (pantalla verde Wojak, chroma-key) |
| `GET /canvas/fotopc` | `FotoPc.jpg` | `url` en la pantalla (chroma-key) |
| `GET /canvas/sebusca` | `SeBusca.jpg` | `url`, `name`, `reward` |
| `GET /canvas/pokemoncard` | `PokemonCard.jpg` | `name`, `hp`, `url`, `type`, `attack`, `damage`, `description` |
| `GET /canvas/ship` | `ship.png` | `image1`, `name1`, `image2`, `name2`, `percentage`, `text` |
| `GET /canvas/friendship` | `friendship.png` | igual que ship (círculos + 👍) |
| `GET /canvas/gaycard` | `gaycard.png` | `url`, `name`, `rank` |
| `GET /canvas/gay` | `gay.png` | `url`, `opacity` (filtro arcoíris) |
| `GET /canvas/invert` | `invert.png` | `url` (colores invertidos) |
| `GET /canvas/rata` | `Canvas Personajes/Rata.jpg` | `url` (tu cara) |
| `GET /canvas/banana` | `Canvas Personajes/Banana.jpg` | `url` |
| `GET /canvas/arandano` | `Canvas Personajes/Arandano.jpg` | `url` (chroma-key) |
| `GET /canvas/pan` | `Canvas Personajes/Pan.jpg` | `url` (chroma-key) |
| `GET /canvas/galletita` | `Canvas Personajes/Galletita.jpg` | `url` |
| `GET /canvas/minions` | `Canvas Personajes/Minions.jpg` | `url`, `url2`, `url3` (las 3 caras) |

Ejemplo: `/canvas/quotly?image=https://…/avatar.jpg&username=Velirius+Api&text=Welcome+to+Velirius+Api&bg=000000`
En carteles con texto **o** imagen, borrar el texto y poner `url`/`image` (o `mode=image`) pega la foto en el cartel. También acepta imágenes en `data:` (así funciona "SUBIR FOTO" del probador web).

### ⛩️ Anime — 5

| Endpoint | Descripción | Parámetros |
|---|---|---|
| `GET /anime/pokemon` | Pokédex PokeAPI: stats, tipos, descripción y arte | `query` (nombre/ID/`random`), `shiny` |
| `GET /anime/gacha` | Personaje al azar con rareza (common→legendary) | — |
| `GET /anime/character` | Buscar personajes (sin `query` = al azar) | `query`, `limit` |
| `GET /anime/manga` | Buscar manga (Jikan) | `query`, `limit` |
| `GET /anime/anime` | Buscar anime (Jikan) | `query`, `limit` |

### ⬇️ Download — 9

| Endpoint | Descripción | Parámetros |
|---|---|---|
| `GET /download/tiktok` | **TikTok sin marca de agua** (HD + MP3, vía TikWM) | `url`, `direct=mp4\|mp3` |
| `GET /download/youtube` | Info + todos los formatos de un video | `url` (o `query`), `quality`, `direct` |
| `GET /download/mp3` | Audio desde YouTube | `url` o `query`, `direct=true` |
| `GET /download/mp4` | Video desde YouTube | `url` o `query`, `quality=360\|480\|720\|1080`, `direct=true` |
| `GET /download/play` | Busca una canción y suena el audio | `query`, `direct=true` |
| `GET /download/spotify` | Info del track + audio equivalente en YouTube | `url`, `direct=true` |
| `GET /download/instagram` | Reels/fotos públicas | `url`, `direct=true` |
| `GET /download/aptoide` | Buscar apps con link APK directo | `query`, `limit` |
| `GET /download/lyric` | Letra (LRCLIB + lyrics.ovh) | `query`, `format=json\|txt\|lrc` |

> YouTube se resuelve con InnerTube (búsqueda) + instancias Invidious con **descubrimiento dinámico** desde la lista oficial de `api.invidious.io` (en 2026 la mayoría cerró su API; la lista se refresca sola cada hora) y Piped como respaldo.

### 🔎 Search — 8

| Endpoint | Descripción | Parámetros |
|---|---|---|
| `GET /search/sticker` | Stickers sueltos (Sticker.ly v3.1) | `query`, `limit` |
| `GET /search/stickerpack` | Packs de stickers (alias `stickerly`) | `query`, `limit` |
| `GET /search/anime` | Buscar anime (Jikan) | `query`, `limit` |
| `GET /search/tiktok` | Buscar videos en TikTok | `query`, `limit` |
| `GET /search/youtube` | Buscar videos en YouTube | `query`, `limit` |
| `GET /search/instagram` | Perfil público por usuario (+ posts) | `query` (usuario sin @) |
| `GET /search/lyric` | Buscar letras (marca si hay sincronizada) | `query`, `limit` |
| `GET /search/play` | Canciones con `playUrl` listo para sonar | `query`, `limit` |

### 🛠️ Tools — 2

| Endpoint | Descripción | Parámetros |
|---|---|---|
| `GET /tools/translator` | Traductor (alias `translate`, `traductor`) | `text`, `to`, `from` |
| `GET /tools/calculator` | Calculadora sin `eval`: `+ - * / % ^ ( ) sqrt() sin()… pi e` (alias `calc`, `calculadora`) | `expr`, `degrees` |

---

## Correr en local

```bash
npm install
npm start          # http://localhost:3000/home
npm test           # smoke: web + catálogo + calculadora + los 33 canvas (guarda PNG en tmp-canvas/)
```

Requiere Node ≥ 18. Los canvas en video (`bratvideo`, `attp`) usan el binario de `@ffmpeg-installer/ffmpeg` incluido en dependencias.

## Despliegue

- **Render (recomendado):** se incluye `render.yaml` → *New → Blueprint*. Los canvas en video funcionan sin límite de 10 s.
- **Vercel:** se incluye `vercel.json` + `api/index.js` (Express como función, `assets/` empaquetadas con `includeFiles`). Importar el repo y desplegar.

## Estructura

```
assets/templates/   Plantillas Canvas originales de Drive (CategoriaCanvas)
assets/defaults/    Avatares por defecto (FotoPredeterminada / FotoShipGirlPred)
public/             CSS + JS de la web (home.js buscador global, category.js probador RUN)
src/catalog.js      Fuente única: alimenta /home, categorías, /docs y ejemplos RUN
src/routes/         pages (web Delirius) · canvas · anime · tools · download · search
src/utils/          http · response (JSON + Range 206) · image (sharp) · canvasEngine (33) · video (ffmpeg) · providers ( APIs públicas)
scripts/smoke.js    Pruebas (npm test)
```

Respuestas de error siempre en JSON con `hint` cuando falta un parámetro. Si una fuente pública se cae, los buscadores rotan entre varias (InnerTube/Invidious/Piped, LRCLIB/lyrics.ovh, Google/MyMemory…) antes de responder `502`.
