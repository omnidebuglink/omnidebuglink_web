# React + Capacitor Android Sample

OmniDebugLink Web SDK 的 React 用法演示 + 打包安卓 APK。SDK 以 `file:../..` 本地包安装
（真包形态：`@omnidebuglink/web`，main 指向 dist ESM bundle），npm 发布后改普通依赖即可。

## 演示内容（对应 MCP task）

- 受控表单（text/email/select/range）→ `input_text`（React onChange 兼容）、`swipe` 拖滑块
- 按钮 + 动态列表 → `ui_click` / `find_objects`（都带 `data-testid`）
- Shadow DOM web component → `ui_traverse`（shadow 可见）/ `screenshot`（0.1.4 起展平渲染）
- 日志区 → `read_logs`
- token 输入框 → `prefs`（localStorage 可存）

设备 token：默认 `web-react` 席位（与网页 sample 分席，避免 4000 互踢）。

## 命令

```bash
npm install            # 安装依赖（SDK 走 file:../..）
npm run dev            # 浏览器调试（http://localhost:5173）
npm run build          # 产出 dist/（Capacitor webDir）
npx cap add android    # 首次：生成 android/ 工程（已生成则跳过）
npx cap sync android   # web 资产拷进 android 工程
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

需要 Java 17 + ANDROID_HOME（platform 35/36 均可）。改了 web 代码后：`npm run build && npx cap sync android` 再打包。
