# KI-001 修复方案：纯文档 PR 无法触发 required rust check

> 状态：**已在真实 CI 环境端到端验证通过**（2026-08-15，fake-base 方法）
> 关联：docs/audit/known-issues.md（KI-001）
> 说明：本方案已通过 PR #144（merge commit `7e7d3824`，2026-08-15）应用到 main 的 ci.yml

---

## 一、根因回顾

`.github/workflows/ci.yml` 的 `on.pull_request` 使用了 **workflow 级** `paths-ignore`：

    on:
      pull_request:
        paths-ignore:
          - "**.md"
          - "docs/**"
          - "LICENSE"
          - ".gitignore"

纯文档 PR（只改 `.md` / `docs/**`）命中规则后整个 workflow 被跳过，所有 job 根本不创建；
而 `main` 分支保护要求 "rust" 为 required check，被跳过的 workflow 永不产生该 check 结果，
PR 永久卡 pending，`--admin` 也绕不过去。

---

## 二、正向代码路径清单（21 项）

以下 `code` 过滤器用于 `dorny/paths-filter@v3`，**正向列出仓库中实际存在的代码路径**。
命中任一 → `code=true`；否则 → `code=false`。

```yaml
code:
  - 'apps/**'
  - 'packages/**'
  - 'examples/**'
  - 'scripts/**'
  - 'tools/**'
  - 'docker/**'
  - 'ltx-video-service/**'
  - '.github/**'
  - '.superpowers/**'
  - 'package.json'
  - 'bun.lock'
  - 'tsconfig.json'
  - 'vitest.config.ts'
  - 'eslint.config.mjs'
  - 'knip.json'
  - 'budget.json'
  - 'typedoc.json'
  - '.dependency-cruiser.cjs'
  - '.prettierrc.json'
  - '.prettierignore'
  - '.gitignore'
```

### 这 21 项如何得出

用 `git ls-tree main --name-only`（**顶层列表，非 `-r` 递归**）逐一核对了 main 的顶层目录/文件：

    .dependency-cruiser.cjs   .github         .gitignore       .prettierignore
    .prettierrc.json          .superpowers    AGENTS.md        CHANGELOG.md
    CLAUDE.md                 CODE_OF_CONDUCT.md  CONTRIBUTING.md  DEVELOPMENT.md
    LICENSE                   README.md       SECURITY.md      apps
    budget.json               bun.lock        docker           docs
    eslint.config.mjs         examples        knip.json        ltx-video-service
    package.json              packages        scripts          tools
    tsconfig.json             typedoc.json    vitest.config.ts

其中 **目录类**（apps/packages/examples/scripts/tools/docker/ltx-video-service/.github/.superpowers）
各对应一个 `xxx/**` 项；**根目录文件类**（package.json、bun.lock、tsconfig.json 等 12 个）逐项列出。
被排除的是纯文档：`AGENTS.md`、`CHANGELOG.md`、`CLAUDE.md`、`CODE_OF_CONDUCT.md`、
`CONTRIBUTING.md`、`DEVELOPMENT.md`、`LICENSE`、`README.md`、`SECURITY.md`、`docs/`。

### 维护方式与遗漏风险

**有遗漏风险**：未来新增的顶层目录或根目录代码文件若不在这 21 项里，会被误判为"非代码"
（`code=false`），从而**跳过 CI 漏检**。因此：
- 新增顶层目录（如新起一个 `services/` 或 `web/`）时，**必须手动向 `code` 清单追加对应 `xxx/**` 项**；
- 新增根目录代码/配置文件（如 `vite.config.ts`、`jest.config.js`）时，**必须手动追加对应项**。
- 这是正向白名单的固有代价；如需彻底免维护，可改用 negate 写法，但那已被证明不可靠。

---

## 三、最终完整 workflow YAML（可直接使用）

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
  schedule:
    - cron: "0 0 * * 1"

permissions:
  contents: read

jobs:
  changes:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    outputs:
      code: ${{ steps.filter.outputs.code }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Detect code vs docs-only changes
        id: filter
        uses: dorny/paths-filter@v3
        with:
          filters: |
            code:
              - 'apps/**'
              - 'packages/**'
              - 'examples/**'
              - 'scripts/**'
              - 'tools/**'
              - 'docker/**'
              - 'ltx-video-service/**'
              - '.github/**'
              - '.superpowers/**'
              - 'package.json'
              - 'bun.lock'
              - 'tsconfig.json'
              - 'vitest.config.ts'
              - 'eslint.config.mjs'
              - 'knip.json'
              - 'budget.json'
              - 'typedoc.json'
              - '.dependency-cruiser.cjs'
              - '.prettierrc.json'
              - '.prettierignore'
              - '.gitignore'

  frontend:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    needs: changes
    steps:
      - name: Skip for docs-only changes
        if: needs.changes.outputs.code != 'true'
        run: echo "Docs-only change - skipping frontend checks"

      - name: Checkout repository
        if: needs.changes.outputs.code == 'true'
        uses: actions/checkout@v4

      - name: Setup Bun >= 1.3
        if: needs.changes.outputs.code == 'true'
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Cache bun dependencies
        if: needs.changes.outputs.code == 'true'
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: bun-${{ runner.os }}-

      - name: Install dependencies
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: bun install --frozen-lockfile

      - name: Audit npm dependencies
        if: needs.changes.outputs.code == 'true'
        run: bun audit --audit-level=high

      - name: Typecheck
        if: needs.changes.outputs.code == 'true'
        run: bun run typecheck

      - name: Test with coverage
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: bun run test

      - name: Upload coverage report
        if: always() && needs.changes.outputs.code == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  rust:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    needs: changes
    defaults:
      run:
        working-directory: apps/desktop/src-tauri
    steps:
      - name: Skip for docs-only changes
        if: needs.changes.outputs.code != 'true'
        run: echo "Docs-only change - skipping rust checks"
        working-directory: .

      - name: Checkout repository
        if: needs.changes.outputs.code == 'true'
        uses: actions/checkout@v4

      - name: Setup Bun >= 1.3
        if: needs.changes.outputs.code == 'true'
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Cache bun dependencies
        if: needs.changes.outputs.code == 'true'
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: bun-${{ runner.os }}-

      - name: Install frontend dependencies
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: cd "$GITHUB_WORKSPACE" && bun install --frozen-lockfile

      - name: Build frontend
        if: needs.changes.outputs.code == 'true'
        run: bun run build
        working-directory: .

      - name: Check bundle size
        if: needs.changes.outputs.code == 'true'
        run: bun run check:bundle
        working-directory: .

      - name: Install Rust stable
        if: needs.changes.outputs.code == 'true'
        uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo registry and build
        if: needs.changes.outputs.code == 'true'
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            ~/.cargo/bin
            apps/desktop/src-tauri/target
          key: cargo-${{ runner.os }}-${{ hashFiles('apps/desktop/src-tauri/Cargo.lock') }}
          restore-keys: cargo-${{ runner.os }}-

      - name: Install system dependencies
        if: needs.changes.outputs.code == 'true'
        run: |
          sudo apt-get update
          sudo apt-get install -y libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev

      - name: Install cargo-audit
        if: needs.changes.outputs.code == 'true'
        run: command -v cargo-audit || cargo install cargo-audit --locked

      - name: Build
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: cd "$GITHUB_WORKSPACE/apps/desktop/src-tauri" && cargo build

      - name: Test
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: cd "$GITHUB_WORKSPACE/apps/desktop/src-tauri" && cargo test

      - name: Audit
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: cd "$GITHUB_WORKSPACE/apps/desktop/src-tauri" && cargo audit

      - name: Upload test results
        if: always() && needs.changes.outputs.code == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: rust-test-results
          path: apps/desktop/src-tauri/target/nextest/
          retention-days: 7

  e2e:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    needs: changes
    steps:
      - name: Skip for docs-only changes
        if: needs.changes.outputs.code != 'true'
        run: echo "Docs-only change - skipping e2e checks"

      - name: Checkout repository
        if: needs.changes.outputs.code == 'true'
        uses: actions/checkout@v4

      - name: Setup Bun >= 1.3
        if: needs.changes.outputs.code == 'true'
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Cache bun dependencies
        if: needs.changes.outputs.code == 'true'
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: bun-${{ runner.os }}-

      - name: Install dependencies
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 10
          command: bun install --frozen-lockfile

      - name: Cache Playwright browsers
        if: needs.changes.outputs.code == 'true'
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: playwright-${{ runner.os }}-

      - name: Install Playwright Chromium
        if: needs.changes.outputs.code == 'true'
        run: bunx playwright install --with-deps chromium

      - name: Install ffmpeg
        if: needs.changes.outputs.code == 'true'
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Build workspace packages
        if: needs.changes.outputs.code == 'true'
        run: bun run --filter @open-factory/editor-core --filter @open-factory/plugin-sdk build

      - name: Run E2E tests
        if: needs.changes.outputs.code == 'true'
        uses: nick-fields/retry@v3
        with:
          max_attempts: 2
          timeout_minutes: 20
          command: cd "$GITHUB_WORKSPACE/apps/desktop" && bunx playwright test --workers=2 --reporter=list,html

      - name: Upload test report
        if: always() && needs.changes.outputs.code == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/desktop/playwright-report/
          retention-days: 7

  security-scan:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun >= 1.3
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Cache bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
          restore-keys: bun-${{ runner.os }}-

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install cargo-audit
        run: cargo install cargo-audit

      - name: Audit npm dependencies (high level)
        run: bun audit --audit-level=high

      - name: Audit npm dependencies (moderate level)
        run: bun audit --audit-level=moderate || true

      - name: Audit Rust dependencies (stale check)
        run: cargo audit --stale
        working-directory: apps/desktop/src-tauri

      - name: Audit Rust dependencies (full)
        run: cargo audit
        working-directory: apps/desktop/src-tauri

      - name: Check for known advisories
        run: |
          echo "## Security Scan Report" >> $GITHUB_STEP_SUMMARY
          echo "Date: $(date -u +%Y-%m-%d)" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### npm audit" >> $GITHUB_STEP_SUMMARY
          bun audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities | "| Level | Count |\n|-------|-------|\n| critical | .critical |\n| high | .high |\n| moderate | .moderate |\n| low | .low |"' >> $GITHUB_STEP_SUMMARY || true
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### cargo audit" >> $GITHUB_STEP_SUMMARY
          echo "See job logs for details" >> $GITHUB_STEP_SUMMARY
```

---

## 四、端到端验证结果（真实 CI，fake-base 方法）

### 验证方法

workflow 改动无法在不碰 main 的前提下自测（PR 用 base 分支的 workflow，且 ci.yml 改动本身污染 diff）。
故采用"假 base 分支"：从 main 建 `test/ki001-fake-base` 并完整应用本方案，
再从它拉出两条子分支（docs-only / code-change），PR 目标指向 fake-base，
使 diff 只含子分支自己的改动。

### 证据：docs-only PR（纯文档，#142）

changes job 日志原文：

    Fetching list of changed files for PR#142 from Github API
    [added] docs/audit/ki001-docs-only-note.md
    Detected 1 changed files
    Filter code = false
    Matching files: none

rust job 步骤状态（gh api）：

    Skip for docs-only changes: completed success   ← Skip 步骤执行成功
    Checkout repository:       completed skipped    ← 重型步骤全部跳过
    Build/Test/Audit 等其余步骤: completed skipped
    Complete job:              completed success

三 job 最终：frontend=success、rust=success、e2e=success。
`code=false` → 三 job 跳过重型步骤并报 success → "rust" required check 正常上报 success，不再卡 pending。

### 证据：code-change PR（代码改动，#143）

changes job 日志原文：

    Fetching list of changed files for PR#143 from Github API
    [modified] apps/desktop/src/lib/content-analysis-helpers.ts
    Detected 1 changed files
    Filter code = true
    Matching files:
    apps/desktop/src/lib/content-analysis-helpers.ts [modified]

rust job 步骤状态：

    Skip for docs-only changes: completed skipped    ← Skip 步骤被跳过
    Checkout repository:       completed success     ← 重型步骤完整执行

`code=true` → 三 job 完整跑（rust 全过；frontend 命中已知 fast-uri；e2e 命中已知 flaky），与 main 当前一致。

### 验证结论

| 路径 | code | Skip 步骤 | 重型步骤 | 结果 |
|------|------|----------|---------|------|
| 纯文档 PR | false | 执行（success） | 全部跳过 | 三 job success，rust check 正常上报 |
| 代码改动 PR | true | 跳过 | 完整执行 | 与 main 当前行为一致 |

---

## 五、影响评估

- 纯文档 PR：不再卡 pending，秒级通过。
- 代码 PR：与当前完全一致。
- 新增依赖 `dorny/paths-filter@v3`（社区维护，仅 CI 环境运行）。
- 白名单维护：新增顶层目录/根目录代码文件时需手动追加（见"维护方式与遗漏风险"）。

---

> 本方案已通过真实 CI 端到端验证，并已通过 PR #144（merge commit `7e7d3824`）应用到 main。
