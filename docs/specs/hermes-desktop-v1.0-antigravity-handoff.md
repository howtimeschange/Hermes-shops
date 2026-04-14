# Hermes Desktop v1.0 Antigravity Handoff

Date: 2026-04-13

Status: Active

Role Split:

- 我：Backend + Architecture Owner
- `antigravity`：Frontend Owner

## 1. 这份文档是给谁的

这份文档直接写给 `antigravity`。

你的工作不是“想办法定义产品方向”，而是基于现有架构与接口契约，把 `Hermes Desktop` 的前端主体验落出来，并且做到可以和 backend 合起来形成完整项目。

你的参考文档只有三份：

1. `hermes-desktop-v1.0-technical-design.md`
2. `hermes-desktop-v1.0-api-contract.md`
3. `hermes-desktop-v1.0-ui-design.md`

你做前端实现时，以这三份为准。

## 2. 角色边界

### 2.1 我负责

- 桌面总体架构
- sidecar 设计与实现
- FastAPI 路由
- `SessionDB` 会话闭环
- `/v1/runs` run manager
- approval / clarify backend bridge
- 打包运行时设计
- GitHub CI 构建链路

### 2.2 你负责

- `web/` 前端实现
- Chat 首页
- Session Sidebar
- Message List / Composer
- Timeline Panel
- Approval / Clarify UI
- Onboarding Wizard
- 前端 API client 与 SSE hook
- 与现有 Settings / Logs / Skills 页面整合

### 2.3 你不要负责

- Python sidecar 逻辑
- provider 解析逻辑
- SessionDB schema
- tool execution backend
- Electron main process 逻辑

如果某个需求只有改 backend 才能完成，不要在前端层面硬 hack，直接标为 backend dependency。

## 3. 你的目标

把当前偏 dashboard 的 `web/` 前端升级为可直接驱动桌面 agent 的主界面。

你的交付必须满足：

1. `Chat` 成为首页
2. 新建会话、打开会话、继续会话全部跑通
3. 可以基于 `/v1/runs + SSE` 完成一次完整 agent 回合
4. 审批和澄清不是 toast，而是正式 UI 卡片
5. 时间线能让人看清 agent 做了什么

## 4. 实现约束

### 4.1 代码位置

所有前端工作都在：

```text
/Users/xingyicheng/Downloads/Hermes/web
```

不要另起一个新前端目录。

### 4.2 视觉约束

沿用现有 `web/src/index.css` 的 Hermes 视觉语言：

- 深青背景
- 暖色前景
- `Mondwest` / `Collapse` / `Courier Prime`
- 几何边框与颗粒质感

不要做成另一套风格。

### 4.3 技术约束

- 继续使用 React 19 + TypeScript
- 继续使用现有 `web/src/lib/api.ts` 风格
- 继续使用当前单页布局体系
- 不引入 `react-router`
- 不要引入重量级状态管理库，优先 React hooks + 轻量本地状态
- `Chat` 相关实现优先放到 `web/src/features/chat/`
- SSE 和 run 状态不要塞进页面组件里，必须抽成 feature hooks

### 4.4 协作约束

不要阻塞在 backend 未完工上。  
先按 API contract 做 mock，把页面与交互打通。

## 5. 文件 ownership

下面这些路径默认由你拥有：

```text
web/src/App.tsx
web/src/lib/api.ts
web/src/lib/runs.ts
web/src/lib/desktop.ts
web/src/pages/ChatPage.tsx
web/src/pages/OnboardingPage.tsx
web/src/features/chat/**/*
```

下面这些现有页面你可以做整合，但不要大幅破坏它们原本语义：

```text
web/src/pages/SessionsPage.tsx
web/src/pages/LogsPage.tsx
web/src/pages/SkillsPage.tsx
web/src/pages/ConfigPage.tsx
web/src/pages/EnvPage.tsx
web/src/pages/StatusPage.tsx
```

## 6. 任务拆解

## Phase 0: 基础接线

### Task F0.1 更新导航与首页

目标：

- `Chat` 成为默认首页
- `Status` 不再是默认第一页

你要改：

- `web/src/App.tsx`

验收：

- 应用启动后默认打开 `Chat`
- 导航中保留原有管理页入口

### Task F0.2 建立前端类型层

目标：

- 把 API contract 里的 DTO 和事件类型落成 TypeScript 类型

你要新增：

```text
web/src/lib/desktop.ts
web/src/lib/runs.ts
web/src/features/chat/types.ts
```

你要修改：

```text
web/src/lib/api.ts
```

验收：

- 所有 run 相关接口和事件都有 TS 类型
- 不再把 run 事件写成 `any`

## Phase 1: Chat 基础骨架

### Task F1.1 建立 ChatPage

目标：

- 新增真正的聊天主页面

你要新增：

```text
web/src/pages/ChatPage.tsx
```

要求：

- 三栏布局
- 左侧会话栏
- 中间消息区
- 右侧时间线

验收：

- 页面骨架完整
- 支持空状态
- 支持“无 session / 有 session / run 中”三种主状态

### Task F1.2 Session Sidebar

你要新增：

```text
web/src/features/chat/components/SessionSidebar.tsx
web/src/features/chat/hooks/useSessionList.ts
```

功能：

- 最近会话列表
- 搜索框
- `New Chat`
- 当前工作区显示

验收：

- 可从 mock 数据渲染
- 可切换 active session

### Task F1.3 Message 区域

你要新增：

```text
web/src/features/chat/components/MessageList.tsx
web/src/features/chat/components/MessageBubble.tsx
```

功能：

- 展示历史消息
- 展示 streaming assistant 草稿
- 支持 Markdown

复用要求：

- 正文渲染继续复用现有 `web/src/components/Markdown.tsx`

验收：

- 用户和 assistant 消息视觉上可区分
- 代码块样式统一

## Phase 2: Run 流与时间线

### Task F2.1 SSE Hook

你要新增：

```text
web/src/features/chat/hooks/useRunStream.ts
web/src/features/chat/hooks/useChatSession.ts
```

职责：

- 发起 `POST /v1/runs`
- 建立 SSE 订阅
- 分发事件
- 管理临时 assistant buffer
- 管理当前 run 状态
- 负责把历史消息与 streaming 状态合并成页面可消费的会话状态

要求：

- 组件层不要直接写 EventSource 细节
- `useRunStream` 暴露清晰状态与 action

建议返回值：

```ts
{
  runState,
  timeline,
  streamingText,
  pendingApproval,
  pendingClarify,
  startRun,
  cancelRun,
  submitApproval,
  submitClarify,
}
```

验收：

- 能吃 mock SSE
- 能处理 run complete / fail / cancel

### Task F2.2 Timeline Panel

你要新增：

```text
web/src/features/chat/components/TimelinePanel.tsx
web/src/features/chat/components/TimelineItem.tsx
```

职责：

- 按事件渲染时间线
- 区分 thinking/tool/approval/clarify/final state

验收：

- `tool.started` 和 `tool.completed` 可以成对显示
- 高风险状态视觉显著

## Phase 3: 用户介入能力

### Task F3.1 Approval Card

你要新增：

```text
web/src/features/chat/components/ApprovalCard.tsx
```

功能：

- 接收 `approval.required`
- 呈现命令、cwd、风险说明
- 提交四种 decision

验收：

- `Allow Once`
- `Allow Session`
- `Allow Workspace`
- `Deny`

这四个动作齐全

### Task F3.2 Clarify Card

你要新增：

```text
web/src/features/chat/components/ClarifyCard.tsx
```

功能：

- 渲染选择项
- 支持自由输入
- 提交 answer

验收：

- 选择项模式和自由输入模式都可用

### Task F3.3 Composer

你要新增：

```text
web/src/features/chat/components/Composer.tsx
```

功能：

- 多行输入
- `Enter` 发送
- `Shift+Enter` 换行
- `Stop` 按钮
- run 中禁用或切换按钮语义

## Phase 4: Onboarding

### Task F4.1 Onboarding Page

你要新增：

```text
web/src/pages/OnboardingPage.tsx
web/src/features/chat/hooks/useOnboarding.ts
```

职责：

- 四步向导
- 校验 provider
- 保存完成

步骤：

1. Provider
2. Credentials
3. Model
4. Workspace & Approval

验收：

- 可以在 mock 接口上完整走通
- 完成后自动进入 Chat

## Phase 5: 整合与打磨

### Task F5.1 现有页面整合

目标：

- 让原有 `Sessions / Logs / Skills / Config / Keys / Status` 与新的 `Chat` 结构统一

要求：

- 统一标题层级
- 统一边框与间距
- 不破坏现有接口使用

### Task F5.2 Loading / Empty / Error 状态

每个核心页面必须有：

- loading
- empty
- error

不能只在控制台里报错。

### Task F5.3 Mock fixtures

为了前后端并行开发，你要顺手提供：

```text
web/src/lib/mocks/desktop.ts
web/src/lib/mocks/run-events.ts
```

这些 fixtures 用于：

- Chat UI 演示
- 时间线开发
- 审批/澄清交互开发

## 7. 建议文件清单

建议你新建这些文件：

```text
web/src/pages/ChatPage.tsx
web/src/pages/OnboardingPage.tsx
web/src/features/chat/types.ts
web/src/features/chat/components/SessionSidebar.tsx
web/src/features/chat/components/MessageList.tsx
web/src/features/chat/components/MessageBubble.tsx
web/src/features/chat/components/TimelinePanel.tsx
web/src/features/chat/components/TimelineItem.tsx
web/src/features/chat/components/ApprovalCard.tsx
web/src/features/chat/components/ClarifyCard.tsx
web/src/features/chat/components/Composer.tsx
web/src/features/chat/components/ChatShell.tsx
web/src/features/chat/hooks/useRunStream.ts
web/src/features/chat/hooks/useChatSession.ts
web/src/features/chat/hooks/useSessionList.ts
web/src/features/chat/hooks/useOnboarding.ts
web/src/lib/runs.ts
web/src/lib/desktop.ts
web/src/lib/mocks/desktop.ts
web/src/lib/mocks/run-events.ts
```

## 8. 开发顺序

严格按下面顺序来，不要一上来就做视觉细节：

1. `App.tsx` 默认页切到 `Chat`
2. 类型层与 mock 数据
3. `ChatPage` 静态三栏骨架
4. `SessionSidebar`
5. `MessageList`
6. `useRunStream`
7. `TimelinePanel`
8. `ApprovalCard`
9. `ClarifyCard`
10. `Composer`
11. `OnboardingPage`
12. 全局整合与 polish

## 9. Backend 依赖清单

这些点你可以先 mock，但联调前必须等我补 backend：

| 能力 | 你先 mock | 最终依赖 backend |
|---|---|---|
| `GET /desktop/bootstrap` | 可以 | 需要 |
| `POST /api/sessions` | 可以 | 需要 |
| `PATCH /api/sessions/{id}` | 可以 | 需要 |
| `POST /v1/runs` | 可以 | 需要 |
| `GET /v1/runs/{id}/events` | 可以 | 需要 |
| `POST /v1/runs/{id}/approval` | 可以 | 需要 |
| `POST /v1/runs/{id}/clarify` | 可以 | 需要 |
| `POST /v1/runs/{id}/cancel` | 可以 | 需要 |

## 10. 你交付 PR 时的标准

每个 PR 必须满足：

1. 一个清晰主题
2. 不混入不相关重构
3. 页面状态完整
4. 类型不要偷懒用 `any`
5. 对应截图或录屏

推荐 PR 粒度：

- PR1: `Chat` 导航 + 类型层 + mock
- PR2: `ChatPage` + `SessionSidebar` + `MessageList`
- PR3: `useRunStream` + `TimelinePanel`
- PR4: `ApprovalCard` + `ClarifyCard` + `Composer`
- PR5: `OnboardingPage`
- PR6: polish + integration

## 11. Definition of Done

以下条件全部成立，才算你这部分完成：

1. `Chat` 成为默认首页
2. 新建会话可用
3. 会话列表和历史消息可展示
4. run 流式事件能驱动消息区和时间线
5. approval/clarify 能在 UI 中走完整闭环
6. onboarding 能完整走 4 步
7. 现有管理页仍然可用

## 12. 风险提醒

### 风险 1: 把所有状态塞进一个大组件

不要这么做。  
拆成：

- page container
- hooks
- pure components

### 风险 2: 直接在组件里写 fetch + SSE

不要这么做。  
网络与事件逻辑集中到 hooks / lib。

### 风险 3: 提前做路由和全局 store 重构

不要这么做。  
当前 `web/` 是单入口本地页切换模型，v1.0 先顺着现有结构把主路径做通。

### 风险 4: 过早追求动画和视觉微调

先把信息架构、状态闭环、事件驱动做稳。

## 13. 我给你的工作要求

简单说：

1. 先把前端骨架搭起来
2. 先跑 mock，不等 backend
3. 页面要能说明 agent 在干什么
4. 审批和澄清必须像正式产品，不许糊弄成 toast
5. 所有 UI 都围绕“Chat 是首页”这个核心来做
6. 用 `features/chat` 把业务边界收清楚，不要把复杂状态塞回 `App.tsx` 或页面组件

做到这一步，前后端一合，我们就不是在做一个 demo，而是在做一个完整的 Hermes Desktop 项目。
