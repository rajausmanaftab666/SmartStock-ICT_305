import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sharedSrc = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Matches the `paths` entries in tsconfig.json so the validation schemas
      // in shared/ are the same source on both sides of the wire.
      { find: /^@shared$/, replacement: `${sharedSrc}/index.ts` },
      { find: /^@shared\//, replacement: `${sharedSrc}/` },
    ],
  },
  server: {
    port: 5173,
    fs: {
      // shared/ lives outside the client root.
      allow: ['..'],
    },
    // The API is proxied through the dev server so the browser sees one
    // origin. That keeps the session cookie first-party and means no CORS
    // configuration is needed in development.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
