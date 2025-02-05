import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          pglite: ['@electric-sql/pglite'],
          worker: ['@electric-sql/pglite/worker'],
          extensions: [
            '@electric-sql/pglite/vector',
            '@electric-sql/pglite/live',
            '@electric-sql/pglite/contrib/pg_trgm'
          ]
        }
      }
    },
    commonjsOptions: {
      include: [/@electric-sql\/pglite/]
    }
  },
  worker: {
    format: 'es',
    plugins: [],
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: {
          pglite: ['@electric-sql/pglite'],
          extensions: [
            '@electric-sql/pglite/vector',
            '@electric-sql/pglite/live',
            '@electric-sql/pglite/contrib/pg_trgm'
          ]
        }
      }
    }
  }
});
