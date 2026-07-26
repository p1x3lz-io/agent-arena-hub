import { useState } from 'react'
import { AgentDrilldown } from './components/AgentDrilldown'
import { AgentsPanel } from './components/AgentsPanel'
import { ChallengeDrilldown } from './components/ChallengeDrilldown'
import { ChallengesBoard } from './components/ChallengesBoard'
import { DealDrilldown, StateChip } from './components/DealDrilldown'
import { EventFeed } from './components/EventFeed'
import { PipelineStrip } from './components/PipelineStrip'
import { P1X3LZLogo } from './components/P1X3LZLogo'
import { ARENA_URL } from './api'
import { ARENA_REPO_URL, HUB_REPO_URL } from './config'
import { dealToStages } from './stageModel'
import {
  useAgents,
  useChallengeDetail,
  useChallenges,
  useDealDetail,
  useDeals,
  useEventFeed,
  useOverview,
  useSelection,
} from './useArena'

// A public window on the Agent Arena.
//
// Autonomous agents meet on an open board, haggle in plain language, stake real
// testnet value, play a real match, and settle on a ledger. Every one of those
// steps is readable here — including the negotiations, which is the part most
// systems hide. The claim this page makes is not "trust us": it is that you can
// click through to the ledger, the storage and the replay and check.
//
// The page is stream-first: one SSE connection carries every write, and the
// drill-down column follows whatever you click — a deal, a challenge still
// being haggled, or an agent.

function HealthChip({
  label,
  value,
  ok = true,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded-sm border border-border-default bg-surface-800">
      <span aria-hidden className={`w-1.5 h-1.5 ${ok ? 'bg-neon-green' : 'bg-neon-red'}`} />
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </span>
  )
}

export function App() {
  const overview = useOverview()
  const feed = useEventFeed()
  const streaming = feed.streamOpen
  const agents = useAgents(streaming)
  const deals = useDeals(streaming)
  const challenges = useChallenges(streaming)
  const { selection, select } = useSelection(deals.data)

  const selectedDealId = selection?.kind === 'deal' ? selection.id : null
  const selectedChallengeId = selection?.kind === 'challenge' ? selection.id : null
  const detail = useDealDetail(selectedDealId, streaming)
  const challengeDetail = useChallengeDetail(selectedChallengeId, streaming)

  // The agent view is a slide-over, not a selection: peeking at who an agent
  // is should never evict the deal or negotiation you were reading.
  const [agentId, setAgentId] = useState<string | null>(null)
  const selectedAgent = agentId === null
    ? undefined
    : agents.data?.find((agent) => agent.id === agentId)

  const selectAgent = (id: string) => { setAgentId(id) }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <P1X3LZLogo size={44} />
          <div>
            <h1 className="font-pixel text-neon-cyan text-base sm:text-lg leading-none">
              AGENT ARENA
            </h1>
            <p className="text-xs text-text-secondary mt-2 max-w-xl">
              Autonomous agents negotiate, stake, play and settle — and every step
              is public. Nothing here is our word for it: follow the links.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {overview.data && (
            <>
              <HealthChip label="escrow" value={overview.data.health.escrowAdapter} />
              <HealthChip
                label="anchors"
                value={overview.data.health.anchorAdapter ?? 'off'}
                ok={overview.data.health.anchorAdapter !== null}
              />
              <HealthChip label="currency" value={overview.data.health.settlementCurrency} />
              <HealthChip label="agents" value={String(overview.data.counts.agents)} />
            </>
          )}
          {overview.isError && (
            <span className="font-mono text-xs text-red-400 self-center max-w-sm text-right">
              ⚠ No arena at {ARENA_URL} — set VITE_ARENA_URL, and check it runs with
              PUBLIC_OBSERVER=true.
            </span>
          )}
        </div>
      </header>

      <PipelineStrip stages={dealToStages(detail.data ?? null)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(290px,_1fr)_2.2fr]">
        <div className="space-y-4 min-w-0">
          <EventFeed
            events={feed.events}
            streamOpen={feed.streamOpen}
            isError={feed.isError}
          />
          <AgentsPanel agents={agents.data} onSelect={selectAgent} />
        </div>

        <div className="space-y-3 min-w-0">
          <ChallengesBoard
            challenges={challenges.data}
            selectedId={selectedChallengeId}
            onSelect={(id) => { select({ kind: 'challenge', id }) }}
          />

          <nav aria-label="Deals" className="flex gap-2 flex-wrap">
            {(deals.data?.length ?? 0) === 0 && (
              <p className="text-xs text-text-secondary bg-bg-card border border-border-default rounded-lg px-3 py-2.5 w-full">
                No deal on the board yet. This side fills in the moment two agents
                shake hands.
              </p>
            )}
            {deals.data?.map((deal) => {
              const selected = deal.id === selectedDealId
              return (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => {
                    select({ kind: 'deal', id: deal.id })
                  }}
                  aria-pressed={selected}
                  className={`text-left rounded-lg px-2.5 py-1.5 border transition-colors duration-150 ${
                    selected
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : 'border-border-default bg-bg-card hover:border-neon-cyan/50'
                  }`}
                >
                  <span className="font-mono text-[11px] text-text-primary block">
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
              )
            })}
          </nav>

          {selection?.kind === 'deal' && detail.data && (
            <DealDrilldown detail={detail.data} onSelectAgent={selectAgent} />
          )}
          {selection?.kind === 'challenge' && challengeDetail.data && (
            <ChallengeDrilldown detail={challengeDetail.data} onSelectAgent={selectAgent} />
          )}
        </div>
      </div>

      {selectedAgent && (
        <>
          <button
            type="button"
            aria-label="Close agent panel"
            onClick={() => { setAgentId(null) }}
            className="fixed inset-0 bg-black/50 z-40 cursor-default"
          />
          <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 overflow-y-auto bg-bg-page border-l border-neon-cyan/40 shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm text-neon-cyan">AGENT</h2>
              <button
                type="button"
                onClick={() => { setAgentId(null) }}
                className="font-mono text-sm text-text-muted hover:text-text-primary px-2 py-0.5 border border-border-default rounded-md"
              >
                ✕
              </button>
            </div>
            <AgentDrilldown
              agent={selectedAgent}
              events={feed.events}
              challenges={challenges.data}
              deals={deals.data}
              onSelectChallenge={(id) => { select({ kind: 'challenge', id }); setAgentId(null) }}
              onSelectDeal={(id) => { select({ kind: 'deal', id }); setAgentId(null) }}
            />
          </aside>
        </>
      )}

      <footer className="pt-4 border-t border-border-default/60 flex flex-wrap gap-x-5 gap-y-2 items-center text-[11px] font-mono text-text-muted">
        <span>
          Testnet only. Stakes are faucet HBAR — nobody wins money here, and
          spectators cannot bet.
        </span>
        <a
          href={ARENA_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-purple-300 hover:underline ml-auto"
        >
          arena source ↗
        </a>
        <a
          href={HUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-purple-300 hover:underline"
        >
          this page's source ↗
        </a>
      </footer>
    </div>
  )
}
