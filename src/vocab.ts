import type { ChallengeSummary, DealSummary } from './api'
import { PZ } from './pixel'

// The words this page is allowed to use, and the one place they are decided.
//
// The arena speaks in states (ACCEPTED, SPAWNING, LOCKED, EXPIRED); a visitor
// with five minutes does not. Everything on the surface is translated here —
// the jargon still exists, but only inside a drill-in, next to the value it
// names.

export type BetState =
  | 'PLAYING NOW'
  | 'STILL ARGUING'
  | 'WAITING'
  | 'FINISHED'
  | 'CANCELLED'

export const STATE_INK: Record<BetState, string> = {
  'PLAYING NOW': PZ.yellow,
  'STILL ARGUING': PZ.green,
  WAITING: PZ.green,
  FINISHED: PZ.cyan,
  CANCELLED: PZ.red,
}

/** Deal states, in the language of the page. */
export function dealState(state: string): BetState {
  switch (state) {
    case 'PLAYING':
      return 'PLAYING NOW'
    case 'SETTLING':
    case 'SETTLED':
      return 'FINISHED'
    case 'ABORTING':
    case 'ABORTED':
      return 'CANCELLED'
    default:
      // ACCEPTED, FUNDED, SPAWNING — agreed, money moving, board not up yet.
      return 'WAITING'
  }
}

/** Challenge statuses, same vocabulary. */
export function challengeState(challenge: ChallengeSummary): BetState {
  if (challenge.status === 'EXPIRED') return 'CANCELLED'
  if (challenge.status === 'CLOSED') return 'FINISHED'
  if (challenge.status === 'LOCKED') return 'WAITING'
  return challenge.partySize > 1 ? 'STILL ARGUING' : 'WAITING'
}

// ── Money ──────────────────────────────────────────────────────────────────
//
// One rule, everywhere: testnet HBAR is PLAY MONEY — purple, dashed, marked
// `⌁`, and never with a `$` anywhere near it. Anything settled in a currency
// that is not testnet HBAR is REAL, and gets the yellow `◆`. Painting play
// money yellow was the worst thing the old page did.

export interface Money {
  /** `25 ℏ` — the amount, in the unit the agents actually bet in. */
  text: string
  play: boolean
  mark: string
  ink: string
}

const PLAY_CURRENCIES = new Set(['HBAR', 'TESTNET_HBAR', 'ℏ'])

export function money(amount: string, currency: string): Money {
  const play = PLAY_CURRENCIES.has(currency.toUpperCase())
  return {
    text: play ? `${amount} ℏ` : `${amount} ${currency}`,
    play,
    mark: play ? '⌁' : '◆',
    ink: play ? PZ.purple : PZ.yellow,
  }
}

/** The total in the pot: one stake per seat. */
export function pot(amount: string, seats: number): string | null {
  const value = Number(amount)
  if (!Number.isFinite(value) || seats <= 0) return null
  const total = value * seats
  return Number.isInteger(total) ? String(total) : total.toFixed(2)
}

// ── Time ───────────────────────────────────────────────────────────────────

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB')
}

export function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'time is up'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute left'
  if (minutes < 60) return `${String(minutes)} minutes left`
  return `${String(Math.floor(minutes / 60))}h${String(minutes % 60).padStart(2, '0')} left`
}

/** `20 seconds`, `4 minutes` — for gaps we actually measured. */
export function span(fromMs: number, toMs: number): string | null {
  const ms = toMs - fromMs
  if (!Number.isFinite(ms) || ms < 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 90) return `${String(seconds)} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.round(seconds / 60)
  return `${String(minutes)} minute${minutes === 1 ? '' : 's'}`
}

export function shorten(value: string, head = 8, tail = 6): string {
  return value.length > head + tail + 1
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value
}

// ── One list of bets ───────────────────────────────────────────────────────
//
// A visitor does not know that a negotiation and a deal are two tables. On the
// board they are one thing: a bet, at some point in its life.

export interface Bet {
  /** Route segment: the kind is part of the id so `/bets/:id` stays one route. */
  key: string
  kind: 'deal' | 'challenge'
  id: string
  state: BetState
  ink: string
  title: string
  /** One factual line, built from fields this page actually has. */
  line: string
  at: number
}

function names(players: { name: string }[]): string {
  return players.map((player) => player.name).join(' vs ')
}

function dealLine(deal: DealSummary): string {
  const each = money(deal.stakeAmount, deal.currency)
  const seats = deal.players.length
  const total = pot(deal.stakeAmount, seats)
  const stake = seats > 1 ? `${String(seats)} players bet ${each.text} each` : `bet ${each.text}`
  switch (dealState(deal.state)) {
    case 'PLAYING NOW':
      return `${stake}. Playing since ${hhmm(deal.updatedAt)}.`
    case 'FINISHED': {
      const winner = deal.players.find((player) => player.agentId === deal.winnerId)
      if (winner && total !== null) {
        return `${winner.name} won and was paid ${money(total, deal.currency).text}.`
      }
      return deal.state === 'SETTLING'
        ? `${stake}. The match is over — the winner is being paid.`
        : `${stake}. Settled at ${hhmm(deal.updatedAt)}.`
    }
    case 'CANCELLED':
      // The arena's own reason, in its own words, with the underscores taken
      // out — inventing a friendlier cause would be inventing a fact.
      return deal.abortReason === null
        ? `${stake}. It never ran, and the money went back.`
        : `${stake}. It stopped — the arena recorded “${deal.abortReason.replace(/_/g, ' ')}”.`
    default:
      return `${stake}. Agreed at ${hhmm(deal.createdAt)}, waiting on the board.`
  }
}

function challengeLine(challenge: ChallengeSummary): string {
  const bracket = `${challenge.stakeMin} to ${challenge.stakeMax}`
  const seats = challenge.currentOffer?.seats ?? challenge.seats
  const open = challenge.status === 'OPEN'
  if (challenge.status === 'EXPIRED') {
    // It ran out of time. Whether anyone had joined is the whole difference
    // between "nobody wanted it" and "they never came to terms".
    return challenge.partySize > 1
      ? `${String(challenge.partySize)} of ${String(seats)} players were in, but they never came to terms before it ran out.`
      : `Wanted ${money(bracket, challenge.currency).text} a seat. Nobody took it in time.`
  }
  if (challenge.currentOffer) {
    const asking = money(challenge.currentOffer.stakeAmount, challenge.currency)
    const room = `${String(challenge.partySize)} of ${String(seats)} players in`
    return open
      ? `Asking ${asking.text} each. ${room}, ${timeLeft(challenge.expiresAt)}.`
      : `Asking ${asking.text} each. ${room}.`
  }
  const willing = `Willing to bet ${money(bracket, challenge.currency).text}`
  return challenge.partySize > 1
    ? `${willing}. ${String(challenge.partySize)} of ${String(seats)} players in, still no offer on the table.`
    : `${willing}. Nobody has replied yet.`
}

/**
 * Every bet on the board, newest first.
 *
 * A CLOSED challenge is the same bet as the deal it produced — it is dropped
 * here so the board never shows one negotiation twice. Everything else, deal
 * or negotiation, gets exactly one row.
 */
export function toBets(
  deals: DealSummary[] | undefined,
  challenges: ChallengeSummary[] | undefined,
  /** Names the challenger when the roster is loaded; the row works without it. */
  nameOf: (agentId: string) => string | null = () => null,
): Bet[] {
  const fromDeals: Bet[] = (deals ?? []).map((deal) => {
    const state = dealState(deal.state)
    return {
      key: `deal-${deal.id}`,
      kind: 'deal' as const,
      id: deal.id,
      state,
      ink: STATE_INK[state],
      title: names(deal.players) || `bet ${shorten(deal.id, 6, 4)}`,
      line: dealLine(deal),
      at: deal.updatedAt,
    }
  })

  const fromChallenges: Bet[] = (challenges ?? [])
    .filter((challenge) => challenge.status !== 'CLOSED')
    .map((challenge) => {
      const state = challengeState(challenge)
      const seats = challenge.currentOffer?.seats ?? challenge.seats
      const who = nameOf(challenge.challengerId)
      return {
        key: `challenge-${challenge.id}`,
        kind: 'challenge' as const,
        id: challenge.id,
        state,
        ink: STATE_INK[state],
        title:
          seats > 2
            ? `${who ?? 'An agent'} wants a ${String(seats)}-player game`
            : `${who ?? 'An agent'} is looking for an opponent`,
        line: challengeLine(challenge),
        at: challenge.createdAt,
      }
    })

  return [...fromDeals, ...fromChallenges].sort((a, b) => b.at - a.at)
}

/** Route id → what to fetch. `/bets/:id` stays one route with two shapes. */
export function readBetKey(key: string): { kind: 'deal' | 'challenge'; id: string } | null {
  if (key.startsWith('deal-')) return { kind: 'deal', id: key.slice(5) }
  if (key.startsWith('challenge-')) return { kind: 'challenge', id: key.slice(10) }
  return null
}
