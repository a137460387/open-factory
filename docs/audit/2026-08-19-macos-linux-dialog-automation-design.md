# macOS/Linux 原生对话框自动化——调研与设计方案

日期：2026-08-19
状态：调研 + 设计方案（本轮不产生生产代码改动）
关联：roadmap「Next (v4.26+)」未勾选项「macOS/Linux native dialog automation where unattended host control is available」

---

## 1. 现状调研

### 1.1 Windows 已有完整实现

`apps/desktop/scripts/dialog-smoke.mjs`（186 行）在 **Windows** 上完整运行：

- 启动 release executable（`OPEN_FACTORY_DIALOG_SMOKE=1`）。
- `closeNativeDialog` 用 **PowerShell + Win32 API**（`FindWindow` / `EnumWindows` / `PostMessage` / `SendMessage` / `SendKeys`）查找并关闭文件选择对话框（`#32770` 类 / Cabinet 类）。
- 校验 smoke 报告（`windowExists` / `nativeDialogFound` / `dialogReturned` / `dialogCanceled`）。

### 1.2 macOS/Linux 现状：直接跳过

`smoke-platform.mjs` 的 `shouldSkipNativeAppSmoke`：

```js
if (process.platform === 'win32') return false;
// 非 win32：写 skipped 报告，不启动 app
return true;
```

- **所有** native smoke（tauri/dialog/preview/cancel 共 4 个）在非 win32 都走 skip。
- `releaseExecutablePath` 已有 macOS 候选（`.app/Contents/MacOS/...`）、Linux 候选（`open-factory-desktop`）。
- `defaultDrawtextFontPath` 已有 macOS/Linux 字体候选。
- Rust 侧对话框在 `commands/files.rs`（Tauri dialog 插件）。

### 1.3 macOS/Linux 自动化基础设施：完全没有

- grep「osascript / AppleScript / System Events / AXUIElement」：仅 `background.rs:105` 的关机命令（`osascript ... shut down`），与对话框无关。
- grep「xdotool / XTest / ydotool」：0 处。

**结论**：macOS/Linux 的对话框自动化是**空白**，只有 Windows 版本。roadmap 这一项的限定「where unattended host control is available」意味着：只在 CI 主机配置了无人值守控制能力时才跑，否则保持 skip。

---

## 2. 缺口分析

| 平台 | 现状 | 缺口 |
|------|------|------|
| Windows | Win32 API + PowerShell 自动化 | 无（已有） |
| macOS | skip | 需 AppleScript（`System Events`）+ Accessibility 权限自动化 NSOpenPanel/NSSavePanel |
| Linux | skip | 需 xdotool（X11）+ `$DISPLAY` 自动化 GTK/Qt 文件对话框 |

---

## 3. 设计方案

### 3.1 平台抽象：closeNativeDialog 按平台实现

把 `dialog-smoke.mjs` 的 `closeNativeDialog(windowTitle, processId)` 拆为平台实现：

| 平台 | 实现 | 依赖 |
|------|------|------|
| win32 | 现有 PowerShell + Win32 API（保持不动） | PowerShell |
| darwin | `osascript` + `System Events`：`keystroke` 输入路径、`click button "Open"` / `key code 53`（ESC） | osascript + Accessibility 权限 |
| linux | `xdotool search --name <title>` + `key Escape` / `type <path>` | xdotool + X11 `$DISPLAY` |

### 3.2 能力检测：shouldSkipNativeAppSmoke 平台化

`shouldSkipNativeAppSmoke` 改为「检测平台自动化能力」：

- win32：不 skip（现有行为）。
- darwin：检测 `osascript` 可执行 + 快速探测 Accessibility 权限（`osascript -e 'tell application "System Events" to get name of first process'`）；无权限则 skip + 报告 `reason: 'Accessibility permission required'`。
- linux：检测 `xdotool` 可执行 + `$DISPLAY` 非空；缺失则 skip + 报告。

### 3.3 CI 配置要求（文档化）

- **macOS runner**：授予 Terminal/runner 进程 Accessibility 权限（`System Settings → Privacy & Security → Accessibility`）；或使用预授权的自托管 runner。
- **Linux runner**：安装 `xdotool`（`apt install xdotool`）+ 运行在 X11（或用 `xvfb-run` 提供虚拟 display）。

---

## 4. 需要用户决策的开放问题

1. **实现范围**：只做 macOS（AppleScript）还是 macOS + Linux（xdotool）一起？（推荐一起，改动集中在 `dialog-smoke.mjs` + `smoke-platform.mjs` 两个脚本）
2. **能力缺失时的行为**：skip（推荐，符合「where unattended host control is available」）还是 fail（强制要求 CI 配置自动化）？
3. **本地验证策略**：本项目是 Windows 开发环境，macOS/Linux 代码无法本地验证，只能「写好 + 文档 + 依赖 CI 环境」——是否接受「未本地验证」的实现？（推荐接受，因为这是 smoke 脚本、非生产逻辑，且现有 Windows 路径不受影响）
4. **是否新增依赖**：无（osascript / xdotool 都是宿主系统工具，不进 package.json）。

（若按最小风险默认——macOS + Linux 一起、无能力 skip、接受未本地验证——改动收敛为：`smoke-platform.mjs` 加能力检测 + `dialog-smoke.mjs` 拆平台 closeNativeDialog，约 150-200 行，零新增依赖，Rust 零改动，Windows 现有行为不变。）
