import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: '/display/',
  build: {
    outDir: path.resolve(__dirname, '../backend/LightMosaic.Backend/wwwroot/display'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/hubs': {
        target: 'http://localhost:5190',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
