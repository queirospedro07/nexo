import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 5184,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:5304',
      '/socket.io': { target: 'http://127.0.0.1:5304', ws: true },
    },
  },
});
