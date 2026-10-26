// src/catalog.js — Catálogo único de Velirius API.
// Alimenta /home, las páginas de categoría, /docs y el probador TEST de la web.
//
// Categorías: ANIME · CANVAS · TOOLS · DOWNLOADER · SEARCHER · REACTIONS
// (sin IA y sin contenido NSFW por diseño).
//
// AVATAR / AVATAR2 se reemplazan en tiempo de render por las URLs absolutas de
// /img/default-avatar.jpg y /img/default-avatar2.jpg.
const AV = '__AVATAR__';
const AV2 = '__AVATAR2__';

const P = (name, example, desc = '') => ({ name, example, desc, required: true });
const O = (name, example, desc = '') => ({ name, example, desc, required: false });
const S = (name, example, desc, options) => ({ name, example, desc, required: false, options });

// ---------- Parámetros de estilo reutilizables (Canvas) ----------
const textStyle = () => [
  O('color', '', 'Color del texto (hex, ej. ff2d55, o nombre: white, black…)'),
  O('size', '1', 'Escala del texto: 0.5 = mitad, 2 = doble'),
  S('font', 'sans', 'Tipografía incluida en el repo (sin cuadrados)', ['sans', 'serif', 'mono']),
  O('uppercase', 'false', 'true = texto en MAYÚSCULAS'),
  O('x', '0', 'Mover el texto en horizontal (-50 a 50)'),
  O('y', '0', 'Mover el texto en vertical (-50 a 50)'),
  O('rotate', '0', 'Rotar el texto en grados (-180 a 180)'),
  O('spacing', '0', 'Espacio extra entre letras en px')
];
const photoStyle = () => [
  O('zoom', '1', 'Zoom de la foto: 0.5 = más pequeña, 2 = más grande'),
  O('grayscale', 'false', 'true = foto en blanco y negro'),
  O('rotate', '0', 'Rotar la foto en grados (-180 a 180)')
];

const CATEGORIES = [
  // ======================================================================
  {
    id: 'anime', name: 'ANIME',
    endpoints: [
      { id: 'neko', desc: 'Imagen aleatoria de neko (chica gato). Proveedores: nekos.best, waifu.pics, waifu.im, nekos.life', media: 'image', params: [
        S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'waifu.pics', 'waifu.im', 'nekos.life']),
        O('amount', '1', 'Cantidad de imágenes (1-10)'),
        O('direct', 'false', 'true = devuelve la imagen directamente')
      ] },
      { id: 'waifu', desc: 'Imagen aleatoria de waifu. Proveedores: nekos.best, waifu.pics, waifu.im', media: 'image', params: [
        S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'waifu.pics', 'waifu.im']),
        O('amount', '1', 'Cantidad de imágenes (1-10)'),
        O('direct', 'false', 'true = devuelve la imagen directamente')
      ] },
      { id: 'maid', desc: 'Imagen aleatoria de maid (sirvienta). Proveedores: nekos.best, waifu.im', media: 'image', params: [
        S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'waifu.im']),
        O('amount', '1', 'Cantidad de imágenes (1-10)'),
        O('direct', 'false', 'true = devuelve la imagen directamente')
      ] },
      { id: 'pokemon', desc: 'Pokémon por nombre o ID: arte oficial, tipos, stats y descripción (PokeAPI)', media: 'image', params: [
        P('query', 'pikachu', 'Nombre o ID del Pokémon. Usa "random" para uno al azar'),
        O('shiny', 'false', 'true = arte shiny'),
        O('direct', 'false', 'true = devuelve solo la imagen')
      ] }
    ]
  },

  // ======================================================================
  {
    id: 'canvas', name: 'CANVAS',
    endpoints: [
      { id: 'quotly', desc: 'Genera un sticker PNG transparente estilo Quotly con avatar circular y burbuja de chat.', params: [
        P('text', 'Welcome to Velirius Api', 'Mensaje del sticker'),
        O('username', 'Velirius Api', 'Nombre del usuario'),
        O('image', AV, 'Avatar opcional (URL o imagen de tu galería)'),
        O('bg', '000000', 'Color hexadecimal de la burbuja'),
        ...textStyle()
      ] },
      { id: 'brat', desc: 'Texto brat real (minúsculas, desenfocado y con grano sutil)', params: [
        P('text', 'Welcome to Velirius API', 'Texto del sticker'),
        O('bg', 'ffffff', 'Fondo hex sin #'),
        O('color', '000000', 'Color del texto hex sin #'),
        O('size', '1', 'Escala del texto (0.5 - 2)'),
        O('rotate', '0', 'Rotar el texto en grados')
      ] },
      { id: 'bratvideo', desc: 'Genera un video MP4 animado estilo Brat donde las palabras aparecen progresivamente.', media: 'video', params: [
        P('text', 'Welcome to Velirius API', 'Frase animada palabra por palabra (admite emojis)'),
        O('bg', '8ACE00', 'Color de fondo hex (ej. 8ACE00 o ffffff)'),
        O('color', '000000', 'Color del texto hex')
      ] },
      { id: 'bratestirado', desc: 'Genera el cartel Brat estirado con lente esférico 3D (fisheye).', params: [
        P('text', 'i <3 money', 'Texto a estirar'),
        O('bg', 'ffffff', 'Color de fondo hex (ej. ffffff o 8ACE00)'),
        O('color', '000000', 'Color del texto hex'),
        O('size', '1', 'Escala del texto (0.5 - 2)')
      ] },
      { id: 'bratanime', desc: 'Maid de anime sosteniendo tu texto', params: [
        P('text', 'Welcome to Velirius API', 'Texto del cartel'),
        ...textStyle()
      ] },
      { id: 'bratcoyote', desc: 'El Coyote sosteniendo tu texto', params: [
        P('text', 'WELCOME TO VELIRIUS API', 'Texto del cartel'),
        ...textStyle()
      ] },
      { id: 'bratpinguino', desc: 'Gunter (pingüino) con cartel: texto o imagen', params: [
        O('text', 'Welcome to Velirius API', 'Texto del cartel'),
        O('image', '', 'URL de imagen para el cartel (reemplaza el texto)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        ...textStyle()
      ] },
      { id: 'ttp', desc: 'Texto a sticker con letras espaciadas', params: [
        P('text', 'Hola', 'Texto del sticker'),
        S('color', 'white', 'Color de las letras', ['white', 'black', 'red', 'green', 'blue', 'yellow', 'pink', 'purple', 'orange']),
        O('bg', 'transparent', 'Fondo hex sin # o "transparent"'),
        O('size', '1', 'Escala del texto (0.5 - 2)')
      ] },
      { id: 'attp', desc: 'Texto animado arcoíris (WebM sticker)', media: 'video', params: [
        P('text', 'Welcome to Velirius', 'Texto animado'),
        O('size', '1', 'Escala del texto (0.5 - 2)')
      ] },
      { id: 'iqc', desc: 'Genera una captura estilo WhatsApp iOS en modo oscuro con barra de reacciones y menú contextual.', params: [
        P('text', 'Yo siempre te voy a amar', 'Mensaje principal de la burbuja'),
        O('replyText', 'vooooss seguro', 'Texto del mensaje citado (dejar vacío para ocultar)'),
        O('replyName', 'Tú', 'Autor del mensaje citado'),
        O('time', '7:32 p. m.', 'Hora mostrada en la burbuja'),
        ...textStyle()
      ] },
      { id: 'cuentatiktok', desc: 'Menú falso de TikTok "Account not found"', params: [
        O('username', 'Account not found', 'Nombre de la cuenta'),
        O('image', AV, 'Avatar de la cuenta'),
        O('status', 'Sent', 'Texto bajo el nombre')
      ] },
      { id: 'storyreply', desc: '"Replied to your story" con tu foto y mensaje', params: [
        P('url', AV, 'Foto de la historia'),
        P('text', 'jajaja total', 'Respuesta'),
        O('color', 'ffffff', 'Color del texto hex sin #'),
        O('size', '1', 'Escala del texto (0.5 - 2)'),
        O('zoom', '1', 'Zoom de la foto'),
        O('shadow', 'false', 'true = sombra suave bajo el texto')
      ] },
      { id: 'absolutecinema', desc: 'Meme ABSOLUTE CINEMA con tu texto', params: [
        O('text', 'CINEMA', 'Palabra grande'),
        O('subtext', 'ABSOLUTE', 'Palabra chica'),
        O('url', '', 'Foto opcional (se pasa a blanco y negro)'),
        O('size', '1', 'Escala del texto (0.5 - 2)'),
        O('color', 'ffffff', 'Color del texto hex sin #')
      ] },
      { id: 'bobesponja', desc: 'Bob Esponja muestra una hoja: texto o imagen', params: [
        O('text', 'Welcome to Velirius API', 'Texto en la hoja'),
        O('url', '', 'Imagen para la hoja (reemplaza el texto)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        ...textStyle()
      ] },
      { id: 'bobesponja2', desc: 'Cómic de 4 viñetas: texto o imagen en la hoja', params: [
        O('text', 'mi tarea', 'Texto en la hoja'),
        O('url', '', 'Imagen para la hoja (reemplaza el texto)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        ...textStyle()
      ] },
      { id: 'bobesponja3', desc: 'Bob Esponja con cartel: texto o imagen', params: [
        O('text', 'tu texto aquí', 'Texto del cartel'),
        O('url', '', 'Imagen para el cartel (reemplaza el texto)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        ...textStyle()
      ] },
      { id: 'canvatextoxd', desc: 'Muñeco 3D con cartel en blanco', params: [
        O('text', 'tu texto aquí', 'Texto del cartel'),
        O('url', '', 'Imagen para el cartel (reemplaza el texto)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        ...textStyle()
      ] },
      { id: 'imagencanba', desc: 'Tu imagen (o texto) dentro de MS Paint', params: [
        O('url', AV, 'Imagen dentro del lienzo'),
        O('text', '', 'Texto dentro del lienzo (reemplaza la imagen)'),
        S('mode', '', 'auto = decide por parámetros', ['', 'text', 'image']),
        O('color', '111111', 'Color del texto hex sin #'),
        O('size', '1', 'Escala del texto (0.5 - 2)'),
        O('zoom', '1', 'Zoom de la imagen')
      ] },
      { id: 'canvaimagen', desc: 'Wojaks señalando tu imagen (pantalla verde)', params: [
        P('url', AV, 'Tu imagen'),
        ...photoStyle()
      ] },
      { id: 'fotopc', desc: 'Tu imagen en la pantalla de la PC', params: [
        P('url', AV, 'Tu imagen'),
        ...photoStyle()
      ] },
      { id: 'sebusca', desc: 'Cartel SE BUSCA vivo o muerto', params: [
        P('url', AV, 'Foto del buscado'),
        O('name', 'EL MAS BUSCADO', 'Apodo bajo la foto'),
        O('zoom', '1', 'Zoom de la foto')
      ] },
      { id: 'pokemoncard', desc: 'Carta Pokémon personalizada', params: [
        P('name', 'Velirius', 'Nombre de la carta'),
        O('hp', '120', 'Puntos de salud'),
        P('url', AV, 'Arte de la carta'),
        O('type', 'Legendario', 'Tipo'),
        O('attack', 'Golpe API', 'Nombre del ataque'),
        O('damage', '90', 'Daño del ataque'),
        O('description', 'Una carta creada con Velirius API.', 'Descripción')
      ] },
      { id: 'ship', desc: 'Genera una tarjeta de medidor de compatibilidad con avatares recortados en corazón.', params: [
        P('name1', 'Velirius', 'Primer nombre'),
        P('name2', 'dls', 'Segundo nombre'),
        O('percentage', '85', 'Porcentaje opcional (0-100)'),
        O('text', 'Best Friends', 'Etiqueta personalizada (ej. Best Friends)'),
        O('image1', AV, 'Primer avatar (URL o imagen de tu galería)'),
        O('image2', AV2, 'Segundo avatar (URL o imagen de tu galería)')
      ] },
      { id: 'friendship', desc: 'Genera una tarjeta de medidor de amistad con avatares circulares y porcentaje.', params: [
        P('name1', 'Velirius', 'Primer nombre'),
        P('name2', 'dls', 'Segundo nombre'),
        O('percentage', '85', 'Porcentaje opcional (0-100)'),
        O('text', 'Best Friends', 'Etiqueta personalizada (ej. Best Friends)'),
        O('image1', AV, 'Primer avatar (URL o imagen de tu galería)'),
        O('image2', AV2, 'Segundo avatar (URL o imagen de tu galería)')
      ] },
      { id: 'gaycard', desc: 'Tarjeta GAY PERCENTAGE', params: [
        P('url', AV, 'Foto'),
        O('name', 'Velirius', 'Nombre'),
        O('percentage', '12', 'Porcentaje opcional (0-100)')
      ] },
      { id: 'gay', desc: 'Filtro arcoíris sobre tu foto', params: [
        P('url', AV, 'Tu foto'),
        O('opacity', '0.45', 'Intensidad del filtro 0-1')
      ] },
      { id: 'invert', desc: 'Invierte los colores de tu foto', params: [
        P('url', AV, 'Tu foto')
      ] },
      { id: 'rata', desc: 'Tu cara en la rata', params: [
        P('url', AV, 'Tu foto o cara'),
        ...photoStyle()
      ] },
      { id: 'banana', desc: 'Tu cara en la banana', params: [
        P('url', AV, 'Tu foto o cara'),
        ...photoStyle()
      ] },
      { id: 'arandano', desc: 'Tu cara en el arándano', params: [
        P('url', AV, 'Tu foto o cara'),
        ...photoStyle()
      ] },
      { id: 'pan', desc: 'Tu cara en el pan', params: [
        P('url', AV, 'Tu foto o cara'),
        ...photoStyle()
      ] },
      { id: 'galletita', desc: 'Tu cara en la galletita', params: [
        P('url', AV, 'Tu foto o cara'),
        ...photoStyle()
      ] },
      { id: 'minions', desc: 'Tus caras en los 3 Minions', params: [
        P('url', AV, 'Cara izquierda'),
        O('url2', AV2, 'Cara del medio'),
        O('url3', AV, 'Cara de la derecha'),
        O('zoom', '1', 'Zoom de las caras')
      ] }
    ]
  },

  // ======================================================================
  {
    id: 'tools', name: 'TOOLS',
    endpoints: [
      { id: 'calculator', desc: 'Calculadora scientific: resuelve expresiones matemáticas', params: [
        P('expr', '(2+3)*4^2 + sqrt(81)', 'Expresión: + - * / % ^ ( ) sqrt() sin() cos() pi e…'),
        O('degrees', 'false', 'true = trigonometría en grados')
      ] },
      { id: 'translator', desc: 'Traduce texto entre idiomas (Google + MyMemory)', params: [
        P('text', 'Hola, bienvenido a Velirius API', 'Texto a traducir'),
        O('to', 'en', 'Idioma destino (en, es, pt, fr, ja…)'),
        O('from', 'auto', 'Idioma origen o auto')
      ] },
      { id: 'morse', desc: 'Código Morse: codifica o decodifica texto', params: [
        P('text', 'SOS', 'Texto o código morse'),
        S('mode', 'encode', 'encode = texto → morse, decode = morse → texto', ['encode', 'decode']),
        O('separator', '/', 'Separador entre palabras al codificar')
      ] }
    ]
  },

  // ======================================================================
  {
    id: 'downloader', name: 'DOWNLOADER',
    endpoints: [
      { id: 'tiktok', desc: 'TikTok SIN marca de agua (video HD + audio MP3)', params: [
        P('url', 'https://vt.tiktok.com/ZS43DntHW/', 'URL del TikTok'),
        S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4', 'mp3'])
      ] },
      { id: 'youtube', desc: 'Info y formatos de un video de YouTube', params: [
        O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL del video'),
        O('query', '', 'O busca por nombre'),
        O('quality', '720', 'Calidad preferida (360/480/720/1080)'),
        S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4', 'mp3'])
      ] },
      { id: 'facebook', desc: 'Descarga videos públicos de Facebook (HD/SD)', params: [
        P('url', 'https://www.facebook.com/watch/?v=10153231379946729', 'URL del video o reel público'),
        S('direct', '', 'Devuelve el archivo en vez de JSON', ['', 'mp4']),
        S('quality', '', 'Preferencia de calidad', ['', 'hd', 'sd'])
      ] },
      { id: 'instagram', desc: 'Reels, videos y fotos de Instagram', params: [
        P('url', 'https://www.instagram.com/reel/C7cVzn2yzXB/', 'URL del post/reel'),
        O('direct', 'false', 'true = media directa')
      ] },
      { id: 'mp3', desc: 'Audio MP3 desde YouTube (URL o búsqueda)', media: 'audio', params: [
        O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'),
        O('query', 'Twice I Cant Stop Me', 'O busca por nombre'),
        O('direct', 'true', 'true = audio directo en streaming')
      ] },
      { id: 'mp4', desc: 'Video MP4 desde YouTube (URL o búsqueda)', media: 'video', params: [
        O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'),
        O('query', 'Twice', 'O busca por nombre'),
        O('quality', '360', '360/480/720/1080'),
        O('direct', 'true', 'true = video directo en streaming')
      ] },
      { id: 'play', desc: 'Busca una canción y devuelve el audio listo para reproducir', media: 'audio', params: [
        P('query', 'Lisa Money', 'Canción o artista'),
        O('direct', 'true', 'true = audio directo en streaming')
      ] },
      { id: 'lyric', desc: 'Letra de una canción (JSON, .txt o .lrc sincronizada)', params: [
        P('query', 'Kendrick Lamar Humble', 'Artista + canción'),
        S('format', 'json', 'Formato de salida', ['json', 'txt', 'lrc'])
      ] }
    ]
  },

  // ======================================================================
  {
    id: 'searcher', name: 'SEARCHER',
    endpoints: [
      { id: 'tiktok', desc: 'Busca videos en TikTok (TikWM)', media: 'image', params: [
        P('query', 'anime edit', 'Palabra clave'),
        O('limit', '10', 'Cantidad de resultados (1-30)')
      ] },
      { id: 'youtube', desc: 'Busca videos en YouTube', media: 'image', params: [
        P('query', 'Twice', 'Palabra clave'),
        O('limit', '10', 'Cantidad de resultados (1-30)')
      ] },
      { id: 'google', desc: 'Busca en Google (con respaldo en DuckDuckGo)', params: [
        P('query', 'Velirius API', 'Qué quieres buscar'),
        O('limit', '10', 'Cantidad de resultados (1-20)'),
        O('lang', 'es', 'Idioma de la búsqueda (es, en, pt…)')
      ] },
      { id: 'wikipedia', desc: 'Busca artículos en Wikipedia con extracto e imagen', media: 'image', params: [
        P('query', 'One Piece', 'Tema a buscar'),
        O('limit', '8', 'Cantidad de artículos (1-20)'),
        O('lang', 'es', 'Idioma de Wikipedia (es, en, pt…)')
      ] }
    ]
  },

  // ======================================================================
  {
    id: 'reactions', name: 'REACTIONS',
    endpoints: Object.entries(require('./utils/providers').REACTIONS).map(([id, label]) => ({
      id,
      desc: `GIF de ${label.toLowerCase()} (nekos.best · waifu.pics · purrbot · otakugifs)`,
      media: 'image',
      params: [
        S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'waifu.pics', 'purrbot', 'otakugifs']),
        O('direct', 'false', 'true = devuelve el GIF directamente')
      ]
    }))
  }
];

// ---------- Parámetros "avanzados" (se ocultan tras un botón en la web) ----------
// Los estilos de texto/foto no hacen falta para probar un endpoint: se agrupan
// detrás de "Opciones avanzadas" para que el probador no quede lleno de campos.
const ADVANCED_PARAMS = new Set([
  'color', 'bg', 'size', 'font', 'uppercase', 'x', 'y', 'rotate', 'spacing',
  'zoom', 'grayscale', 'shadow', 'mode', 'align', 'opacity', 'subtext'
]);
for (const cat of CATEGORIES) {
  for (const ep of cat.endpoints) {
    for (const p of ep.params) {
      if (ADVANCED_PARAMS.has(String(p.name).toLowerCase())) p.advanced = true;
    }
  }
}

function totals() {
  return {
    routers: CATEGORIES.length,
    endpoints: CATEGORIES.reduce((n, c) => n + c.endpoints.length, 0)
  };
}

function findCategory(id) {
  return CATEGORIES.find(c => c.id === String(id).toLowerCase()) || null;
}

function findEndpoint(categoryId, endpointId) {
  const cat = findCategory(categoryId);
  if (!cat) return null;
  return cat.endpoints.find(e => e.id === String(endpointId).toLowerCase()) || null;
}

function exampleQuery(endpoint, avatarUrl, avatar2Url) {
  const qs = new URLSearchParams();
  for (const p of endpoint.params) {
    if (p.example === '' || p.example === undefined || p.example === null) continue;
    let v = String(p.example);
    if (v === AV) { if (!avatarUrl) continue; v = avatarUrl; }
    if (v === AV2) { if (!avatar2Url) continue; v = avatar2Url; }
    qs.set(p.name, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

module.exports = { CATEGORIES, totals, findCategory, findEndpoint, exampleQuery };
