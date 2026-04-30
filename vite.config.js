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
    chunkSizeWarningLimit: 800,
    // Keep identifiers readable to prevent minified-name TDZ collisions.
    // manualChunks splits vendors into separate files so the main bundle
    // stays under 500 kB and the browser can cache React/Supabase independently.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return
          if (id.includes('@supabase'))        return 'supabase'
          if (id.includes('react-dom'))        return 'react-dom'
          if (id.includes('react'))            return 'react'
          return 'vendor'
        },
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false,
  },
  server: { host: true },
})
