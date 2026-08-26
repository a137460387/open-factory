# RELEASING.md — 发版工作流

> 基于 v4.75.0 实际执行轨迹固化（2026-08-26）。下次发版直接读取执行，无需重复判断惯例偏差。
> 历史先例：v4.74.1（patch，标题纯版本号）、v4.75.0（minor，标题带主题后缀）。

## 前置条件

- main 干净，工作区无未提交改动（CRLF/LF 幻影修改用 `git restore <file>` 清理，diff 为空即噪音）
- 核实目标版本号 tag 与 GitHub Release 均不存在（`git tag -l "vX.Y*"` + `gh release list`）
- 核实三处版本号当前值完全一致：
  - `package.json`（根）version 字段
  - `apps/desktop/src-tauri/Cargo.toml` version 字段
  - `apps/desktop/src-tauri/tauri.conf.json` version 字段
- 若三处版本号文件路径已变更（仓库目录结构调整），先更新本文档中记录的路径，再继续执行

## 版本号决策

- **patch**（vX.Y.Z+1）：仅含 bugfix / 安全修复 / 测试——无面向用户新功能
- **minor**（vX.Y+1.0）：含面向用户新功能（feat 类型 PR）
- **major**（vX+1.0.0，含破坏性变更）：本文档未覆盖，遇到需人工判断，不套用 patch/minor 默认流程
- 决策依据：`git log <last-tag>..main --oneline` 的 PR 类型分布

## 执行步骤

1. 建分支 `release/vX.Y.Z`（沿用 v4.74.x / v4.75.0 命名惯例）
2. 三处版本号同步 bump（路径见前置条件；注意 PowerShell 5.1 的 `Set-Content -Encoding utf8` 不写 BOM 已验证安全，但更推荐精确文本替换后核对 `git diff` 仅 3 行）
3. 同步 Cargo.lock：在 `apps/desktop/src-tauri` 下执行 `cargo update -w --offline`
4. 起草发版说明（release notes）：
   - `git log <last-tag>..main --oneline` 获取全部提交
   - 按类型分组：Features / Bug Fixes / Refactor / Tests / Docs
   - 数字以 HANDOFF 实测值为准（覆盖率 / e2e 用例数 / 全量单测），不盲用估算
   - 保存为临时文件（`node_modules/.cache/` 或 `.release-notes-vX.Y.Z.md`，用后删除）
5. `CHANGELOG.md` 追加 `## [vX.Y.Z] - 日期` 段（在 `## [Unreleased]` 之后）
6. 提交（按文件名 add，不用 `git add -A`）：
   `chore(release): bump version to vX.Y.Z`
   （5 个文件：package.json / Cargo.toml / Cargo.lock / tauri.conf.json / CHANGELOG.md）
7. 推送 + `gh pr create --base main --body-file <中文 PR body>`
8. 等 CI 全绿（changes / frontend / rust / e2e 四 job）——发版 PR 的合并标准与日常功能 PR 相同：rust 必过 + frontend 仅豁免已知 fast-uri 审计问题 + e2e 仅豁免已知 20 分钟超时，不额外放宽也不额外收紧
9. `mergeStateStatus` 非 CLEAN 则 `gh pr update-branch` 后重等 CI
10. merge（按惯例补 `--subject`）：
    ```
    gh pr merge <PR> --merge --delete-branch \
      --subject "release: vX.Y.Z <中文标题>"
    ```
11. `git checkout main && git pull --ff-only`
12. 打 **lightweight tag 在 bump 提交上**（非 merge commit）：
    ```
    git tag vX.Y.Z <bump-commit-hash>
    git push origin vX.Y.Z
    ```
    （显式推送，**勿用 --follow-tags**——会静默漏掉 lightweight tag）
13. 等 release.yml 触发（tag push 自动触发 tauri-action 三平台构建，约 17-25 分钟）
14. `gh release edit` 校正标题与 notes：
    ```
    gh release edit vX.Y.Z \
      --title "vX.Y.Z <主题后缀>" \
      --notes-file <发版说明临时文件>
    ```
15. 验证：`gh release view vX.Y.Z`（标题 / notes / 资产清单）

## 既有惯例（必须遵循，避免偏差判断）

- **tag 类型**：lightweight（`git cat-file -t` = commit），非 annotated
- **tag 位置**：打在 bump 提交上（非 merge commit），依据 v4.74.1 / v4.74.0 先例
- **Release 创建**：tag push 触发 release.yml 自动建（默认标题 "open-factory vX.Y.Z"），事后 `gh release edit` 校正——**勿手动 `gh release create`**（会与 workflow 自动建重复）
- **Release 标题惯例**：版本号+主题后缀（如 v4.74.0「时间线专业操作」、v4.75.0「智能粗剪」），或纯版本号（如 v4.74.1）
- **merge 信息**：`release: vX.Y.Z <中文标题>`（`--subject` 参数）
- **bump 提交信息**：`chore(release): bump version to vX.Y.Z`
- **Cargo.lock**：必须用 `cargo update -w --offline` 同步（遵守 cargo 一律 --offline 纪律）
- **CHANGELOG 格式**：`## [vX.Y.Z] - 日期` + `### Added/Fixed/Changed` 段（Keep a Changelog 风格，中文条目）
- **PR body 含中文时用 `--body-file`**（命令行内联转义不可靠，HANDOFF 5.4 纪律）

## 数字口径纪律

- 发版说明中的覆盖率 / e2e 用例数 / 全量单测数以 **HANDOFF 实测值**为准
- 不盲用估算或报告口径（教训参考 #172 异常记录：任务描述给累计行数 +3939，实测 `git diff` 仅 +2335——采用实测并双口径注明）
- 如数字与 HANDOFF 不一致，以 `git diff` / CI 实测为准并双口径注明

## 异常处理

- 工作区幻影修改（CRLF/LF 噪音）：`git restore` 清理后继续（diff 为空即噪音）
- tag / Release 已存在：停止报告
- 三处版本号不一致：停止报告
- CI flaky：只记录不修
- release.yml 三平台构建失败：核实 log 重跑，不手动补建 Release（手动 create 会与 workflow 产物重复）

## 验证清单

- [ ] 三处版本号一致（路径若有变更已同步更新本文档）
- [ ] Cargo.lock 已同步
- [ ] CHANGELOG 段已追加
- [ ] PR CI 四 job 全绿 + e2e 零回归
- [ ] tag lightweight 打在 bump 提交上
- [ ] release.yml 三平台构建成功
- [ ] Release 标题已校正（版本号+主题后缀）
- [ ] Release notes 已替换（非默认 "See the assets below"）
- [ ] Release 资产完整（三平台 6 文件：x64-setup.exe / x64_zh-CN.msi / universal.dmg / universal.app.tar.gz / amd64.AppImage / amd64.deb）
