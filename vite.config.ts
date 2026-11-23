import { copyFileSync, mkdirSync } from 'node:fs';
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
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        registration: resolve(__dirname, 'src/registration/index.html'),
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
    {
      name: 'copy-third-party-licenses',
      closeBundle() {
        const output = resolve(__dirname, 'dist/third-party-licenses');
        mkdirSync(output, { recursive: true });
        const packages = [
          ['tldts', 'tldts'],
          ['tldts-core', 'tldts-core'],
          ['vue', 'vue'],
          ['@vue/shared', 'vue-shared'],
          ['@vue/reactivity', 'vue-reactivity'],
          ['@vue/runtime-core', 'vue-runtime-core'],
          ['@vue/runtime-dom', 'vue-runtime-dom'],
        ];
        for (const [source, target] of packages) {
          if (!source || !target) throw new Error('ライセンスのコピー先が不正です。');
          copyFileSync(
            resolve(__dirname, 'node_modules', source, 'LICENSE'),
            resolve(output, `${target}.txt`),
          );
        }
      },
    },
  ],
});
