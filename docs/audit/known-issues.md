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
