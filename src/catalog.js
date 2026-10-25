// src/catalog.js — Catálogo único: alimenta /home, las categorías, /docs y el probador RUN.
// AVATAR se reemplaza en tiempo de render por la URL absoluta de /img/default-avatar.jpg
const AV = '__AVATAR__';
const AV2 = '__AVATAR2__';

const P = (name, example, desc = '', required = true) => ({ name, example, desc, required });
const O = (name, example, desc = '') => ({ name, example, desc, required: false });

const canvasText = [
  P('text', 'Welcome to Velirius API', 'Texto del cartel')
];

const CATEGORIES = [
  {
    id: 'anime', name: 'ANIME',
    endpoints: [
      { id: 'pokemon', desc: 'Pokédex: datos, stats y arte oficial (PokeAPI)', params: [P('query', 'pikachu', 'Nombre o ID. Usa "random" al azar'), O('shiny', 'false', 'true = arte shiny')] },
      { id: 'gacha', desc: 'Personaje al azar con rareza (common → legendary)', params: [] },
      { id: 'character', desc: 'Busca personajes de anime (Jikan)', params: [P('query', 'Monkey D. Luffy', 'Nombre del personaje'), O('limit', '10', 'Resultados (1-25)')] },
      { id: 'manga', desc: 'Busca manga: portada, score y sinopsis (Jikan)', params: [P('query', 'Berserk', 'Título del manga'), O('limit', '10', 'Resultados (1-25)')] },
      { id: 'anime', desc: 'Busca anime: episodios, score y trailer (Jikan)', params: [P('query', 'Naruto', 'Título del anime'), O('limit', '10', 'Resultados (1-25)')] }
    ]
  },
  {
    id: 'canvas', name: 'CANVAS',
    endpoints: [
      { id: 'quotly', desc: 'Sticker de cita estilo Telegram', params: [P('image', AV, 'URL del avatar'), P('username', 'Velirius Api', 'Nombre visible'), P('text', 'Welcome to Velirius Api', 'Mensaje'), O('bg', '000000', 'Fondo hex sin #')] },
      { id: 'brat', desc: 'Texto brat (blanco, minúsculas, blur)', params: [...canvasText, O('bg', 'ffffff', 'Fondo hex'), O('color', '000000', 'Texto hex')] },
      { id: 'bratvideo', desc: 'Brat animado palabra por palabra (MP4)', params: canvasText, media: 'video' },
      { id: 'bratestirado', desc: 'Brat estirado con lente ojo de pez', params: [P('text', 'i <3 money', 'Texto a estirar')] },
      { id: 'bratanime', desc: 'Maid de anime sosteniendo tu texto', params: canvasText },
      { id: 'bratcoyote', desc: 'El Coyote sosteniendo tu texto', params: canvasText },
      { id: 'bratpinguino', desc: 'Gunter (pingüino) con cartel: texto o imagen', params: [P('text', 'Welcome to Velirius API', 'Texto del cartel'), O('image', '', 'O pega una imagen en el cartel (borra el texto)')] },
      { id: 'ttp', desc: 'Texto a sticker (letras espaciadas)', params: [P('text', 'Hola', 'Texto'), O('color', 'white', 'Color: white, black, red…')] },
      { id: 'attp', desc: 'TTP animado arcoíris (WebM sticker)', params: [P('text', 'Welcome to Velirius', 'Texto animado')], media: 'video' },
      { id: 'iqc', desc: 'Chat falso de WhatsApp con cita y menú', params: [P('text', 'Yo siempre te voy a amar', 'Mensaje principal'), O('quote', 'vooooss seguro', 'Mensaje citado'), O('username', 'Tú', 'Autor de la cita'), O('time', '7:32 p. m.', 'Hora')] },
      { id: 'cuentatiktok', desc: 'Menú falso de TikTok "Account not found"', params: [O('username', 'Account not found', 'Nombre de la cuenta'), O('image', AV, 'Avatar'), O('status', 'Sent', 'Texto bajo el nombre')] },
      { id: 'storyreply', desc: '"Replied to your story" con tu foto y mensaje', params: [P('url', AV, 'Foto de la historia'), P('text', 'jajaja total', 'Respuesta')] },
      { id: 'absolutecinema', desc: 'Meme ABSOLUTE CINEMA con tu texto', params: [O('text', 'CINEMA', 'Palabra grande'), O('subtext', 'ABSOLUTE', 'Palabra chica'), O('url', '', 'Foto opcional en blanco y negro')] },
      { id: 'bobesponja', desc: 'Bob Esponja muestra una hoja: texto o imagen', params: [O('text', 'Welcome to Velirius API', 'Texto en la hoja'), O('url', '', 'O imagen en la hoja (borra el texto)')] },
      { id: 'bobesponja2', desc: 'Cómic de 4 viñetas: texto o imagen en la hoja', params: [O('text', 'mi tarea', 'Texto en la hoja'), O('url', '', 'O imagen en la hoja (borra el texto)')] },
      { id: 'bobesponja3', desc: 'Bob Esponja con cartel: texto o imagen', params: [O('text', 'tu texto aquí', 'Texto del cartel'), O('url', '', 'O imagen en el cartel (borra el texto)')] },
      { id: 'canvatextoxd', desc: 'Muñeco 3D con cartel en blanco', params: [O('text', 'tu texto aquí', 'Texto del cartel'), O('url', '', 'O imagen en el cartel (borra el texto)')] },
      { id: 'imagencanba', desc: 'Tu imagen (o texto) dentro de MS Paint', params: [O('url', AV, 'Imagen en el lienzo'), O('text', '', 'O texto en el lienzo (borra la imagen)')] },
      { id: 'canvaimagen', desc: 'Wojaks señalando tu imagen (pantalla verde)', params: [P('url', AV, 'Tu imagen')] },
      { id: 'fotopc', desc: 'Tu imagen en la pantalla de la PC (Lain)', params: [P('url', AV, 'Tu imagen')] },
      { id: 'sebusca', desc: 'Cartel SE BUSCA vivo o muerto', params: [P('url', AV, 'Foto del buscado'), O('name', 'EL MAS BUSCADO', 'Apodo bajo la foto'), O('reward', '$5,000.00', 'Recompensa')] },
      { id: 'pokemoncard', desc: 'Carta Pokémon personalizada', params: [P('name', 'Velirius', 'Nombre'), O('hp', '120', 'Puntos de salud'), P('url', AV, 'Arte de la carta'), O('type', 'Legendario', 'Tipo'), O('attack', 'Golpe API', 'Ataque'), O('damage', '90', 'Daño'), O('description', 'Una carta creada con Velirius API.', 'Descripción')] },
      { id: 'ship', desc: 'Medidor de compatibilidad (corazones)', params: [P('image1', AV, 'Foto 1'), P('name1', 'Velirius', 'Nombre 1'), P('image2', AV2, 'Foto 2'), P('name2', 'dls', 'Nombre 2'), O('percentage', '85', '0-100 (vacío = al azar)'), O('text', 'Best Friends', 'Frase central')] },
      { id: 'friendship', desc: 'Medidor de amistad (círculos)', params: [P('image1', AV, 'Foto 1'), P('name1', 'Velirius', 'Nombre 1'), P('image2', AV2, 'Foto 2'), P('name2', 'dls', 'Nombre 2'), O('percentage', '85', '0-100 (vacío = al azar)'), O('text', 'Best Friends', 'Frase central')] },
      { id: 'gaycard', desc: 'Tarjeta GAY PERCENTAGE', params: [P('url', AV, 'Foto'), O('name', 'Velirius', 'Nombre'), O('rank', '12', 'Porcentaje 0-100 (vacío = al azar)')] },
      { id: 'gay', desc: 'Filtro arcoíris sobre tu foto', params: [P('url', AV, 'Tu foto'), O('opacity', '0.45', 'Intensidad 0-1')] },
      { id: 'invert', desc: 'Invierte los colores de tu foto', params: [P('url', AV, 'Tu foto')] },
      { id: 'rata', desc: 'Tu cara en la rata', params: [P('url', AV, 'Tu foto/cara')] },
      { id: 'banana', desc: 'Tu cara en la banana', params: [P('url', AV, 'Tu foto/cara')] },
      { id: 'arandano', desc: 'Tu cara en el arándano', params: [P('url', AV, 'Tu foto/cara')] },
      { id: 'pan', desc: 'Tu cara en el pan', params: [P('url', AV, 'Tu foto/cara')] },
      { id: 'galletita', desc: 'Tu cara en la galletita', params: [P('url', AV, 'Tu foto/cara')] },
      { id: 'minions', desc: 'Tus caras en los 3 Minions', params: [P('url', AV, 'Cara principal (se repite)'), O('url2', AV2, 'Cara del medio'), O('url3', AV, 'Cara de la derecha')] }
    ]
  },
  {
    id: 'download', name: 'DOWNLOAD',
    endpoints: [
      { id: 'tiktok', desc: 'TikTok SIN marca de agua (HD + MP3)', params: [P('url', 'https://vt.tiktok.com/ZS43DntHW/', 'URL del TikTok'), O('direct', '', 'mp4 o mp3 = archivo directo')] },
      { id: 'youtube', desc: 'Info y formatos de un video de YouTube', params: [P('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL del video'), O('quality', '720', 'Calidad preferida'), O('direct', '', 'mp4 o mp3 = archivo directo')] },
      { id: 'mp3', desc: 'Audio MP3 desde YouTube (URL o búsqueda)', params: [O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'), O('query', 'Twice I Cant Stop Me', 'O busca por nombre'), O('direct', 'true', 'true = audio directo')], media: 'audio' },
      { id: 'mp4', desc: 'Video MP4 desde YouTube (URL o búsqueda)', params: [O('url', 'https://www.youtube.com/watch?v=5M_n2UCe7DQ', 'URL de YouTube'), O('query', 'Twice', 'O busca por nombre'), O('quality', '360', '360/480/720/1080'), O('direct', 'true', 'true = video directo')], media: 'video' },
      { id: 'play', desc: 'Busca una canción y reproduce el audio', params: [P('query', 'Lisa Money', 'Canción / artista'), O('direct', 'true', 'true = audio directo')], media: 'audio' },
      { id: 'spotify', desc: 'Track de Spotify: info + audio equivalente', params: [P('url', 'https://open.spotify.com/track/37ZtpRBkHcaq6hHy0X98zn', 'URL de Spotify'), O('direct', '', 'true = audio directo')] },
      { id: 'instagram', desc: 'Reels/fotos de Instagram', params: [P('url', 'https://www.instagram.com/reel/C7cVzn2yzXB/', 'URL del post/reel'), O('direct', '', 'true = media directa')] },
      { id: 'aptoide', desc: 'Busca apps en Aptoide con link APK', params: [P('query', 'WhatsApp', 'Nombre de la app'), O('limit', '10', 'Resultados')] },
      { id: 'lyric', desc: 'Letra de canción (.txt / .lrc sincronizada)', params: [P('query', 'Kendrick Lamar Humble', 'Artista + canción'), O('format', 'json', 'json, txt o lrc')] }
    ]
  },
  {
    id: 'search', name: 'SEARCH',
    endpoints: [
      { id: 'sticker', desc: 'Busca stickers sueltos (Sticker.ly)', params: [P('query', 'anime', 'Palabra clave'), O('limit', '20', 'Cantidad')] },
      { id: 'stickerpack', desc: 'Busca packs de stickers (Sticker.ly)', params: [P('query', 'my melody', 'Palabra clave'), O('limit', '10', 'Cantidad de packs')] },
      { id: 'anime', desc: 'Busca anime (Jikan)', params: [P('query', 'One Piece', 'Título'), O('limit', '10', 'Resultados')] },
      { id: 'tiktok', desc: 'Busca videos en TikTok', params: [P('query', 'anime edit', 'Palabra clave'), O('limit', '10', 'Cantidad')] },
      { id: 'youtube', desc: 'Busca videos en YouTube', params: [P('query', 'Twice', 'Palabra clave'), O('limit', '10', 'Cantidad')] },
      { id: 'instagram', desc: 'Perfil público de Instagram por usuario', params: [P('query', 'nayeonyny', 'Usuario sin @')] },
      { id: 'lyric', desc: 'Busca letras (con opción sincronizada)', params: [P('query', 'Twice Feel Special', 'Artista + canción'), O('limit', '10', 'Cantidad')] },
      { id: 'play', desc: 'Busca canciones listas para reproducir (audio)', params: [P('query', 'Blackpink', 'Canción / artista'), O('limit', '10', 'Cantidad')] }
    ]
  },
  {
    id: 'tools', name: 'TOOLS',
    endpoints: [
      { id: 'translator', desc: 'Traduce texto entre idiomas', params: [P('text', 'Hola, bienvenido a Velirius API', 'Texto a traducir'), O('to', 'en', 'Idioma destino (en, es, pt…)'), O('from', 'auto', 'Idioma origen o auto')] },
      { id: 'calculator', desc: 'Calculadora: opera una expresión', params: [P('expr', '(2+3)*4^2 + sqrt(81)', 'Expresión: + - * / % ^ sqrt() pi')] }
    ]
  }
];

function totals() {
  return {
    routers: CATEGORIES.length,
    endpoints: CATEGORIES.reduce((n, c) => n + c.endpoints.length, 0)
  };
}

function findCategory(id) {
  return CATEGORIES.find(c => c.id === String(id).toLowerCase()) || null;
}

function exampleQuery(endpoint, avatarUrl, avatar2Url) {
  const qs = new URLSearchParams();
  for (const p of endpoint.params) {
    if (p.example === '' || p.example === undefined) continue;
    let v = String(p.example);
    if (v === AV) { if (!avatarUrl) continue; v = avatarUrl; }
    if (v === AV2) { if (!avatar2Url) continue; v = avatar2Url; }
    // En ejemplos RUN evitamos direct vacío y parámetros opcionales sin ejemplo
    qs.set(p.name, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

module.exports = { CATEGORIES, totals, findCategory, exampleQuery };
