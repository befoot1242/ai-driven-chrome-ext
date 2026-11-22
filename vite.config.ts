import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// MV3 拡張機能のビルド設定。
// 各エントリを固定のファイル名で出力し、manifest.json を dist/ にコピーする。
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync(resolve(__dirname, 'src/manifest.json'), resolve(__dirname, 'dist/manifest.json'));
      },
    },
  ],
});
