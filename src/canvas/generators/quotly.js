// src/canvas/generators/quotly.js — quotly

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, loadImageBuffer, shapedImage, textLayer, measure, wrapLines, txt, imgParam,
  normColor, styleOf
} = require('./_helpers');

module.exports = async function quotly(q) {
  const ov = styleOf(q);
  const username = String(q.username || q.name || 'Velirius Api').slice(0, 40);
  const text = txt(q, 'Welcome to Velirius Api');
  const bg = ov.bg && ov.bg !== 'transparent' ? ov.bg : normColor(q.bg, '#000000');
  const dark = ['#000000', '#111111', '#17212b', 'black'].includes(String(bg).toLowerCase());
  const bodyColor = ov.fill || (dark ? '#ffffff' : '#111111');
  const nameColor = ov.fill || '#f59e0b';
  const family = ov.font || 'sans';

  const fontSize = Math.round(32 * ov.scale);
  const lineHeight = 1.34;
  const avatarSize = Math.round(84 * Math.min(ov.scale, 1.4));
  const padX = 24, padY = 22, gap = 20;
  const nameSize = Math.round(fontSize * 0.86);
  const nameH = Math.round(nameSize * 1.35);

  // 1) medir el texto con margen suficiente y decidir el ancho del lienzo
  const textPad = 6;
  const narrow = Math.max(60, ...wrapLines(text, 560 - textPad * 2, { family, weight: 400, size: fontSize })
    .map(l => measure(l, { family, weight: 400, size: fontSize })));
  const W = Math.round(Math.min(1000, Math.max(400, padX * 2 + avatarSize + gap + Math.ceil(narrow) + 14 + textPad * 2)));
  const textW = Math.max(80, W - padX * 2 - avatarSize - gap);

  // 2) renderizar el texto con el ancho definitivo (altura exacta de las líneas)
  const lines = wrapLines(text, textW - textPad * 2, { family, weight: 400, size: fontSize });
  const bodyH = Math.max(Math.round(fontSize * lineHeight), Math.round(lines.length * fontSize * lineHeight) + 2);
  const body = textLayer({
    text: lines.join('\n'), width: textW, height: bodyH, family, weight: 400,
    maxFont: fontSize, minFont: 12, maxLines: lines.length, lineHeight,
    fill: bodyColor, align: 'start', autoFit: false, fontSize, padding: textPad
  });
  const H = Math.round(padY * 2 + nameH + bodyH);

  const nameLayer = textLayer({
    text: ov.uppercase ? username.toUpperCase() : username,
    width: textW, height: nameH, family, weight: 700,
    maxFont: nameSize, minFont: 9, maxLines: 1, fill: nameColor, align: 'start', padding: textPad
  });
  // Telegram: avatar cuadrado con esquinas redondeadas (no círculo)
  const rounded = await shapedImage(
    await loadImageBuffer(imgParam(q, 'image', 'url', 'avatar')),
    avatarSize, avatarSize, { radius: Math.round(avatarSize * 0.22), zoom: ov.zoom }
  );
  const rim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}"><rect x="1" y="1" width="${avatarSize - 2}" height="${avatarSize - 2}" rx="${Math.round(avatarSize * 0.22)}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/></svg>`);
  const avatar = await sharp(rounded).composite([{ input: rim }]).png().toBuffer();

  const left = padX + avatarSize + gap;
  const composed = await sharp({ create: { width: W, height: H, channels: 4, background: bg } })
    .composite([
      { input: avatar, left: padX, top: Math.round((H - avatarSize) / 2) },
      { input: nameLayer.svg, left, top: padY },
      { input: body.svg, left, top: padY + nameH }
    ])
    .png().toBuffer();

  if (!ov.rotate && !ov.dx && !ov.dy) return composed;
  const rotated = await sharp(composed)
    .rotate(ov.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  if (!ov.dx && !ov.dy) return rotated;
  const meta = await sharp(rotated).metadata();
  return sharp({ create: { width: meta.width + 80, height: meta.height + 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left: Math.round(40 + ov.dx * 80), top: Math.round(40 + ov.dy * 80) }])
    .png().toBuffer();
};
