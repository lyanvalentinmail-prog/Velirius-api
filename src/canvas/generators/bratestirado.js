// src/canvas/generators/bratestirado.js — bratestirado
// Estilo: "i <3 money" con tipografía grande y estirada.
// Parámetros:
// /canvas/bratestirado?canvas.size=1024
// /canvas/bratestirado?text.fill=000000
// /canvas/bratestirado?text.size=1.2
// /canvas/bratestirado?lens.stretch=1.1
// /canvas/bratestirado?lens.bulge=0.2
// /canvas/bratestirado?bg=ffffff

const {
  sharp,
  textLayer,
  txt,
  styleOf,
  lensWarp,
  P,
  partsOf
} = require('./_helpers');

module.exports = async function bratestirado(q) {
  const ov = styleOf(q);
  const parts = partsOf('bratestirado');

  // ---- Canvas ----
  const S = Math.round(
    P.num(q, 'canvas', 'size', parts.canvas.width, 200, 2000)
  );

  const bg = ov.bg || P.bg(q, 'canvas', parts.canvas.bg);

  // ---- Estilo del texto ----
  const t = P.style(q, 'text', parts.text.font);

  const fill = ov.fill || P.color(q, 'text', 'fill', '000000');
  const family = ov.font || t.family;
  const weight = Math.max(900, Number(t.weight) || 900);

  const spacing = t.spacing + (ov.spacing || 0);
  const dx = (ov.dx || 0) * S;
  const dy = (ov.dy || 0) * S;

  const scale = Math.max(0.1, Number(t.size) || 1);

  // ---- Lente opcional ----
  const stretch = P.num(
    q, 'lens', 'stretch', parts.lens.stretch, 1, 1.9
  );

  const bulge = P.num(
    q, 'lens', 'bulge', parts.lens.bulge, 0, 1
  );

  const centerY = P.num(
    q, 'lens', 'y', parts.lens.y, 0.1, 0.9
  );

  // ---- Fondo ----
  const base = await sharp({
    create: {
      width: S,
      height: S,
      channels: 4,
      background: bg
    }
  })
    .png()
    .toBuffer();

  // ---- Texto superior ----
  // "i <3", grande, centrado y con espacio alrededor.
  const topText = 'i <3';

  const topWidth = Math.round(S * 0.90);
  const topHeight = Math.round(S * 0.46);

  const topLayer = textLayer({
    text: topText,
    width: topWidth,
    height: topHeight,
    family,
    weight,
    maxFont: Math.round(S * 0.43 * scale),
    minFont: 12,
    maxLines: 1,
    fill,
    align: 'middle',
    rotate: 0,
    letterSpacing: spacing
  });

  // ---- Texto inferior ----
  // "money", mucho más grande y ocupando casi todo el ancho.
  const bottomText = 'money';

  const bottomWidth = Math.round(S * 1.08);
  const bottomHeight = Math.round(S * 0.53);

  const bottomLayer = textLayer({
    text: bottomText,
    width: bottomWidth,
    height: bottomHeight,
    family,
    weight,
    maxFont: Math.round(S * 0.48 * scale),
    minFont: 12,
    maxLines: 1,
    fill,
    align: 'middle',
    rotate: 0,
    letterSpacing: spacing
  });

  // ---- Composición ----
  const topLeft = Math.round((S - topWidth) / 2 + dx);
  const topPosition = Math.round(S * 0.025 + dy);

  const bottomLeft = Math.round((S - bottomWidth) / 2 + dx);
  const bottomPosition = Math.round(S * 0.51 + dy);

  const image = await sharp(base)
    .composite([
      {
        input: topLayer.svg,
        left: topLeft,
        top: topPosition
      },
      {
        input: bottomLayer.svg,
        left: bottomLeft,
        top: bottomPosition
      }
    ])
    .png()
    .toBuffer();

  // ---- Deformación opcional ----
  if (stretch > 1 || bulge > 0) {
    return lensWarp(image, {
      stretch,
      bulge,
      centerY
    });
  }

  return image;
};
