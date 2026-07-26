import { useEffect, useRef, useState } from 'react'
import { ARENA_URL, type ArenaEvent } from './api'

// The arena's journal as Server-Sent Events, hand-parsed over fetch.
//
// EventSource would be less code, but it only delivers event types it was
// told to listen for — and the arena names every frame after its `type`
// (deal.accepted, offer.made, …), an open set this page must not have to
// enumerate. Reading the stream ourselves gets every frame regardless of
// name, and lets reconnects resume from the exact seq we last saw.
//
// `after=0` on the very first connect deliberately replays history, exactly
// like the poller it replaces: the dashboard backfills the whole story
// instead of starting blind. Heartbeat comments (`: hb`) fall out of the
// parser as empty frames and cost nothing.

const RETRY_MIN_MS = 1_000
const RETRY_MAX_MS = 15_000

function parseFrame(frame: string): ArenaEvent | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (data === '') return null
  try {
    return JSON.parse(data) as ArenaEvent
  } catch {
    return null
  }
}

/**
 * Opens `${ARENA_URL}/public/stream` and feeds every event to `onEvent`.
 * Returns whether the stream is currently open — the callers' cue to pause
 * their fallback polling. Reconnects forever with backoff; an arena that
 * does not serve the stream yet simply leaves this `false` and the page on
 * its polls.
 */
export function useArenaStream(onEvent: (event: ArenaEvent) => void): boolean {
  const [open, setOpen] = useState(false)
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    const controller = new AbortController()
    let lastSeq = 0
    let retryMs = RETRY_MIN_MS
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = async (): Promise<void> => {
      const response = await fetch(
        `${ARENA_URL}/public/stream?after=${String(lastSeq)}`,
        { headers: { accept: 'text/event-stream' }, signal: controller.signal },
      )
      if (!response.ok || response.body === null) {
        throw new Error(`stream answered ${String(response.status)}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      setOpen(true)
      retryMs = RETRY_MIN_MS
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        // Frames end on a blank line; whatever trails stays buffered.
        const frames = buffer.split(/\r?\n\r?\n/)
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const event = parseFrame(frame)
          if (event === null || event.seq <= lastSeq) continue
          lastSeq = event.seq
          handler.current(event)
        }
      }
    }

    const run = (): void => {
      connect().then(
        // Server closed cleanly — same treatment as an error: retry.
        () => { scheduleRetry() },
        () => { scheduleRetry() },
      )
    }

    const scheduleRetry = (): void => {
      setOpen(false)
      if (controller.signal.aborted) return
      retryTimer = setTimeout(run, retryMs)
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
    }

    run()
    return () => {
      controller.abort()
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [])

  return open
}
