/**
 * 构建脚本:npm run build
 * 产出 dist/ 两个文件(均已 minify、内联 html2canvas 1.4.1 及其 MIT 声明):
 *   omnidebuglink.min.js       IIFE —— <script src> 引入,globalThis.OmniDebugLink
 *   omnidebuglink.esm.min.js   ESM  —— import { OmniDebugLink } 或 <script type="module">
 * 版本以 package.json 为准,且必须与 omnidebuglink.js 的 LIB_VERSION 一致(发版两处同 bump)。
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

const src = await readFile(new URL('./omnidebuglink.js', import.meta.url), 'utf8');
const m = src.match(/LIB_VERSION\s*=\s*'([^']+)'/);
if (!m || m[1] !== pkg.version) {
  console.error(`版本不一致:package.json=${pkg.version},omnidebuglink.js LIB_VERSION=${m ? m[1] : '?'}`);
  process.exit(1);
}

const common = {
  entryPoints: ['entry.full.js'],
  bundle: true,
  minify: true,
  sourcemap: false,
  legalComments: 'inline', // 保留 html2canvas 的 MIT 声明在产物内
  charset: 'utf8',
  target: ['es2022'], // 源码用了 class static fields(ES2022);调试 SDK 面向现代浏览器即可
  logLevel: 'info',
  banner: { js: `/*! OmniDebugLink Web SDK v${pkg.version} | MIT | https://omnidebuglink.dev */` },
};

await Promise.all([
  build({ ...common, format: 'iife', outfile: 'dist/omnidebuglink.min.js' }),
  build({ ...common, format: 'esm', outfile: 'dist/omnidebuglink.esm.min.js' }),
]);

for (const f of ['dist/omnidebuglink.min.js', 'dist/omnidebuglink.esm.min.js']) {
  const buf = await readFile(f);
  const kb = (buf.length / 1024).toFixed(1).padStart(7);
  const sri = createHash('sha384').update(buf).digest('base64');
  console.log(`${f.padEnd(32)} ${kb} KB  integrity="sha384-${sri}"`);
}
