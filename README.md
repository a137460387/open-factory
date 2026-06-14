# 开源工厂 (open-factory)

本地优先的桌面视频编辑器，基于 Tauri 2、Rust、React、TypeScript 构建。无登录、无遥测、无云端上传，所有媒体文件保留在本地。

![Open Factory](open-factory-screenshot.png)

## 功能特性

- 多轨时间线：视频、音频、图片、文字 clip，移动、裁剪、分割、删除
- 撤销/重做：所有编辑操作通过 command objects 实现
- WebGL 预览合成器（含 2D canvas 降级）+ Web Audio 混音
- FFmpeg 导出：MP4、GIF、WebP、APNG、PNG 序列、当前帧
- 关键帧动画：不透明度、音量、位置、缩放、变速曲线
- 色彩校正：亮度/对比度/饱和度/色相、RGB 曲线、三向色轮、LUT 支持
- 视频特效栈：模糊、锐化、暗角、胶片颗粒、色散、GLSL 自定义着色器
- 抠像（色度键/亮度键/差值遮罩）、形状遮罩、路径遮罩
- 音频混音器：EQ 均衡器、压缩器、声像、VU 电平表、音频闪避
- 嵌套序列、多机位剪辑、分屏布局、画中画
- GPU 硬件编码（NVENC/VideoToolbox）
- Whisper 本地字幕生成、SRT/ASS/VTT 导出
- 自动保存与崩溃恢复、项目归档、快照版本管理
- 场景检测、静音检测、节拍检测、智能粗剪面板
- 插件系统、宏录制与回放、批量自动化规则

## 环境要求

- Rust stable >= 1.77
- Bun >= 1.3
- FFmpeg（需在 PATH 中）
- Windows：WebView2 Runtime + Visual Studio C++ Build Tools

## 安装依赖

```bash
bun install
```

## 开发

```bash
bun run tauri:dev
```

## 测试

```bash
bun run typecheck
bun run test
bun run e2e
bun run check:release
```

## 构建

```bash
bun run tauri:build
```

## License

MIT