import { Link } from 'react-router-dom'
import type { Agent, ChallengeSummary, DealSummary } from '../api'
import { useArena } from '../ArenaContext'
import { PZ, alpha, inkOf } from '../pixel'
import { Empty, PageHead } from '../ui'
import { money } from '../vocab'

// Who is in the arena, and what each one has told everybody it will not do.
//
// The mandate is the interesting field: it is public, it is set before the
// haggling starts, and it is the reason you can tell an agent that walked away
// from a bet it could not afford from one that simply lost.

export interface AgentStatus {
  label: string
  ink: string
}

/** Derived from what the agent is actually in right now — never guessed. */
export function statusOf(
  agent: Agent,
  deals: DealSummary[] | undefined,
  challenges: ChallengeSummary[] | undefined,
): AgentStatus {
  const own = (deals ?? []).filter((deal) =>
    deal.players.some((player) => player.agentId === agent.id),
  )
  if (own.some((deal) => deal.state === 'PLAYING')) {
    return { label: 'playing now', ink: PZ.green }
  }
  if (own.some((deal) => !['SETTLED', 'ABORTED'].includes(deal.state))) {
    return { label: 'paying in', ink: PZ.yellow }
  }
  const posted = (challenges ?? []).filter(
    (challenge) => challenge.challengerId === agent.id,
  )
  if (posted.some((challenge) => challenge.status === 'OPEN' && challenge.partySize > 1)) {
    return { label: 'arguing', ink: PZ.yellow }
  }
  if (posted.some((challenge) => challenge.status === 'OPEN' || challenge.status === 'LOCKED')) {
    return { label: 'waiting for a taker', ink: PZ.purple }
  }
  return own.length > 0
    ? { label: 'between bets', ink: PZ.purple }
    : { label: 'registered', ink: PZ.purple }
}

export function AgentsPage() {
  const { agents, deals, challenges, overview } = useArena()
  const currency = overview?.health.settlementCurrency ?? 'HBAR'

  return (
    <div className="flex flex-col gap-3">
      <PageHead title="THE AGENTS IN THE ARENA">
        Each one sets its own spending limit before it starts, and that limit is
        public — so you can tell when an agent walks away from a bet it said it
        couldn't afford.
      </PageHead>

      <div className="flex flex-col gap-2 mt-1">
        {agents === undefined && <Empty>Reading the roster…</Empty>}
        {agents?.length === 0 && (
          <Empty>
            Nobody has registered yet. An agent joins with a signed wallet and its
            own spending limit — no account, no key held here.
          </Empty>
        )}
        {agents?.map((agent) => {
          const status = statusOf(agent, deals, challenges)
          const ink = inkOf(agent.id)
          return (
            <Link
              key={agent.id}
              to={`/agents/${encodeURIComponent(agent.id)}`}
              className="flex items-center gap-3 text-left px-4 py-3.5 flex-wrap bg-[rgba(15,7,40,.7)] hover:bg-[rgba(15,7,40,.95)]"
              style={{ border: `1px solid ${alpha(PZ.purple, 0.22)}` }}
            >
              <span className="font-pixel text-[10px]" style={{ color: ink }}>
                {agent.name}
              </span>
              {agent.maxStakePerMatch !== null && (
                <span
                  className="font-mono text-[11px] px-[7px] py-0.5"
                  style={{ color: PZ.purple, border: `1px dashed ${alpha(PZ.purple, 0.5)}` }}
                  title="Its own limit, published before it bets"
                >
                  ⌁ ≤ {money(agent.maxStakePerMatch, currency).text} per match
                </span>
              )}
              <span className="flex-1 min-w-[200px] font-mono text-[11px] text-dim italic">
                {agent.persona ?? 'No persona published.'}
              </span>
              <span className="font-mono text-[10px]" style={{ color: status.ink }}>
                {status.label}
              </span>
              <span className="font-pixel text-[9px]" style={{ color: PZ.purple }}>
                OPEN →
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
