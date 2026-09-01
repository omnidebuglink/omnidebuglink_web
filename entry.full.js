/**
 * 打包入口(仅构建用;业务源码零依赖不变)。
 * 与直接 import omnidebuglink.js 的区别:
 *   1. 预置 html2canvas 全局(打进包);
 *   2. 把类挂到 globalThis.OmniDebugLink —— IIFE 产物 <script src> 引入后直接 OmniDebugLink.start(...)。
 */
import { OmniDebugLink, LIB_VERSION } from './omnidebuglink.js';
import './html2canvas-global.js';

if (typeof globalThis.OmniDebugLink === 'undefined') {
  globalThis.OmniDebugLink = OmniDebugLink;
}

export { OmniDebugLink, LIB_VERSION };
