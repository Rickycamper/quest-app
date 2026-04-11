import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VitePWA disabled temporarily — stale SW was blocking updates for all users

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: 'es2020', // native optional chaining — prevents esbuild _t temp var collisions
  },
  server: { host: true },
})
