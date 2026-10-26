// src/canvas/layouts.js — TODAS las medidas de los canvas, canvas por canvas y
// **parte por parte**. Aquí se cambia cualquier número sin tocar el motor.
//
// Convención de las áreas: fracciones (0-1) del ancho/alto de la plantilla.
// Desde la URL se puede sobreescribir cualquier valor con `<parte>.<clave>`:
//   /canvas/searched?photo.y1=0.66&photo.zoom=1.2&name.size=1.4&reward.size=0.9
//
// Partes típicas:  canvas (lienzo) · bg · photo · text · name · reward · band ·
//                  bubble · quote · msg · time · avatar · badge · bar · title
//
// ➕ AGREGAR UN CANVAS: 1) src/canvas/generators/<id>.js  2) un bloque acá con sus
//    medidas  3) la ficha en src/catalog/canvas.js. Guía: CONTRIBUTING.md.

// ---------- Tipografía de la familia BRAT (una sola definición) ----------
// Inter 700, minúsculas, interlineado apretado y letras levemente juntas: así se
// ve el sticker original de brat. TODAS las canvas brat* (`brat`, `bratcoyote`,
// `bratanime`…) tienen que usar exactamente esta, cambiándola acá una sola vez.
// `align` lo decide cada canvas (el cartel del coyote va centrado).
const BRAT_TYPE = {
  family: 'sans',
  weight: 700,
  lineHeight: 1.08,
  spacing: -0.5
};

const LAYOUTS = {
  /* ============================ TEXTO ============================ */
  brat: {
    label: 'Brat',
    parts: {
      canvas: { width: 512, height: 512, bg: '#ffffff' },
      text: {
        box: { x0: 0.04, y0: 0.06, x1: 0.96, y1: 0.94 },
        font: { ...BRAT_TYPE, maxFont: 78, maxLines: 8, align: 'start' },
        fill: '#000000',
        pad: 0.06
      }
    }
  },

  // Texto tipo meme sobre una imagen ("pov: …", "x: …").
  // `canvas.maxWidth`/`maxHeight` limitan la foto; `text` es la caja del texto.
  pov: {
    label: 'POV (texto sobre tu imagen)',
    parts: {
      canvas: { maxWidth: 1024, maxHeight: 1280, bg: '#000000' },
      text: {
        box: { x0: 0.05, y0: 0.04, x1: 0.95, y1: 0.44 },
        font: { family: 'sans', weight: 800, maxFont: 76, lineHeight: 1.16, maxLines: 5 },
        fill: '#ffffff',
        stroke: { color: '#000000', width: 0.075 }
      }
    }
  },

  x: {
    label: 'X (texto sobre tu imagen)',
    parts: {
      canvas: { maxWidth: 1024, maxHeight: 1280, bg: '#000000' },
      text: {
        box: { x0: 0.05, y0: 0.04, x1: 0.95, y1: 0.44 },
        font: { family: 'sans', weight: 800, maxFont: 76, lineHeight: 1.16, maxLines: 5 },
        fill: '#ffffff',
        stroke: { color: '#000000', width: 0.075 }
      }
    }
  },

  bratestirado: {
    label: 'Brat estirado (lente esférica)',
    parts: {
      canvas: { width: 736, height: 736, bg: '#ffffff' },
      text: {
        box: { x0: 0.05, y0: 0.05, x1: 0.95, y1: 0.95 },
        font: { family: 'sans', weight: 800, maxFont: 190, lineHeight: 1.16, align: 'middle' },
        fill: '#000000',
        pad: 0.04,
        maxLines: 6,
        // aire extra para que la lente nunca recorte el texto
        inset: 0.94
      },
      // lente esférica: `stretch` = cuánto se agranda el centro (1 = plano),
      // `aspect` = estirón vertical del texto, `radius` = tamaño del bulto
      // (1 = llega a los bordes del lado corto) e `y` = altura del centro.
      lens: { stretch: 1.18, aspect: 1.3, radius: 1.2, y: 0.5 }
    }
  },

  ttp: {
    label: 'Sticker de texto (contorno negro)',
    parts: {
      canvas: { width: 512, height: 512, bg: 'transparent' },
      text: {
        box: { x0: 0.05, y0: 0.12, x1: 0.95, y1: 0.88 },
        font: { family: 'sans', weight: 700, maxFont: 72, lineHeight: 1.34, maxLines: 3, spacing: 0.05 },
        fill: '#ffffff',
        stroke: { color: '#000000', width: 0.06 }
      }
    }
  },

  absolutecinema: {
    label: 'Absolute cinema',
    parts: {
      canvas: { width: 735, height: 602, bg: '#000000' },
      bar: { box: { x0: 0, y0: 0.68, x1: 1, y1: 1 }, bg: '#000000' },
      sub: {
        box: { x0: 0.03, y0: 0.70, x1: 0.97, y1: 0.81 },
        font: { family: 'sans', weight: 600, maxFont: 37, spacing: 6 },
        fill: '#ffffff'
      },
      title: {
        box: { x0: 0.02, y0: 0.80, x1: 0.98, y1: 0.97 },
        font: { family: 'sans', weight: 900, maxFont: 96, spacing: 2 },
        fill: '#ffffff'
      }
    }
  },

  /* ============================ CHATS ============================ */
  quotly: {
    label: 'Quotly (cita estilo Telegram)',
    parts: {
      canvas: { bg: '#000000' },
      card: { padX: 24, padY: 22, gap: 20 },
      avatar: { box: { y0: 0.5, y1: 0.5 }, size: 84, radius: 0.22 },
      name: { font: { family: 'sans', weight: 700, size: 27 }, fill: '#f59e0b' },
      msg: { font: { family: 'sans', weight: 400, size: 32, lineHeight: 1.34 }, fill: '#ffffff' }
    }
  },

  iqc: {
    label: 'Chat de WhatsApp (burbuja que crece)',
    parts: {
      template: 'iqc.jpg',
      // globo medido sobre la plantilla (736x1308)
      bubble: {
        box: { x0: 0.0408, y0: 0.4380, x1: 0.7500, y1: 0.5864 },
        radius: 0.032,
        bg: '#2a2a2a',
        pad: { top: 0.0122, bottom: 0.0076, gap: 0.0176 }
      },
      // cita dentro del globo (panel apenas más oscuro que el globo)
      quote: {
        box: { x0: 0.0503, y0: 0.4419, x1: 0.7405, y1: 0.5298 },
        bg: '#212121',
        bar: '#f97b8c',
        barWidth: 0.0109,
        padX: 0.0380,
        name: { x: 0.0870, y: 0.4670, font: { family: 'sans', weight: 600, size: 24 }, fill: '#e8848c' },
        text: { x: 0.0856, y: 0.4985, font: { family: 'sans', weight: 400, size: 27 }, fill: '#e9edef' }
      },
      // mensaje y hora
      msg: { x: 0.0679, y: 0.5474, font: { family: 'sans', weight: 400, size: 30, lineHeight: 1.36 }, fill: '#e9edef' },
      time: { right: 0.7215, y: 0.5670, font: { family: 'sans', weight: 400, size: 22 }, fill: '#a9b4bb' }
    }
  },

  cuentatiktok: {
    label: 'Cuenta de TikTok',
    parts: {
      template: 'cuentatiktok.jpg',
      row: { box: { x0: 0.054, y0: 0.333, x1: 0.967, y1: 0.414 } },
      avatar: { box: { x0: 0.078, y0: 0.346, x1: 0.196, y1: 0.414 } },
      name: { box: { x0: 0.232, y0: 0.340, x1: 0.952, y1: 0.384 }, font: { family: 'sans', weight: 600 }, fill: '#ffffff' },
      status: { box: { x0: 0.232, y0: 0.378, x1: 0.952, y1: 0.400 }, font: { family: 'sans', weight: 400 }, fill: '#9a9a9a' },
      cover: { x0: 0.207 }
    }
  },

  storyreply: {
    label: 'Replied to your story',
    parts: {
      template: 'storyreply.jpg',
      photo: { box: { x0: 0.060, y0: 0.155, x1: 0.360, y1: 0.695 }, radius: 0.16 },
      reply: {
        box: { x0: 0.075, y0: 0.745, x1: 0.905, y1: 0.880 },
        pad: 0.018,
        lineHeight: 1.3,
        font: { family: 'sans', weight: 500, maxFont: 30, maxLines: 3 },
        fill: '#e9e9eb'
      },
      bubble: { box: { x0: 0.037, y0: 0.699, x1: 0.924, y1: 0.902 } }
    }
  },

  /* ============================ CARTELES ============================ */
  bratanime: {
    label: 'Anime sosteniendo cartel',
    parts: {
      template: 'bratanime.png',
      sign: { box: { x0: 0.163, y0: 0.497, x1: 0.818, y1: 0.810 } },
      text: { font: { family: 'serif', weight: 700, maxFont: 96, maxLines: 4 }, fill: '#111111' }
    }
  },

  bratcoyote: {
    label: 'Coyote sosteniendo cartel',
    parts: {
      template: 'bratcoyote.png',
      sign: { box: { x0: 0.052, y0: 0.092, x1: 0.538, y1: 0.468 } },
      // La tipografía del cartel original: letra a mano (`hand` = Caveat Brush,
      // empaquetada en assets/fonts). Mayúsculas, interlineado amplio y el texto
      // centrado en el cartel, igual que la plantilla de Drive.
      // ?font=sans|serif|mono la cambia, como en el resto de los canvas.
      text: {
        font: { family: 'hand', weight: 400, maxFont: 102, maxLines: 4, lineHeight: 1.1, spacing: 0, align: 'middle', uppercase: true },
        fill: '#111111',
        pad: 0.055,
        // el texto del cartel original no está centrado: baja un poco
        offsetY: 0.19
      }
    }
  },

  bratpinguino: {
    label: 'Pingüino con cartel',
    parts: {
      template: 'bratpinguino.jpg',
      sign: { box: { x0: 0.335, y0: 0.545, x1: 0.875, y1: 0.855 } },
      text: { cover: false, font: { family: 'sans', weight: 700, maxFont: 72, maxLines: 4, rotate: -3.4 }, fill: '#2b3020' }
    }
  },

  bobesponja: {
    label: 'Bob Esponja con hoja',
    parts: {
      template: 'bobesponja.jpg',
      sign: { box: { x0: 0.170, y0: 0.255, x1: 0.745, y1: 0.870 } },
      text: { cover: false, font: { family: 'sans', weight: 700, maxFont: 46, maxLines: 5 } }
    }
  },

  bobesponja2: {
    label: 'Bob Esponja (cómic 4 paneles)',
    parts: {
      template: 'bobesponja2.jpg',
      sign: { box: { x0: 0.075, y0: 0.105, x1: 0.410, y1: 0.395 } },
      text: { cover: false, font: { family: 'sans', weight: 700, maxFont: 32, maxLines: 4 } }
    }
  },

  bobesponja3: {
    label: 'Bob Esponja con cartel',
    parts: {
      template: 'bobesponja3.jpg',
      sign: { box: { x0: 0.545, y0: 0.085, x1: 0.858, y1: 0.620 } },
      text: { cover: false, font: { family: 'sans', weight: 700, maxFont: 56, maxLines: 5 } }
    }
  },

  cartelboy: {
    label: 'Muñeco con cartel',
    parts: {
      template: 'cartelboy.jpg',
      sign: { box: { x0: 0.405, y0: 0.425, x1: 0.885, y1: 0.735 } },
      text: { cover: false, font: { family: 'sans', weight: 700, maxFont: 46, maxLines: 4, rotate: -1.5 }, fill: '#3a3a3a' }
    }
  },

  pcquote: {
    label: 'Foto dentro de MS Paint',
    parts: {
      template: 'pcquote.jpg',
      photo: { box: { x0: 0.152, y0: 0.128, x1: 0.935, y1: 0.700 } },
      text: { box: { x0: 0.152, y0: 0.128, x1: 0.935, y1: 0.700 }, font: { family: 'sans', weight: 700, maxFont: 72, maxLines: 4 }, fill: '#1f2937' }
    }
  },

  searched: {
    label: 'Se busca (cartel del oeste)',
    parts: {
      template: 'searched.jpg',
      photo: { box: { x0: 0.284, y0: 0.303, x1: 0.770, y1: 0.642 } },
      band: { box: { x0: 0.278, y0: 0.5955, x1: 0.777, y1: 0.645 }, bg: '#000000', opacity: 0.74 },
      name: { box: { x0: 0.283, y0: 0.6000, x1: 0.772, y1: 0.6420 }, font: { family: 'serif', weight: 900, maxLines: 1 }, fill: '#ffffff' },
    }
  },

  pokemoncard: {
    label: 'Carta Pokémon',
    parts: {
      template: 'pokemoncard.jpg',
      photo: { box: { x0: 0.088, y0: 0.108, x1: 0.912, y1: 0.468 }, radius: 6 },
      name: { box: { x0: 0.205, y0: 0.043, x1: 0.755, y1: 0.083 }, font: { family: 'sans', weight: 700, maxFont: 36 }, fill: '#222222' },
      hp: { box: { x0: 0.60, y0: 0.045, x1: 0.782, y1: 0.081 }, font: { family: 'sans', weight: 700, maxFont: 29 }, fill: '#c0392b', align: 'end' },
      type: { box: { x0: 0.105, y0: 0.498, x1: 0.705, y1: 0.522 }, font: { family: 'sans', weight: 400, maxFont: 22 }, fill: '#4a4a4a' },
      attack: { box: { x0: 0.105, y0: 0.585, x1: 0.725, y1: 0.626 }, font: { family: 'sans', weight: 700, maxFont: 38 }, fill: '#222222' },
      damage: { box: { x0: 0.72, y0: 0.585, x1: 0.90, y1: 0.626 }, font: { family: 'sans', weight: 700, maxFont: 38 }, fill: '#222222', align: 'end' },
      description: { box: { x0: 0.105, y0: 0.652, x1: 0.895, y1: 0.782 }, font: { family: 'sans', weight: 400, maxFont: 26, maxLines: 5, lineHeight: 1.3 }, fill: '#333333' }
    }
  },

  /* ============================ TARJETAS ============================ */
  ship: {
    label: 'Medidor de compatibilidad',
    parts: {
      canvas: { width: 1200, height: 460, bg: '#23272e' },
      title: { box: { x0: 0.18, y0: 0.05, x1: 0.82, y1: 0.15 }, font: { family: 'sans', weight: 700, maxFont: 30 }, fill: '#ff6b8a' },
      avatar1: { box: { x0: 0.30, y0: 0.56, x1: 0.30, y1: 0.56 }, size: 210 },
      avatar2: { box: { x0: 0.70, y0: 0.56, x1: 0.70, y1: 0.56 }, size: 210 },
      heart: { box: { x0: 0.465, y0: 0.24, x1: 0.535, y1: 0.38 }, fill: '#ff2d55' },
      percentage: { box: { x0: 0.38, y0: 0.38, x1: 0.62, y1: 0.49 }, font: { family: 'sans', weight: 800, maxFont: 40 }, fill: '#ff2d55' },
      phrase: { box: { x0: 0.32, y0: 0.50, x1: 0.68, y1: 0.60 }, font: { family: 'sans', weight: 700, maxFont: 26 }, fill: '#ff8fa6' },
      name1: { box: { x0: 0.18, y0: 0.82, x1: 0.42, y1: 0.93 }, font: { family: 'sans', weight: 600, maxFont: 24 }, fill: '#ffffff' },
      name2: { box: { x0: 0.58, y0: 0.82, x1: 0.82, y1: 0.93 }, font: { family: 'sans', weight: 600, maxFont: 24 }, fill: '#ffffff' }
    }
  },

  friendship: {
    label: 'Medidor de amistad',
    parts: {
      canvas: { width: 1200, height: 460, bg: '#23272e' },
      title: { box: { x0: 0.18, y0: 0.05, x1: 0.82, y1: 0.15 }, font: { family: 'sans', weight: 700, maxFont: 30 }, fill: '#2ee06d' },
      avatar1: { box: { x0: 0.30, y0: 0.56, x1: 0.30, y1: 0.56 }, size: 210 },
      avatar2: { box: { x0: 0.70, y0: 0.56, x1: 0.70, y1: 0.56 }, size: 210 },
      heart: { box: { x0: 0.465, y0: 0.24, x1: 0.535, y1: 0.38 }, fill: '#ffc93c' },
      percentage: { box: { x0: 0.38, y0: 0.38, x1: 0.62, y1: 0.49 }, font: { family: 'sans', weight: 800, maxFont: 40 }, fill: '#00e05a' },
      phrase: { box: { x0: 0.32, y0: 0.50, x1: 0.68, y1: 0.60 }, font: { family: 'sans', weight: 700, maxFont: 26 }, fill: '#6cf0a5' },
      name1: { box: { x0: 0.18, y0: 0.82, x1: 0.42, y1: 0.93 }, font: { family: 'sans', weight: 600, maxFont: 24 }, fill: '#ffffff' },
      name2: { box: { x0: 0.58, y0: 0.82, x1: 0.82, y1: 0.93 }, font: { family: 'sans', weight: 600, maxFont: 24 }, fill: '#ffffff' }
    }
  },

  gaycard: {
    label: 'Tarjeta arcoíris',
    parts: {
      canvas: { width: 600, height: 450, bg: '#141414' },
      avatar: { box: { x0: 0.50, y0: 0.435, x1: 0.50, y1: 0.435 }, size: 190, ring: '#ffffff' },
      title: { box: { x0: 0.10, y0: 0.05, x1: 0.90, y1: 0.15 }, font: { family: 'mono', weight: 700, maxFont: 30, spacing: 2 } },
      name: { box: { x0: 0.15, y0: 0.70, x1: 0.85, y1: 0.80 }, font: { family: 'serif', weight: 700, maxFont: 34 }, fill: '#ffffff' },
      badge: {
        box: { x0: 0.31, y0: 0.82, x1: 0.69, y1: 0.92 },
        pill: { bg: '#ffffff', radius: 26 },
        font: { family: 'sans', weight: 700, maxFont: 26 },
        fill: '#ff2d55'
      }
    }
  },

  /* ============================ FOTOS ============================ */
  rata: {
    label: 'Rata con tu foto',
    parts: { template: 'rata.jpg', hole: { cx: 0.6253, cy: 0.5325, rx: 0.1287, ry: 0.1698 } }
  },
  banana: {
    label: 'Plátano con tu foto',
    parts: { template: 'banana.jpg', hole: { cx: 0.53, cy: 0.4483, rx: 0.159, ry: 0.166 } }
  },
  galletita: {
    label: 'Galletita con tu foto',
    parts: { template: 'galletita.jpg', hole: { cx: 0.466, cy: 0.5009, rx: 0.1616, ry: 0.1507 } }
  },
  minions: {
    label: 'Tres minions',
    parts: {
      template: 'minions.jpg',
      hole1: { cx: 0.256, cy: 0.472, rx: 0.118, ry: 0.080 },
      hole2: { cx: 0.522, cy: 0.436, rx: 0.135, ry: 0.087 },
      hole3: { cx: 0.766, cy: 0.468, rx: 0.114, ry: 0.083 }
    }
  },
  arandano: {
    label: 'Arándano con tu foto',
    parts: { template: 'arandano.jpg', photo: { box: { x0: 0.24, y0: 0.20, x1: 0.71, y1: 0.75 } } }
  },
  pan: {
    label: 'Pan con tu foto',
    parts: { template: 'pan.jpg', photo: { box: { x0: 0.29, y0: 0.34, x1: 0.74, y1: 0.78 } } }
  },
  laptop: {
    label: 'Foto en la pantalla del PC',
    parts: { template: 'laptop.jpg', photo: { box: { x0: 0.52, y0: 0.29, x1: 1, y1: 0.68 } } }
  },
  canvaimagen: {
    label: 'Soyjaks con tu foto de fondo',
    parts: { template: 'canvaimagen.jpg', photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 } } }
  },

  /* ============================ EFECTOS ============================ */
  /* Pantalla verde que se reemplaza por tu foto: la parte NO verde de la
     plantilla (los lentes, la cara, las rejas…) queda siempre encima. */
  sunglass: {
    label: 'Lentes de píxeles',
    parts: { template: 'sunglass.jpg', photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 } } }
  },
  trollface: {
    label: 'TrollFace encima de tu foto',
    parts: { template: 'trollface.jpg', photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 } } }
  },
  badface: {
    label: 'Cara de asco encima de tu foto',
    parts: { template: 'badface.jpg', photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 } } }
  },
  carcel: {
    label: 'Rejas de cárcel',
    parts: { template: 'carcel.jpg', photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 } } }
  },
  pc: {
    label: 'TU foto en el monitor',
    parts: { template: 'pc.jpg', photo: { box: { x0: 0.0625, y0: 0.145, x1: 0.4675, y1: 0.4675 } } }
  },
  /* Buscador de Google con tus imágenes en los resultados. Cada panel tiene su
     propio `url` (url1…url5) y el avatar de la cuenta usa `avatar`. */
  google: {
    label: 'Búsqueda de imágenes de Google',
    parts: {
      template: 'google.jpg',
      photo1: { box: { x0: 0.0239, y0: 0.3104, x1: 0.4846, y1: 0.5126 } },
      photo2: { box: { x0: 0.5126, y0: 0.3104, x1: 0.9733, y1: 0.5126 } },
      photo3: { box: { x0: 0.0225, y0: 0.5300, x1: 0.4846, y1: 0.9352 } },
      photo4: { box: { x0: 0.5126, y0: 0.5292, x1: 0.9747, y1: 0.7314 } },
      photo5: { box: { x0: 0.5126, y0: 0.7480, x1: 0.9747, y1: 0.9305 } },
      avatar: { box: { x0: 0.8371, y0: 0.0411, x1: 0.9438, y1: 0.1011 } }
    }
  },
  gay: {
    label: 'Filtro arcoíris',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      overlay: { opacity: 0.45, colors: ['#ff004d', '#ff8a00', '#ffee00', '#00e05a', '#0088ff', '#8a2be2'] }
    }
  },
  invert: {
    label: 'Foto invertida',
    parts: { photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 } }
  },

  /* ---------------- Filtros de foto (photo + filter) ---------------- */
  // `photo.width` limita el ancho de salida y `filter.*` son los ajustes de
  // cada efecto; todo se puede pisar desde la URL: ?filter.amount=0.8&filter.cx=0.35
  grayscale: {
    label: 'Blanco y negro',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 1, tone: '' }
    }
  },
  blur: {
    label: 'Desenfoque',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 8 }
    }
  },
  pixel: {
    label: 'Pixelado',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { size: 12, colors: 0 }
    }
  },
  deepfry: {
    label: 'Deep fried',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 1 }
    }
  },
  sketch: {
    label: 'Lápiz',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 1, detail: 8 },
      paper: 'fffdf5'
    }
  },
  swirl: {
    label: 'Remolino',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 190, radius: 0.62, cx: 0.5, cy: 0.5 }
    }
  },
  liquify: {
    label: 'Liquify',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 65, radius: 0.7, cx: 0.5, cy: 0.5 },
      mode: 'bulge'
    }
  },
  glitch: {
    label: 'Glitch',
    parts: {
      photo: { box: { x0: 0, y0: 0, x1: 1, y1: 1 }, maxWidth: 1024 },
      filter: { amount: 0.7, slices: 14, seed: 7, scanlines: 0.6 }
    }
  },

  quotly: {
    label: 'Sticker estilo Quotly',
    parts: {
      canvas: { bg: '#000000', maxWidth: 1000 },
      avatar: { size: 84, radius: 0.22 },
      name: { font: { family: 'sans', weight: 700, size: 0.86 }, fill: '#f59e0b' },
      body: { font: { family: 'sans', weight: 400, size: 32, lineHeight: 1.34 }, fill: '#ffffff' },
      pad: { x: 24, y: 22, gap: 20 }
    }
  }
};

const get = id => LAYOUTS[String(id || '').toLowerCase()] || null;

module.exports = { LAYOUTS, get };
