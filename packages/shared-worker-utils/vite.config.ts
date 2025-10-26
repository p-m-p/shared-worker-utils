import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
  plugins: mode !== 'test' ? [dts({ rollupTypes: true })] : [],
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
