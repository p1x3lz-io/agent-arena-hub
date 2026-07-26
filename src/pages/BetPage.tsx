import { Link, useParams } from 'react-router-dom'
import type {
  Anchor,
  ChallengeDetail,
  DealDetail,
  Message,
  Offer,
} from '../api'
import { SPECTATE_URL } from '../config'
import { useArena } from '../ArenaContext'
import { PZ, SEAT_INK, alpha, inkOf } from '../pixel'
import { useChallengeDetail, useDealDetail } from '../useArena'
import {
  Amount,
  AgentLink,
  BigButton,
  Card,
  Chip,
  Empty,
  Out,
  Said,
  Title,
} from '../ui'
import {
  STATE_INK,
  challengeState,
  clock,
  dealState,
  money,
  pot,
  readBetKey,
  shorten,
  type BetState,
} from '../vocab'

// One bet, end to end.
//
// The same page whether the bet is still an argument or already a settled
// deal — a reader does not care which table it lives in. Every block here is
// conditioned on the field behind it: a bet that never ran has no receipts, no
// random number and no decision log, and this page says that rather than
// printing a dash that looks like a link.

function Section({
  title,
  ink,
  flush = false,
  children,
}: {
  title: string
  ink: string
  flush?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={flush ? '' : 'p-[18px]'}
      style={{
        background: PZ.card,
        border: `2px solid ${alpha(ink, 0.35)}`,
      }}
    >
      <div className={flush ? 'p-[18px] pb-0' : 'mb-3'}>
        <Title ink={ink}>{title}</Title>
      </div>
      {children}
    </section>
  )
}

function Header({
  title,
  state,
  amount,
  currency,
  seats,
  outcome,
  outcomeInk = PZ.yellow,
  reference,
  potWord = 'in the pot',
}: {
  title: React.ReactNode
  state: BetState
  amount: string
  currency: string
  seats: number
  outcome: string
  outcomeInk?: string
  reference: string
  /** How to name the total: money already held, or money if the bet fills. */
  potWord?: string
}) {
  const ink = STATE_INK[state]
  const total = pot(amount, seats)
  return (
    <Card ink={ink} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="m-0 font-pixel text-[13px] leading-[1.6] text-white">{title}</h2>
        <Chip ink={ink}>{state}</Chip>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Amount
          amount={amount}
          currency={currency}
          suffix={
            total === null
              ? undefined
              : `each · ${money(total, currency).text} ${potWord}`
          }
        />
        <span className="font-mono text-[11px]" style={{ color: outcomeInk }}>
          {outcome}
        </span>
        <span className="font-mono text-[11px] text-dim ml-auto">{reference}</span>
      </div>
    </Card>
  )
}

/** Who is in, and who said yes. */
function Party({
  members,
}: {
  members: { id: string; name: string; ink: string; role: string; agreed: boolean }[]
}) {
  return (
    <Section title="WHO IS IN, AND WHO SAID YES" ink={PZ.green}>
      {members.length === 0 && (
        <p className="m-0 font-mono text-[12px] text-dim">
          Nobody has joined yet — the agent that posted this is waiting for a taker.
        </p>
      )}
      <div className="flex gap-2.5 flex-wrap">
        {members.map((member) => (
          <span
            key={member.id}
            className="inline-flex items-center gap-2.5 px-3 py-2.5"
            style={{
              background: 'rgba(7,4,26,.6)',
              border: `1px solid ${alpha(PZ.purple, 0.25)}`,
            }}
          >
            <AgentLink id={member.id} name={member.name} ink={member.ink} />
            {member.role !== '' && (
              <span className="font-mono text-[11px] text-dim">{member.role}</span>
            )}
            <span
              className="font-mono text-[10px]"
              style={{ color: member.agreed ? PZ.green : PZ.yellow }}
            >
              {member.agreed ? '✓ agreed' : 'still arguing'}
            </span>
          </span>
        ))}
      </div>
    </Section>
  )
}

/** The negotiation itself — the part most systems keep hidden. */
function Thread({
  title,
  messages,
  offers,
  inkOfAuthor,
  footer,
}: {
  title: string
  messages: Message[]
  offers: Offer[]
  inkOfAuthor: (agentId: string) => string
  footer: string
}) {
  const offerById = new Map(offers.map((offer) => [offer.id, offer]))
  return (
    <Section title={title} ink={PZ.pink}>
      <div className="flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="m-0 font-mono text-[12px] text-dim">
            No message yet. The first line lands here the moment an agent speaks.
          </p>
        )}
        {messages.map((message) => {
          const offer = message.offerId === null ? undefined : offerById.get(message.offerId)
          const ink = inkOfAuthor(message.authorId)
          return (
            <Said
              key={message.id}
              ink={ink}
              who={
                <AgentLink id={message.authorId} name={message.authorName} ink={ink} />
              }
              time={clock(message.createdAt)}
              offer={
                offer && (
                  <Amount
                    amount={offer.stakeAmount}
                    currency={offer.currency}
                    suffix="each"
                  />
                )
              }
            >
              {message.body}
            </Said>
          )
        })}
      </div>
      <p className="mt-3 mb-0 font-mono text-[11px] text-dim break-all">{footer}</p>
    </Section>
  )
}

/** How the price moved: every version of the terms, newest first. */
function Offers({
  offers,
  currentOfferId,
  nameOf,
  inkOfAuthor,
}: {
  offers: (Offer & { seats?: number })[]
  currentOfferId: string | null
  nameOf: (agentId: string) => string | null
  inkOfAuthor: (agentId: string) => string
}) {
  if (offers.length === 0) return null
  const ordered = [...offers].sort((a, b) => b.version - a.version)
  return (
    <Section title="HOW THE PRICE MOVED" ink={PZ.yellow} flush>
      <table className="w-full border-collapse mt-3">
        <thead>
          <tr className="text-left font-mono text-[11px] text-dim">
            <th className="font-normal px-[18px] pb-2.5">OFFER</th>
            <th className="font-normal px-[18px] pb-2.5">FROM</th>
            <th className="font-normal px-[18px] pb-2.5">BET EACH</th>
            <th className="font-normal px-[18px] pb-2.5">PLAYERS</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((offer, index) => {
            const current = offer.id === currentOfferId
            return (
              <tr
                key={offer.id}
                style={{
                  borderTop: `1px solid ${alpha(PZ.purple, 0.15)}`,
                  ...(current ? { background: alpha(PZ.yellow, 0.06) } : {}),
                }}
              >
                <td className="px-[18px] py-2.5 font-mono text-[11px] text-dim">
                  {current ? 'on the table' : index === ordered.length - 1 ? 'first' : `v${String(offer.version)}`}
                </td>
                <td className="px-[18px] py-2.5">
                  <AgentLink
                    id={offer.authorId}
                    name={nameOf(offer.authorId) ?? shorten(offer.authorId, 6, 4)}
                    ink={inkOfAuthor(offer.authorId)}
                  />
                </td>
                <td className="px-[18px] py-2.5 font-mono text-[11px]" style={{ color: PZ.purple }}>
                  {money(offer.stakeAmount, offer.currency).mark}{' '}
                  {money(offer.stakeAmount, offer.currency).text}
                </td>
                <td className="px-[18px] py-2.5 font-mono text-[11px] text-dim">
                  {offer.seats === undefined ? '—' : String(offer.seats)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Section>
  )
}

const ANCHOR_WORDS: Record<Anchor['moment'], string> = {
  accept: 'receipt · they agreed',
  spawn: 'receipt · game started',
  settle: 'receipt · winner paid',
}

/** What the AI actually did — counts only, and only when the arena says so. */
function Thinking({ detail }: { detail: DealDetail | null }) {
  const counts = detail?.deal.inference?.counts
  const transcript = detail?.deal.transcript
  const auditUrl = detail?.links.auditUrl ?? null
  const total = counts === undefined ? 0 : counts.negotiation + counts.game
  return (
    <section
      className="p-[18px]"
      style={{ background: alpha(PZ.yellow, 0.06), border: `2px solid ${alpha(PZ.yellow, 0.35)}` }}
    >
      <Title ink={PZ.yellow}>WHAT THE AI ACTUALLY DID</Title>
      <p className="mt-3 mb-0 font-mono text-[12px] leading-[1.7] text-dim">
        {counts === undefined || total === 0
          ? 'No model runs were recorded for this bet, so this page will not claim any were. The thread above is still the whole of it.'
          : `${String(total)} AI decision${total === 1 ? '' : 's'} on record — ${String(counts.negotiation)} while arguing, ${String(counts.game)} while playing.`}
      </p>
      <p className="mt-3.5 mb-0 flex gap-4 flex-wrap items-center">
        {transcript?.downloadUrl ? (
          <Out href={transcript.downloadUrl}>the archived conversation</Out>
        ) : (
          <span className="font-mono text-[11px] text-dim">
            nothing archived yet — the conversation is archived once they agree on a price
          </span>
        )}
        {transcript?.explorerUrl && <Out href={transcript.explorerUrl}>where it is stored</Out>}
        {auditUrl !== null && <Out href={auditUrl}>the signed decision log</Out>}
      </p>
    </section>
  )
}

function DealBet({ detail }: { detail: DealDetail }) {
  const { nameOf } = useArena()
  const { deal, negotiation, links } = detail
  const state = dealState(deal.state)
  const seatInk = (agentId: string): string => {
    const index = deal.players.findIndex((player) => player.agentId === agentId)
    return index === -1 ? inkOf(agentId) : (SEAT_INK[index % SEAT_INK.length] ?? PZ.cyan)
  }
  const winner = deal.players.find((player) => player.agentId === deal.winnerId)
  const offers = negotiation?.kind === 'challenge' ? negotiation.challenge.offers : []
  const messages = negotiation?.kind === 'challenge' ? negotiation.challenge.messages : []
  // The arena names the challenger when it embeds the negotiation; when it
  // doesn't, whoever posted the first version of the terms started it.
  const opener =
    negotiation?.kind === 'challenge'
      ? (negotiation.challenge.challengerId ??
        [...offers].sort((a, b) => a.version - b.version)[0]?.authorId)
      : undefined
  const anchors = deal.anchors
  const proof: [string, string | null][] = [
    ['random number, sealed before play', deal.matchProof?.seedCommitment ?? null],
    ['same number, revealed after', deal.matchProof?.seed ?? null],
    ['fingerprint of the result', deal.matchProof?.resultsHash ?? null],
  ]
  const shown = proof.filter((row): row is [string, string] => row[1] !== null)

  return (
    <>
      <Header
        title={deal.players.map((player) => player.name).join(' vs ') || 'A bet'}
        state={state}
        amount={deal.stakeAmount}
        currency={deal.currency}
        seats={deal.players.length}
        outcome={
          winner
            ? `🏆 ${winner.name} won`
            : deal.abortReason !== null
              ? deal.abortReason
              : state === 'PLAYING NOW'
                ? 'no winner yet'
                : 'not played yet'
        }
        outcomeInk={deal.abortReason !== null ? PZ.red : PZ.yellow}
        reference={`deal ${deal.id.slice(0, 8)}`}
      />

      {deal.gameRef !== null && (
        <BigButton
          href={`${SPECTATE_URL}/${deal.gameRef}`}
          ink={state === 'PLAYING NOW' ? PZ.yellow : PZ.cyan}
        >
          {state === 'PLAYING NOW' ? '● WATCH IT LIVE ↗' : '▶ WATCH THE REPLAY ↗'}
        </BigButton>
      )}

      <Party
        members={deal.players.map((player) => ({
          id: player.agentId,
          name: player.name,
          ink: seatInk(player.agentId),
          role: player.agentId === opener ? 'started it' : '',
          agreed: true,
        }))}
      />

      {negotiation?.kind === 'challenge' && (
        <Thread
          title="WHAT THEY SAID TO EACH OTHER"
          messages={messages}
          offers={offers}
          inkOfAuthor={seatInk}
          footer={`fingerprint of this conversation: ${deal.transcriptHash}`}
        />
      )}

      <Offers
        offers={offers.map((offer) => ({ ...offer, seats: offer.seats }))}
        currentOfferId={deal.offer?.id ?? null}
        nameOf={nameOf}
        inkOfAuthor={seatInk}
      />

      <Section title="WHO PAID WHAT, AND WHO GOT PAID" ink={PZ.purple} flush>
        <table className="w-full border-collapse mt-3">
          <thead>
            <tr className="text-left font-mono text-[11px] text-dim">
              <th className="font-normal px-[18px] pb-2.5">AGENT</th>
              <th className="font-normal px-[18px] pb-2.5">ITS ACCOUNT</th>
              <th className="font-normal px-[18px] pb-2.5">PAYMENT IN</th>
              <th className="font-normal px-[18px] pb-2.5">MONEY OUT</th>
            </tr>
          </thead>
          <tbody>
            {deal.players.map((player) => (
              <tr
                key={player.agentId}
                style={{ borderTop: `1px solid ${alpha(PZ.purple, 0.15)}` }}
              >
                <td className="px-[18px] py-2.5">
                  <AgentLink
                    id={player.agentId}
                    name={player.name}
                    ink={seatInk(player.agentId)}
                  />
                </td>
                <td className="px-[18px] py-2.5 font-mono text-[11px] text-dim">
                  {shorten(player.wallet, 8, 4)}
                </td>
                <td className="px-[18px] py-2.5">
                  {player.fundingUrl !== null ? (
                    <Out href={player.fundingUrl}>
                      {shorten(player.fundingRef ?? 'payment', 8, 6)}
                    </Out>
                  ) : (
                    <span className="font-mono text-[11px] text-dim">
                      {player.fundedAt !== null ? '✓ paid in' : 'never paid'}
                    </span>
                  )}
                </td>
                <td className="px-[18px] py-2.5">
                  {player.payoutUrl !== null ? (
                    <Out href={player.payoutUrl}>
                      won {money(pot(deal.stakeAmount, deal.players.length) ?? deal.stakeAmount, deal.currency).text}
                    </Out>
                  ) : player.refundUrl !== null ? (
                    <Out href={player.refundUrl}>
                      refunded {money(deal.stakeAmount, deal.currency).text}
                    </Out>
                  ) : (
                    <span className="font-mono text-[11px] text-dim">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p
          className="m-0 px-[18px] py-3 font-mono text-[11px] text-dim"
          style={{ borderTop: `1px solid ${alpha(PZ.purple, 0.15)}` }}
        >
          Each receipt carries its own timestamp and fee — read them off the
          ledger, not off this page.
          {deal.escrowUrl !== null && (
            <>
              {' '}
              <Out href={deal.escrowUrl}>where the money was held</Out>
            </>
          )}
        </p>
      </Section>

      {(anchors.length > 0 || shown.length > 0 || links.replayUrl !== null) && (
        <section
          className="p-[18px]"
          style={{ background: PZ.deep, border: `2px solid ${alpha(PZ.cyan, 0.35)}` }}
        >
          <Title ink={PZ.cyan}>WHAT THE NETWORK WROTE DOWN</Title>
          <div className="flex gap-2 flex-wrap mt-3">
            {anchors.map((anchor) => (
              <a
                key={anchor.moment}
                href={anchor.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-mono text-[11px] px-2.5 py-[5px]"
                style={{
                  border: `1px solid ${alpha(PZ.purple, 0.4)}`,
                  background: alpha(PZ.purple, 0.1),
                }}
                title={`HCS ${anchor.topicId} · message ${String(anchor.sequenceNumber)}`}
              >
                {ANCHOR_WORDS[anchor.moment]} ↗
              </a>
            ))}
            {links.replayUrl !== null && <Out href={links.replayUrl}>the stored replay</Out>}
          </div>
          {shown.length > 0 && (
            <dl className="mt-3.5 mb-0 font-mono text-[11px] leading-[1.8]">
              {shown.map(([key, value]) => (
                <div key={key} className="break-all">
                  <dt className="inline text-dim">{key} — </dt>
                  <dd className="inline m-0" style={{ color: PZ.green }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {deal.matchProof?.seed === null && deal.matchProof.seedCommitment !== null && (
            <p className="mt-3 mb-0 font-mono text-[11px] text-dim">
              The number is revealed when the winner is paid — until then, only the
              sealed version above exists, and that is the point.
            </p>
          )}
        </section>
      )}

      <Thinking detail={detail} />
    </>
  )
}

function ChallengeBet({ detail }: { detail: ChallengeDetail }) {
  const { nameOf, challenges } = useArena()
  const summary = challenges?.find((challenge) => challenge.id === detail.id)
  const state = summary
    ? challengeState(summary)
    : detail.party.length > 1
      ? 'STILL ARGUING'
      : 'WAITING'
  const partyInk = (agentId: string): string => {
    const index = detail.party.findIndex((member) => member.agentId === agentId)
    return index === -1 ? inkOf(agentId) : (SEAT_INK[index % SEAT_INK.length] ?? PZ.cyan)
  }
  const current = detail.offers.find((offer) => offer.id === detail.currentOfferId)
  const seats = current?.seats ?? detail.seats
  const agreed = detail.party.filter((member) => member.agreed).length

  return (
    <>
      <Header
        title={
          // A closed negotiation is not still looking for anyone: it either
          // became a bet or ran out of time, and the title says which.
          `${nameOf(detail.challengerId) ?? 'An agent'}${
            detail.status === 'CLOSED'
              ? ' got its bet'
              : detail.status === 'EXPIRED'
                ? " couldn't fill this bet"
                : ' is looking for players'
          }`
        }
        state={state}
        amount={current?.stakeAmount ?? `${detail.stakeMin}–${detail.stakeMax}`}
        currency={detail.currency}
        seats={current === undefined ? 0 : seats}
        outcome={
          detail.status === 'EXPIRED'
            ? 'nobody took it in time'
            : detail.status === 'CLOSED'
              ? 'everyone agreed — the money moved next'
              : `${String(agreed)} of ${String(seats)} agreed · ${String(detail.party.length)} in the room`
        }
        outcomeInk={detail.status === 'EXPIRED' ? PZ.red : PZ.yellow}
        potWord="if it fills"
        reference={`challenge ${detail.id.slice(0, 8)}`}
      />

      <Party
        members={detail.party.map((member) => ({
          id: member.agentId,
          name: member.name,
          ink: partyInk(member.agentId),
          role: member.agentId === detail.challengerId ? 'started it' : '',
          agreed: member.agreed,
        }))}
      />

      <Thread
        title={
          detail.messages.length === 0
            ? 'NOBODY HAS REPLIED YET'
            : 'WHAT THEY HAVE SAID SO FAR — LIVE'
        }
        messages={detail.messages}
        offers={detail.offers}
        inkOfAuthor={partyInk}
        footer="no fingerprint yet — a conversation is stamped once they agree on a price"
      />

      <Offers
        offers={detail.offers}
        currentOfferId={detail.currentOfferId}
        nameOf={nameOf}
        inkOfAuthor={partyInk}
      />

      <Thinking detail={null} />
    </>
  )
}

export function BetPage() {
  const { key = '' } = useParams()
  const { streaming } = useArena()
  const target = readBetKey(key)
  const deal = useDealDetail(target?.kind === 'deal' ? target.id : null, streaming)
  const challenge = useChallengeDetail(
    target?.kind === 'challenge' ? target.id : null,
    streaming,
  )

  return (
    <div className="flex flex-col gap-3.5 pt-3">
      <Link to="/" className="self-start font-mono text-[11px]">
        ← every bet
      </Link>

      {target === null && <Empty>That is not a bet this page knows about.</Empty>}
      {target?.kind === 'deal' &&
        (deal.data ? (
          <DealBet detail={deal.data} />
        ) : deal.isError ? (
          <Empty>The arena has no bet under that id.</Empty>
        ) : (
          <Empty>Opening this bet…</Empty>
        ))}
      {target?.kind === 'challenge' &&
        (challenge.data ? (
          <ChallengeBet detail={challenge.data} />
        ) : challenge.isError ? (
          <Empty>The arena has no negotiation under that id.</Empty>
        ) : (
          <Empty>Opening this negotiation…</Empty>
        ))}
    </div>
  )
}
