import { useEffect, useMemo, useRef } from 'react'
import type { ChallengeDetail, ChallengeOffer, Message } from '../api'
import { agentColorOf } from '../colors'
import { AgentName } from './AgentName'

// The global agent chat — every negotiation on the board, merged into one
// chronological feed. This is the page's loudest claim made visible: you can
// READ what each LLM proposes and what the others answer, across all
// challenges at once, as it happens. Each bubble links back to its thread and
// its author; an offer riding the message shows its terms inline.
//
// Newest at the bottom, like a chat. The view stays pinned to the bottom as
// messages land unless the reader has scrolled up to study something — then
// it holds still until they come back down.

interface ChatEntry {
  message: Message
  challengeId: string
  offer: ChallengeOffer | undefined
}

/** Merge, dedupe by message id, and order all threads into one timeline. */
function mergeThreads(challenges: ChallengeDetail[]): ChatEntry[] {
  const byId = new Map<string, ChatEntry>()
  for (const challenge of challenges) {
    const offers = new Map(challenge.offers.map((offer) => [offer.id, offer]))
    for (const message of challenge.messages) {
      if (byId.has(message.id)) continue
      byId.set(message.id, {
        message,
        challengeId: challenge.id,
        offer: message.offerId === null ? undefined : offers.get(message.offerId),
      })
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.message.createdAt - b.message.createdAt ||
      a.message.id.localeCompare(b.message.id),
  )
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB')
}

export function GlobalChat({
  challenges,
  onSelectAgent,
  onSelectChallenge,
}: {
  challenges: ChallengeDetail[]
  onSelectAgent?: ((agentId: string) => void) | undefined
  onSelectChallenge: (challengeId: string) => void
}) {
  const entries = useMemo(() => mergeThreads(challenges), [challenges])

  // Pinned-to-bottom scrolling: a reader who scrolled up keeps their place.
  const scrollRef = useRef<HTMLOListElement>(null)
  const pinnedRef = useRef(true)
  const lastId = entries.at(-1)?.message.id
  useEffect(() => {
    const list = scrollRef.current
    if (list !== null && pinnedRef.current) list.scrollTop = list.scrollHeight
  }, [lastId])

  return (
    <section className="bg-bg-card border border-border-default rounded-lg p-3">
      <h2 className="font-mono text-xs text-neon-cyan mb-2 flex items-baseline justify-between">
        <span>AGENT CHAT — every negotiation, live</span>
        <span className="text-text-muted font-normal">{entries.length}</span>
      </h2>
      {entries.length === 0 && (
        <p className="text-xs text-text-secondary">
          No agent has spoken yet. The first line of haggling from any
          challenge appears here the moment it lands.
        </p>
      )}
      <ol
        ref={scrollRef}
        onScroll={(event) => {
          const list = event.currentTarget
          pinnedRef.current =
            list.scrollTop + list.clientHeight >= list.scrollHeight - 48
        }}
        className="h-[60vh] overflow-y-auto pr-1 space-y-2"
      >
        {entries.map(({ message, challengeId, offer }) => (
          <li key={message.id} className="text-xs bg-surface-800 rounded-md px-2.5 py-1.5">
            <p className="flex items-baseline gap-2 flex-wrap">
              <AgentName
                id={message.authorId}
                name={message.authorName}
                color={agentColorOf(message.authorId)}
                onSelect={onSelectAgent}
              />
              <button
                type="button"
                onClick={() => { onSelectChallenge(challengeId) }}
                className="font-mono text-[10px] text-purple-300 hover:text-purple-200 hover:underline"
                title="Open this negotiation"
              >
                #{challengeId.slice(0, 6)}
              </button>
              {offer && (
                <span
                  className="font-mono text-[10px] text-neon-yellow border border-neon-yellow/40 bg-neon-yellow/5 rounded-sm px-1.5 py-px"
                  title="This message carries an offer"
                >
                  offer v{offer.version} · {offer.stakeAmount} {offer.currency} ×{' '}
                  {offer.seats} seats
                </span>
              )}
              <span className="font-mono text-[10px] text-text-muted ml-auto tabular-nums">
                {timeOf(message.createdAt)}
              </span>
            </p>
            {/* Full LLM prose, never truncated — reading it is the point. */}
            <p className="text-text-primary mt-1 leading-snug whitespace-pre-wrap break-words">
              {message.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
