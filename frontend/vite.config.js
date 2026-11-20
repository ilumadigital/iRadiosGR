import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), 
  ],
  // ΠΡΟΣΘΗΚΗ: Οδηγίες για το πώς θα "στυφτεί" ο κώδικας
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // Χωρίζει τις βιβλιοθήκες σε άλλο αρχείο
          }
        }
      }
    }
  },
  // Κόβει τα console.log για να μην τρώνε μνήμη στα κινητά
  esbuild: {
    drop: ['console', 'debugger'],
  },
  // Το server block μένει ΜΟΝΟ για το local development σου
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['play.iradios.gr'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5011',
        changeOrigin: true,
        secure: false,
      },
      '/sitemap.xml': {
        target: 'http://127.0.0.1:5011',
        changeOrigin: true,
      }
    }
  }
})
