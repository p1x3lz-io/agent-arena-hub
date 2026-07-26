import type { Agent, ArenaEvent, ChallengeSummary, DealSummary } from '../api'
import { agentColorOf } from '../colors'
import { eventInvolves } from '../useArena'
import { Section, StateChip } from './DealDrilldown'
import { EventList } from './EventFeed'

// One agent, in focus: its identity and mandate, the slice of the live feed
// that involves it, and every challenge and deal it is part of — each a way
// back into the matching drill-down. The feed filter is honest about its
// method: addressed events match by target, the rest by the payload naming
// the agent's id.

function shorten(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-mono text-[11px]">
      <span className="text-text-muted">{label} </span>
      <span className="text-text-primary break-all">{value}</span>
    </p>
  )
}

export function AgentDrilldown({
  agent,
  events,
  challenges,
  deals,
  onSelectChallenge,
  onSelectDeal,
}: {
  agent: Agent
  events: ArenaEvent[]
  challenges: ChallengeSummary[] | undefined
  deals: DealSummary[] | undefined
  onSelectChallenge: (id: string) => void
  onSelectDeal: (id: string) => void
}) {
  const color = agentColorOf(agent.id)
  const involved = events.filter((event) => eventInvolves(event, agent.id))
  const ownChallenges = (challenges ?? []).filter(
    (challenge) => challenge.challengerId === agent.id,
  )
  const ownDeals = (deals ?? []).filter((deal) =>
    deal.players.some((player) => player.agentId === agent.id),
  )

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2.5 flex-wrap bg-surface-800 border border-border-default rounded-lg px-3 py-2.5">
        <h2 className={`font-mono text-sm font-bold ${color}`}>{agent.name}</h2>
        <span className="font-mono text-[10px] text-text-muted">{shorten(agent.wallet)}</span>
        {agent.maxStakePerMatch !== null && (
          <span
            className="font-mono text-xs text-neon-yellow"
            title="Mandate: max stake per match"
          >
            ≤ {agent.maxStakePerMatch}/match
          </span>
        )}
        <span className="font-mono text-[10px] text-text-muted ml-auto" title="Agent id">
          {shorten(agent.id)}
        </span>
      </header>

      <Section title="IDENTITY — who this agent says it is">
        {agent.persona !== null && (
          <p className="text-xs text-text-secondary italic mb-1.5">{agent.persona}</p>
        )}
        <Fact label="wallet" value={agent.wallet} />
        {agent.settlementAccount !== null && (
          <Fact label="settles to" value={agent.settlementAccount} />
        )}
        {agent.maxDailyExposure !== null && (
          <Fact label="daily cap" value={agent.maxDailyExposure} />
        )}
        {agent.agenticIdRef !== null && (
          <Fact label="ERC-7857" value={agent.agenticIdRef} />
        )}
        {agent.inferenceCounts !== null && (
          <Fact
            label="0G proofs"
            value={`${String(agent.inferenceCounts.negotiation)} haggling + ${String(agent.inferenceCounts.game)} play`}
          />
        )}
      </Section>

      <Section title={`LIVE FEED — events involving ${agent.name}`}>
        {involved.length === 0 && (
          <p className="text-xs text-text-secondary">
            Nothing yet in the current window. Events land here live as this
            agent acts or is acted on.
          </p>
        )}
        <EventList events={involved} maxHeight="max-h-64" />
      </Section>

      {(ownChallenges.length > 0 || ownDeals.length > 0) && (
        <Section title="IN PLAY — this agent's challenges & deals">
          <div className="flex gap-2 flex-wrap">
            {ownChallenges.map((challenge) => (
              <button
                key={challenge.id}
                type="button"
                onClick={() => { onSelectChallenge(challenge.id) }}
                className="text-left rounded-lg px-2.5 py-1.5 border border-border-default bg-surface-800 hover:border-violet/60 transition-colors duration-150"
              >
                <span className="font-mono text-[10px] text-purple-300 block">
                  challenge {challenge.id.slice(0, 10)}
                </span>
                <span className="flex items-center gap-1.5 mt-1">
                  <StateChip state={challenge.status} />
                  <span className="font-mono text-[10px] text-neon-yellow">
                    {challenge.stakeMin}–{challenge.stakeMax} {challenge.currency}
                  </span>
                </span>
              </button>
            ))}
            {ownDeals.map((deal) => (
              <button
                key={deal.id}
                type="button"
                onClick={() => { onSelectDeal(deal.id) }}
                className="text-left rounded-lg px-2.5 py-1.5 border border-border-default bg-surface-800 hover:border-neon-cyan/50 transition-colors duration-150"
              >
                <span className="font-mono text-[10px] text-neon-cyan block">
                  {deal.players.map((player) => player.name).join(' vs ') ||
                    deal.id.slice(0, 10)}
                </span>
                <span className="flex items-center gap-1.5 mt-1">
                  <StateChip state={deal.state} />
                  <span className="font-mono text-[10px] text-neon-yellow">
                    {deal.stakeAmount} {deal.currency}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
