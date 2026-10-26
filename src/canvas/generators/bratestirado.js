// src/canvas/generators/bratestirado.js — bratestirado
// Partes: canvas (lienzo) · text (texto centrado) · lens (lente esférico).
//   /canvas/bratestirado?text.size=1.2&lens.stretch=1.5&bg=8ACE00&text.fill=ff0044

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, textLayer, txt, styleOf, lensWarp, fitLines, P, partsOf
} = require('./_helpers');

module.exports = async function bratestirado(q) {
  const ov = styleOf(q);
  const parts = partsOf('bratestirado');
  const S = Math.round(P.num(q, 'canvas', 'size', parts.canvas.width, 200, 2000));
  const bg = ov.bg || P.bg(q, 'canvas', parts.canvas.bg);
  const box = P.area(q, 'text', parts.text.box);
  const t = P.style(q, 'text', parts.text.font);
  const fill = ov.fill || P.color(q, 'text', 'fill', parts.text.fill);
  const family = ov.font || t.family;
  const text = txt(q, 'i <3 money').slice(0, 120);

  // ---- lente: el centro se agranda `stretch` veces ----
  const stretch = P.num(q, 'lens', 'stretch', parts.lens.stretch, 1, 1.9);
  const bulge = P.num(q, 'lens', 'bulge', parts.lens.bulge, 0, 1);
  const centerY = P.num(q, 'lens', 'y', parts.lens.y, 0.1, 0.9);

  // El texto se compone como si fuera plano y la lente lo estira después, así
  // que se deja el margen que la lente va a comerse (1/stretch).
  // el ancho se deja con margen para que la lente no lo saque del lienzo;
  // el alto NO se divide: la gracia es que el centro quede más grande.
  const availW = (box.x1 - box.x0) * S / Math.max(1, 1 + (stretch - 1) * bulge);
  const availH = (box.y1 - box.y0) * S;

  // 0.86 deja aire arriba/abajo: el texto nunca toca el borde del lienzo
  const fit = fitLines(text, {
    width: Math.round(availW), height: Math.round(availH * 0.86),
    maxFont: Math.round(parts.text.font.maxFont * t.size), minFont: 12,
    lineHeight: t.lineHeight, family, weight: t.weight,
    letterSpacing: t.spacing + (ov.spacing || 0), maxLines: 8
  });
  const size = fit.size;
  const lines = fit.lines;
  const lineH = Math.round(size * t.lineHeight);
  const blockH = Math.max(lineH, lines.length * lineH);
  const left = Math.round(S * box.x0 + (S * (box.x1 - box.x0) - availW) / 2);
  const top = Math.round(S * box.y0 + (S * (box.y1 - box.y0) - blockH) / 2 + (ov.dy || 0) * S);

  const comps = lines.map((ln, i) => ({
    input: textLayer({
      text: ln, width: Math.round(availW), height: lineH,
      family, weight: t.weight, maxFont: size, minFont: 8, maxLines: 1,
      fill, align: t.align || 'middle', rotate: t.rotate,
      letterSpacing: t.spacing + (ov.spacing || 0)
    }).svg,
    left: Math.round(left + (ov.dx || 0) * S),
    top: top + i * lineH
  }));

  const base = await sharp({ create: { width: S, height: S, channels: 4, background: bg } }).png().toBuffer();
  const flatImg = await sharp(base).composite(comps).png().toBuffer();
  return lensWarp(flatImg, { stretch, bulge, centerY });
};
