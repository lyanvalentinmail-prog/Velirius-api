// src/config.js — Configuración central de Velirius API
module.exports = {
  name: 'Velirius API',
  brand: 'VELIRIUS',
  creator: 'Velirius',
  storeFooter: 'VELIRIUS STORE',
  githubUrl: 'https://github.com/lyanvalentinmail-prog',
  mainWebsite: '/',
  supportUrl: 'https://github.com/lyanvalentinmail-prog/Velirius-api',
  port: process.env.PORT || 3000,
  // Imagen de ejemplo pública usada en las pruebas de Canvas (avatar por defecto del repo)
  defaultAvatarPath: '/img/default-avatar.jpg',

  // ---------- Multimedia de la web (carpeta "Velirius api" de Google Drive) ----------
  // Los archivos están compartidos como "cualquiera con el enlace" para poder
  // mostrarse en el sitio. Las capturas se sirven directo desde el CDN de Drive;
  // el video pasa por /media/dashboardvid.mp4 (proxy con caché) y, si falla,
  // el <video> cae al enlace directo de Drive.
  media: {
    driveFolder: '1fVn2qKJrHUzMc-p97NZDDbHX3nQqHHRP',
    video: {
      id: '1jgvNMSHNu8_g2pNK6imQiK7kvSR0kCLk',
      name: 'DashboardVid.mp4',
      direct: 'https://drive.usercontent.google.com/download?id=1jgvNMSHNu8_g2pNK6imQiK7kvSR0kCLk&export=download&confirm=t'
    },
    dashboard: [
      { id: '1JFFQpQlcIIon6XnLvwRwBZN-NnUC67rv', name: 'dashboard1.jpg' },
      { id: '1Q0JsIgEAHWCwBawXBfvWHIWIO76D-PDW', name: 'dashboard2.jpg' }
    ],
    captures: [
      { id: '12PzTV6CSK61AI91fXEEmVSsgHsv3XrvC', name: '1.jpg' },
      { id: '1eG1wD8oEFOmQqAt_ymvWHQe1h3QM7E3h', name: '2.jpg' },
      { id: '1mzGNi80yFsVstr3gsUffr-SHmjXqY7M2', name: '3.jpg' },
      { id: '18BIDiFo-kM77nuiuNV6xA_tqjnoMeQXz', name: '4.jpg' }
    ]
  }
};
