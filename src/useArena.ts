import { useCallback, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  arena,
  type ArenaEvent,
  type ChallengeDetail,
  type ChallengeSummary,
  type DealDetail,
} from './api'
import { useArenaStream } from './useStream'

// SSE-first data layer. The stream carries the story; every list and
// drill-down below polls only while the stream is down. When it is up, an
// incoming event invalidates exactly the caches it touches (the payload
// names its challenge or deal), so a fresh fetch lands within a render of
// the arena writing — and an idle page costs the arena nothing.
//
// The page still has no backend of its own: both transports read the same
// public journal, and both feed one dedupe-by-seq accumulator, so overlap
// between a reconnecting stream and a covering poll is harmless.

const FEED_LIMIT = 100
/** Ring buffer bound so an hours-old dashboard doesn't grow without limit. */
const FEED_KEEP = 300
const CHALLENGE_LIMIT = 25

const TERMINAL_STATES = new Set(['SETTLED', 'ABORTED'])
const TERMINAL_CHALLENGE = new Set(['CLOSED', 'EXPIRED'])

export function useOverview() {
  return useQuery({
    queryKey: ['arena', 'overview'],
    queryFn: () => arena.overview(),
    refetchInterval: 10_000,
  })
}

export function useAgents(streaming: boolean) {
  return useQuery({
    queryKey: ['arena', 'agents'],
    queryFn: () => arena.agents(),
    refetchInterval: streaming ? false : 30_000,
  })
}

export function useDeals(streaming: boolean) {
  return useQuery({
    queryKey: ['arena', 'deals'],
    queryFn: () => arena.deals(),
    refetchInterval: streaming ? false : 3_000,
  })
}

export function useChallenges(streaming: boolean) {
  return useQuery({
    queryKey: ['arena', 'challenges'],
    queryFn: () => arena.challenges(CHALLENGE_LIMIT),
    refetchInterval: streaming ? false : 3_000,
  })
}

export function useDealDetail(id: string | null, streaming: boolean) {
  return useQuery<DealDetail>({
    queryKey: ['arena', 'deal', id],
    queryFn: () => {
      if (id === null) throw new Error('no deal selected')
      return arena.deal(id)
    },
    enabled: id !== null,
    // Terminal deals are immutable; live ones move every couple of seconds
    // when the stream is not there to push them.
    refetchInterval: (query) =>
      streaming ||
      (query.state.data && TERMINAL_STATES.has(query.state.data.deal.state))
        ? false
        : 2_000,
  })
}

/**
 * Several deals at once, on the same cache keys as `useDealDetail` — the proof
 * page needs the receipts of more than one bet, and a deal already open in a
 * drill-in is never fetched twice for being read in two places.
 */
export function useDealDetails(ids: string[], streaming: boolean): DealDetail[] {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['arena', 'deal', id],
      queryFn: () => arena.deal(id),
      refetchInterval: (query: { state: { data?: DealDetail | undefined } }) =>
        streaming ||
        (query.state.data && TERMINAL_STATES.has(query.state.data.deal.state))
          ? (false as const)
          : 2_000,
    })),
    combine: (results) =>
      results.flatMap((result) => (result.data ? [result.data] : [])),
  })
}

/** Poll a challenge only while it can still move and the stream is down. */
function challengeRefetch(streaming: boolean) {
  return (query: { state: { data?: ChallengeDetail | undefined } }): number | false =>
    streaming ||
    (query.state.data && TERMINAL_CHALLENGE.has(query.state.data.status))
      ? false
      : 2_000
}

export function useChallengeDetail(id: string | null, streaming: boolean) {
  return useQuery<ChallengeDetail>({
    queryKey: ['arena', 'challenge', id],
    queryFn: () => {
      if (id === null) throw new Error('no challenge selected')
      return arena.challenge(id)
    },
    enabled: id !== null,
    refetchInterval: challengeRefetch(streaming),
  })
}

/**
 * The details behind several challenges at once — the global chat merges
 * their threads. Keys are the exact ones the stream invalidates on
 * `challenge.message` events, and the selected challenge shares its entry,
 * so no message is ever fetched twice for being read in two places.
 */
export function useChallengeDetails(
  ids: string[],
  streaming: boolean,
): ChallengeDetail[] {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['arena', 'challenge', id],
      queryFn: () => arena.challenge(id),
      refetchInterval: challengeRefetch(streaming),
    })),
    combine: (results) =>
      results.flatMap((result) => (result.data ? [result.data] : [])),
  })
}

/** The ~10 challenges the global chat follows: most recently created first. */
export function chatChallengeIds(
  challenges: ChallengeSummary[] | undefined,
): string[] {
  return [...(challenges ?? [])]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((challenge) => challenge.id)
}

function idsOf(payload: unknown): { challengeId?: string; dealId?: string } {
  if (typeof payload !== 'object' || payload === null) return {}
  const record = payload as Record<string, unknown>
  return {
    ...(typeof record.challengeId === 'string'
      ? { challengeId: record.challengeId }
      : {}),
    ...(typeof record.dealId === 'string' ? { dealId: record.dealId } : {}),
  }
}

/**
 * The live feed over the arena's append-only event log.
 *
 * Primary transport is `/public/stream` (SSE); while it is not open — arena
 * without the endpoint yet, reconnect gaps — a 2s cursor poll covers for it.
 * `after=0` on first contact deliberately replays history on either path, so
 * the dashboard backfills the whole story instead of starting blind.
 *
 * The feed also drives freshness for everything else: each event invalidates
 * the list its family belongs to and the drill-down its payload names.
 */
export function useEventFeed(): {
  events: ArenaEvent[]
  streamOpen: boolean
  isError: boolean
} {
  const [events, setEvents] = useState<ArenaEvent[]>([])
  const lastSeq = useRef(0)
  const queryClient = useQueryClient()

  const append = useCallback(
    (incoming: ArenaEvent[]) => {
      const fresh = incoming.filter((event) => event.seq > lastSeq.current)
      if (fresh.length === 0) return
      lastSeq.current = fresh.at(-1)?.seq ?? lastSeq.current
      setEvents((previous) => [...previous, ...fresh].slice(-FEED_KEEP))

      const invalidate = (key: (string | null)[]) =>
        void queryClient.invalidateQueries({ queryKey: key })
      for (const event of fresh) {
        const { challengeId, dealId } = idsOf(event.payload)
        // The haggling side: board + the thread the event belongs to.
        if (
          event.type.startsWith('challenge.') ||
          event.type.startsWith('message.') ||
          event.type.startsWith('offer.')
        ) {
          invalidate(['arena', 'challenges'])
          if (challengeId !== undefined) invalidate(['arena', 'challenge', challengeId])
        }
        // The deal side — which also closes challenges, so both lists move.
        if (
          event.type.startsWith('deal.') ||
          event.type.startsWith('match.') ||
          event.type.startsWith('table.')
        ) {
          invalidate(['arena', 'deals'])
          invalidate(dealId === undefined ? ['arena', 'deal'] : ['arena', 'deal', dealId])
          invalidate(['arena', 'challenges'])
          if (challengeId !== undefined) invalidate(['arena', 'challenge', challengeId])
        }
        if (event.type.startsWith('agent.')) invalidate(['arena', 'agents'])
      }
    },
    [queryClient],
  )

  const streamOpen = useArenaStream(
    useCallback((event: ArenaEvent) => { append([event]) }, [append]),
  )

  const { isError } = useQuery({
    queryKey: ['arena', 'events'],
    enabled: !streamOpen,
    refetchInterval: 2_000,
    queryFn: async () => {
      const page = await arena.events(lastSeq.current, FEED_LIMIT)
      append(page.events)
      return page
    },
  })

  return { events, streamOpen, isError: !streamOpen && isError }
}

// The selection hook this file used to export is gone: the URL is the
// selection now. Its auto-pick rule — the most recent live deal, else the most
// recent one — lives on in `/story`, which is the only screen that still has to
// choose a bet for you.

/** Whether an event involves an agent: addressed to it, or naming it. */
export function eventInvolves(event: ArenaEvent, agentId: string): boolean {
  if (event.targetAgentId === agentId) return true
  if (typeof event.payload !== 'object' || event.payload === null) return false
  return JSON.stringify(event.payload).includes(agentId)
}
