import { defineConfig } from 'vite';

export default defineConfig({
  // Static SPA; deployed to Cloudflare Pages at the domain root.
  base: '/',
  server: {
    // Expose on the LAN/sandbox and accept proxied preview hosts
    // (dev-server-only settings; they do not affect the production build).
    host: true,
    allowedHosts: true
  },
  preview: {
    host: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
