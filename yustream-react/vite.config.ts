import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: true,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/live': {
        target: 'http://localhost:5080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})