## Task 2 完成报告

### 状态
DONE

### 提交记录
- `4391ac0c` feat: implement multicam core algorithms (getActiveAngleAtTime, switch point management)

### 测试结果

```
$ npx vitest run packages/editor-core/__tests__/multicam-clip.test.ts

 ✓ packages/editor-core/__tests__/multicam-clip.test.ts (34 tests) 9ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
   Duration  1.00s
```

Function coverage for `multicam.ts`: 100%

Typecheck: 通过 (`tsc --noEmit`)

### 自我发现的问题
- `addSwitchPoint` 的插入循环中比较运算符需使用 `>=` 而非 `>`，否则相同时间的替换逻辑无法命中。已修复。
- `createMulticamClip([] , 'audio', 0)` 在空 angles 时会抛出 `syncReferenceAngle out of range` 而非预期的 `MulticamClip has no angles`，因此空数组测试改为手动构造 MulticamClip 对象。

### 覆盖的接口
- `getActiveAngleAtTime(multicamClip: MulticamClip, time: number): MulticamClipAngle`
- `addSwitchPoint(switchPoints: SwitchPoint[], switchPoint: SwitchPoint): SwitchPoint[]`
- `deleteSwitchPoint(switchPoints: SwitchPoint[], index: number): SwitchPoint[]`
- `updateSwitchPoint(switchPoints: SwitchPoint[], index: number, updates: Partial<SwitchPoint>): SwitchPoint[]`

### 改动的文件
- `packages/editor-core/src/multicam.ts` -- 新增 4 个函数及类型导入
- `packages/editor-core/__tests__/multicam-clip.test.ts` -- 新增 27 个测试用例

---

## 修复报告

### 修复的问题
`getActiveAngleAtTime` 函数中 `activeAngle` 未做越界校验。当 `switchPoints` 为空时，直接返回 `angles[activeAngle]`，如果 `activeAngle` 为负数或 >= `angles.length`，将返回 `undefined` 而非抛错。

### 修复方案
在 `getActiveAngleAtTime` 函数入口处（`angles.length === 0` 校验之后、`switchPoints.length === 0` 判断之前）添加了 `activeAngle` 范围校验：

```typescript
if (activeAngle < 0 || activeAngle >= angles.length) {
  throw new Error('activeAngle out of range');
}
```

该校验确保在函数使用 `activeAngle` 之前（包括无 switch points 时直接返回 `angles[activeAngle]`、以及有 switch points 但 `targetAngle` 越界时回退到 `angles[activeAngle]`）其值始终合法。

### 测试结果

```
$ npx vitest run packages/editor-core/__tests__/multicam-clip.test.ts

 ✓ packages/editor-core/__tests__/multicam-clip.test.ts (38 tests) 9ms

 Test Files  1 passed (1)
      Tests  38 passed (38)
   Duration  1.05s
```

新增 4 个测试用例：
- `should throw when activeAngle is negative` -- 无 switch points，activeAngle = -1
- `should throw when activeAngle is >= angles.length` -- 无 switch points，activeAngle = 5
- `should throw when activeAngle is negative even with switch points` -- 有 switch points，activeAngle = -1
- `should throw when activeAngle equals angles.length` -- 无 switch points，activeAngle = 3（等于边界）

### 提交记录
`f06b3084` fix: validate activeAngle bounds in getActiveAngleAtTime
