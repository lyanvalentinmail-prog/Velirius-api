// src/canvas/generators/invert.js — invert

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, loadImageBuffer, imgParam, P, partsOf
} = require('./_helpers');

module.exports = async function invert(q) {
  const parts = partsOf('invert');
  const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
  const maxW = Math.round(P.num(q, 'photo', 'width', parts.photo.maxWidth, 64, 4096));
  const img = sharp(user).rotate();
  const meta = await img.metadata();
  const out = meta.width && meta.width > maxW
    ? await img.resize(maxW, null).negate({ alpha: false }).png().toBuffer()
    : await img.negate({ alpha: false }).png().toBuffer();
  return out;
};
