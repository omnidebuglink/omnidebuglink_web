import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 给打包产物一个稳定的相对路径(Capacitor WebView 从 capacitor://localhost 提供)
  base: './',
});
