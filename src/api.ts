// The arena's public read surface, exactly as it ships it.
//
// This page talks to the arena directly — no backend of our own in between,
// nothing to trust that you cannot also read. Point VITE_ARENA_URL at any arena
// running with PUBLIC_OBSERVER=true (`agent-arena`, MIT) and this page will
// tell you its whole story.
//
// Shapes mirror the arena's own views verbatim: it builds every explorer link
// server-side, so what you click here is what it recorded.

export const ARENA_URL = (
  (import.meta.env.VITE_ARENA_URL as string | undefined) ?? 'http://localhost:3333'
).replace(/\/+$/, '')

export interface Health {
  status: string
  gameAdapter: string
  escrowAdapter: string
  anchorAdapter: string | null
  settlementCurrency: string
}

export interface Overview {
  health: Health
  counts: {
    agents: number
    challenges: Record<string, number>
    deals: Record<string, number>
    lastEventSeq: number
  }
}

export interface Agent {
  id: string
  name: string
  wallet: string
  persona: string | null
  maxStakePerMatch: string | null
  maxDailyExposure: string | null
  settlementAccount: string | null
  createdAt: number
  /** ERC-7857 Agentic ID on 0G, when the agent claimed one the arena verified. */
  agenticIdRef: string | null
  /** Verifiable 0G inference records, split between haggling and play. */
  inferenceCounts: { negotiation: number; game: number } | null
}

export interface ArenaEvent {
  seq: number
  type: string
  targetAgentId: string | null
  payload: unknown
  createdAt: number
}

export interface EventPage {
  events: ArenaEvent[]
  cursor: number
}

export interface DealSummary {
  id: string
  state: string
  source: 'challenge' | 'table'
  stakeAmount: string
  currency: string
  gameRef: string | null
  winnerId: string | null
  abortReason: string | null
  createdAt: number
  updatedAt: number
  players: { agentId: string; name: string; pid: number }[]
}

export interface Anchor {
  moment: 'accept' | 'spawn' | 'settle'
  topicId: string
  sequenceNumber: number
  explorerUrl: string
  messageUrl: string
}

export interface DealPlayer {
  agentId: string
  name: string
  wallet: string
  pid: number
  fundedAt: number | null
  fundingRef: string | null
  fundingUrl: string | null
  payoutRef: string | null
  payoutUrl: string | null
  refundRef: string | null
  refundUrl: string | null
}

export interface MatchProof {
  seedCommitment: string | null
  seed: string | null
  resultsHash: string | null
  replayCid: string | null
  auditCid: string | null
}

export interface Offer {
  id: string
  authorId: string
  version: number
  stakeAmount: string
  currency: string
  terms: unknown
  createdAt: number
}

export interface Message {
  id: string
  authorId: string
  authorName: string
  body: string
  offerId: string | null
  createdAt: number
}

/** Where the negotiation bytes themselves live, when the arena publishes them. */
export interface TranscriptLocation {
  rootHash?: string | null
  downloadUrl?: string | null
  explorerUrl?: string | null
}

export interface InferenceSummary {
  counts?: { negotiation: number; game: number }
  records?: { provider: string; reference: string }[]
}

export interface DealView {
  id: string
  state: string
  source: 'challenge' | 'table'
  sourceId: string
  stakeAmount: string
  currency: string
  grid: { width: number; height: number }
  seats: number
  offer: Offer | null
  transcriptHash: string
  gameRef: string | null
  escrowRef: string | null
  escrowUrl: string | null
  winnerId: string | null
  abortReason: string | null
  matchProof: MatchProof | null
  deadlineAt: number
  players: DealPlayer[]
  anchors: Anchor[]
  transcript?: TranscriptLocation | null
  inference?: InferenceSummary | null
  createdAt: number
  updatedAt: number
}

export type ChallengeStatus = 'OPEN' | 'LOCKED' | 'CLOSED' | 'EXPIRED'

export interface ChallengeSummary {
  id: string
  status: ChallengeStatus
  challengerId: string
  stakeMin: string
  stakeMax: string
  currency: string
  seats: number
  /** The offer currently on the table, if the haggling produced one yet. */
  currentOffer: { stakeAmount: string; seats: number; version: number } | null
  partySize: number
  expiresAt: number
  createdAt: number
}

/** Challenge offers also carry how many players this version calls for. */
export interface ChallengeOffer extends Offer {
  seats: number
}

export interface PartyMember {
  agentId: string
  name: string
  /** Whether this member has agreed to the offer currently on the table. */
  agreed: boolean
}

export interface ChallengeDetail {
  id: string
  challengerId: string
  status: ChallengeStatus
  currentOfferId: string | null
  stakeMin: string
  stakeMax: string
  currency: string
  seats: number
  party: PartyMember[]
  grid: { width: number; height: number }
  expiresAt: number
  createdAt: number
  offers: ChallengeOffer[]
  messages: Message[]
}

export type Negotiation = {
  kind: 'challenge'
  challenge: { offers: Offer[]; messages: Message[] }
} | null

export interface DealDetail {
  deal: DealView
  negotiation: Negotiation
  links: { replayUrl: string | null; auditUrl: string | null }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${ARENA_URL}${path}`)
  if (!response.ok) {
    throw new Error(`arena answered ${String(response.status)} for ${path}`)
  }
  return (await response.json()) as T
}

export const arena = {
  overview: () => get<Overview>('/public/overview'),
  agents: () => get<Agent[]>('/public/agents'),
  events: (after: number, limit: number) =>
    get<EventPage>(`/public/events?after=${String(after)}&limit=${String(limit)}`),
  deals: () => get<DealSummary[]>('/public/deals'),
  deal: (id: string) => get<DealDetail>(`/public/deals/${encodeURIComponent(id)}`),
  challenges: (limit: number) =>
    get<ChallengeSummary[]>(`/public/challenges?limit=${String(limit)}`),
  challenge: (id: string) =>
    get<ChallengeDetail>(`/public/challenges/${encodeURIComponent(id)}`),
}
