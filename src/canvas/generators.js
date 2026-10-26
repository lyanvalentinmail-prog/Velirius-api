// src/canvas/generators.js — Un generador por canvas, agrupado por familia.
// Cada generador está partido en PARTES (fondo, texto, foto, globo, hora…): las
// medidas y estilos por defecto viven en ./layouts.js y cualquier valor se puede
// sobrescribir desde la URL con <parte>.<clave>=valor.
const C = require('./core');
const P = require('./parts');
const L = require('./layouts');
const partsOf = id => L.get(id).parts;
const { sharp, loadImageBuffer, templateMeta, shapedImage, circleImage, heartImage,
  textLayer, measure, wrapLines, txt, imgParam, numberIn, flag, parsePercent,
  normColor, styleOf, flat, expandLayer, innerShade, chromaInsert, ellipseImage,
  insertRows, placeImageArea, placeTextArea, eraseSampleText, signCanvas,
  holeInsert, faceCanvas, twemoji, svgPng } = C;
void C;


// ---------- helpers de partes ----------
const boxOf = (id, part, q) => P.area(q, part, partsOf(id)[part].box);
const fillOf = (id, part, q, ov) => (ov.fill || P.color(q, part, 'fill', partsOf(id)[part].fill));

/** Cartel con personaje: la zona del cartel y la tipografía vienen de layouts.js. */
function signPart(id, q, opts = {}) {
  const parts = partsOf(id);
  const area = P.area(q, 'sign', parts.sign.box);
  const t = P.style(q, 'text', parts.text.font);
  return signCanvas(parts.template, area, q, {
    defaultText: opts.defaultText || 'Welcome to Velirius API',
    imageRadius: parts.sign.radius || 0,
    textOpts: {
      family: t.family,
      weight: t.weight,
      fill: t.fill || opts.fill,
      maxFont: Math.round(parts.text.font.maxFont * t.size),
      maxLines: parts.text.font.maxLines || 4,
      rotate: t.rotate,
      uppercase: t.uppercase,
      cover: opts.cover === false ? false : parts.text.cover !== false
    }
  });
}

const GENERATORS = {
  // ======================= BRAT =======================
  async brat(q) {
    const ov = styleOf(q);
    const text = txt(q, 'Welcome to Velirius API').toLowerCase();
    const bg = ov.bg || normColor(q.bg, '#ffffff');
    const color = ov.fill || normColor(q.color, '#000000');
    const S = 512;
    const layer = textLayer({
      text,
      width: S,
      height: S,
      family: ov.font || 'sans',
      weight: 400,
      maxFont: Math.round(78 * ov.scale),
      minFont: 12,
      maxLines: 8,
      lineHeight: 1.12,
      letterSpacing: (ov.spacing || 0) - 0.5,
      fill: color,
      align: 'start',
      padding: 30,
      uppercase: ov.uppercase,
      rotate: ov.rotate,
      offsetX: Math.round(ov.dx * S),
      offsetY: Math.round(ov.dy * S)
    });
    const blurred = await sharp(layer.svg).blur(0.7).png().toBuffer();
    const base = sharp({ create: { width: S, height: S, channels: 4, background: bg } });
    const withText = await base.composite([{ input: blurred }]).png().toBuffer();
    // grano sutil: el sticker brat real no es un plano perfecto
    const grain = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${S}" height="${S}" filter="url(#n)" opacity="0.035"/></svg>`);
    return sharp(withText).composite([{ input: grain }]).png().toBuffer();
  },

  // ---------------------------- BRAT ESTIRADO ----------------------------
  // Partes: canvas (lienzo) · text (texto centrado, autoajustado al área) ·
  // lens (banda central que se estira para el efecto esférico).
  // Todos los valores se pueden cambiar: ?text.size=1.2&text.fill=ff0044&lens.stretch=1.3
  async bratestirado(q) {
    const ov = styleOf(q);
    const parts = partsOf('bratestirado');
    const S = Math.round(P.num(q, 'canvas', 'size', parts.canvas.width, 200, 2000));
    const bg = ov.bg || P.bg(q, 'canvas', parts.canvas.bg);
    const box = P.area(q, 'text', parts.text.box);
    const t = P.style(q, 'text', parts.text.font);
    const fill = ov.fill || P.color(q, 'text', 'fill', parts.text.fill);
    const family = ov.font || t.family;
    const weight = ov.uppercase ? t.weight : t.weight;
    const text = ov.uppercase ? txt(q, 'i <3 money').toUpperCase() : txt(q, 'i <3 money');

    // área útil en píxeles (deja margen para que el lens no recorte nada)
    const availW = (box.x1 - box.x0) * S;
    const availH = (box.y1 - box.y0) * S;
    const baseMax = Math.round(parts.text.font.maxFont * t.size);

    // la lente agranda el centro: el texto se calcula para que, ya ampliado,
    // siga entrando en el lienzo (como el sticker real, más chico en los bordes)
    const stretch = P.num(q, 'lens', 'stretch', parts.lens.stretch, 1, 1.9);
    const fitW = availW / stretch;
    const fitH = availH / stretch;
    const fits = size => {
      const lines = wrapLines(text, fitW, { family, weight, size, letterSpacing: ov.spacing || 0, maxLines: 4 });
      const tooWide = lines.some(l => measure(l, { family, weight, size }) > fitW + 0.5);
      const tall = lines.length * size * t.lineHeight > fitH;
      return { lines, ok: !tooWide && !tall };
    };
    let size = baseMax, lines = fits(size).lines;
    if (!fits(size).ok) {
      for (let s = baseMax; s >= 14; s -= 2) {
        const r = fits(s);
        if (r.ok) { size = s; lines = r.lines; break; }
        size = s; lines = r.lines;
      }
    }

    // ---- reparto de líneas con la lente aplicada ----
    // Cada línea se dibuja más grande cuanto más cerca está del centro y se separa
    // igual, así el efecto esférico no deja fantasmas ni recortes.
    const k = stretch - 1;
    const lineH = size * t.lineHeight;
    const blockH = lineH * lines.length;
    const centerY = S / 2 + ov.dy * S;
    const firstY = Math.round(S * box.y0 + (availH - blockH) / 2);
    const comps = [];
    for (let i = 0; i < lines.length; i++) {
      const lineCenter = firstY + lineH * (i + 0.5);
      const ty = Math.max(-1, Math.min(1, (lineCenter - centerY) / (S / 2)));
      const mag = 1 + k * (1 - ty * ty);
      const lineSize = Math.max(10, Math.round(size * mag));
      const y2 = centerY + (lineCenter - centerY) * mag;
      const layer = textLayer({
        text: lines[i], width: Math.round(S * 0.96), height: Math.round(lineSize * 1.4),
        family, weight, maxFont: lineSize, minFont: 8, maxLines: 1, fill, align: 'middle',
        letterSpacing: (t.spacing + (ov.spacing || 0)) * mag, rotate: ov.rotate
      });
      comps.push({ input: layer.svg, left: Math.round(S * 0.02), top: Math.round(y2 - (lineSize * 1.4) / 2) });
    }

    const base = await sharp({ create: { width: S, height: S, channels: 4, background: bg } }).png().toBuffer();
    return sharp(base).composite(comps).png().toBuffer();
  },

  // ======================= CARTELES CON PERSONAJES =======================
  bratanime: q => signPart('bratanime', q),

  bratcoyote: q => signPart('bratcoyote', q),

  bratpinguino: q => signPart('bratpinguino', q),

  bobesponja: q => signPart('bobesponja', q),

  bobesponja2: q => signPart('bobesponja2', q, { defaultText: 'mi tarea' }),

  bobesponja3: q => signPart('bobesponja3', q),

  canvatextoxd: q => signPart('canvatextoxd', q, { defaultText: 'tu texto aquí' }),

  // Partes: photo / text sobre el lienzo blanco de MS Paint.
  imagencanba: async q => {
    const parts = partsOf('imagencanba');
    const { buf, width: W, height: H } = await templateMeta(parts.template);
    const ov = styleOf(q);
    const imageUrl = imgParam(q, 'url', 'image', 'img');
    const text = String(q.text ?? '').trim();
    const mode = String(q.mode || '').toLowerCase();
    const useImage = mode === 'image' || (mode !== 'text' && imageUrl && !text);
    const layers = [];
    if (useImage) {
      const user = await loadImageBuffer(imageUrl);
      layers.push(await placeImageArea(W, H, boxOf('imagencanba', 'photo', q), user, { zoom: ov.zoom }));
    } else {
      const t = P.style(q, 'text', parts.text.font);
      layers.push(placeTextArea(W, H, boxOf('imagencanba', 'text', q), text || 'dibujo god', {
        family: t.family, weight: t.weight, fill: t.fill,
        maxFont: Math.round(parts.text.font.maxFont * t.size), maxLines: parts.text.font.maxLines, ov
      }));
    }
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= QUOTLY (Telegram) =======================
  async quotly(q) {
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
  },

  // ======================= TTP / ATPP =======================
  // Partes: canvas (tamaño/fondo) · text (tipografía, relleno y contorno).
  async ttp(q) {
    const ov = styleOf(q);
    const parts = partsOf('ttp');
    const text = ov.uppercase ? txt(q, 'Hola').toUpperCase() : txt(q, 'Hola');
    const bgIn = String(q.bg || parts.canvas.bg).toLowerCase();
    const bg = bgIn === 'transparent' ? null : normColor(bgIn, '#000000');
    const S = Math.round(P.num(q, 'canvas', 'width', parts.canvas.width, 128, 1200));
    const box = P.area(q, 'text', parts.text.box);
    const t = P.style(q, 'text', parts.text.font);
    const size = Math.round(parts.text.font.maxFont * t.size);
    const strokeW = P.num(q, 'text', 'stroke', parts.text.stroke.width, 0, 0.3);
    const layer = textLayer({
      text,
      width: Math.round((box.x1 - box.x0) * S),
      height: Math.round((box.y1 - box.y0) * S),
      family: t.family, weight: t.weight,
      maxFont: size, minFont: 18, maxLines: parts.text.font.maxLines,
      lineHeight: parts.text.font.lineHeight,
      letterSpacing: size * (parts.text.font.spacing + (ov.spacing || 0)),
      fill: ov.fill || P.color(q, 'text', 'fill', parts.text.fill),
      align: 'middle', padding: 24, uppercase: t.uppercase || ov.uppercase,
      rotate: t.rotate, offsetX: Math.round(ov.dx * S), offsetY: Math.round(ov.dy * S),
      stroke: strokeW > 0 ? P.color(q, 'text', 'stroke', parts.text.stroke.color) : null,
      strokeWidth: strokeW > 0 ? Math.max(2, size * strokeW) : 0
    });
    const canvas = sharp({ create: { width: S, height: S, channels: 4, background: bg || { r: 0, g: 0, b: 0, alpha: 0 } } });
    return canvas.composite([{ input: layer.svg, left: Math.round(box.x0 * S), top: Math.round(box.y0 * S) }]).png().toBuffer();
  },

  // ======================= IQC (chat falso) =======================
  // La burbuja se arma por partes (cita + mensaje + hora) y CRECE hacia abajo
  // como en WhatsApp: si la respuesta es larga se agregan líneas, la burbuja se
  // estira y el menú de abajo baja lo necesario (el alto de la imagen se ajusta).
  // ---------------------------- IQC (chat WhatsApp) ----------------------------
  // Partes: bubble (globo) · quote (cita con barra de color) · msg (mensaje) ·
  // time (hora). El globo CRECE hacia abajo con el texto y el menú de la plantilla
  // baja lo necesario. Todo ajustable: ?msg.size=1.2&quote.color=66ddff&time.text=9:41
  async iqc(q) {
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
    const msgW = Math.max(60, contentW - timeW);
    const msgLines = wrapLines(message, msgW, {
      family, weight: 400, size: msgSize, letterSpacing: ov.spacing || 0, maxLines: 30
    });
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
  },

  // ======================= CUENTA TIKTOK =======================
  // Partes: row (fila negra) · avatar · name · status.
  async cuentatiktok(q) {
    const parts = partsOf('cuentatiktok');
    const username = String(q.username ?? q.name ?? 'Account not found').slice(0, 36);
    const status = String(q.status ?? q.text ?? 'Sent').slice(0, 24);
    const { buf, width: W, height: H } = await templateMeta(parts.template);
    const rowBox = boxOf('cuentatiktok', 'row', q);
    const rowTop = Math.round(rowBox.y0 * H);
    const rowH = Math.round((rowBox.y1 - rowBox.y0) * H);
    const nameBox = boxOf('cuentatiktok', 'name', q);
    const statusBox = boxOf('cuentatiktok', 'status', q);
    const textLeft = Math.round(nameBox.x0 * W);
    const textW = Math.round((Math.min(nameBox.x1, statusBox.x1) - nameBox.x0) * W);
    const nameTop = Math.round(nameBox.y0 * H);
    const subTop = Math.round(statusBox.y0 * H);
    const nameH = Math.round((nameBox.y1 - nameBox.y0) * H);
    const subH = Math.round((statusBox.y1 - statusBox.y0) * H);

    // se borra toda la zona de texto de la fila (la fila es negra, no se nota)
    const coverX = Math.round(parts.cover.x0 * W);
    const coverW = Math.round(rowBox.x1 * W) - coverX - Math.round(0.01 * W);
    const cover = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${coverW}" height="${rowH}"><rect width="${coverW}" height="${rowH}" fill="#000000"/></svg>`
    );

    const nameSize = Math.round(rowH * P.num(q, 'name', 'size', 0.255, 0.06, 0.6));
    const statusSize = Math.round(rowH * P.num(q, 'status', 'size', 0.185, 0.04, 0.5));
    const name = textLayer({
      text: username, width: coverW, height: nameH, family: parts.name.font.family,
      weight: parts.name.font.weight, maxFont: nameSize, minFont: 9, maxLines: 1,
      align: 'start', fill: P.color(q, 'name', 'fill', parts.name.fill)
    });
    const sub = textLayer({
      text: status, width: coverW, height: subH, family: parts.status.font.family,
      weight: parts.status.font.weight, maxFont: statusSize, minFont: 7, maxLines: 1,
      align: 'start', fill: P.color(q, 'status', 'fill', parts.status.fill)
    });
    const layers = [
      { input: cover, left: coverX, top: rowTop },
      { input: name.svg, left: textLeft, top: nameTop },
      { input: sub.svg, left: textLeft, top: subTop }
    ];
    const avatarUrl = imgParam(q, 'image', 'url', 'avatar');
    if (avatarUrl) {
      const ab = boxOf('cuentatiktok', 'avatar', q);
      const d = Math.round(Math.min((ab.x1 - ab.x0) * W, (ab.y1 - ab.y0) * H));
      const av = await circleImage(await loadImageBuffer(avatarUrl), d);
      layers.push({
        input: av,
        left: Math.round(((ab.x0 + ab.x1) / 2) * W - d / 2),
        top: Math.round(((ab.y0 + ab.y1) / 2) * H - d / 2)
      });
    }
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= STORY REPLY =======================
  // Partes: photo (historia) · bubble (globo del SMS) · reply (texto dentro).
  async storyreply(q) {
    const ov = styleOf(q);
    const parts = partsOf('storyreply');
    const photo = boxOf('storyreply', 'photo', q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = await chromaInsert(parts.template, user, photo, {
      zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate,
      radius: P.num(q, 'photo', 'radius', parts.photo.radius)
    });
    const reply = txt(q, '');
    if (!reply) return base;

    const meta = await sharp(base).metadata();
    const W = meta.width, H = meta.height;
    const bubble = parts.bubble.box;
    const box = boxOf('storyreply', 'reply', q);
    const t = P.style(q, 'reply', parts.reply.font);
    const size = Math.round(parts.reply.font.maxFont * t.size);
    const pad = Math.round(parts.reply.pad * W);
    const availW = Math.max(60, Math.round((box.x1 - box.x0) * W) - pad * 2);
    const lines = wrapLines(reply, availW, { family: t.family, weight: t.weight, size });
    const lineH = Math.round(size * parts.reply.lineHeight);
    const blockH = Math.max(lineH, lines.length * lineH);
    // El globo tiene altura fija: el texto se centra verticalmente en él.
    const centerY = Math.round(((bubble.y0 + bubble.y1) / 2) * H);
    const top = centerY - Math.round(blockH / 2);
    const fill = ov.fill || P.color(q, 'reply', 'fill', parts.reply.fill);
    const comps = lines.map((ln, i) => ({
      input: textLayer({
        text: ln, width: availW, height: lineH, family: t.family, weight: t.weight,
        maxFont: size, minFont: 10, maxLines: 1, fill, align: 'start', padding: 0,
        letterSpacing: t.spacing + (ov.spacing || 0)
      }).svg,
      left: Math.round(box.x0 * W) + pad,
      top: top + i * lineH
    }));
    return sharp(base).composite(flat(comps)).png().toBuffer();
  },

  // ======================= ABSOLUTE CINEMA =======================
  async absolutecinema(q) {
    const ov = styleOf(q);
    const main = String(q.text || 'CINEMA').toUpperCase().slice(0, 24);
    const sub = String(q.subtext || q.sub || 'ABSOLUTE').toUpperCase().slice(0, 24);
    const url = imgParam(q, 'url', 'image', 'img');
    let base, W, H;
    if (url) {
      const user = await loadImageBuffer(url);
      base = await sharp(user).rotate().resize(900, 737, { fit: 'cover' }).grayscale().png().toBuffer();
      W = 900; H = 737;
    } else {
      const t = await templateMeta('absolutecinema.jpg');
      base = t.buf; W = t.width; H = t.height;
    }
    const color = ov.fill || normColor(q.color, '#ffffff');
    const barH = Math.round(H * 0.32);
    const bar = await sharp({ create: { width: W, height: barH, channels: 4, background: '#000000' } }).png().toBuffer();
    const subLayer = textLayer({
      text: sub, width: W - 60, height: Math.round(barH * 0.36), family: ov.font || 'sans',
      weight: 600, maxFont: Math.round(H * 0.05 * ov.scale), minFont: 10, maxLines: 1,
      letterSpacing: Math.max(4, H * 0.008), fill: color, align: 'middle', offsetX: Math.round(ov.dx * W)
    });
    const mainLayer = textLayer({
      text: main, width: W - 40, height: Math.round(barH * 0.54), family: ov.font || 'sans',
      weight: 900, maxFont: Math.round(H * 0.13 * ov.scale), minFont: 14, maxLines: 1,
      letterSpacing: Math.max(1, H * 0.003), fill: color, align: 'middle', offsetX: Math.round(ov.dx * W)
    });
    return sharp(base)
      .composite([
        { input: bar, left: 0, top: H - barH },
        { input: subLayer.svg, left: 30, top: H - barH + Math.round(barH * 0.10) },
        { input: mainLayer.svg, left: 20, top: H - barH + Math.round(barH * 0.38) }
      ])
      .png().toBuffer();
  },

  // ======================= PANTALLAS VERDES =======================
  async canvaimagen(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('canvaimagen.jpg', user, { x0: 0, y0: 0, x1: 1, y1: 1 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },

  async fotopc(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return chromaInsert('fotopc.jpg', user, { x0: 0.52, y0: 0.29, x1: 1, y1: 0.68 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },

  // ======================= SE BUSCA =======================
  // Partes: photo · band + name (franja del nombre al pie de la foto) · reward.
  async sebusca(q) {
    const ov = styleOf(q);
    const parts = partsOf('sebusca');
    const { buf, width: W, height: H } = await templateMeta(parts.template);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const layers = [
      await placeImageArea(W, H, boxOf('sebusca', 'photo', q), user, {
        zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate
      })
    ];

    const name = String(q.name ?? '').trim();
    if (name) {
      const bandBox = boxOf('sebusca', 'band', q);
      const bandX = Math.round(bandBox.x0 * W);
      const bandW = Math.round((bandBox.x1 - bandBox.x0) * W);
      const bandY = Math.round(bandBox.y0 * H);
      const bandH = Math.round((bandBox.y1 - bandBox.y0) * H);
      const opacity = P.num(q, 'band', 'opacity', parts.band.opacity, 0, 1);
      const band = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${bandW}" height="${bandH}">` +
        `<rect width="${bandW}" height="${bandH}" fill="${P.color(q, 'band', 'bg', parts.band.bg)}" fill-opacity="${opacity}"/></svg>`
      );
      const t = P.style(q, 'name', parts.name.font);
      const size = Math.round(bandH * P.num(q, 'name', 'size', 0.62, 0.2, 1.1));
      const nameLayer = textLayer({
        text: t.uppercase ? name.toUpperCase().slice(0, 26) : name.slice(0, 26),
        width: bandW, height: bandH, family: t.family, weight: t.weight,
        maxFont: size, minFont: 8, maxLines: 1, fill: ov.fill || P.color(q, 'name', 'fill', parts.name.fill),
        align: 'middle'
      });
      layers.push({ input: band, left: bandX, top: bandY });
      layers.push({ input: nameLayer.svg, left: bandX, top: bandY });
    }

    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= POKEMON CARD =======================
  // Partes: photo (arte) · name · hp · type · attack · damage · description.
  async pokemoncard(q) {
    const ov = styleOf(q);
    const parts = partsOf('pokemoncard');
    const { buf, width: W, height: H } = await templateMeta(parts.template);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const clip = (v, fb, n) => String(v ?? fb).trim().slice(0, n) || fb;
    const name = clip(q.name, 'Velirius', 20);
    const hp = clip(String(q.hp || '120').replace(/[^0-9]/g, ''), '120', 4);
    const type = clip(q.type, 'Legendario', 22);
    const attack = clip(q.attack, 'Golpe API', 26);
    const damage = clip(String(q.damage || '90').replace(/[^0-9+]/g, ''), '90', 5);
    const description = clip(q.description ?? q.desc, 'Una carta creada con Velirius API.', 220);

    const layers = [
      await placeImageArea(W, H, boxOf('pokemoncard', 'photo', q), user, {
        zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate,
        radius: P.num(q, 'photo', 'radius', parts.photo.radius)
      })
    ];

    // cada texto toma su caja y su tipografía de layouts.js
    const put = (text, part, extra = {}) => {
      const t = P.style(q, part, parts[part].font);
      const area = boxOf('pokemoncard', part, q);
      const x = Math.round(area.x0 * W);
      const y = Math.round(area.y0 * H);
      const width = Math.max(20, Math.round((area.x1 - area.x0) * W));
      const height = Math.max(16, Math.round((area.y1 - area.y0) * H));
      const size = Math.round(parts[part].font.maxFont * t.size);
      const maxLines = parts[part].font.maxLines || 1;
      const body = maxLines > 1 && !text.includes('\n')
        ? wrapLines(text, width, { family: t.family, weight: t.weight, size, maxLines, letterSpacing: t.spacing }).join('\n')
        : text;
      const layer = textLayer({
        text: body, width, height, family: t.family, weight: t.weight,
        maxFont: size, minFont: Math.max(8, Math.round(size * 0.55)),
        maxLines: parts[part].font.maxLines || 1,
        lineHeight: parts[part].font.lineHeight || 1.2,
        letterSpacing: t.spacing + (ov.spacing || 0),
        fill: ov.fill || P.color(q, part, 'fill', parts[part].fill),
        align: parts[part].align || 'start',
        autoFit: false, fontSize: size, ...extra
      });
      return { input: layer.svg, left: x, top: y };
    };

    layers.push(put(name, 'name'));
    layers.push(put(hp, 'hp'));
    layers.push(put(type, 'type'));
    layers.push(put(attack, 'attack'));
    layers.push(put(damage, 'damage'));
    layers.push(put(description, 'description'));
    return sharp(buf).composite(flat(layers)).png().toBuffer();
  },

  // ======================= SHIP / FRIENDSHIP =======================
  async _meter(q, kind) {
    const ov = styleOf(q);
    const isShip = kind === 'ship';
    const W = 1200, H = 512;
    const name1 = String(q.name1 || 'Velirius').slice(0, 20);
    const name2 = String(q.name2 || 'dls').slice(0, 20);
    const pct = parsePercent(q.percentage ?? q.percent ?? q.rank);
    const phrase = String(q.text || 'Best Friends').slice(0, 26);
    const accent = ov.fill || (isShip ? '#ff2d55' : '#00e05a');
    const title = isShip ? 'Medidor de compatibilidad' : 'Medidor de amistad';
    const bg = ov.bg || '#23272e';
    const img1 = await loadImageBuffer(imgParam(q, 'image1', 'url1', 'image', 'url'), 'avatar1.jpg');
    const img2 = await loadImageBuffer(imgParam(q, 'image2', 'url2'), 'avatar2.jpg');
    const S = Math.round(295 * Math.min(ov.zoom, 1.6));
    const piece1 = isShip ? await heartImage(img1, S, S * 0.92) : await circleImage(img1, S);
    const piece2 = isShip ? await heartImage(img2, S, S * 0.92) : await circleImage(img2, S);
    const heart = `<path d="M600 118 C586 96 552 92 544 114 C536 133 553 152 600 177 C647 152 664 133 656 114 C648 92 614 96 600 118Z" fill="${isShip ? accent : '#ff2d55'}"/>`;
    const star = `<text x="${W / 2}" y="170" text-anchor="middle" font-family="sans-serif" font-size="58" fill="#ffc93c">★</text>`;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="${bg}"/>` +
      `<text x="${W / 2}" y="50" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="28" fill="${isShip ? '#ff7a92' : '#2ee06d'}">~ ${title} ~</text>` +
      (isShip ? heart : star) +
      `</svg>`
    );
    const base = await svgPng(svg);
    const pctLayer = textLayer({
      text: `~${pct}%~`, width: 600, height: Math.round(70 * ov.scale), family: 'mono', weight: 700,
      maxFont: Math.round(42 * ov.scale), minFont: 12, maxLines: 1, fill: accent, align: 'middle'
    });
    const phraseLayer = textLayer({
      text: phrase, width: 700, height: Math.round(56 * ov.scale), family: 'mono', weight: 700,
      maxFont: Math.round(34 * ov.scale), minFont: 10, maxLines: 1, fill: accent, align: 'middle'
    });
    const name1Layer = textLayer({
      text: name1, width: 300, height: 42, family: 'sans', weight: 700, maxFont: 27, minFont: 10,
      maxLines: 1, fill: '#ffffff', align: 'middle'
    });
    const name2Layer = textLayer({
      text: name2, width: 300, height: 42, family: 'sans', weight: 700, maxFont: 27, minFont: 10,
      maxLines: 1, fill: '#ffffff', align: 'middle'
    });
    const layers = [
      { input: piece1, left: Math.round(300 - S / 2), top: 118 + Math.round((295 - S) / 2) },
      { input: piece2, left: Math.round(900 - S / 2), top: 118 + Math.round((295 - S) / 2) },
      { input: pctLayer.svg, left: 300, top: 196 },
      { input: phraseLayer.svg, left: 250, top: 262 },
      { input: name1Layer.svg, left: 150, top: 452 },
      { input: name2Layer.svg, left: 750, top: 452 }
    ];
    if (!isShip) {
      const thumb = await twemoji('1f44d');
      if (thumb) layers.push({ input: await sharp(thumb).resize(60, 60).png().toBuffer(), left: W / 2 - 30, top: 104 });
    }
    return sharp(base).composite(layers).png().toBuffer();
  },
  ship: q => GENERATORS._meter(q, 'ship'),
  friendship: q => GENERATORS._meter(q, 'friendship'),

  // ======================= GAY CARD =======================
  async gaycard(q) {
    const ov = styleOf(q);
    const W = 600, H = 450;
    const size = 178;
    const name = String(q.name || q.username || 'Velirius').slice(0, 22);
    const pct = parsePercent(q.rank ?? q.percentage ?? q.percent);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));

    // avatar: foto → arcoíris → recorte circular → aro blanco
    let avatar = await shapedImage(user, size, size, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
    const rainbowBands = ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'];
    const bandH = size / rainbowBands.length;
    const rainbow = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${rainbowBands.map((c, i) => `<rect y="${i * bandH}" width="${size}" height="${bandH + 1}" fill="${c}" fill-opacity="0.5"/>`).join('')}</svg>`
    );
    avatar = await sharp(avatar).composite([{ input: rainbow }]).png().toBuffer();
    const circleMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    avatar = await sharp(avatar).composite([{ input: circleMask, blend: 'dest-in' }]).png().toBuffer();
    const rim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="#ffffff" stroke-width="4"/></svg>`);
    avatar = await sharp(avatar).composite([{ input: rim }]).png().toBuffer();

    const title = textLayer({
      text: 'GAY PERCENTAGE', width: 540, height: 44, family: 'mono', weight: 700,
      maxFont: 32, minFont: 12, maxLines: 1, letterSpacing: 2,
      fill: 'url(#rw)', align: 'middle'
    });
    const nameLayer = textLayer({
      text: name, width: 480, height: 46, family: 'serif', weight: 700, maxFont: 31, minFont: 10,
      maxLines: 1, fill: ov.fill || '#ffffff', align: 'middle'
    });
    const pctLayer = textLayer({
      text: `~ ${pct}% ~`, width: 170, height: 44, family: 'sans', weight: 700,
      maxFont: Math.round(30 * ov.scale), minFont: 10, maxLines: 1, fill: '#ff2d78', align: 'middle'
    });
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<defs><linearGradient id="rw" x1="0" y1="0" x2="1" y2="0">${rainbowBands.map((c, i) => `<stop offset="${(i / (rainbowBands.length - 1)) * 100}%" stop-color="${c}"/>`).join('')}</linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="${ov.bg || '#141414'}"/>` +
      `<polygon points="0,0 190,0 0,150" fill="#000000"/><polygon points="${W},${H} ${W - 190},${H} ${W},${H - 150}" fill="#000000"/>` +
      `<circle cx="${W / 2}" cy="196" r="94" fill="none" stroke="#ffffff" stroke-width="3"/>` +
      `<rect x="${W / 2 - 92}" y="356" width="184" height="52" rx="26" fill="#ffffff"/>` +
      `</svg>`
    );
    const base = await svgPng(svg);
    return sharp(base)
      .composite([
        { input: avatar, left: W / 2 - size / 2, top: 196 - size / 2 },
        { input: title.svg, left: W / 2 - 270, top: 24 },
        { input: nameLayer.svg, left: W / 2 - 240, top: 314 },
        { input: pctLayer.svg, left: W / 2 - 85, top: 360 }
      ])
      .png().toBuffer();
  },

  // ======================= FILTROS =======================
  async gay(q) {
    const ov = styleOf(q);
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    const base = sharp(user).rotate();
    if (ov.grayscale) base.grayscale();
    const meta = await base.metadata();
    const W = Math.min(meta.width || 512, 1024);
    const resized = await base.resize(W, null, { kernel: 'lanczos3' }).png().toBuffer();
    const m2 = await sharp(resized).metadata();
    const colors = ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'];
    const band = Math.ceil(m2.height / colors.length);
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m2.width}" height="${m2.height}">${colors.map((c, i) => `<rect y="${i * band}" width="${m2.width}" height="${band}" fill="${c}" fill-opacity="${ov.opacity}"/>`).join('')}</svg>`);
    return sharp(resized).composite([{ input: overlay }]).png().toBuffer();
  },

  async invert(q) {
    const user = await loadImageBuffer(imgParam(q, 'url', 'image', 'img'));
    return sharp(user).rotate().negate({ alpha: false }).png().toBuffer();
  },

  // ======================= PERSONAJES =======================
  rata: q => faceCanvas('rata.jpg', [{ cx: 0.6253, cy: 0.5325, rx: 0.1287, ry: 0.1698 }], q),
  banana: q => faceCanvas('banana.jpg', [{ cx: 0.53, cy: 0.4483, rx: 0.159, ry: 0.166 }], q),
  galletita: q => faceCanvas('galletita.jpg', [{ cx: 0.466, cy: 0.5009, rx: 0.1616, ry: 0.1507 }], q),
  minions: q => faceCanvas('minions.jpg', [
    { cx: 0.2560, cy: 0.4720, rx: 0.1180, ry: 0.0800 },
    { cx: 0.5220, cy: 0.4360, rx: 0.1350, ry: 0.0870 },
    { cx: 0.7660, cy: 0.4680, rx: 0.1140, ry: 0.0830 }
  ], q),
  arandano: async q => {
    const ov = styleOf(q);
    return chromaInsert('arandano.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.24, y0: 0.20, x1: 0.71, y1: 0.75 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  },
  pan: async q => {
    const ov = styleOf(q);
    return chromaInsert('pan.jpg', await loadImageBuffer(imgParam(q, 'url', 'image', 'img')), { x0: 0.29, y0: 0.34, x1: 0.74, y1: 0.78 }, { zoom: ov.zoom, grayscale: ov.grayscale, rotate: ov.rotate });
  }
};


module.exports = { GENERATORS };
