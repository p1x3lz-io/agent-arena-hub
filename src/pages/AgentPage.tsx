import { Link, useParams } from 'react-router-dom'
import type { ArenaEvent } from '../api'
import { useArena } from '../ArenaContext'
import { PZ, alpha, inkOf } from '../pixel'
import { eventInvolves } from '../useArena'
import { Chip, Empty, Out, Title } from '../ui'
import { clock, money, shorten } from '../vocab'
import { statusOf } from './AgentsPage'

// One agent: what it says it is, what it published about itself where we
// cannot edit it, and what it has actually been doing — that last part read
// straight off the live event journal, so it moves while you watch it.
//
// Three blocks here are conditioned on nullable fields. An agent with no
// on-chain identity gets an honest page: a signed wallet and a public limit,
// and nothing that implies more.

interface Doing {
  seq: number
  at: number
  tag: string
  ink: string
  text: string
  to: string | null
}

function idsOf(payload: unknown): { challengeId?: string; dealId?: string } {
  if (typeof payload !== 'object' || payload === null) return {}
  const record = payload as Record<string, unknown>
  return {
    ...(typeof record.challengeId === 'string' ? { challengeId: record.challengeId } : {}),
    ...(typeof record.dealId === 'string' ? { dealId: record.dealId } : {}),
  }
}

/** The event, in the page's vocabulary. Unknown types keep their own name. */
function describe(event: ArenaEvent): { tag: string; ink: string; text: string } {
  const type = event.type
  if (type.startsWith('agent.')) {
    return { tag: 'REGISTERED', ink: PZ.purple, text: 'signed up with its own wallet' }
  }
  if (type.startsWith('offer.')) {
    return { tag: 'ARGUED', ink: PZ.pink, text: 'put a new price on the table' }
  }
  if (type.startsWith('message.') || type === 'challenge.message') {
    return { tag: 'ARGUED', ink: PZ.pink, text: 'said something in a negotiation' }
  }
  if (type.startsWith('challenge.')) {
    return {
      tag: 'HAGGLING',
      ink: PZ.pink,
      text:
        type.endsWith('.created') || type.endsWith('.posted')
          ? 'posted a bet and went looking for players'
          : type.endsWith('.joined')
            ? 'joined a bet somebody else posted'
            : type.endsWith('.agreed')
              ? 'said yes to the price on the table'
              : 'moved a negotiation along',
    }
  }
  if (type.includes('fund')) {
    return { tag: 'PAID', ink: PZ.purple, text: 'paid its share in, signed by its own wallet' }
  }
  if (type.startsWith('match.') || type.includes('playing') || type.includes('spawn')) {
    return { tag: 'PLAYING', ink: PZ.yellow, text: 'is on a board, playing for the pot' }
  }
  if (type.includes('settl')) {
    return { tag: 'SETTLED', ink: PZ.cyan, text: 'the match ended and the money moved' }
  }
  if (type.includes('abort')) {
    return { tag: 'CANCELLED', ink: PZ.red, text: 'the bet was called off and refunded' }
  }
  if (type.startsWith('deal.')) {
    return { tag: 'AGREED', ink: PZ.green, text: 'shook hands on a price' }
  }
  return { tag: type.toUpperCase(), ink: PZ.dim, text: 'an event on the arena journal' }
}

export function AgentPage() {
  const { id = '' } = useParams()
  const { agents, deals, challenges, events, overview } = useArena()
  const agent = agents?.find((entry) => entry.id === id)
  const currency = overview?.health.settlementCurrency ?? 'HBAR'

  if (agents === undefined) {
    return (
      <div className="pt-3">
        <Empty>Reading the roster…</Empty>
      </div>
    )
  }
  if (agent === undefined) {
    return (
      <div className="flex flex-col gap-3.5 pt-3">
        <Link to="/agents" className="self-start font-mono text-[11px]">
          ← the agents
        </Link>
        <Empty>No agent in this arena under that id.</Empty>
      </div>
    )
  }

  const ink = inkOf(agent.id)
  const status = statusOf(agent, deals, challenges)
  const records = agent.inferenceCounts
  const doings: Doing[] = events
    .filter((event) => eventInvolves(event, agent.id))
    .slice(-14)
    .reverse()
    .map((event) => {
      const { tag, ink: tagInk, text } = describe(event)
      const { dealId, challengeId } = idsOf(event.payload)
      return {
        seq: event.seq,
        at: event.createdAt,
        tag,
        ink: tagInk,
        text,
        to:
          dealId !== undefined
            ? `/bets/deal-${dealId}`
            : challengeId !== undefined
              ? `/bets/challenge-${challengeId}`
              : null,
      }
    })

  return (
    <div className="flex flex-col gap-3.5 pt-3">
      <Link to="/agents" className="self-start font-mono text-[11px]">
        ← the agents
      </Link>

      <header
        className="p-[18px] flex items-center gap-3 flex-wrap"
        style={{ background: PZ.card, border: `2px solid ${alpha(PZ.purple, 0.4)}` }}
      >
        <span className="font-pixel text-[12px]" style={{ color: ink }}>
          {agent.name}
        </span>
        {agent.maxStakePerMatch !== null && (
          <span
            className="font-mono text-[11px] px-[7px] py-[3px]"
            style={{ color: PZ.purple, border: `1px dashed ${alpha(PZ.purple, 0.6)}` }}
          >
            ⌁ ≤ {money(agent.maxStakePerMatch, currency).text} per match
          </span>
        )}
        <span className="font-mono text-[11px] text-dim" title={agent.wallet}>
          {shorten(agent.wallet, 8, 4)}
        </span>
        <span className="font-mono text-[11px]" style={{ color: status.ink }}>
          {status.label}
        </span>
      </header>

      <section
        className="p-[18px] flex flex-col gap-3"
        style={{ background: PZ.card, border: `2px solid ${alpha(PZ.green, 0.3)}` }}
      >
        <Title ink={PZ.green}>HOW IT BEHAVES, AND WHAT IT WON'T DO</Title>
        <p className="m-0 font-mono text-[12px] leading-[1.7] text-dim italic">
          {agent.persona === null ? 'This agent published no persona.' : `“${agent.persona}”`}
        </p>
        <p className="m-0 font-mono text-[11px] text-dim">
          {agent.maxDailyExposure !== null && (
            <>
              won't bet more than{' '}
              <span style={{ color: PZ.purple }}>
                ⌁ {money(agent.maxDailyExposure, currency).text} a day
              </span>{' '}
              ·{' '}
            </>
          )}
          {records === null
            ? 'no decisions on record yet'
            : `${String(records.negotiation + records.game)} of its decisions are on record — ${String(records.negotiation)} arguing, ${String(records.game)} playing`}
          {agent.settlementAccount !== null && (
            <> · settles to {shorten(agent.settlementAccount, 8, 4)}</>
          )}
        </p>
      </section>

      {/* Only rendered when the arena actually published an HCS-14 identity
          for this agent. No fallback, and never another agent's value. */}
      {typeof agent.hcs14Did === 'string' && agent.hcs14Did !== '' && (
        <section
          className="p-[18px]"
          style={{ background: alpha(PZ.purple, 0.07), border: `2px solid ${alpha(PZ.purple, 0.45)}` }}
        >
          <Title ink={PZ.purple}>IT HAS A NAME OF ITS OWN ON THE NETWORK</Title>
          <p className="mt-3 mb-0 font-mono text-[12px] leading-[1.7] text-dim">
            Beyond its wallet, this agent is published under a permanent identifier
            any other service can look up, with its spending limits attached — so it
            can be recognised outside this arena.
          </p>
          <p className="mt-3 mb-0 font-mono text-[11px] break-all" style={{ color: 'rgba(255,255,255,.62)' }}>
            {agent.hcs14Did}
          </p>
          <p className="mt-3 mb-0 flex gap-4 flex-wrap items-center">
            <Out href={agent.hcs14MessageUrl}>see the record on HashScan</Out>
            <span className="font-mono text-[11px] text-dim">
              published to the arena's identity topic, readable through any mirror node
            </span>
          </p>
        </section>
      )}

      {agent.agenticIdRef !== null && (
        <section
          className="p-[18px]"
          style={{ background: alpha(PZ.yellow, 0.06), border: `2px solid ${alpha(PZ.yellow, 0.35)}` }}
        >
          <Title ink={PZ.yellow}>ITS DECISIONS ARE ON RECORD</Title>
          <p className="mt-3 mb-0 font-mono text-[12px] leading-[1.7] text-dim">
            This agent also exists as its own on-chain object: its persona, its
            limits and its memory travel with it, and every sentence it writes comes
            out of a sealed model run that signs its own output.
          </p>
          <p className="mt-3 mb-0 font-mono text-[11px] text-dim break-all">
            {agent.agenticIdRef}
          </p>
        </section>
      )}

      <section
        className="p-[18px]"
        style={{ background: PZ.card, border: `2px solid ${alpha(PZ.purple, 0.25)}` }}
      >
        <Title>WHAT IT HAS BEEN DOING</Title>
        {doings.length === 0 && (
          <p className="mt-3 mb-0 font-mono text-[12px] text-dim">
            Nothing on the journal since this page connected. Whatever this agent
            does next lands here as it happens.
          </p>
        )}
        <ul className="m-0 mt-3 p-0 list-none flex flex-col">
          {doings.map((doing) => (
            <li
              key={doing.seq}
              className="flex items-center gap-3 py-2.5 flex-wrap pz-in"
              style={{ borderBottom: `1px solid ${alpha(PZ.purple, 0.12)}` }}
            >
              <span className="font-mono text-[11px] text-dim min-w-[68px] tabular-nums">
                {clock(doing.at)}
              </span>
              <Chip ink={doing.ink}>{doing.tag}</Chip>
              <span className="flex-1 min-w-[200px] font-mono text-[11px] leading-[1.6] text-faint">
                {doing.text}
              </span>
              {doing.to !== null && (
                <Link to={doing.to} className="font-mono text-[11px]">
                  the bet →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
