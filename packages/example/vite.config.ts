import { defineConfig } from 'vite'

export default defineConfig({
  // Set base to repository name for GitHub Pages
  // This will be overridden by environment variable in production
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
