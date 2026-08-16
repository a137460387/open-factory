# Known Issues

## MediaBin 虚拟化：键盘导航边界场景待手动验证

**状态**: 已合并 main，待真实设备手动测试
**合并时间**: 2026-07-04
**相关分支**: mediabin-virtualization-wip（9 commits）

MediaBin Grid 视图已引入 @tanstack/react-virtual 虚拟化。键盘导航（方向键移动焦点）改为数据索引驱动 + requestAnimationFrame 延迟聚焦。极端滚动边界场景下的行为尚未经过真实设备手动测试，如遇到方向键无响应等问题，参考 `docs/audit/mediabin-virtualization-manual-test-checklist.md` 排查。

---

# Known Issues — v4.12.0

## quick-xml 0.39.4 DoS（RUSTSEC-2026-0194/0195）

**状态**: 待上游修复，v4.12.1 跟进
**发现时间**: v4.12.0 发布前安全审计
**CVE**: [RUSTSEC-2026-0194](https://rustsec.org/advisories/RUSTSEC-2026-0194)、[RUSTSEC-2026-0195](https://rustsec.org/advisories/RUSTSEC-2026-0195)
**严重性**: HIGH（CVSS 7.5），纯 DoS，无代码执行/信息泄露

### 依赖链

```
tauri 2.11.2 → tauri-utils 2.9.2 → plist 1.9.0 → quick-xml 0.39.4
```

### 无法当前修复的原因

- plist 1.9.0 是最新版本，声明 `quick-xml ^0.39.2`（semver 上限 <0.40.0）
- quick-xml 安全版本 ≥0.41.0，不满足 semver 约束
- `[patch.crates-io]` 强制替换会因 breaking change 导致编译失败

### 风险评估

实际触发需要解析恶意构造的 XML。本项目中 quick-xml（通过 plist）仅解析 macOS property list 文件，来源为本地系统文件和 Tauri 打包资源，**非网络/不可信输入**，实际不可利用。

### v4.12.1 跟进计划

- 检查 [plist crate](https://crates.io/crates/plist) 是否发布支持 quick-xml ≥0.41.0 的新版本
- 若上游已修复：直接 `cargo update -p plist` 即可
---

# Known Issues — 2026-08-15 更新

## KI-001：纯文档 PR 无法触发 required rust check（已修复）

- **发现日期**: 2026-08-13
- **影响**: 所有仅改动 `.md` 文件或仅改动 `docs/**` 目录的 PR
- **受影响的 PR**: [#140](https://github.com/a137460387/open-factory/pull/140)
- **状态**: ✅ 已修复
- **修复 commit**: 7e7d3824（Merge PR #144）
- **修复方案**: docs/audit/KI-001-fix-proposal.md（正向代码路径 filter + dorny/paths-filter 探测 + 三 job step 级门控）
- **修复时间**: 2026-08-15

### 问题描述

`.github/workflows/ci.yml` 在 workflow 级别配置了 `paths-ignore`：

```yaml
on:
  pull_request:
    paths-ignore:
      - "**.md"
      - "docs/**"
```

当 PR 仅包含 `docs/**` 下的 `.md` 文件时，整个 CI workflow 被跳过，
所有 job（rust、frontend、e2e、security-scan）均不会被创建。

与此同时，`main` 分支保护规则将 "rust" 设为 required status check。
被跳过的 workflow 不会产生任何 check 结果，GitHub 分支保护永远等不到
"rust" 的状态上报，PR 会永久卡在 "Expected — Waiting for status to be reported" 状态。

`gh pr merge --admin` 也无法绕过——它要求 required check 必须存在并成功，
而不是允许跳过。

### 建议修复方向（发现时记录）

将 `paths-ignore` 从 workflow 级别移到 job 级别，改用各 job 内的 `if` 条件
判断是否需要运行。这样：

- 所有 job 始终创建，分支保护规则能收到 check 结果
- 对纯文档 PR，rust/frontend/e2e job 可以直接返回 skip/success（无代码改动无意义运行）
- 具体实现方案（如是否使用 `dorny/paths-filter` action 或 GitHub 原生 `paths` 条件）
  待后续单独调研，不在本次设计

（后续实际修复采用了 dorny/paths-filter，见下方修复结果。）

### 修复结果

原问题：ci.yml 的 workflow 级 paths-ignore 导致纯文档 PR 跳过全部 job，
required "rust" check 永不产生，PR 永久卡 pending。
现已移除 paths-ignore，改为 changes job 探测改动类型，纯文档改动时三 job 快速通过。

### 修复前的临时处置（历史记录）

曾暂不修复 CI 配置。PR #140 保持 open 状态搁置，不合并。
当时如需合并纯文档 PR，可临时在 PR 中混入一个不影响代码的空 commit
（如修改 `.gitignore` 加一行空行）触发 CI，或修复 CI 配置后再合并。

---

## 已知 flaky：advanced-text.spec.ts:4:1

**测试**: e2e/advanced-text.spec.ts:4:1（bolds part of a rich text clip and exports multiple drawtext filters）
**首次记录**: 2026-08-15（PR #144 CI 观察）
**证据强度**: **低**

证据来源（弱）：
- 仅在 PR #144 的 attempt 1 失败一次，同次 run 的 retry 通过（未做两次独立 run 验证）；
- 一次更早的 main 基线 run（31758987639）中也曾 ✘✘ 失败，作为间接佐证；
- 未做像 ai-loudness-suggestion 那样的两次独立 run 验证。

**后续处理建议**: 若该测试再次失败，按 ai-loudness-suggestion 的方式做两次独立 run 验证，
不要因"已记录在案"就直接跳过不查。
