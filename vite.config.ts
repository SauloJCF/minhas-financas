import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    // No CI é o commit publicado; localmente, 'dev'.
    __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a nova versão só assume quando o usuário aceita o aviso.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Minhas Finanças',
        short_name: 'Finanças',
        description: 'Controle financeiro pessoal',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#047857',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
