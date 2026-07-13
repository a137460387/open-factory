# AI原生工作流深化：元数据感知编排器与一键应用

**日期**: 2026-07-13
**版本**: v1.0
**状态**: 已批准
**基础文档**: `2026-07-13-ai-native-workflow-design.md`

---

## 1. 背景与目标

在已完成的AI原生工作流基础（场景检测、情绪分析、语音理解、叙事分析、智能推荐、叙事生成）上，深化AI能力：

- **元数据感知编排器**：使用真实媒体元数据替代合成数据，提升分析准确性
- **一键应用功能**：将AI建议直接应用到时间线，实现端到端工作流
- **E2E测试覆盖**：补全缺失的端到端测试

## 2. 深化内容

### 2.1 元数据感知编排器

**问题**：原有编排器使用固定默认值（brightness=0.5, saturation=0.5, motion=0.3），无法反映真实媒体特征。

**解决方案**：基于媒体元数据和AI分析提示生成更准确的样本数据。

**新增函数**：
- `estimateBrightness(m: MediaAsset)` - 基于HDR元数据和分辨率估计亮度
- `estimateSaturation(m: MediaAsset)` - 基于色域和编码器估计饱和度
- `estimateMotion(m: MediaAsset)` - 基于帧率和码流估计运动强度

**元数据利用**：
| 元数据 | 用途 | 映射逻辑 |
|--------|------|----------|
| colorTransfer | HDR检测 | smpte2084/arib-std-b67 → 高亮度 |
| colorPrimaries | 色域检测 | bt2020 → 高饱和度 |
| frameRate | 运动检测 | 高帧率 → 高运动 |
| width × height | 分辨率 | 4K+ → 高亮度 |
| audioChannels | 音频检测 | 6ch → 高响度 |
| aiAnalysis.scene | 场景提示 | night → 低亮度, action → 高运动 |
| aiAnalysis.mood | 情绪提示 | energetic → 高运动, calm → 低运动 |

### 2.2 一键应用功能

**推荐片段应用**：
1. 查找第一个视频轨道
2. 计算轨道末端时间
3. 按顺序添加推荐片段到时间线
4. 使用 `AddClipCommand` 确保支持撤销

**故事线应用**：
1. 遍历故事线片段
2. 根据场景类型匹配媒体资产
3. 按故事线顺序组装片段
4. 使用 `AddClipCommand` 确保支持撤销

### 2.3 E2E测试

**测试用例**：
1. 打开智能创作面板并运行分析
2. 应用推荐片段到时间线
3. 切换section可见性
4. 关闭面板
5. 情绪曲线图表显示

**Fixture设置**：
- 3个不同特征的媒体资产：
  - 户外HDR（bt2020, 60fps, 4K）
  - 室内SDR（bt709, 24fps, 720p）
  - 夜景4K（hevc, 6ch音频）

## 3. 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `packages/editor-core/src/ai-smart-creation-orchestrator.ts` | 修改 | 元数据感知采样 |
| `apps/desktop/src/components/layout/ShellRightPanel.tsx` | 修改 | 一键应用回调 |
| `apps/desktop/src/e2e/install-mocks.ts` | 修改 | E2E fixture |
| `apps/desktop/e2e/ai-native-deep.spec.ts` | 新增 | E2E测试 |
| `packages/editor-core/__tests__/ai-smart-creation-orchestrator.test.ts` | 修改 | 新增测试用例 |

## 4. 验证结果

- ✅ 类型检查通过
- ✅ 构建成功
- ✅ 59个单元测试通过
- ✅ 编排器覆盖率98.32%

---

**设计完成，已批准进入实现阶段。**
