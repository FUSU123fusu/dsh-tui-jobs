/**
 * scene.js — the full-screen jobs panel scene.
 *
 * Plain createElement, no JSX: the plugin ships zero dependencies and the
 * scene contract requires the HOST's React for every hook and element (see
 * TuiSceneProps in dsh-TUI's scenes.ts). `store`/`api`/`t` close over the
 * factory.
 *
 * List mode: every visible job, status icon + id + label + duration, sorted
 * running-first. Detail mode: metadata plus terminal output (running jobs
 * deliberately show no output — stream jobs have one consuming cursor and
 * the panel must not steal deltas from the model-side read).
 */

import { formatDuration, isTerminal, jobId, statusMeta } from './format.js'

/** Chrome rows: title + divider + divider + hint. */
const CHROME = 4

export function createSceneComponent({ store, api, t }) {
  /**
   * @param {{ React: typeof import('react'), ui: any, channel: any, close(): void }} props
   */
  return function JobsScene({ React, ui, close }) {
    const { Box, Text, useInput, useTerminalSize } = ui
    const { columns, rows: termRows } = useTerminalSize()
    const [, bump] = React.useReducer((x) => x + 1, 0)

    const [mode, setMode] = React.useState('list')
    const [cursor, setCursor] = React.useState(0)
    const [detailId, setDetailId] = React.useState(undefined)
    const [output, setOutput] = React.useState('')
    const [outputNote, setOutputNote] = React.useState('')
    const [scroll, setScroll] = React.useState(0)
    const [note, setNote] = React.useState('')

    const armedKillRef = React.useRef(0)
    const noteTimerRef = React.useRef(null)
    const flash = (text) => {
      setNote(text)
      if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
      noteTimerRef.current = setTimeout(() => {
        noteTimerRef.current = null
        setNote('')
        bump()
      }, 4000)
    }

    React.useEffect(() => store.subscribe(bump), [])

    // Live refresh while the scene is up; the api's onJobsChanged hookup is
    // lazy (bound on first refresh), and this 1s ticker keeps durations
    // honest for running jobs.
    React.useEffect(() => {
      void api.refresh()
      const timer = setInterval(() => void api.refresh(), 1000)
      return () => clearInterval(timer)
    }, [])

    const jobs = store.data.jobs
    const current = jobs.find((job) => jobId(job) === detailId)
    const bodyRows = Math.max(3, termRows - CHROME - (note === '' ? 0 : 1))

    const openDetail = (job) => {
      const id = jobId(job)
      setDetailId(id)
      setMode('detail')
      setScroll(0)
      setOutput('')
      setOutputNote('')
      if (!isTerminal(job.status)) {
        setOutputNote(t('detail-running-note'))
        return
      }
      api
        .readOutput(id)
        .then((text) => {
          setOutput(text)
          if (text.trim() === '') setOutputNote(t('detail-no-output'))
          bump()
        })
        .catch((error) => {
          setOutputNote(t('read-failed', { err: error instanceof Error ? error.message : String(error) }))
          bump()
        })
    }

    const killCurrent = () => {
      const job = current ?? jobs[cursor]
      if (job === undefined) return
      if (isTerminal(job.status)) return flash(t('kill-na'))
      const now = Date.now()
      if (now - armedKillRef.current > 3000) {
        armedKillRef.current = now
        return flash(t('confirm-kill'))
      }
      armedKillRef.current = 0
      api
        .kill(jobId(job))
        .then(() => flash(t('kill-ok')))
        .catch((error) => flash(t('kill-failed', { err: error instanceof Error ? error.message : String(error) })))
    }

    useInput((input, key) => {
      if (mode === 'list') {
        if (key.escape) return close()
        if (key.upArrow) return setCursor((c) => Math.max(0, c - 1))
        if (key.downArrow) return setCursor((c) => Math.min(Math.max(0, jobs.length - 1), c + 1))
        if (input === 'r') return void api.refresh().then(bump)
        if ((input === 'x' || input === 'X') && jobs.length > 0) return killCurrent()
        if (key.return) {
          const job = jobs[cursor]
          if (job !== undefined) openDetail(job)
          return undefined
        }
        return undefined
      }
      // detail
      if (key.escape) {
        setMode('list')
        setDetailId(undefined)
        return undefined
      }
      const outputLines = output === '' ? 0 : output.split('\n').length
      const maxScroll = Math.max(0, outputLines - bodyRows)
      if (key.upArrow) return setScroll((s) => Math.max(0, s - 1))
      if (key.downArrow) return setScroll((s) => Math.min(maxScroll, s + 1))
      if (key.pageUp) return setScroll((s) => Math.max(0, s - bodyRows))
      if (key.pageDown) return setScroll((s) => Math.min(maxScroll, s + bodyRows))
      if (input === 'x' || input === 'X') return killCurrent()
      return undefined
    })

    const h = React.createElement
    const divider = (key) => h(Text, { key, dimColor: true, wrap: 'truncate' }, '─'.repeat(Math.max(8, columns - 2)))

    // ── list mode ──────────────────────────────────────────────────────────
    if (mode === 'list') {
      const rows = [
        h(Text, { key: 'title', bold: true, color: 'text' }, t('list-title', { count: jobs.length })),
        divider('div'),
      ]
      if (jobs.length === 0) {
        rows.push(h(Text, { key: 'empty', dimColor: true }, t('list-empty')))
      } else {
        const listWindow = Math.max(3, bodyRows - 1)
        const start = Math.max(0, Math.min(cursor - listWindow + 1, jobs.length - listWindow))
        jobs.slice(start, start + listWindow).forEach((job, index) => {
          const absolute = start + index
          const selected = absolute === cursor
          const meta = statusMeta(job.status)
          rows.push(
            h(
              Box,
              { key: jobId(job) || String(absolute), flexDirection: 'row' },
              h(Text, { color: selected ? 'suggestion' : 'inactive' }, selected ? '❯ ' : '  '),
              h(Text, { color: meta.color }, `${meta.icon} `),
              h(Text, { dimColor: true }, `${jobId(job)} `),
              h(Text, { bold: selected, wrap: 'truncate' }, `${job.label} `),
              h(Text, { dimColor: true }, `${t(meta.key)} · ${formatDuration(job.startedAt, job.finishedAt)}`),
            ),
          )
        })
      }
      rows.push(divider('div2'))
      if (note !== '') rows.push(h(Text, { key: 'note', color: note.startsWith('✗') ? 'error' : 'success' }, note))
      rows.push(h(Text, { key: 'hint', dimColor: true }, t('list-hint')))
      return h(Box, { flexDirection: 'column', paddingX: 1, height: termRows, overflow: 'hidden' }, ...rows)
    }

    // ── detail mode ────────────────────────────────────────────────────────
    const job = current ?? { status: 'failed', label: detailId ?? '?', startedAt: 0 }
    const meta = statusMeta(job.status)
    const fields = [
      [t('field-id'), jobId(job)],
      [t('field-kind'), String(job.kind ?? '?')],
      ...(job.ownerSession === undefined ? [] : [[t('field-owner'), String(job.ownerSession?.value ?? job.ownerSession)]]),
      [t('field-started'), `${new Date(job.startedAt).toLocaleTimeString()} (${formatDuration(job.startedAt, job.finishedAt)})`],
      ...(job.finishedAt === undefined ? [] : [[t('field-finished'), new Date(job.finishedAt).toLocaleTimeString()]]),
      ...(job.detail === undefined ? [] : [[t('field-detail'), job.detail]]),
    ]

    const outputLines = output === '' ? [] : output.split('\n')
    const visible = outputLines.slice(scroll, scroll + Math.max(1, bodyRows - fields.length - 2))

    return h(
      Box,
      { flexDirection: 'column', paddingX: 1, height: termRows, overflow: 'hidden' },
      h(
        Box,
        { key: 'header', flexDirection: 'row', columnGap: 1 },
        h(Text, { color: meta.color }, meta.icon),
        h(Text, { bold: true, color: 'text', wrap: 'truncate' }, job.label),
        h(Text, { dimColor: true }, `${jobId(job)} · ${t(meta.key)}`),
      ),
      divider('div'),
      h(
        Box,
        { key: 'body', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' },
        ...fields.map(([k, v]) =>
          h(Box, { key: `f-${k}`, flexDirection: 'row' }, h(Text, { dimColor: true }, `${k}  `), h(Text, { wrap: 'truncate-end' }, v)),
        ),
        fields.length > 0 ? h(Text, { key: 'f-end', dimColor: true }, ' ') : null,
        outputNote !== '' ? h(Text, { key: 'onote', dimColor: true }, outputNote) : null,
        ...visible.map((line, i) => h(Text, { key: `o${scroll + i}`, wrap: 'truncate-end' }, line)),
      ),
      divider('div2'),
      note === ''
        ? null
        : h(Text, { key: 'note', color: note.startsWith('✗') ? 'error' : 'success' }, note),
      h(Text, { key: 'hint', dimColor: true }, t('detail-hint')),
    )
  }
}
