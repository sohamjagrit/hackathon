import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/agent': 'http://localhost:8000',
      '/events': 'http://localhost:8000',
      '/tools': 'http://localhost:8000',
      '/context': 'http://localhost:8000',
      '/debug': 'http://localhost:8000',
    },
  },
})
