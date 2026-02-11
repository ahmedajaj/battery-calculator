import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) for server-side proxy use
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Inject the Deye token server-side — never sent to the browser
              const token = env.DEYE_TOKEN || '';
              if (token) {
                proxyReq.setHeader('Authorization', `Bearer ${token}`);
              }
            });
          },
        },
      },
    },
  };
})
