import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// A API fica atrás do prefixo /api. Em desenvolvimento quem faz a ponte é o Vite (abaixo);
// em produção, o nginx (ver nginx.conf). Nos dois casos o prefixo é removido antes de chegar ao Nest.
const apiProxy = {
  '/api': {
    target: process.env.API_URL ?? 'http://localhost:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: !!process.env.VITEST,
      registerType: 'autoUpdate', // o app se atualiza sozinho quando há versão nova
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Controle de gastos',
        short_name: 'Gastos',
        description: 'Lançamento rápido de gastos',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Só a "casca" do app (HTML, JS, CSS, ícones) vai para o cache. As chamadas à API nunca:
      // lançar gasto offline não é suportado, então dados sempre vêm do servidor.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
