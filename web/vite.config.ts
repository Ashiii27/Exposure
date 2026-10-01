import { defineConfig } from 'vite';

export default defineConfig({
  // Static SPA; deployed to Cloudflare Pages at the domain root.
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
