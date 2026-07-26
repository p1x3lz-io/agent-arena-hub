import { createContext, use, useMemo, type ReactNode } from 'react'
import type { Agent, ArenaEvent, ChallengeSummary, DealSummary, Overview } from './api'
import {
  useAgents,
  useChallenges,
  useDeals,
  useEventFeed,
  useOverview,
} from './useArena'
import { toBets, type Bet } from './vocab'

// One live connection for the whole site.
//
// Every page here is a live page — the board, the story, the chat, the roster,
// the proof page. They all read the same SSE stream, opened exactly once above
// the router: an event lands, it invalidates the caches it names, and whichever
// page is mounted re-renders within a frame. Navigating between them never
// reconnects and never replays history a second time.
//
// When the stream is not there (an arena without the endpoint, a reconnect
// gap), `streaming` goes false and every list falls back to its 2–3s poll on
// its own. Nothing above this line has to know which transport is carrying it.

interface ArenaState {
  overview: Overview | undefined
  overviewError: boolean
  agents: Agent[] | undefined
  deals: DealSummary[] | undefined
  challenges: ChallengeSummary[] | undefined
  /** Deals and negotiations as one board, newest first. */
  bets: Bet[]
  events: ArenaEvent[]
  /** True while the SSE stream is open; false means the page is polling. */
  streaming: boolean
  feedError: boolean
  nameOf: (agentId: string) => string | null
}

const ArenaCtx = createContext<ArenaState | null>(null)

export function ArenaProvider({ children }: { children: ReactNode }) {
  const feed = useEventFeed()
  const streaming = feed.streamOpen
  const overview = useOverview()
  const agents = useAgents(streaming)
  const deals = useDeals(streaming)
  const challenges = useChallenges(streaming)

  const nameById = useMemo(
    () => new Map((agents.data ?? []).map((agent) => [agent.id, agent.name])),
    [agents.data],
  )
  const nameOf = useMemo(
    () => (agentId: string): string | null => nameById.get(agentId) ?? null,
    [nameById],
  )

  const bets = useMemo(
    () => toBets(deals.data, challenges.data, nameOf),
    [deals.data, challenges.data, nameOf],
  )

  const value = useMemo<ArenaState>(
    () => ({
      overview: overview.data,
      overviewError: overview.isError,
      agents: agents.data,
      deals: deals.data,
      challenges: challenges.data,
      bets,
      events: feed.events,
      streaming,
      feedError: feed.isError,
      nameOf,
    }),
    [
      overview.data,
      overview.isError,
      agents.data,
      deals.data,
      challenges.data,
      bets,
      feed.events,
      feed.isError,
      streaming,
      nameOf,
    ],
  )

  return <ArenaCtx value={value}>{children}</ArenaCtx>
}

export function useArena(): ArenaState {
  const value = use(ArenaCtx)
  if (value === null) throw new Error('useArena used outside ArenaProvider')
  return value
}
