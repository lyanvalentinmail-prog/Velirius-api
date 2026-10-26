// src/canvas/generators/brat.js — brat
// Partes: canvas (lienzo y fondo) · text (bloque de texto).
//   /canvas/brat?text.size=1.2&text.fill=ff0044&canvas.bg=8ACE00

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, textLayer, txt, styleOf, fitLines, P, partsOf
} = require('./_helpers');

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

  const pad = Math.round(S * 0.06);
  const fit = fitLines(ov.uppercase ? text.toUpperCase() : text, {
    width: Math.round((box.x1 - box.x0) * S) - pad,
    height: Math.round((box.y1 - box.y0) * S),
    maxFont: Math.round(parts.text.font.maxFont * t.size), minFont: 12,
    lineHeight: t.lineHeight, family, weight: t.weight,
    letterSpacing: t.spacing + (ov.spacing || 0), maxLines: 12
  });
  const layer = textLayer({
    text: fit.lines.join('\n'),
    width: Math.round((box.x1 - box.x0) * S), height: S,
    family, weight: t.weight, fontSize: fit.size, autoFit: false,
    maxFont: fit.size, minFont: 12, maxLines: fit.lines.length, lineHeight: t.lineHeight,
    letterSpacing: t.spacing + (ov.spacing || 0), fill: color,
    align: t.align || 'start', padding: pad,
    uppercase: t.uppercase || ov.uppercase, rotate: t.rotate,
    offsetX: Math.round(ov.dx * S), offsetY: Math.round(ov.dy * S)
  });
  const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
  const base = sharp({ create: { width: S, height: S, channels: 4, background: bg } });
  const withText = await base.composite([{ input: blurred, left: Math.round(box.x0 * S), top: 0 }]).png().toBuffer();
  // grano sutil: el sticker brat real no es un plano perfecto
  const grain = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${S}" height="${S}" filter="url(#n)" opacity="0.035"/></svg>`);
  return sharp(withText).composite([{ input: grain }]).png().toBuffer();
};
