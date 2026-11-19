import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Yalnızca bu yapılandırma dosyası Node ortamında çalışır; tarayıcı koduna Node tipleri eklememek için yerel tanım.
declare const process: { env: Record<string, string | undefined> }

// Uygulamanın yayınlandığı alt yol. GitHub Pages'te depo adına göre "/filiz/" gibi olur;
// GitHub Actions bunu BASE_PATH ile verir. Bilgisayarda çalışırken "/" kullanılır.
const base = process.env.BASE_PATH ?? '/'

// PWA yapılandırması: uygulama kabuğu ve tüm içerik çevrimdışı önbelleğe alınır.
// Kullanıcı verisi (ilerleme, cevaplar) önbellekte değil, IndexedDB'de tutulur.
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Filiz — Dil Öğrenme',
        short_name: 'Filiz',
        description: 'Kısa, etkileşimli dersler ve aralıklı tekrar ile kişisel dil öğrenme uygulaması.',
        lang: 'tr',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#F1F2EE',
        theme_color: '#F1F2EE',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Büyük kelime paketleri (dil başına ~2 MB) önceden değil, ilk kullanımda indirilir ve saklanır
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/content/') && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'filiz-content', expiration: { maxEntries: 120 } },
          },
        ],
      },
    }),
  ],
})
