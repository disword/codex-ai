# 项目分析记录

## Topic

分析 `codex-ai` 项目的当前架构、边界、健康度与下一步演进方向。

## Current Understanding

这是一个基于 `Tauri 2 + React 19 + SQLite` 的本地桌面协作工具，目标是管理项目、任务、AI 员工以及 Codex CLI 会话。当前整体形态已经不是原型脚手架，而是一个具备明确领域边界的桌面端模块化单体雏形。

前端负责页面与本地状态缓存，Rust/Tauri 侧负责写路径、运行时校验、数据库迁移以及 Codex 子进程生命周期管理。读路径仍保留在前端，通过 `@tauri-apps/plugin-sql` 直接查询 SQLite。

## Key Findings

> **Finding**: 项目主架构是“前端读库 + Rust 写库 + Rust 托管运行时”的混合式模块化单体。
> - **Confidence**: High — **Why**: `README.md`、`src/lib/database.ts`、`src/lib/backend.ts`、`src-tauri/src/lib.rs` 与 `src-tauri/src/app.rs` 的职责划分一致。
> - **Hypothesis Impact**: Confirms hypothesis "项目已开始从 demo 向产品化骨架演进"
> - **Scope**: 前端数据流、后端服务层、运行时集成

> **Finding**: 写路径已经较好收口，但读路径仍然把 SQL 语义泄漏到 store 和组件层。
> - **Confidence**: High — **Why**: `src/stores/projectStore.ts`、`src/stores/taskStore.ts`、`src/stores/employeeStore.ts`、`src/stores/dashboardStore.ts` 都直接调用 `select(...)`。
> - **Hypothesis Impact**: Modifies hypothesis "业务边界已经完全稳定"
> - **Scope**: 可维护性、后续重构成本、查询一致性

> **Finding**: Codex 运行时是当前项目最有特色、也最成熟的一块能力。
> - **Confidence**: High — **Why**: `src-tauri/src/codex/process.rs` 包含工作目录校验、会话落库、事件日志、CLI session 绑定与 start/stop/restart 生命周期管理。
> - **Hypothesis Impact**: Confirms hypothesis "产品差异化核心在运行时集成"
> - **Scope**: 桌面端产品定位、稳定性、后续运维能力

> **Finding**: 数据模型经过一轮治理，但仍保留历史兼容痕迹。
> - **Confidence**: High — **Why**: `src-tauri/src/db/migrations.rs` 中先创建 `project_employees`，后又在迁移 16 中回填到 `employees.project_id` 并清空关联表。
> - **Hypothesis Impact**: Confirms hypothesis "模型正在收敛但尚未彻底清理"
> - **Scope**: 迁移复杂度、查询来源一致性、技术债管理

> **Finding**: 当前构建可通过，但工程环境和交付层还不够稳。
> - **Confidence**: High — **Why**: `npm run build` 成功，但提示 Node.js 18.17.1 低于 Vite 要求的 20.19+；前端 bundle 主包约 584 kB；Rust 单测通过但覆盖面集中在基础函数。
> - **Hypothesis Impact**: Modifies hypothesis "项目已具备稳定交付基线"
> - **Scope**: 本地开发体验、打包、长期演进安全网

## Decision Log

> **Decision**: 本轮分析按“架构 + 数据流 + 运行时 + 健康度”四个维度展开。
> - **Context**: 用户只给出“分析项目”，范围较宽，但项目体量适合先做结构化扫描。
> - **Options considered**: 仅做目录介绍；只做代码 review；直接跑 UI 手测。
> - **Chosen**: 架构与健康度并行分析 — **Reason**: 既能回答“项目是什么”，也能回答“现在处于什么状态”。
> - **Rejected**: 只做目录介绍 | 信息密度不足；只做 review | 会过度聚焦缺陷而忽略产品结构。
> - **Impact**: 输出更适合后续接重构、补测试或继续做 roadmap。

## Evidence

- 架构说明：`README.md`
- 前端直连查询：`src/lib/database.ts` 与各 `src/stores/*.ts`
- 写路径与命令注册：`src/lib/backend.ts`、`src-tauri/src/lib.rs`、`src-tauri/src/app.rs`
- Codex 运行时：`src-tauri/src/codex/process.rs`
- 迁移与数据模型：`src-tauri/src/db/migrations.rs`、`src-tauri/src/db/models.rs`
- 验证结果：
  - `npm run build` 成功，但有 Node 版本告警与 chunk 体积告警
  - `cargo test --manifest-path src-tauri/Cargo.toml` 通过，12 个测试全部成功

## Recommendations

1. 继续坚持模块化单体，不要过早拆服务。
2. 收敛读路径，把高频查询逐步从前端 SQL 迁到 Tauri command / service 层。
3. 把 Codex 运行时抽成更清晰的 `runtime/session` 边界，作为产品核心能力继续加固。
4. 明确工程基线：升级 Node 到 Vite 要求版本，控制前端首包体积。
5. 增加前端自动化测试或至少补 store/service 层测试，避免后续重构缺少保护。

## Suggested Next Steps

- 如果目标是“继续开发功能”，优先做运行时与任务流整合。
- 如果目标是“准备长期演进”，优先做读写边界治理和测试基线。
- 如果目标是“先修明显问题”，先解决 Node 版本基线与 bundle 体积预警。
