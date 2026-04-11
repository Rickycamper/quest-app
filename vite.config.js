import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VitePWA disabled temporarily — stale SW was blocking updates for all users

export default defineConfig({
  plugins: [
    react(),
  ],
  server: { host: true },
})
