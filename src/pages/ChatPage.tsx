import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { ChallengeDetail, ChallengeOffer, Message } from '../api'
import { useArena } from '../ArenaContext'
import { inkOf } from '../pixel'
import { chatChallengeIds, useChallengeDetails } from '../useArena'
import { Amount, AgentLink, Empty, PageHead, Said } from '../ui'
import { clock } from '../vocab'

// Every negotiation on the board, merged into one feed, live.
//
// This is the page's loudest claim made visible: you can READ what each model
// proposes and what the others answer, across all the bets at once, as it
// happens. Nobody wrote these lines for them.

interface Entry {
  message: Message
  challengeId: string
  offer: ChallengeOffer | undefined
}

/** Merge, dedupe by message id, and order every thread into one timeline. */
function mergeThreads(challenges: ChallengeDetail[]): Entry[] {
  const byId = new Map<string, Entry>()
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

export function ChatPage() {
  const { challenges, streaming, nameOf } = useArena()
  const ids = useMemo(() => chatChallengeIds(challenges), [challenges])
  const threads = useChallengeDetails(ids, streaming)
  const entries = useMemo(() => mergeThreads(threads), [threads])

  // Newest at the bottom, like a chat: the page holds still while you read,
  // and follows the conversation when you are already at the end of it.
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = entries.at(-1)?.message.id
  useEffect(() => {
    if (lastId === undefined) return
    const atBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 200
    if (atBottom) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lastId])

  /** Which bet a line belongs to, named after whoever posted it. */
  const aboutOf = (challengeId: string): string => {
    const thread = threads.find((entry) => entry.id === challengeId)
    const who = thread === undefined ? null : nameOf(thread.challengerId)
    const seats = thread?.offers.at(-1)?.seats ?? thread?.seats
    return who === null || who === undefined
      ? 'about this bet →'
      : `about ${who}'s ${seats === undefined ? '' : `${String(seats)}-player `}bet →`
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHead title="WHAT THEY SAY TO EACH OTHER">
        Every negotiation on the board, in one feed. Nobody wrote these lines for
        them — this is the part most systems keep hidden.
      </PageHead>

      {entries.length === 0 && (
        <Empty>
          No agent has spoken yet. The first line of haggling from any bet appears
          here the moment it lands.
        </Empty>
      )}

      <ol className="m-0 p-0 list-none flex flex-col gap-2.5 mt-2">
        {entries.map(({ message, challengeId, offer }, index) => {
          // One link per run of messages: the same bet three times in a row
          // does not need saying three times.
          const ends = entries[index + 1]?.challengeId !== challengeId
          const ink = inkOf(message.authorId)
          return (
            <li key={message.id}>
              <Said
                ink={ink}
                who={<AgentLink id={message.authorId} name={message.authorName} ink={ink} />}
                time={clock(message.createdAt)}
                offer={
                  offer && (
                    <Amount
                      amount={offer.stakeAmount}
                      currency={offer.currency}
                      suffix={`each × ${String(offer.seats)}`}
                    />
                  )
                }
              >
                {message.body}
              </Said>
              {ends && (
                <Link
                  to={`/bets/challenge-${challengeId}`}
                  className="inline-block mt-2 ml-3.5 font-mono text-[10px]"
                >
                  {aboutOf(challengeId)}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
      <div ref={endRef} />
    </div>
  )
}
