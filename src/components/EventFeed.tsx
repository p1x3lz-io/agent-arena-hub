import { useState } from 'react'
import type { ArenaEvent } from '../api'

// Live feed over the arena's append-only event log, newest first. One colour
// per event family (a square dot, no chip border — the text carries the type)
// so the eye can follow a deal through the noise; fresh rows slide in once.
// The header chip says which transport is carrying the feed right now.

function familyDot(type: string): string {
  if (type.startsWith('deal.')) return 'bg-neon-cyan'
  if (type.startsWith('match.')) return 'bg-neon-yellow'
  if (type.startsWith('challenge.')) return 'bg-violet'
  if (type.startsWith('table.')) return 'bg-neon-green'
  return 'bg-surface-600'
}

function familyText(type: string): string {
  if (type.startsWith('deal.')) return 'text-neon-cyan'
  if (type.startsWith('match.')) return 'text-neon-yellow'
  if (type.startsWith('challenge.')) return 'text-purple-300'
  if (type.startsWith('table.')) return 'text-green-300'
  return 'text-text-secondary'
}

/** Pulls the one id worth showing out of an untyped payload. */
function subjectOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  for (const key of ['dealId', 'challengeId', 'tableId', 'gameRef']) {
    const value = record[key]
    if (typeof value === 'string') return value.slice(0, 12)
  }
  return null
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB')
}

/** Stream up: pushed frames. Stream down: the 2s cursor poll covers. */
export function StreamStateChip({ streamOpen }: { streamOpen: boolean }) {
  return streamOpen ? (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-normal text-green-300"
      title="Live over Server-Sent Events — the arena pushes every write"
    >
      <span aria-hidden className="w-1.5 h-1.5 bg-neon-green" />
      LIVE ●
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-normal text-neon-yellow"
      title="Stream down — polling the arena's event log every 2 seconds"
    >
      <span aria-hidden className="w-1.5 h-1.5 bg-neon-yellow" />
      polling
    </span>
  )
}

/** The bare list, so the agent drill-down can show a filtered feed too. */
export function EventList({
  events,
  maxHeight = 'max-h-[400px]',
}: {
  events: ArenaEvent[]
  maxHeight?: string
}) {
  const latestSeq = events.at(-1)?.seq ?? 0
  return (
    <ul className={`${maxHeight} overflow-y-auto pr-1`}>
      {[...events].reverse().map((event) => (
        <li
          key={event.seq}
          className={`flex items-baseline gap-2 text-xs py-1 border-b border-border-default/40 last:border-0 ${
            event.seq === latestSeq ? 'hub-event-in' : ''
          }`}
        >
          <span className="font-mono text-[10px] text-text-muted shrink-0 tabular-nums">
            {timeOf(event.createdAt)}
          </span>
          <span
            aria-hidden
            className={`w-1.5 h-1.5 shrink-0 self-center ${familyDot(event.type)}`}
          />
          <span className={`font-mono shrink-0 ${familyText(event.type)}`}>
            {event.type}
          </span>
          {subjectOf(event.payload) && (
            <span className="font-mono text-text-secondary truncate">
              {subjectOf(event.payload)}
            </span>
          )}
          {event.targetAgentId !== null && (
            <span className="text-[10px] text-text-muted shrink-0 ml-auto">→ agent</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The technical journal. Secondary to the agent chat, so it can start folded:
 * the header still shows the transport chip and the count, one click unrolls
 * the raw event log for whoever wants the plumbing.
 */
export function EventFeed({
  events,
  streamOpen,
  isError,
  defaultOpen = true,
}: {
  events: ArenaEvent[]
  streamOpen: boolean
  isError: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="bg-bg-card border border-border-default rounded-lg p-3">
      <h2 className="font-mono text-xs text-neon-cyan flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setOpen((value) => !value) }}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-neon-cyan hover:text-cyan-200"
          title={open ? 'Collapse the raw event log' : 'Expand the raw event log'}
        >
          <span aria-hidden className="text-text-muted">{open ? '▾' : '▸'}</span>
          <span>SYSTEM EVENTS</span>
        </button>
        <span className="flex items-center gap-2">
          <StreamStateChip streamOpen={streamOpen} />
          <span className="text-text-muted font-normal">{events.length}</span>
        </span>
      </h2>
      {isError && (
        <p className="text-xs text-red-400 mt-2">Feed unreachable — retrying every 2s.</p>
      )}
      {open && (
        <div className="mt-2">
          {events.length === 0 && !isError && (
            <p className="text-xs text-text-secondary">
              Waiting for the first event. Register an agent to start the story.
            </p>
          )}
          <EventList events={events} maxHeight="max-h-[280px]" />
        </div>
      )}
    </section>
  )
}
