/**
 * 打包模式专用:把仓库内 vendor 的 html2canvas 1.4.1(UMD)挂到全局。
 * 页面若已自带 window.html2canvas(先于本 SDK 加载),用页面的,不覆盖。
 * 源码模式(直接 import './omnidebuglink.js')不经过本文件,仍是零依赖。
 */
import h2c from './html2canvas.min.js';

if (typeof globalThis.html2canvas !== 'function' && typeof h2c === 'function') {
  globalThis.html2canvas = h2c; // tasks-device.js 的 screenshot 用 typeof 探测这个全局
}
