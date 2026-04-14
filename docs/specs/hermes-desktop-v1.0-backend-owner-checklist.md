# Hermes Desktop v1.0 Backend Owner Checklist

Date: 2026-04-13

Status: Active

Owner: Backend / Architecture

## Goal

把 Hermes Desktop 的后端从“设计稿”推进到“可以和前端联调的 sidecar 骨架”。

## Phase B0: Sidecar foundation

- [x] 新建 `hermes_server` 包
- [x] 新建 `create_app()` sidecar 工厂
- [x] 新建 `hermes-desktop-sidecar` 入口
- [x] 把 sidecar 挂在现有 FastAPI Web app 之上

## Phase B1: Desktop bootstrap

- [x] `GET /desktop/bootstrap`
- [x] `POST /desktop/onboarding/complete`
- [x] 桌面 onboarding 状态本地持久化

## Phase B2: Session extensions

- [x] `POST /api/sessions`
- [x] `PATCH /api/sessions/{session_id}`
- [x] 桌面 session metadata 持久化（cwd）
- [ ] 将现有 `GET /api/sessions` 完整对齐到桌面前端 DTO

## Phase B3: FastAPI runs

- [x] `POST /v1/runs`
- [x] `GET /v1/runs/{run_id}`
- [x] `GET /v1/runs/{run_id}/events`
- [x] `POST /v1/runs/{run_id}/cancel`
- [x] `POST /v1/runs/{run_id}/approval`
- [x] `POST /v1/runs/{run_id}/clarify`
- [x] `run.started`
- [x] `message.delta`
- [x] `reasoning.available`
- [x] `tool.started`
- [x] `tool.completed`
- [x] `approval.required`
- [x] `approval.resolved`
- [x] `clarify.required`
- [x] `clarify.resolved`
- [x] `run.completed`
- [x] `run.failed`
- [x] `run.cancelled`

## Phase B4: Tooling and runtime alignment

- [x] 新增 `hermes-desktop` toolset
- [ ] sidecar 鉴权从“本地开放”升级到真正 token enforcement
- [ ] Browser runtime readiness 改成真实探测
- [ ] workspace-scoped approval 从占位映射升级到真实实现

## Phase B5: Hardening

- [ ] focused tests for `/desktop/bootstrap`
- [ ] focused tests for `/v1/runs`
- [ ] session list/detail 响应补齐 camelCase compatibility
- [ ] sidecar startup/shutdown lifecycle tests

## Current implementation notes

- 第一版 sidecar 直接复用现有 `hermes_cli.web_server.app`
- `/v1/runs` 已经完成 FastAPI 化，不再依赖 aiohttp adapter
- 审批与澄清已具备真实阻塞/恢复闭环
- 当前并发 run 数量故意保守，先限制为 1，避免 `terminal_tool` 全局 approval callback 带来竞态
