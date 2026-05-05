import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    preact(),
    webExtension({
      manifest: () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkg = require('./package.json') as { version: string }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const manifest = require('./src/manifest.json') as Record<string, unknown>
        return { ...manifest, version: pkg.version }
      },
      additionalInputs: [],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
