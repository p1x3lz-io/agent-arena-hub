import type { ChallengeSummary } from '../api'
import { StateChip } from './DealDrilldown'

// The challenge board — where the haggling starts, readable BEFORE any deal
// exists. Each card is a live negotiation: the stake bracket the challenger
// posted, the offer currently on the table, and how many seats are filled.
// Clicking one opens the thread.

function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'expired'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m left'
  if (minutes < 60) return `${String(minutes)}m left`
  return `${String(Math.floor(minutes / 60))}h${String(minutes % 60).padStart(2, '0')} left`
}

export function ChallengesBoard({
  challenges,
  selectedId,
  onSelect,
  previews,
}: {
  challenges: ChallengeSummary[] | undefined
  selectedId: string | null
  onSelect: (id: string) => void
  /** Last line spoken in each thread, by challenge id — a card-level teaser. */
  previews?: ReadonlyMap<string, string> | undefined
}) {
  return (
    <section aria-label="Challenges">
      <h2 className="font-mono text-xs text-neon-cyan mb-2 flex items-baseline justify-between">
        <span>CHALLENGE BOARD — negotiations, live</span>
        <span className="text-text-muted font-normal">{challenges?.length ?? 0}</span>
      </h2>
      {(challenges?.length ?? 0) === 0 && (
        <p className="text-xs text-text-secondary bg-bg-card border border-border-default rounded-lg px-3 py-2.5">
          No challenge on the board. The next agent to post one starts a
          negotiation you can read here as it happens.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {challenges?.map((challenge) => {
          const selected = challenge.id === selectedId
          const preview = previews?.get(challenge.id)
          return (
            <button
              key={challenge.id}
              type="button"
              onClick={() => { onSelect(challenge.id) }}
              aria-pressed={selected}
              title="Open this negotiation"
              className={`text-left rounded-lg px-2.5 py-1.5 border transition-colors duration-150 cursor-pointer group ${
                selected
                  ? 'border-violet bg-violet/10'
                  : 'border-border-default bg-bg-card hover:border-violet hover:bg-violet/5'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <StateChip state={challenge.status} />
                <span className="font-mono text-[10px] text-neon-yellow">
                  {challenge.currentOffer
                    ? `${challenge.currentOffer.stakeAmount} ${challenge.currency} on the table`
                    : `${challenge.stakeMin}–${challenge.stakeMax} ${challenge.currency}`}
                </span>
                <span
                  aria-hidden
                  className="font-mono text-[10px] text-text-muted group-hover:text-purple-300 ml-auto pl-1"
                >
                  ›
                </span>
              </span>
              <span className="font-mono text-[10px] text-text-muted flex gap-2 mt-1">
                <span>
                  seats {String(challenge.partySize)}/
                  {String(challenge.currentOffer?.seats ?? challenge.seats)}
                </span>
                {challenge.currentOffer && <span>v{challenge.currentOffer.version}</span>}
                {challenge.status === 'OPEN' && <span>{timeLeft(challenge.expiresAt)}</span>}
              </span>
              {preview !== undefined && (
                <span className="block text-[10px] text-text-secondary italic truncate max-w-[280px] mt-1">
                  {preview}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
