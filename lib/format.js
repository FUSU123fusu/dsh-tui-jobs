/**
 * format.js — pure presentation helpers for job snapshots: status icons,
 * durations, ages. Shared by the scene and the tests.
 */

/** Terminal states: the job has settled and its output is safe to read. */
export const TERMINAL = new Set(['completed', 'killed', 'failed'])

export function isTerminal(status) {
  return TERMINAL.has(status)
}

/** Icon + i18n key + color token per lifecycle state. */
export function statusMeta(status) {
  switch (status) {
    case 'running':
      return { icon: '●', key: 'st-running', color: 'success' }
    case 'stopping':
      return { icon: '◌', key: 'st-stopping', color: 'warning' }
    case 'completed':
      return { icon: '✓', key: 'st-completed', color: 'inactive' }
    case 'killed':
      return { icon: '⊘', key: 'st-killed', color: 'inactive' }
    case 'failed':
      return { icon: '✗', key: 'st-failed', color: 'error' }
    default:
      return { icon: '?', key: 'st-running', color: 'inactive' }
  }
}

/** 65000 → "1m 5s"; 900 → "0.9s"; hours collapse to "2h 3m". */
export function formatDuration(startedAt, finishedAt, now = Date.now()) {
  const end = finishedAt ?? now
  const ms = Math.max(0, end - startedAt)
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Sort for the list: running first, then stopping, then newest terminal first. */
export function sortJobs(jobs) {
  const rank = (job) => (job.status === 'running' ? 0 : job.status === 'stopping' ? 1 : 2)
  return [...jobs].sort((a, b) => rank(a) - rank(b) || b.startedAt - a.startedAt)
}

/** Normalize a JobId (string or branded { value }). */
export function jobId(job) {
  const id = job?.id
  if (typeof id === 'string') return id
  if (id !== null && typeof id === 'object' && typeof id.value === 'string') return id.value
  return ''
}
