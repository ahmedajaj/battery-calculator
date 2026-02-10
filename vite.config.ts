import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/battery-calculator/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/battery-calculator/api/yasno': {
        target: 'https://app.yasno.ua',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/battery-calculator\/api\/yasno/, '/api/blackout-service/public/shutdowns/regions/25/dsos/902'),
      },
      '/battery-calculator/api/deye': {
        target: 'https://eu1-developer.deyecloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/battery-calculator\/api\/deye/, '/v1.0/station'),
      },
    },
  },
})
