import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Deployed to GitHub Pages as a project site (https://elpis-for-blanc.github.io/dearly-our-little-life/), not
  // a user/org site at the domain root — every built asset URL (JS/CSS chunks, index.html's own script/link tags,
  // and anything else Vite's HTML transform rewrites) needs this prefix or it 404s under the real path and the
  // page renders blank. Must match the actual repo name exactly. Runtime code that builds its own asset URLs
  // (bgmConfig.ts's resolveMusicUrl) already reads `import.meta.env.BASE_URL`, which this `base` value feeds —
  // no separate change needed there.
  base: '/dearly-our-little-life/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
