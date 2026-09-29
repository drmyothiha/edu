import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-root-to-edu',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/login') {
            res.writeHead(302, { Location: req.url === '/login' ? '/edu/login' : '/edu/' });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  base: '/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/edu/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/edu/, ''),
        timeout: 120000,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 120000,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
