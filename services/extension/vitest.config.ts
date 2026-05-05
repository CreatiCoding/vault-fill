import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Use esbuild JSX transform directly — avoids @preact/preset-vite's zimmerframe
  // PnP incompatibility while still supporting Preact JSX in tests
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/popup/**', 'src/background/**', 'src/content/**'],
      exclude: ['src/__tests__/**'],
    },
  },
})
