// src/canvas/generators/gay.js — gay
// Partes: photo (recorte) · overlay (franjas arcoíris) · maxWidth.

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, loadImageBuffer, imgParam, styleOf, P, partsOf
} = require('./_helpers');

module.exports = async function gay(q) {
  const ov = styleOf(q);
  const parts = partsOf('gay');
  const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
  let img = sharp(user).rotate();
  if (ov.grayscale) img = img.grayscale();
  const meta = await img.metadata();
  const W = Math.min(meta.width || 512, Math.round(P.num(q, 'photo', 'width', parts.photo.maxWidth, 64, 4096)));
  const resized = await img.resize(W, null, { kernel: 'lanczos3' }).png().toBuffer();
  const m2 = await sharp(resized).metadata();
  const colors = parts.overlay.colors;
  const opacity = P.num(q, 'overlay', 'opacity', ov.opacity || parts.overlay.opacity, 0, 1);
  const ow = m2.width || W;
  const oh = m2.height || 1;
  const band = Math.ceil(oh / colors.length);
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}">` +
    colors.map((c, i) => `<rect y="${i * band}" width="${ow}" height="${band}" fill="${c}" fill-opacity="${opacity}"/>`).join('') +
    `</svg>`
  );
  return sharp(resized).composite([{ input: overlay }]).png().toBuffer();
};
