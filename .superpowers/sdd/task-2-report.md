# Task 2 报告：节点图引擎补全

## 完成状态

**全部完成** -- 6 种节点类型的执行逻辑已成功添加并通过测试。

## 修改的文件

### `packages/editor-core/src/color-grading/node-graph-engine.ts`

1. **扩展 UniformValue 类型**：新增 `UniformValue` 联合类型，支持 `number | number[] | Float32Array | 结构化 uniform 描述符`。更新了 `NodeExecutionResult` 和 `GraphExecutionResult` 接口中的 `uniforms` 类型。

2. **导入 sampleCurve**：从 `./color-curves` 导入 `sampleCurve` 函数，用于曲线节点 LUT 生成。

3. **新增 6 个节点类型处理**（在 `executeNode()` switch 中）：
   - `curves` -- 调用 `sampleCurve` 为 R/G/B/Master 四通道各生成 256 个采样点，返回 `Float32Array(1024)` 作为 sampler2D uniform
   - `lut-apply` -- 返回 `sampler3D` uniform 引用（含 lutId）和 intensity 标量 uniform
   - `tracking-mask` -- 返回 feather、expand、invert 三个标量 uniform
   - `output` / `color-space` / `mixer-node` -- 辅助节点，返回空 uniforms 和空 fragmentSnippets

4. **新增 3 个私有执行方法**：
   - `executeCurves(node)` -- 曲线 LUT 生成
   - `executeLUTApply(node)` -- LUT 应用
   - `executeTrackingMask(node)` -- 跟踪遮罩

### `packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts`

新增 8 个测试用例：
- `executes curves node with default identity LUT` -- 验证默认曲线生成恒等 LUT（首尾值正确、Float32Array 长度为 1024）
- `executes curves node with custom curve points` -- 验证自定义红通道曲线中点提升
- `executes lut-apply node` -- 验证 sampler3D uniform 和 intensity uniform
- `executes tracking-mask node` -- 验证 feather/expand/invert uniform 值
- `handles output node as no-op` -- 验证输出节点返回空结果
- `handles color-space node as no-op` -- 验证色彩空间节点返回空结果
- `handles mixer-node as no-op` -- 验证混合节点返回空结果
- `executes full pipeline with all node types` -- 端到端测试全部节点类型串联执行

## 测试结果

```
Test Files  7 passed (7)
Tests      119 passed (119)
Duration   989ms
```

全部 7 个 color-grading 测试文件、119 个测试用例通过，无回归。

## 提交信息

```
feat(color-grading): 实现 curves、lut-apply、tracking-mask 及辅助节点执行器
```

## 备注

- `UniformValue` 类型扩展是向后兼容的，现有 primary-wheel/primary-slider/hsl-qualifier/window-mask 节点的 `number | number[]` uniform 值仍满足新类型约束。
- 曲线 LUT 使用 Catmull-Rom 样条插值（来自 `sampleCurve`），与 color-curves 模块保持一致。
