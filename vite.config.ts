import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/yasno': {
        target: 'https://app.yasno.ua',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yasno/, '/api/blackout-service/public/shutdowns/regions/25/dsos/902'),
      },
      '/api/deye': {
        target: 'https://eu1-developer.deyecloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deye/, '/v1.0/station'),
      },
    },
  },
})
