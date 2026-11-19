import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import os from 'os'
import fs from 'fs'

const versionConfig = JSON.parse(
  fs.readFileSync(resolve(__dirname, 'Version.json'), 'utf-8')
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Inject build-time constants and MODE Flags from Version.json (Rule 7)
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(
      new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
    ),
    __APP_VERSION__: JSON.stringify(versionConfig.version),
    __MOCKUP_MODE__: JSON.stringify(Boolean(versionConfig.MOCKUP_MODE)),
    __STORAGE_MODE__: JSON.stringify(versionConfig.STORAGE_MODE || 'Cloud'),
  },
  root: 'frontend',
  publicDir: 'desktop/public',
  cacheDir: resolve(os.tmpdir(), 'vite-kdt-cache'),
  optimizeDeps: {
    include: [
      'react-markdown',
      'remark-rehype',
      'remark-parse',
      'unified',
      'unist-util-visit',
      'hast-util-to-jsx-runtime',
      'mdast-util-to-hast',
      'vfile',
    ],
  },
  server: {
    port: 3500,
    strictPort: true,
  },
  preview: {
    port: 3500,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        root: resolve(__dirname, 'frontend/index.html'),
        main: resolve(__dirname, 'frontend/desktop/index.html'),
      },
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
          if (id.includes('/exceljs/') || id.includes('/archiver/') || id.includes('/unzipper/') || id.includes('/tmp/')) return 'vendor-excel';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/lucide-react/')) return 'vendor-ui';
          if (id.includes('/dompurify/')) return 'vendor-dompurify';
          return 'vendor-other';
        },
      },
    },
  },
})
