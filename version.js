/**
 * 版本单一来源:omnidebuglink.js(hello/静态字段)与 tasks-basics.js(get_stats)
 * 都从这里取,build.mjs 校验它与 package.json 一致。发版只改这里 + package.json。
 * (此前 tasks-basics.js 自带一份硬编码常量,v0.1.1 bump 时漏改导致 get_stats 谎报版本)
 */
export const LIB_VERSION = '0.2.0';
