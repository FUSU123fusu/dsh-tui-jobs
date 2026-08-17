/**
 * dsh-tui-jobs i18n — zh (default) / en, flat dict with {{name}} params.
 * Same language resolution as the host: DSH_TUI_LANG over CC_TUI_LANG over
 * the persisted /lang choice, else zh.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dict = {
  'cmd-desc': { zh: '后台任务面板：列出、跟踪、查看输出、取消', en: 'Background jobs panel: list, watch, inspect output, cancel' },

  'not-mounted': { zh: '任务注册表未挂载（当前组合没有 jobs 能力）', en: 'Job registry is not mounted in this composition' },
  'none': { zh: '当前没有后台任务', en: 'No background jobs' },
  'query-failed': { zh: '任务查询失败：{{err}}', en: 'Job query failed: {{err}}' },
  'no-scene-host': { zh: '当前宿主不支持全屏界面（需要 dsh-TUI），改用文本列表：', en: 'This host has no full-screen scene support (needs dsh-TUI); falling back to a text list:' },

  'st-running': { zh: '运行中', en: 'running' },
  'st-stopping': { zh: '停止中', en: 'stopping' },
  'st-completed': { zh: '已完成', en: 'completed' },
  'st-killed': { zh: '已取消', en: 'killed' },
  'st-failed': { zh: '失败', en: 'failed' },

  'list-title': { zh: '后台任务（{{count}}）', en: 'Background jobs ({{count}})' },
  'list-empty': { zh: '没有后台任务。Esc 退出。', en: 'No background jobs. Esc to quit.' },
  'list-hint': { zh: '↑/↓ 选择 · Enter 查看 · x 取消 · r 刷新 · Esc 退出', en: '↑/↓ select · Enter inspect · x cancel · r refresh · Esc quit' },

  'detail-hint': { zh: '↑/↓ 滚动 · x 取消 · Esc 返回列表', en: '↑/↓ scroll · x cancel · Esc back to list' },
  'detail-running-note': { zh: '运行中：输出要等任务结束后才能读（流式输出只有一条消费游标，面板不抢占模型侧读取）', en: 'Running: output becomes readable when the job settles (stream output has one consuming cursor; the panel never steals it from the model side)' },
  'detail-no-output': { zh: '（没有输出）', en: '(no output)' },
  'confirm-kill': { zh: '再按一次 x 确认取消该任务', en: 'press x again to confirm cancelling this job' },
  'kill-na': { zh: '该任务已结束', en: 'This job has already settled' },
  'kill-ok': { zh: '✓ 已请求取消', en: '✓ cancellation requested' },
  'kill-failed': { zh: '✗ 取消失败：{{err}}', en: '✗ cancel failed: {{err}}' },
  'read-failed': { zh: '输出读取失败：{{err}}', en: 'Failed to read output: {{err}}' },

  'field-id': { zh: '任务', en: 'job' },
  'field-kind': { zh: '类型', en: 'kind' },
  'field-owner': { zh: '属主会话', en: 'owner session' },
  'field-started': { zh: '开始于', en: 'started' },
  'field-finished': { zh: '结束于', en: 'finished' },
  'field-detail': { zh: '详情', en: 'detail' },
}

const LANGS = new Set(['zh', 'en'])

function isLang(value) {
  return typeof value === 'string' && LANGS.has(value)
}

export function detectLang(env = process.env, readFile = readFileSync) {
  if (isLang(env.DSH_TUI_LANG)) return env.DSH_TUI_LANG
  if (isLang(env.CC_TUI_LANG)) return env.CC_TUI_LANG
  try {
    const parsed = JSON.parse(readFile(join(homedir(), '.dsh-tui', 'lang.json'), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && isLang(parsed.lang)) return parsed.lang
  } catch {
    // No readable lang pref — fall through to the default.
  }
  return 'zh'
}

export function createT(lang) {
  return (key, params = {}) => {
    const entry = dict[key]
    const template = entry?.[lang] ?? entry?.zh ?? key
    return template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
      name in params ? String(params[name]) : match)
  }
}
