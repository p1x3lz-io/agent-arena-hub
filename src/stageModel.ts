import type { DealDetail } from './api'

// Pure derivation of the pipeline strip from a deal drill-down. Kept free of
// React so every state (including ABORTED mid-pipeline) is unit-testable
// without mounting anything.

export type StageStatus = 'done' | 'active' | 'pending' | 'failed'

export interface StageBadge {
  label: string
  href: string
}

export interface Stage {
  key: string
  /** English, judge-facing. */
  title: string
  status: StageStatus
  /** One-line explanation of what this stage proves, shown under the title. */
  detail: string
  badges: StageBadge[]
  /** Set on the stage a dead deal died in. */
  failureReason?: string
}

const ORDER = [
  'ACCEPTED',
  'FUNDED',
  'SPAWNING',
  'PLAYING',
  'SETTLING',
  'SETTLED',
] as const

function rankOf(state: string): number {
  const index = (ORDER as readonly string[]).indexOf(state)
  return index === -1 ? -1 : index
}

function anchorBadge(
  detail: DealDetail,
  moment: 'accept' | 'spawn' | 'settle',
): StageBadge[] {
  const anchor = detail.deal.anchors.find((entry) => entry.moment === moment)
  return anchor ? [{ label: `HCS ⚓ ${moment}`, href: anchor.explorerUrl }] : []
}

function shorten(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}

/**
 * The end-to-end story as nine stages. A deal's existence already proves the
 * first three happened (agents registered, found each other, and negotiated
 * to an acceptance), so those light up as done on any selected deal; the rest
 * follow the deal state machine, and an aborted deal paints the stage it died
 * in red instead of pretending the pipeline is linear-only.
 */
export function dealToStages(detail: DealDetail | null): Stage[] {
  if (!detail) return emptyPipeline()
  const { deal } = detail
  const rank = rankOf(deal.state)
  const dead = deal.state === 'ABORTED' || deal.state === 'ABORTING'
  const funded = deal.players.length > 0 && deal.players.every((p) => p.fundedAt !== null)

  const stages: Stage[] = [
    {
      key: 'register',
      title: 'Register',
      status: 'done',
      detail: `${String(deal.players.length)} agents, EIP-191 signed identity`,
      badges: [],
    },
    {
      key: 'discover',
      title: 'Discover',
      status: 'done',
      detail: deal.source === 'challenge' ? 'Open challenge board' : 'Open table',
      badges: [],
    },
    {
      key: 'negotiate',
      title: 'Negotiate',
      status: 'done',
      detail: negotiationDetail(detail),
      badges: [],
    },
    {
      key: 'accept',
      title: 'Accept',
      status: 'done',
      detail: `Transcript sha256 ${shorten(deal.transcriptHash)}`,
      badges: anchorBadge(detail, 'accept'),
    },
    {
      key: 'fund',
      title: 'Fund',
      status: funded ? 'done' : rank === 0 ? 'active' : 'pending',
      detail: `${deal.stakeAmount} ${deal.currency} per seat, agent-signed`,
      badges: deal.players
        .filter((p) => p.fundingUrl !== null)
        .map((p) => ({ label: `${p.name} tx`, href: p.fundingUrl ?? '' })),
    },
    {
      key: 'spawn',
      title: 'Spawn',
      status:
        deal.gameRef !== null ? 'done' : rank >= 1 && rank <= 2 ? 'active' : 'pending',
      detail: deal.matchProof?.seedCommitment
        ? `Seed committed: ${shorten(deal.matchProof.seedCommitment)}`
        : 'Seed committed before the match',
      badges: anchorBadge(detail, 'spawn'),
    },
    {
      key: 'play',
      title: 'Play',
      status: rank === 3 ? 'active' : rank > 3 ? 'done' : 'pending',
      detail: 'Live match, one LLM decision per turn',
      badges:
        deal.gameRef !== null
          ? [{ label: 'Spectate', href: `/spectate/${deal.gameRef}` }]
          : [],
    },
    {
      key: 'settle',
      title: 'Settle',
      status: rank === 4 ? 'active' : rank === 5 ? 'done' : 'pending',
      detail: deal.winnerId !== null ? 'Winner paid from escrow' : 'Escrow payout',
      badges: [
        ...deal.players
          .filter((p) => p.payoutUrl !== null)
          .map((p) => ({ label: `${p.name} payout`, href: p.payoutUrl ?? '' })),
        ...deal.players
          .filter((p) => p.refundUrl !== null)
          .map((p) => ({ label: `${p.name} refund`, href: p.refundUrl ?? '' })),
        ...anchorBadge(detail, 'settle'),
      ],
    },
    {
      key: 'verify',
      title: 'Verify',
      status: deal.matchProof !== null ? 'done' : 'pending',
      detail: 'Anyone can check the seed, results and replay',
      badges: [
        ...(detail.links.replayUrl
          ? [{ label: 'Replay (IPFS)', href: detail.links.replayUrl }]
          : []),
        ...(detail.links.auditUrl
          ? [{ label: 'LLM audit (IPFS)', href: detail.links.auditUrl }]
          : []),
      ],
    },
  ]

  if (dead) return markFailure(stages, deal.abortReason)
  return stages
}

function negotiationDetail(detail: DealDetail): string {
  if (detail.negotiation?.kind === 'challenge') {
    const { offers, messages } = detail.negotiation.challenge
    return `${String(messages.length)} messages, ${String(offers.length)} offers`
  }
  return 'Natural-language haggling'
}

/** The first stage that had not finished is where an aborted deal died. */
function markFailure(stages: Stage[], reason: string | null): Stage[] {
  const index = stages.findIndex((stage) => stage.status !== 'done')
  return stages.map((stage, at) => {
    if (at < index || index === -1) return stage
    if (at === index) {
      return {
        ...stage,
        status: 'failed' as const,
        ...(reason === null ? {} : { failureReason: reason }),
      }
    }
    return { ...stage, status: 'pending' as const }
  })
}

/** No deal selected yet: the strip still teaches the pipeline's shape. */
function emptyPipeline(): Stage[] {
  const titles: [string, string, string][] = [
    ['register', 'Register', 'Agents sign in over MCP'],
    ['discover', 'Discover', 'Board & tables'],
    ['negotiate', 'Negotiate', 'Natural-language haggling'],
    ['accept', 'Accept', 'Transcript hashed'],
    ['fund', 'Fund', 'Agents pay the escrow'],
    ['spawn', 'Spawn', 'Seed committed, pod starts'],
    ['play', 'Play', 'One LLM decision per turn'],
    ['settle', 'Settle', 'Winner paid on-ledger'],
    ['verify', 'Verify', 'Proofs & replay'],
  ]
  return titles.map(([key, title, detail]) => ({
    key,
    title,
    status: 'pending' as const,
    detail,
    badges: [],
  }))
}
