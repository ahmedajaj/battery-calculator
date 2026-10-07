import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/** Dev-only plugin: serves GET/PUT for scenario.json (mimics nginx WebDAV in prod) */
function scenarioDevPlugin(scenarioPin: string): Plugin {
  const filePath = path.resolve(import.meta.dirname, 'data/scenario.json');
  return {
    name: 'scenario-dev-server',
    configureServer(server) {
      server.middlewares.use('/battery-calculator/data/scenario.json', (req, res) => {
        if (req.method === 'GET') {
          try {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ scenarioId: null, scenarioName: null, scenarioTag: null, updatedAt: null }));
          }
          return;
        }
        if (req.method === 'PUT') {
          // Check PIN from Authorization header (Basic auth: user "admin", password = PIN)
          const auth = req.headers.authorization || '';
          const expected = 'Basic ' + Buffer.from(`admin:${scenarioPin}`).toString('base64');
          if (auth !== expected) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid PIN' }));
            return;
          }
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              JSON.parse(body); // validate
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(body);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end('Method not allowed');
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) for server-side proxy use
  const env = loadEnv(mode, process.cwd(), '');
  const scenarioPin = env.VITE_SCENARIO_PIN || '1234';

  return {
    base: '/battery-calculator/',
    plugins: [react(), tailwindcss(), scenarioDevPlugin(scenarioPin)],
    server: {
      // scenario.json is rewritten by the publish endpoint — don't reload the page when it changes
      watch: { ignored: ['**/data/**'] },
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
