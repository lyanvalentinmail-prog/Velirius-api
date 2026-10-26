// src/catalog/anime.js — Endpoints de la categoría **ANIME**.
//
// ▸ AGREGAR un endpoint: copiá una entrada de la lista y cambiá `id`, `desc` y `params`.
// ▸ EDITAR uno: cambiá su `desc`, el orden en la lista o cualquiera de sus `params`.
// ▸ BORRAR uno: quitá la entrada (y su ruta en src/routes/anime.js).
//
// Formato de una entrada:
//
//   {
//     id: 'miEndpoint',          // = la ruta: GET /anime/miEndpoint  (minúsculas, sin espacios)
//     desc: 'Qué hace',          // se ve en la web, en /docs y en el README
//     media: 'image',            // opcional: 'image' | 'video' | 'audio' (vista previa en la web)
//     params: [
//       P('text', 'hola', 'Texto principal'),   // requerido
//       O('size', '1', 'Escala (0.5 - 2)')      // opcional
//     ]
//   }
//
// Ayudas (src/catalog/helpers.js): P, O, S, AV, AV2, textStyle(), photoStyle().
const { P, O, S } = require('./helpers');

module.exports = {
  id: 'anime',
  name: 'ANIME',
  endpoints: [
    { id: 'neko', desc: 'Imagen aleatoria de neko (chica gato). Proveedores: nekos.best, danbooru, purrbot, safebooru, konachan', media: 'image', params: [
      S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'danbooru', 'purrbot', 'safebooru', 'konachan']),
      O('amount', '1', 'Cantidad de imágenes (1-10)'),
      O('direct', 'false', 'true = devuelve la imagen directamente')
    ] },
    { id: 'waifu', desc: 'Imagen aleatoria de waifu. Proveedores: nekos.best, danbooru, safebooru, pic.re, konachan', media: 'image', params: [
      S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'nekos.best', 'danbooru', 'safebooru', 'pic.re', 'konachan']),
      O('amount', '1', 'Cantidad de imágenes (1-10)'),
      O('direct', 'false', 'true = devuelve la imagen directamente')
    ] },
    { id: 'maid', desc: 'Imagen aleatoria de maid (sirvienta). Proveedores: danbooru, safebooru, konachan', media: 'image', params: [
      S('provider', '', 'Forzar proveedor (vacío = automático)', ['', 'danbooru', 'safebooru', 'konachan']),
      O('amount', '1', 'Cantidad de imágenes (1-10)'),
      O('direct', 'false', 'true = devuelve la imagen directamente')
    ] },
    { id: 'pokemon', desc: 'Pokémon por nombre o ID: arte oficial, tipos, stats y descripción (PokeAPI)', media: 'image', params: [
      P('query', 'pikachu', 'Nombre o ID del Pokémon. Usa "random" para uno al azar'),
      O('shiny', 'false', 'true = arte shiny'),
      O('direct', 'false', 'true = devuelve solo la imagen')
    ] }
  ]
};
