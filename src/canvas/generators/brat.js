// src/canvas/generators/brat.js — brat
// Partes: canvas (lienzo y fondo) · text (bloque de texto).
//   /canvas/brat?text.size=1.2&text.fill=ff0044&canvas.bg=8ACE00
//
// El sticker real es texto Arial (Inter acá) en minúsculas, bien grueso, con
// interlineado apretado y un blur mínimo: parece impreso, no vectorial.

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, textLayer, txt, styleOf, fitLines, P, partsOf
} = require('./_helpers');

/** Grano sutil: el sticker brat real no es un plano perfecto. */
function grainSvg(S) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<rect width="${S}" height="${S}" filter="url(#n)" opacity="0.035"/></svg>`
  );
}

module.exports = async function brat(q) {
  const ov = styleOf(q);
  const parts = partsOf('brat');
  const S = Math.round(P.num(q, 'canvas', 'size', parts.canvas.width, 200, 2000));
  const bg = ov.bg || P.bg(q, 'canvas', parts.canvas.bg);
  const box = P.area(q, 'text', parts.text.box);
  const t = P.style(q, 'text', parts.text.font);
  const color = ov.fill || P.color(q, 'text', 'fill', parts.text.fill);
  const family = ov.font || t.family;
  const text = txt(q, 'Welcome to Velirius API').toLowerCase();
  const body = ov.uppercase || t.uppercase ? text.toUpperCase() : text;

  const pad = Math.round(P.num(q, 'text', 'pad', parts.text.pad ?? 0.06, 0, 0.2) * S);
  const boxW = Math.round((box.x1 - box.x0) * S);
  const boxH = Math.round((box.y1 - box.y0) * S);

  // El texto crece hacia abajo: se elige el tamaño más grande que entra
  // partiendo por palabras (nunca corta ni parte una palabra).
  const fit = fitLines(body, {
    width: boxW - pad * 2,
    height: boxH - pad * 2,
    maxFont: Math.round(parts.text.font.maxFont * t.size * ov.scale),
    minFont: 12,
    lineHeight: t.lineHeight,
    family,
    weight: t.weight,
    letterSpacing: t.spacing + (ov.spacing || 0),
    maxLines: parts.text.font.maxLines || 8
  });

  const layer = textLayer({
    text: fit.lines.join('\n'),
    width: boxW,
    height: boxH,
    family,
    weight: t.weight,
    fontSize: fit.size,
    autoFit: false,
    maxFont: fit.size,
    minFont: 12,
    maxLines: fit.lines.length,
    lineHeight: t.lineHeight,
    letterSpacing: t.spacing + (ov.spacing || 0),
    fill: color,
    align: t.align || 'start',
    padding: pad,
    rotate: t.rotate + (ov.rotate || 0),
    offsetX: Math.round(ov.dx * S),
    offsetY: Math.round(ov.dy * S)
  });

  const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
  const withText = await sharp({ create: { width: S, height: S, channels: 4, background: bg } })
    .composite([{ input: blurred, left: Math.round(box.x0 * S), top: Math.round(box.y0 * S) }])
    .png()
    .toBuffer();
  return sharp(withText).composite([{ input: grainSvg(S) }]).png().toBuffer();
};
