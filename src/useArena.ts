import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { arena, type ArenaEvent, type DealDetail, type DealSummary } from './api'

// Poll cadences: the feed and the deals carry the story, so they poll fast;
// the overview and the roster change rarely. A cursor poll is all this needs —
// the page has no backend of its own to hold a socket open, which is exactly
// what makes it something you can host anywhere and check against the arena.

const FEED_LIMIT = 100
/** Ring buffer bound so an hours-old dashboard doesn't grow without limit. */
const FEED_KEEP = 300

const TERMINAL_STATES = new Set(['SETTLED', 'ABORTED'])

export function useOverview() {
  return useQuery({
    queryKey: ['arena', 'overview'],
    queryFn: () => arena.overview(),
    refetchInterval: 10_000,
  })
}

export function useAgents() {
  return useQuery({
    queryKey: ['arena', 'agents'],
    queryFn: () => arena.agents(),
    refetchInterval: 30_000,
  })
}

export function useDeals() {
  return useQuery({
    queryKey: ['arena', 'deals'],
    queryFn: () => arena.deals(),
    refetchInterval: 3_000,
  })
}

export function useDealDetail(id: string | null) {
  return useQuery<DealDetail>({
    queryKey: ['arena', 'deal', id],
    queryFn: () => {
      if (id === null) throw new Error('no deal selected')
      return arena.deal(id)
    },
    enabled: id !== null,
    // Terminal deals are immutable; live ones move every couple of seconds.
    refetchInterval: (query) =>
      query.state.data && TERMINAL_STATES.has(query.state.data.deal.state)
        ? false
        : 2_000,
  })
}

/**
 * The live feed over the arena's append-only event log.
 *
 * Primary transport is the SSE bridge (`/admin/arena-demo/stream`) — pushed,
 * ticket-authenticated, auto-reconnecting. While the stream is not open (no
 * backend stream, mock mode, reconnect gaps) a 2s cursor poll covers for it;
 * both paths append through one dedupe-by-seq accumulator so overlap and
 * replays are harmless. `after=0` on first connect deliberately replays
 * history: the dashboard backfills the whole story instead of starting blind.
 *
 * The stream also drives freshness: any deal/match event invalidates the
 * deals list and the open drill-down, so state flips render within a second
 * of the arena writing them.
 */
export function useEventFeed(): { events: ArenaEvent[]; isError: boolean } {
  const [events, setEvents] = useState<ArenaEvent[]>([])
  const lastSeq = useRef(0)
  const queryClient = useQueryClient()

  const append = useCallback(
    (incoming: ArenaEvent[]) => {
      const fresh = incoming.filter((event) => event.seq > lastSeq.current)
      if (fresh.length === 0) return
      lastSeq.current = fresh.at(-1)?.seq ?? lastSeq.current
      setEvents((previous) => [...previous, ...fresh].slice(-FEED_KEEP))
      if (
        fresh.some(
          (event) =>
            event.type.startsWith('deal.') ||
            event.type.startsWith('match.') ||
            event.type.startsWith('table.'),
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['arena', 'deals'] })
        void queryClient.invalidateQueries({ queryKey: ['arena', 'deal'] })
      }
    },
    [queryClient],
  )

  const { isError } = useQuery({
    queryKey: ['arena', 'events'],
    refetchInterval: 2_000,
    queryFn: async () => {
      const page = await arena.events(lastSeq.current, FEED_LIMIT)
      append(page.events)
      return page
    },
  })

  return { events, isError }
}

/**
 * Which deal the drill-down shows. Auto-selects the most recent live deal
 * (else the most recent one) until the operator clicks a specific deal; a
 * click pins the choice and polling never steals the selection back.
 */
export function useSelectedDeal(deals: DealSummary[] | undefined): {
  selectedId: string | null
  select: (id: string) => void
} {
  const [pinned, setPinned] = useState<string | null>(null)
  if (pinned !== null) return { selectedId: pinned, select: setPinned }
  const live = deals?.find((deal) => !TERMINAL_STATES.has(deal.state))
  return { selectedId: live?.id ?? deals?.[0]?.id ?? null, select: setPinned }
}
