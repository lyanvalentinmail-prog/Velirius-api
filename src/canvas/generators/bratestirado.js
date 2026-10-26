// src/canvas/generators/bratestirado.js — bratestirado (brat con lente esférico)
//
// El texto va grande y centrado, y después se le aplica la lente (`lensWarp`):
// el centro se agranda `lens.stretch` veces y el eje horizontal acompaña con
// `lens.bulge`. Eso es lo que da el efecto "estirado" del sticker original.
//
// Todo se puede cambiar por query:
//   /canvas/bratestirado?text=hola&text.size=1.2&text.fill=ff0044
//   /canvas/bratestirado?canvas.size=1024&bg=8ACE00
//   /canvas/bratestirado?lens.stretch=1.5&lens.bulge=0.8&lens.y=0.45
const {
  sharp, textLayer, txt, styleOf, lensWarp, fitLines, P, partsOf
} = require('./_helpers');

module.exports = async function bratestirado(q) {
  const ov = styleOf(q);
  const parts = partsOf('bratestirado');

  // ---- lienzo ----
  const S = Math.round(P.num(q, 'canvas', 'size', parts.canvas.width, 200, 2000));
  const bg = ov.bg || P.bg(q, 'canvas', parts.canvas.bg);

  // ---- tipografía ----
  const t = P.style(q, 'text', parts.text.font);
  const fill = ov.fill || P.color(q, 'text', 'fill', parts.text.fill);
  const family = ov.font || t.family;
  const spacing = t.spacing + (ov.spacing || 0);
  const text = txt(q, 'i <3 money');

  // ---- lente ----
  const stretch = P.num(q, 'lens', 'stretch', parts.lens.stretch, 1, 1.9);
  const bulge = P.num(q, 'lens', 'bulge', parts.lens.bulge, 0, 1);
  const centerY = P.num(q, 'lens', 'y', parts.lens.y, 0.1, 0.9);
  const k = Math.max(0, Math.min(1.5, stretch - 1));

  // ---- área de texto ----
  // La lente agranda el centro hasta (1 + k) en vertical y (1 + k·bulge) en
  // horizontal, así que el texto se maqueta más chico para que la deformación
  // no lo saque del lienzo.
  const box = P.area(q, 'text', parts.text.box);
  const availW = ((box.x1 - box.x0) * S) / (1 + k * bulge);
  const availH = ((box.y1 - box.y0) * S) / (1 + k);

  // Elige el tamaño más grande que entra partiendo por palabras (nunca corta ni
  // parte una palabra) y deja crecer el bloque hacia abajo si hay más líneas.
  const fit = fitLines(text, {
    width: Math.round(availW),
    height: Math.round(availH * 0.92), // un poco de aire: el texto no toca el borde
    // `?size=` (escala global) y `?text.size=` se multiplican
    maxFont: Math.round(parts.text.font.maxFont * t.size * ov.scale),
    minFont: 12,
    lineHeight: t.lineHeight,
    family,
    weight: t.weight,
    letterSpacing: spacing,
    maxLines: 8
  });

  const size = fit.size;
  const lines = fit.lines;
  const lineH = Math.round(size * t.lineHeight);
  const blockH = lines.length * lineH;
  const left = Math.round((S - availW) / 2 + (ov.dx || 0) * S);
  const top = Math.round(((box.y0 + box.y1) / 2) * S - blockH / 2 + (ov.dy || 0) * S);

  const layers = lines.map((line, i) => ({
    input: textLayer({
      text: line,
      width: Math.round(availW),
      height: lineH,
      family,
      weight: t.weight,
      maxFont: size,
      minFont: 8,
      maxLines: 1,
      fill,
      align: 'middle',
      letterSpacing: spacing,
      rotate: t.rotate + (ov.rotate || 0),
      uppercase: t.uppercase || ov.uppercase
    }).svg,
    left,
    top: top + i * lineH
  }));

  const flatImg = await sharp({ create: { width: S, height: S, channels: 4, background: bg } })
    .composite(layers)
    .png()
    .toBuffer();

  // Con stretch = 1 y bulge = 0 la lente no hace nada (queda el brat normal).
  if (stretch > 1.001 || bulge > 0.001) {
    return lensWarp(flatImg, { stretch, bulge, centerY });
  }
  return flatImg;
};
