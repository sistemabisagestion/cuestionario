import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Development configuration only; this value is never exposed in the bundle.
const apiPort = process.env.BISA_API_PORT || loadEnv('matrices', process.cwd(), 'BISA_API_PORT').BISA_API_PORT || '3002'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('error', (_error, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
              res.end(JSON.stringify({ error: `Servidor desconectado: no se pudo conectar con la API local (127.0.0.1:${apiPort}). Cierra esta terminal y vuelve a ejecutar npm run dev.`, code: 'API_UNREACHABLE' }));
            }
          })
          // changeOrigin: false keeps the browser's Host header, so the API's same-origin (CSRF)
          // check compares it with Origin. Never derive Host from Origin: that accepts any site.
        },
      },
    },
  },
})
