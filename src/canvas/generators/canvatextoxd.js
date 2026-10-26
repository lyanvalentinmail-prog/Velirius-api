// src/canvas/generators/canvatextoxd.js — canvatextoxd

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  signPart
} = require('./_helpers');

module.exports = q => signPart('canvatextoxd', q, { defaultText: 'tu texto aquí' });
