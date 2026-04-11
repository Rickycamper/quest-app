import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VitePWA disabled temporarily — stale SW was blocking updates for all users

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    // Keep identifiers readable to prevent minified-name TDZ collisions
    // (esbuild reuses short names like _t, Xe across scopes in single-file bundles)
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false,
  },
  server: { host: true },
})
