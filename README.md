# dsh-tui-jobs

> 适用于 [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI)（[dshtui.com](https://dshtui.com)）的社区插件。

dsh-TUI 的后台任务面板：`/jobs` 列出当前所有可见的后台任务（bash、子 agent 等），状态变化实时刷新，可查看已完成任务的输出、取消运行中的任务。补齐官方 WebUI 有而 TUI 没有的任务列表面。

[English](#english) below.

## 用法

```
/jobs     " 打开任务面板
```

列表：↑/↓ 选择 · Enter 查看详情与输出 · x 取消（3 秒内按两次确认）· r 刷新 · Esc 退出。

详情视图：↑/↓ / PgUp/PgDn 滚动输出 · x 取消 · Esc 返回。

## 设计要点

- 数据面全部来自 harness 的 `ctx.jobs` 注册表（`list`/`read`/`kill`/`onJobsChanged`），机制层零改动。
- **输出读取有纪律**：流式任务只有一条消费游标，面板绝不读运行中任务的输出（否则抢走模型侧完成通知的内容）——只有终态任务（completed/killed/failed）的输出可读，且幂等。
- 取消走二次确认（3 秒窗口双击 x），防误触。
- 列表运行中优先、终态最新在前；运行中任务时长每秒刷新。
- 宿主不支持 scene（web、headless）时退化为文本列表。

## 安装

```
dsh plugin --profile <你的profile> add dsh-tui-jobs
```

或从源码：`npm pack` 后 `dsh plugin --profile <你的profile> add file:<tgz路径>`。

## 开发

```
node --test    " 单元测试（状态映射、时长格式化、排序、id 归一化）
```

---

## English

A background jobs panel for dsh-TUI: `/jobs` lists every visible job from the harness `ctx.jobs` registry, follows status changes live, shows output of settled jobs, and cancels running ones (double-x confirm). Closes the jobs-list parity gap between the official WebUI and the TUI.

- Read discipline: stream jobs have a single consuming cursor, so the panel never reads a running job's output — terminal reads only, idempotent.
- Auto-refresh via `onJobsChanged` plus a 1s duration ticker.
- Degrades to a text list on hosts without the scene seam.

MIT
