import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  /*
   * Relative asset URLs.
   *
   * The default ('/') emits absolute paths like /assets/index.js, which 404
   * whenever the app is not served from a domain root - opening index.html
   * directly, or hosting under a sub-path such as /pos/. './' makes every
   * asset resolve relative to index.html, so the build works in all three
   * cases. Override with VITE_BASE at build time if you need an absolute
   * public path (e.g. a CDN).
   */
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow proxied/tunnelled hosts used by remote dev previews.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
