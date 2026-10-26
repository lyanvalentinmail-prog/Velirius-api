// src/canvas/generators/iqc.js — iqc
// La burbuja se arma por partes (cita + mensaje + hora) y CRECE hacia abajo
// como en WhatsApp: si la respuesta es larga se agregan líneas, la burbuja se
// estira y el menú de abajo baja lo necesario (el alto de la imagen se ajusta).
// ---------------------------- IQC (chat WhatsApp) ----------------------------
// Partes: bubble (globo) · quote (cita con barra de color) · msg (mensaje) ·
// time (hora). El globo CRECE hacia abajo con el texto y el menú de la plantilla
// baja lo necesario. Todo ajustable: ?msg.size=1.2&quote.color=66ddff&time.text=9:41

// Guía: README.md → "Cómo agregar o editar un endpoint".
const {
  sharp, templateMeta, textLayer, measure, wrapLines, txt, styleOf, flat, insertRows, P,
  partsOf
} = require('./_helpers');

module.exports = async function iqc(q) {
  const ov = styleOf(q);
  const parts = partsOf('iqc');
  const { buf, width: W, height: H } = await templateMeta(parts.template);
  const family = ov.font || parts.msg.font.family;

  const message = txt(q, 'Yo siempre te voy a amar');
  const quoteRaw = String(q.replyText ?? q.quote ?? q.quoted ?? 'vooooss seguro').trim();
  const hideQuote = quoteRaw === '' || /^(0|false|no|none|null|-)$/i.test(quoteRaw);
  const replyName = String(q.replyName ?? q.username ?? q.name ?? 'Tú').slice(0, 28);
  const time = P.str(q, 'time', 'text', String(q.time ?? q.hour ?? '7:32 p. m.').slice(0, 18));

  // ---- geometría (px de la plantilla) ----
  const bb = parts.bubble.box;
  const bubbleX = Math.round(bb.x0 * W);
  const bubbleW = Math.round((bb.x1 - bb.x0) * W);
  const bubbleTop = Math.round(bb.y0 * H);
  const baseH = Math.round((bb.y1 - bb.y0) * H);
  const radius = Math.round(bubbleW * parts.bubble.radius);
  const padTop = Math.round(parts.bubble.pad.top * H);
  const padBottom = Math.round(parts.bubble.pad.bottom * H);
  const gap = Math.round(parts.bubble.pad.gap * H);

  const qb = P.area(q, 'quote', parts.quote.box);
  const quoteX = Math.round(qb.x0 * W);
  const quoteY = Math.round(qb.y0 * H);
  const quoteW = Math.round((qb.x1 - qb.x0) * W);
  const quoteBaseH = Math.round((qb.y1 - qb.y0) * H);
  const barW = Math.max(2, Math.round(parts.quote.barWidth * W));

  const nameX = Math.round(P.num(q, 'quote', 'nameX', parts.quote.name.x) * W);
  const nameY = Math.round(parts.quote.name.y * H);
  const quoteTextX = Math.round(P.num(q, 'quote', 'textX', parts.quote.text.x) * W);
  const msgX = Math.round(P.num(q, 'msg', 'x', parts.msg.x) * W);
  const msgYBase = Math.round(P.num(q, 'msg', 'y', parts.msg.y) * H);
  const timeRight = Math.round(P.num(q, 'time', 'right', parts.time.right) * W);
  const timeY = Math.round(parts.time.y * H);

  // ---- colores y tamaños ----
  const bubbleBg = P.color(q, 'bubble', 'bg', parts.bubble.bg);
  const quoteBg = P.color(q, 'quote', 'bg', parts.quote.bg);
  const barColor = P.color(q, 'quote', 'bar', parts.quote.bar);
  const nameColor = P.color(q, 'quote', 'nameColor', parts.quote.name.fill);
  const quoteColor = P.color(q, 'quote', 'textColor', parts.quote.text.fill);
  const msgFill = ov.fill || P.color(q, 'msg', 'fill', parts.msg.fill);
  const timeFill = P.color(q, 'time', 'fill', parts.time.fill);

  const msgSize = Math.max(12, Math.round(parts.msg.font.size * P.num(q, 'msg', 'size', 1, 0.5, 2) * ov.scale));
  const quoteSize = Math.max(10, Math.round(parts.quote.text.font.size * P.num(q, 'quote', 'size', 1, 0.5, 2) * ov.scale));
  const nameSize = Math.max(9, Math.round(parts.quote.name.font.size * P.num(q, 'quote', 'size', 1, 0.5, 2) * ov.scale));
  const timeSize = Math.max(8, Math.round(parts.time.font.size * P.num(q, 'time', 'size', 1, 0.5, 2) * ov.scale));
  const lineHeight = parts.msg.font.lineHeight;

  // ---- textos ----
  const timeW = Math.ceil(measure(time, { family, weight: 400, size: timeSize })) + 8;
  const contentW = bubbleW - (msgX - bubbleX) - Math.round(0.0272 * W);
  // Como en WhatsApp: la hora solo ocupa sitio en la ÚLTIMA línea, así que
  // primero se envuelve a todo el ancho y, si la hora no entra al final, se
  // vuelve a envolver reservándole el hueco.
  const wrapOpts = { family, weight: 400, size: msgSize, letterSpacing: ov.spacing || 0, maxLines: 30 };
  let msgLines = wrapLines(message, contentW, wrapOpts);
  const lastW = measure(msgLines[msgLines.length - 1] || '', { family, weight: 400, size: msgSize, letterSpacing: ov.spacing || 0 });
  if (msgLines.length > 1 && lastW + timeW > contentW) {
    msgLines = wrapLines(message, Math.max(60, contentW - timeW), wrapOpts);
  }
  const msgH = Math.round(msgLines.length * msgSize * lineHeight);

  const quoteLines = hideQuote ? [] : wrapLines(quoteRaw, quoteW - (quoteTextX - quoteX), {
    family, weight: 400, size: quoteSize, letterSpacing: ov.spacing || 0, maxLines: 3
  });
  const quoteH = quoteLines.length
    ? Math.max(quoteBaseH, Math.round((nameY - quoteY) + nameSize * 1.35 + quoteLines.length * quoteSize * 1.32 + 12))
    : 0;

  // el mensaje arranca donde lo hace la plantilla; si el globo crece, baja
  const msgTop = quoteH
    ? Math.max(msgYBase, quoteY + quoteH + gap)
    : bubbleTop + Math.max(padTop, Math.round((baseH - msgH - padTop) / 2));
  const bubbleH = Math.max(baseH, msgTop + msgH + padBottom - bubbleTop);
  const delta = bubbleH - baseH;

  // ---- si crece, se insertan filas justo debajo del globo (el menú baja) ----
  const base = delta > 0 ? await insertRows(buf, W, H, delta, bubbleTop + baseH) : buf;

  const layers = [{
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bubbleW}" height="${bubbleH}">` +
      `<rect width="${bubbleW}" height="${bubbleH}" rx="${radius}" ry="${radius}" fill="${bubbleBg}"/></svg>`
    ), left: bubbleX, top: bubbleTop
  }];

  if (quoteH) {
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${quoteW}" height="${quoteH}">` +
        `<rect width="${quoteW}" height="${quoteH}" rx="${Math.round(radius * 0.7)}" fill="${quoteBg}"/>` +
        `<rect width="${barW}" height="${quoteH}" rx="${Math.round(barW / 2)}" fill="${barColor}"/></svg>`
      ), left: quoteX, top: quoteY
    });
    const nameLayer = textLayer({
      text: replyName, width: quoteW - (nameX - quoteX), height: Math.round(nameSize * 1.35),
      family, weight: 600, maxFont: nameSize, minFont: 8, maxLines: 1, align: 'start', fill: nameColor
    });
    const quoteLayer = textLayer({
      text: quoteLines.join('\n'), width: quoteW - (quoteTextX - quoteX),
      height: Math.round(quoteLines.length * quoteSize * 1.32), family, weight: 400,
      fontSize: quoteSize, autoFit: false, lineHeight: 1.32, maxLines: quoteLines.length,
      align: 'start', fill: quoteColor, letterSpacing: ov.spacing || 0
    });
    layers.push({ input: nameLayer.svg, left: nameX, top: nameY });
    layers.push({ input: quoteLayer.svg, left: quoteTextX, top: nameY + Math.round(nameSize * 1.35) });
  }

  const msgLayer = textLayer({
    text: msgLines.join('\n'), width: contentW, height: msgH + 4, family, weight: 400,
    fontSize: msgSize, autoFit: false, lineHeight, maxLines: msgLines.length,
    align: 'start', fill: msgFill, letterSpacing: ov.spacing || 0, rotate: ov.rotate || 0
  });
  layers.push({ input: msgLayer.svg, left: msgX, top: msgTop });

  const timeLayer = textLayer({
    text: time, width: timeW, height: Math.round(timeSize * 1.4), family, weight: 400,
    maxFont: timeSize, minFont: 7, maxLines: 1, align: 'end', fill: timeFill
  });
  layers.push({
    input: timeLayer.svg,
    left: timeRight - timeW,
    top: bubbleTop + bubbleH - padBottom - Math.round(timeSize * 1.4) + 4
  });

  return sharp(base).composite(flat(layers)).png().toBuffer();
};
