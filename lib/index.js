/**
 * dsh-tui-jobs — a background jobs panel inside dsh-TUI: `/jobs` lists every
 * visible job from the `ctx.jobs` registry, follows status changes live via
 * `onJobsChanged`, shows terminal output on demand, and cancels running jobs.
 *
 * Cordis plugin contract: `name` + `apply`, no default export, zero runtime
 * dependencies. Service timing is handled by the row's `inject` (see
 * cordis.patch.yml); the host-only seams (`tuiScenes`, `tuiCommandTrees`) are
 * runtime probes and the command degrades to a plain text list without them.
 * @module dsh-tui-jobs
 */

import { createT, detectLang } from './i18n.js'
import { formatDuration, isTerminal, jobId, sortJobs, statusMeta } from './format.js'
import { createSceneComponent } from './scene.js'

export const name = 'dsh-tui-jobs'

const SCENE_ID = 'jobs'

function createStore() {
  const listeners = new Set()
  return {
    data: { jobs: [], selectedId: undefined },
    set(patch) {
      Object.assign(this.data, patch)
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function createApi(ctx, store) {
  const jobs = () => ctx.get('jobs', false)
  let subscribed = false

  const api = {
    async refresh() {
      const registry = jobs()
      if (registry === undefined) return false
      // Live fan-out: the registry's owner-granular change feed re-reads the
      // whole visible set, exactly the panel's refresh granularity. Bound
      // lazily — at apply time the service fiber may not be active yet.
      if (!subscribed) {
        subscribed = true
        registry.onJobsChanged(() => {
          void api.refresh()
        })
      }
      try {
        store.set({ jobs: sortJobs(await registry.list()) })
        return true
      } catch {
        return false
      }
    },

    /**
     * Read a job's output. Restricted to terminal jobs by the caller: stream
     * jobs have ONE consuming cursor and a panel read would steal deltas from
     * the model-side completion notice. Terminal reads are idempotent.
     */
    async readOutput(id) {
      const registry = jobs()
      if (registry === undefined) throw new Error('jobs service unavailable')
      const result = await registry.read(id)
      return result.text
    },

    async kill(id) {
      const registry = jobs()
      if (registry === undefined) throw new Error('jobs service unavailable')
      return registry.kill(id, undefined, 'cancelled from /jobs panel')
    },

    isTerminal,
    statusMeta,
    formatDuration,
    jobId,
  }
  return api
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const t = createT(detectLang())
  const commands = ctx.get('commands', false)
  if (commands === undefined) return

  const store = createStore()
  const api = createApi(ctx, store)
  let sceneRegistered = false

  const ensureScene = () => {
    if (sceneRegistered) return true
    const scenes = ctx.get('tuiScenes', false)
    if (scenes === undefined) return false
    scenes.register({
      id: SCENE_ID,
      title: 'jobs',
      component: createSceneComponent({ store, api, t }),
    })
    sceneRegistered = true
    return true
  }

  const textList = (jobs) =>
    jobs.map((job) => {
      const meta = statusMeta(job.status)
      return `${meta.icon} ${jobId(job)} ${t(meta.key)} · ${job.label} · ${formatDuration(job.startedAt, job.finishedAt)}`
    })

  commands.register({
    name: 'jobs',
    description: t('cmd-desc'),
    input: { hint: '' },
    handler: async () => {
      const registry = ctx.get('jobs', false)
      if (registry === undefined) return { kind: 'error', text: t('not-mounted') }

      let jobs
      try {
        jobs = sortJobs(await registry.list())
      } catch (error) {
        return { kind: 'error', text: t('query-failed', { err: error instanceof Error ? error.message : String(error) }) }
      }
      if (jobs.length === 0) return { kind: 'success', text: t('none') }

      store.set({ jobs, selectedId: undefined })

      if (!ensureScene() || !ctx.get('tuiScenes', false).open(SCENE_ID)) {
        return { kind: 'success', text: [t('no-scene-host'), ...textList(jobs)].join('\n') }
      }
      return { kind: 'success' }
    },
  })

  const trees = ctx.get('tuiCommandTrees', false)
  trees?.register({
    root: 'jobs',
    descriptions: { zh: '后台任务面板：列出、跟踪、查看输出、取消', en: 'Background jobs panel: list, watch, inspect output, cancel' },
    children: () => [],
  })
}
