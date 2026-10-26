// src/catalog/tools.js — Endpoints de la categoría **TOOLS**.
//
// ▸ AGREGAR un endpoint: copiá una entrada de la lista y cambiá `id`, `desc` y `params`.
// ▸ EDITAR uno: cambiá su `desc`, el orden en la lista o cualquiera de sus `params`.
// ▸ BORRAR uno: quitá la entrada (y su ruta en src/routes/tools.js).
//
// Formato de una entrada:
//
//   {
//     id: 'miEndpoint',          // = la ruta: GET /tools/miEndpoint  (minúsculas, sin espacios)
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
  id: 'tools',
  name: 'TOOLS',
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
};
