# Open Factory 官方示例插件

本目录包含 Open Factory 官方提供的示例插件，展示四种插件类型的开发方式。

## 插件列表

### 🎨 高级色彩校正器（效果插件）

- **ID**: `open-factory.example.color-corrector`
- **类型**: 效果插件 (Effect Plugin)
- **功能**: 亮度、对比度、饱和度、色温调节
- **权限**: `read-project`
- **学习要点**: 如何构建 FFmpeg 滤镜字符串，如何处理像素数据

### ⚙️ 批量字幕翻译（工作流插件）

- **ID**: `open-factory.example.subtitle-translator`
- **类型**: 工作流插件 (Workflow Plugin)
- **功能**: 批量翻译字幕、术语表管理、分批处理
- **权限**: `read-project`, `write-project`
- **学习要点**: 如何注册菜单项、如何修改项目数据

### 📤 社交媒体导出（导出插件）

- **ID**: `open-factory.example.social-export`
- **类型**: 导出插件 (Export Plugin)
- **功能**: 抖音、B站、YouTube等平台导出预设
- **权限**: `export-hook`, `read-project`
- **学习要点**: 如何定义导出预设、如何生成 FFmpeg 参数

## 安装方式

### 方式一：通过插件市场安装

1. 打开 Open Factory 设置 → 插件市场
2. 搜索插件名称
3. 点击"安装"按钮

### 方式二：手动安装

将插件目录复制到应用数据目录的 `plugins/` 文件夹下：

- **Windows**: `%APPDATA%/open-factory/plugins/`
- **macOS**: `~/Library/Application Support/open-factory/plugins/`
- **Linux**: `~/.local/share/open-factory/plugins/`

## 开发指南

每个插件包含：

- `plugin.json` - 插件清单文件（元数据）
- `index.js` - 插件入口文件（逻辑实现）
- `index.test.js` - 单元测试

### 插件清单格式

```json
{
  "id": "com.example.my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "插件描述",
  "category": "effect | export | workflow | ai-model",
  "author": "作者名",
  "permissions": ["read-project"],
  "main": "index.js"
}
```

### 插件入口格式

```javascript
module.exports = {
  manifest: { /* 同 plugin.json */ },
  hooks: {
    onClipSelected(payload) { /* 片段选中时 */ },
    onExportBefore(payload) { /* 导出前 */ },
    onMenuRegister(payload) { /* 注册菜单 */ },
  },
};
```

## 测试

```bash
# 运行单个插件测试
vitest run examples/plugins/color-corrector/index.test.js

# 运行所有示例插件测试
vitest run examples/plugins/
```

## 许可证

示例插件代码遵循 MIT 许可证，可自由修改和分发。
