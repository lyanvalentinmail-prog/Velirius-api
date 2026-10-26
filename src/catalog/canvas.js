// src/catalog/canvas.js — Endpoints de la categoría **CANVAS**.
//
// ▸ AGREGAR un endpoint: copiá una entrada de la lista y cambiá `id`, `desc` y `params`.
// ▸ EDITAR uno: cambiá su `desc`, el orden en la lista o cualquiera de sus `params`.
// ▸ BORRAR uno: quitá la entrada (y su ruta en src/routes/canvas.js).
// ▸ CANVAS nuevo: además hace falta src/canvas/generators/<id>.js y un bloque en
//   src/canvas/layouts.js. Guía completa: CONTRIBUTING.md.
//
// Formato de una entrada:
//
//   {
//     id: 'miEndpoint',          // = la ruta: GET /canvas/miEndpoint  (minúsculas, sin espacios)
//     desc: 'Qué hace',          // se ve en la web, en /docs y en el README
//     media: 'image',            // opcional: 'image' | 'video' | 'audio' (vista previa en la web)
//     params: [
//       P('text', 'hola', 'Texto principal'),   // requerido
//       O('size', '1', 'Escala (0.5 - 2)')      // opcional
//     ]
//   }
//
// Ayudas (src/catalog/helpers.js): P, O, S, AV, AV2, textStyle(), photoStyle().
const { P, O, S, AV, AV2, textStyle, photoStyle } = require('./helpers');

module.exports = {
  id: 'canvas',
  name: 'CANVAS',
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
};
