# Hermes Desktop v1.0 API Contract

Date: 2026-04-13

Status: Draft

Owner: Backend / Architecture

Primary Consumer: Frontend (`antigravity`)

## 1. 文档目的

本文是 `Hermes Desktop v1.0` 的前后端接口契约文档。

目标：

1. 让前端可以独立开始 `Chat`、`Onboarding`、`Timeline`、`Approval`、`Clarify` 相关开发
2. 约束 backend sidecar 的接口、事件、错误格式与状态语义
3. 降低联调时因字段命名、事件顺序或状态定义不一致产生的返工

本文优先级高于临时口头约定；若实现与本文不一致，以本文为准并同步更新文档。

## 2. 契约原则

### 2.1 单 sidecar

桌面版前端只连接一个本地 sidecar：

- 协议：`HTTP + SSE`
- 地址：`http://127.0.0.1:<desktop_port>`

### 2.2 会话主键是 `session_id`

前端不负责在每次发消息时回传完整对话历史。  
前端只需要传：

- `session_id`
- 当前输入
- 可选的运行态覆盖项，如 `cwd` 或 `model`

### 2.3 流式协议以 `/v1/runs + SSE` 为中心

聊天主流程统一采用：

1. `POST /v1/runs`
2. `GET /v1/runs/{run_id}/events`

### 2.4 事件严格有序

同一个 `run_id` 下的所有事件必须带：

- `seq`
- `timestamp`

前端可依赖 `seq` 排序，不需要自己猜测顺序。

### 2.5 审批与澄清是正式事件，不是文本协议

前端不得通过 assistant 文本解析“是否需要审批/澄清”。  
必须只依赖：

- `approval.required`
- `approval.resolved`
- `clarify.required`
- `clarify.resolved`

## 3. 鉴权与请求头

### 3.1 鉴权模型

sidecar 在启动后生成一次性桌面会话 token。

前端获取方式：

- `GET /desktop/bootstrap`

后续请求要求：

```http
Authorization: Bearer <desktop_session_token>
```

### 3.2 请求头约定

推荐所有请求附带：

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <desktop_session_token>
X-Hermes-Client: hermes-desktop
X-Hermes-Client-Version: 1.0.0
```

SSE 请求同样需要 `Authorization`。

## 4. 顶层数据模型

## 4.1 BootstrapResponse

```ts
export interface BootstrapResponse {
  app: {
    name: string;
    version: string;
    platform: "darwin" | "win32";
    buildChannel: "stable" | "beta";
  };
  auth: {
    token: string;
  };
  sidecar: {
    healthy: boolean;
    port: number;
    profile: string;
  };
  onboarding: {
    completed: boolean;
    providerConfigured: boolean;
    defaultModel: string;
    workspace: string | null;
    approvalMode: ApprovalMode;
  };
  runtime: {
    pythonReady: boolean;
    nodeReady: boolean;
    browserRuntimeReady: boolean;
  };
}
```

## 4.2 SessionSummary

```ts
export interface SessionSummary {
  id: string;
  title: string | null;
  cwd: string | null;
  source: "desktop" | "cli" | "acp" | "gateway" | string | null;
  model: string | null;
  startedAt: number;
  lastActive: number;
  endedAt: number | null;
  isActive: boolean;
  messageCount: number;
  toolCallCount: number;
  preview: string | null;
}
```

## 4.3 SessionMessage

```ts
export interface SessionMessage {
  id?: number;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  timestamp?: number;
  toolName?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  reasoning?: string | null;
}
```

## 4.4 ApprovalMode

```ts
export type ApprovalMode =
  | "ask"
  | "auto_safe"
  | "deny_dangerous";
```

## 4.5 RunStatus

```ts
export type RunStatus =
  | "starting"
  | "streaming"
  | "waiting_for_approval"
  | "waiting_for_clarify"
  | "completed"
  | "failed"
  | "cancelled";
```

## 4.6 ApprovalDecision

```ts
export type ApprovalDecision =
  | "allow_once"
  | "allow_session"
  | "allow_workspace"
  | "deny";
```

## 5. HTTP 接口

## 5.1 Bootstrap / Onboarding

### `GET /desktop/bootstrap`

用途：

- 前端启动时获取：
  - token
  - onboarding 状态
  - runtime 状态
  - app 版本信息

响应：

```json
{
  "app": {
    "name": "Hermes Desktop",
    "version": "1.0.0",
    "platform": "darwin",
    "buildChannel": "stable"
  },
  "auth": {
    "token": "desktop_session_token"
  },
  "sidecar": {
    "healthy": true,
    "port": 51791,
    "profile": "desktop-default"
  },
  "onboarding": {
    "completed": false,
    "providerConfigured": false,
    "defaultModel": "",
    "workspace": null,
    "approvalMode": "ask"
  },
  "runtime": {
    "pythonReady": true,
    "nodeReady": true,
    "browserRuntimeReady": true
  }
}
```

### `POST /desktop/onboarding/complete`

用途：

- 保存首启结果
- 写入默认 provider / model / workspace / approval mode

请求：

```json
{
  "provider": "openrouter",
  "apiKeyRef": "keychain://desktop/openrouter/default",
  "baseUrl": "https://openrouter.ai/api/v1",
  "model": "anthropic/claude-sonnet-4.6",
  "workspace": "/Users/alice/projects",
  "approvalMode": "ask"
}
```

响应：

```json
{
  "ok": true,
  "onboardingCompleted": true
}
```

### `POST /desktop/onboarding/validate-provider`

用途：

- 在向导中校验 provider/base_url/api key 是否可用

请求：

```json
{
  "provider": "openrouter",
  "apiKey": "sk-or-...",
  "baseUrl": "https://openrouter.ai/api/v1"
}
```

响应：

```json
{
  "ok": true,
  "resolvedProvider": "openrouter",
  "models": [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-5.4"
  ]
}
```

失败响应：

```json
{
  "error": {
    "code": "provider_validation_failed",
    "message": "Invalid API key or provider endpoint."
  }
}
```

## 5.2 Sessions

### `GET /api/sessions`

用途：

- 返回最近会话列表

响应：

```json
[
  {
    "id": "desktop_3c69d2f1",
    "title": "Fix browser runtime packaging",
    "cwd": "/Users/alice/projects/hermes",
    "source": "desktop",
    "model": "anthropic/claude-sonnet-4.6",
    "startedAt": 1776048226.128,
    "lastActive": 1776048248.221,
    "endedAt": null,
    "isActive": true,
    "messageCount": 16,
    "toolCallCount": 5,
    "preview": "I found the current runtime lookup path..."
  }
]
```

### `GET /api/sessions/search?q=<term>&limit=<n>`

用途：

- 会话全文搜索

响应：

```json
{
  "results": [
    {
      "sessionId": "desktop_3c69d2f1",
      "title": "Fix browser runtime packaging",
      "snippet": "agent-browser CLI not found...",
      "role": "assistant",
      "source": "desktop",
      "model": "anthropic/claude-sonnet-4.6",
      "sessionStarted": 1776048226.128
    }
  ]
}
```

### `POST /api/sessions`

用途：

- 新建桌面聊天会话

请求：

```json
{
  "cwd": "/Users/alice/projects/hermes",
  "title": "New Chat",
  "source": "desktop"
}
```

响应：

```json
{
  "sessionId": "desktop_3c69d2f1",
  "created": true
}
```

### `GET /api/sessions/{session_id}`

响应：

```json
{
  "id": "desktop_3c69d2f1",
  "title": "Fix browser runtime packaging",
  "cwd": "/Users/alice/projects/hermes",
  "source": "desktop",
  "model": "anthropic/claude-sonnet-4.6",
  "startedAt": 1776048226.128,
  "lastActive": 1776048248.221,
  "endedAt": null,
  "isActive": true,
  "messageCount": 16,
  "toolCallCount": 5,
  "preview": "I found the current runtime lookup path..."
}
```

### `PATCH /api/sessions/{session_id}`

用途：

- 更新会话标题
- 更新工作区路径

请求：

```json
{
  "title": "Implement desktop build workflow",
  "cwd": "/Users/alice/projects/hermes"
}
```

响应：

```json
{
  "ok": true
}
```

### `GET /api/sessions/{session_id}/messages`

响应：

```json
{
  "sessionId": "desktop_3c69d2f1",
  "messages": [
    {
      "role": "user",
      "content": "帮我分析 browser 打包问题",
      "timestamp": 1776048226.130
    },
    {
      "role": "assistant",
      "content": "我先检查当前 runtime 的查找逻辑。",
      "timestamp": 1776048226.880
    }
  ]
}
```

### `DELETE /api/sessions/{session_id}`

响应：

```json
{
  "ok": true
}
```

## 5.3 Runs

### `POST /v1/runs`

用途：

- 创建一个新的 agent run

请求：

```json
{
  "sessionId": "desktop_3c69d2f1",
  "input": "帮我检查桌面打包方案，重点看 browser runtime。",
  "cwd": "/Users/alice/projects/hermes",
  "model": "anthropic/claude-sonnet-4.6",
  "toolset": "hermes-desktop",
  "instructions": null,
  "client": {
    "name": "hermes-desktop",
    "version": "1.0.0"
  }
}
```

响应：

```json
{
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "status": "started"
}
```

### `GET /v1/runs/{run_id}`

响应：

```json
{
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "status": "waiting_for_approval",
  "startedAt": 1776048226.128,
  "lastEventSeq": 8,
  "pendingApprovalId": "apr_5ab2f0d4",
  "pendingClarifyId": null
}
```

### `GET /v1/runs/{run_id}/events`

用途：

- SSE 事件流

传输规则：

- `Content-Type: text/event-stream`
- 仅发送 `data: <json>\n\n`
- 30 秒 keepalive comment
- 结束前发送 `: stream closed`

### `POST /v1/runs/{run_id}/cancel`

请求：

```json
{
  "reason": "user_cancelled"
}
```

响应：

```json
{
  "ok": true
}
```

### `POST /v1/runs/{run_id}/approval`

请求：

```json
{
  "requestId": "apr_5ab2f0d4",
  "decision": "allow_once",
  "remember": false
}
```

响应：

```json
{
  "ok": true,
  "requestId": "apr_5ab2f0d4"
}
```

### `POST /v1/runs/{run_id}/clarify`

请求：

```json
{
  "requestId": "clr_05ef1d3e",
  "answer": "只做 GitHub CI 方案，不生成安装脚本"
}
```

响应：

```json
{
  "ok": true,
  "requestId": "clr_05ef1d3e"
}
```

## 5.4 复用管理接口

这些接口前端可直接复用当前 Web UI 语义：

- `GET /api/status`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/config/defaults`
- `GET /api/config/schema`
- `GET /api/config/raw`
- `PUT /api/config/raw`
- `GET /api/env`
- `PUT /api/env`
- `DELETE /api/env`
- `POST /api/env/reveal`
- `GET /api/logs`
- `GET /api/skills`
- `PUT /api/skills/toggle`
- `GET /api/tools/toolsets`
- `GET /api/analytics/usage`
- `GET/POST/PUT/DELETE /api/cron/jobs*`

## 6. SSE 事件契约

## 6.1 基础事件结构

所有 run 事件共用以下字段：

```ts
export interface BaseRunEvent {
  event: string;
  runId: string;
  sessionId: string;
  seq: number;
  timestamp: number;
}
```

## 6.2 事件列表

### `run.started`

```json
{
  "event": "run.started",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 1,
  "timestamp": 1776048226.128,
  "model": "anthropic/claude-sonnet-4.6",
  "cwd": "/Users/alice/projects/hermes"
}
```

### `message.delta`

```json
{
  "event": "message.delta",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 3,
  "timestamp": 1776048227.022,
  "delta": "我先检查当前 browser runtime 的查找路径。"
}
```

### `reasoning.available`

```json
{
  "event": "reasoning.available",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 2,
  "timestamp": 1776048226.901,
  "text": "Need to inspect browser_tool lookup and desktop runtime bundling."
}
```

### `tool.started`

```json
{
  "event": "tool.started",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 4,
  "timestamp": 1776048227.331,
  "tool": "terminal",
  "callId": "call_8a2f",
  "preview": "rg -n \"agent-browser\" tools/browser_tool.py"
}
```

### `tool.completed`

```json
{
  "event": "tool.completed",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 5,
  "timestamp": 1776048227.881,
  "tool": "terminal",
  "callId": "call_8a2f",
  "duration": 0.55,
  "error": false
}
```

### `approval.required`

```json
{
  "event": "approval.required",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 6,
  "timestamp": 1776048228.100,
  "requestId": "apr_5ab2f0d4",
  "tool": "terminal",
  "title": "Dangerous command requires approval",
  "description": "This command may modify files outside the workspace.",
  "riskLevel": "high",
  "command": "rm -rf build",
  "cwd": "/Users/alice/projects/hermes",
  "options": [
    "allow_once",
    "allow_session",
    "allow_workspace",
    "deny"
  ]
}
```

### `approval.resolved`

```json
{
  "event": "approval.resolved",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 7,
  "timestamp": 1776048230.221,
  "requestId": "apr_5ab2f0d4",
  "decision": "allow_once"
}
```

### `clarify.required`

```json
{
  "event": "clarify.required",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 8,
  "timestamp": 1776048231.000,
  "requestId": "clr_05ef1d3e",
  "question": "是否需要我同时输出 workflow 草案？",
  "choices": [
    {
      "label": "只要方案",
      "value": "plan_only"
    },
    {
      "label": "带 workflow 草案",
      "value": "with_workflow"
    }
  ],
  "allowFreeform": true
}
```

### `clarify.resolved`

```json
{
  "event": "clarify.resolved",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 9,
  "timestamp": 1776048233.442,
  "requestId": "clr_05ef1d3e",
  "answer": "with_workflow"
}
```

### `run.completed`

```json
{
  "event": "run.completed",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 10,
  "timestamp": 1776048240.100,
  "output": "我已经整理出桌面打包方案和 CI 结构。",
  "usage": {
    "inputTokens": 4820,
    "outputTokens": 1176,
    "totalTokens": 5996
  }
}
```

### `run.failed`

```json
{
  "event": "run.failed",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 10,
  "timestamp": 1776048240.100,
  "error": "agent-browser CLI not found"
}
```

### `run.cancelled`

```json
{
  "event": "run.cancelled",
  "runId": "run_95c64f3b9f7f4b3db3fd",
  "sessionId": "desktop_3c69d2f1",
  "seq": 10,
  "timestamp": 1776048235.500,
  "reason": "user_cancelled"
}
```

## 6.3 TypeScript 联合类型

```ts
export type RunEvent =
  | RunStartedEvent
  | MessageDeltaEvent
  | ReasoningAvailableEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ApprovalRequiredEvent
  | ApprovalResolvedEvent
  | ClarifyRequiredEvent
  | ClarifyResolvedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent;
```

## 7. 错误格式

所有非 2xx JSON 接口统一返回：

```json
{
  "error": {
    "code": "run_not_found",
    "message": "Run not found: run_123"
  }
}
```

错误码建议：

- `unauthorized`
- `invalid_json`
- `validation_error`
- `provider_validation_failed`
- `session_not_found`
- `run_not_found`
- `approval_not_found`
- `clarify_not_found`
- `run_already_finished`
- `rate_limit_exceeded`
- `internal_error`

前端规则：

- `401`：跳转全局错误态并提示 sidecar 重启
- `404`：局部提示资源不存在
- `409`：显示状态冲突提示
- `422`：表单字段校验提示
- `500`：toast + 可点击到日志页

## 8. 前端状态机建议

## 8.1 会话页状态

```ts
type ChatScreenState =
  | "booting"
  | "ready"
  | "creating_run"
  | "streaming"
  | "waiting_for_approval"
  | "waiting_for_clarify"
  | "completed"
  | "failed";
```

## 8.2 run 期间前端行为

| 事件 | 前端行为 |
|---|---|
| `run.started` | 清空当前临时 assistant buffer，进入 `streaming` |
| `message.delta` | 追加到当前 assistant 草稿消息 |
| `reasoning.available` | 追加到时间线，不直接插入消息流正文 |
| `tool.started` | 在时间线增加进行中项 |
| `tool.completed` | 完成对应时间线项 |
| `approval.required` | 渲染审批卡片，页面状态切为 `waiting_for_approval` |
| `approval.resolved` | 收起或完成审批卡片，恢复 `streaming` |
| `clarify.required` | 渲染澄清卡片，页面状态切为 `waiting_for_clarify` |
| `clarify.resolved` | 收起或完成澄清卡片，恢复 `streaming` |
| `run.completed` | 提交最终 assistant 消息，状态切为 `completed` |
| `run.failed` | 显示失败态并保留时间线 |
| `run.cancelled` | 停止 spinner，显示已取消 |

## 9. Mock 与并行开发约定

为保证前端可以在 backend 完成前并行开发，允许使用 mock adapter。

前端最少需要 mock：

1. `GET /desktop/bootstrap`
2. `POST /api/sessions`
3. `GET /api/sessions`
4. `GET /api/sessions/{id}/messages`
5. `POST /v1/runs`
6. `GET /v1/runs/{id}/events`
7. `POST /v1/runs/{id}/approval`
8. `POST /v1/runs/{id}/clarify`
9. `POST /v1/runs/{id}/cancel`

建议在前端建立：

```text
web/src/lib/mocks/desktop.ts
web/src/lib/mocks/run-events.ts
```

## 10. 后端保证

Backend 保证：

1. 同一 `run_id` 的 `seq` 单调递增
2. `run.completed` / `run.failed` / `run.cancelled` 三者只会出现一个
3. `approval.required` 与 `clarify.required` 会带稳定 `requestId`
4. `GET /api/sessions/{id}/messages` 返回的历史顺序已排好序
5. SSE keepalive 不改变业务状态

## 11. 前端假设

Frontend 可以做以下假设：

1. 同一时刻一个 `session_id` 只会有一个活跃 run
2. 当前版本不支持多个并行 pending approvals
3. 当前版本不支持多个并行 pending clarifies
4. 一个 run 在结束后不可再次 resume

## 12. 版本控制

若接口需要破坏性调整：

1. 先更新本文档
2. 标明字段变更与迁移方式
3. 再更新 backend / frontend

不允许先改实现、后补文档。
