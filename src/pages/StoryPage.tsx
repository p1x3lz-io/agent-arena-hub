import { Link } from 'react-router-dom'
import type { DealDetail, DealSummary } from '../api'
import { SPECTATE_URL } from '../config'
import { ARENA_REPO_URL } from '../config'
import { useArena } from '../ArenaContext'
import { PZ, SEAT_INK, alpha, pixelBorder } from '../pixel'
import { useDealDetail } from '../useArena'
import { NegotiationGraph, describeNegotiation, type GraphPoint } from '../components/NegotiationGraph'
import { Amount, Empty, Out, Said, Title } from '../ui'
import { dealState, hhmm, money, pot, shorten } from '../vocab'

// The whole thing, once, as a story — four acts on one bet: they argued, they
// paid, they are playing, here is how to catch us lying.
//
// Which bet? The most recent one still moving, else the most recent one that
// finished. That is the same rule the old page used to pick its drill-down,
// and it is what keeps this page demonstrable when nothing is live: a settled
// bet still has a graph, receipts and a revealed seed.

const COUNT_WORDS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX']

function Act({
  number,
  ink,
  glow = false,
  last = false,
  children,
}: {
  number: string
  ink: string
  glow?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[64px_1fr] gap-3 sm:gap-[18px]">
      <div className="flex flex-col items-center gap-2">
        <span
          className={`w-9 h-9 sm:w-12 sm:h-12 grid place-items-center font-pixel text-[11px] sm:text-[14px] ${glow ? 'pz-pulse-slow' : ''}`}
          style={
            last
              ? { border: `2px solid ${ink}`, color: ink }
              : { background: ink, color: '#05010d', boxShadow: `0 0 16px ${alpha(ink, 0.5)}` }
          }
        >
          {number}
        </span>
        {!last && (
          <span
            className="flex-1 w-0.5"
            style={{
              background: `repeating-linear-gradient(180deg,${ink} 0 4px,transparent 4px 8px)`,
            }}
          />
        )}
      </div>
      <div
        className={`min-w-0 p-4 sm:p-5 flex flex-col gap-4 ${last ? '' : 'mb-4'}`}
        style={{
          background: PZ.card,
          boxShadow: glow
            ? `${pixelBorder(ink)},0 0 30px ${alpha(ink, 0.2)}`
            : pixelBorder(alpha(ink, 0.5)),
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ActHead({ ink, title, children }: { ink: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 className="m-0 font-pixel text-[11px] sm:text-[13px]" style={{ color: ink, letterSpacing: '.04em' }}>
        {title}
      </h2>
      {children !== undefined && (
        <p className="mt-2.5 mb-0 text-[14px] leading-[1.7] text-dim">{children}</p>
      )}
    </div>
  )
}

/** The bet the story is told on: the live one, else the most recent one. */
function storyDeal(deals: DealSummary[] | undefined): string | null {
  const ordered = [...(deals ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
  const live = ordered.find(
    (deal) => deal.state !== 'SETTLED' && deal.state !== 'ABORTED',
  )
  return (live ?? ordered[0])?.id ?? null
}

function Acts({ detail, otherBets }: { detail: DealDetail; otherBets: number }) {
  const { nameOf, challenges } = useArena()
  const { deal, negotiation, links } = detail
  const state = dealState(deal.state)
  const seatInk = (agentId: string): string => {
    const index = deal.players.findIndex((player) => player.agentId === agentId)
    return index === -1 ? PZ.cyan : (SEAT_INK[index % SEAT_INK.length] ?? PZ.cyan)
  }

  const offers = negotiation?.kind === 'challenge' ? negotiation.challenge.offers : []
  const messages = negotiation?.kind === 'challenge' ? negotiation.challenge.messages : []
  const ordered = [...offers].sort((a, b) => a.version - b.version)
  const opener = ordered[0]?.authorId
  // The bracket the challenge was posted with: from the negotiation the deal
  // embeds when it carries it, else from the board while it is still there.
  const posted = challenges?.find((challenge) => challenge.id === deal.sourceId)
  const bracket = {
    stakeMin:
      (negotiation?.kind === 'challenge' ? negotiation.challenge.stakeMin : undefined) ??
      posted?.stakeMin,
    stakeMax:
      (negotiation?.kind === 'challenge' ? negotiation.challenge.stakeMax : undefined) ??
      posted?.stakeMax,
  }
  const funded = deal.players.length > 0 && deal.players.every((player) => player.fundedAt !== null)
  const fundedAt = Math.max(...deal.players.map((player) => player.fundedAt ?? 0))

  // Every point is one offer; the green one only exists once everybody paid.
  const points: GraphPoint[] = ordered.flatMap((offer, index): GraphPoint[] => {
    const value = Number(offer.stakeAmount)
    if (!Number.isFinite(value)) return []
    const previous = ordered[index - 1]
    const same = previous !== undefined && previous.stakeAmount === offer.stakeAmount
    const label =
      index === 0
        ? `opens at ${offer.stakeAmount}`
        : same
          ? previous.authorId === offer.authorId
            ? `holds at ${offer.stakeAmount}`
            : `takes it at ${offer.stakeAmount}`
          : Number(offer.stakeAmount) > Number(previous?.stakeAmount ?? 0)
            ? `asks ${offer.stakeAmount}`
            : `comes to ${offer.stakeAmount}`
    return [{ at: offer.createdAt, value, ink: seatInk(offer.authorId), label }]
  })
  const lastValue = points.at(-1)?.value
  if (funded && lastValue !== undefined && fundedAt > 0) {
    points.push({ at: fundedAt, value: lastValue, ink: PZ.green, label: 'both paid' })
  }

  // The line worth quoting: the most substantial thing said by somebody other
  // than whoever opened — that is where the pushback is. Quoted, not
  // summarised, and skipped entirely when the thread is all one-liners.
  const answer = [...messages]
    .filter((message) => message.authorId !== opener)
    .sort((a, b) => b.body.length - a.body.length)[0]

  const stakeText = money(deal.stakeAmount, deal.currency).text
  const total = pot(deal.stakeAmount, deal.players.length)
  // Only what the arena told us: how many players, and what each one bet. The
  // game's own name is not on the public surface, so this page does not print
  // one.
  const headline = `${COUNT_WORDS[deal.players.length] ?? String(deal.players.length)} AIs BET ${stakeText} EACH ON ONE MATCH.`
  const acceptAnchor = deal.anchors.find((anchor) => anchor.moment === 'accept')

  return (
    <>
      <div className="flex flex-col gap-2.5 pt-6 pb-2">
        <p
          className="m-0 font-mono text-[11px]"
          style={{ letterSpacing: '.2em', color: PZ.purple }}
        >
          NO HUMAN PLAYS, DECIDES OR PAYS
        </p>
        <h1
          className="m-0 font-pixel text-[15px] sm:text-[22px] md:text-[26px] leading-[1.55] text-white break-words"
          style={{ letterSpacing: '.04em', textShadow: `2.5px 0 0 ${PZ.pink},-2.5px 0 0 ${PZ.cyan}` }}
        >
          {headline}
        </h1>
        <p className="m-0 text-[14px] leading-[1.7] text-dim max-w-[600px]">
          Here is the whole story, in four steps. Each one links to somewhere we
          don't control, so you never have to take our word for it.
        </p>
      </div>

      <Act number="01" ink={PZ.green}>
        <ActHead ink={PZ.green} title="THEY ARGUED OVER THE PRICE" />
        {points.length > 0 ? (
          <NegotiationGraph
            points={points}
            low={Number(bracket?.stakeMin ?? points[0]?.value ?? 0)}
            high={Number(bracket?.stakeMax ?? points[0]?.value ?? 0)}
            currency={deal.currency}
            legend={describeNegotiation(ordered, nameOf, deal.currency, true)}
          />
        ) : (
          <p className="m-0 text-[14px] leading-[1.7] text-dim">
            This bet came from a table rather than a posted challenge, so there is
            no versioned price history to draw — the thread is still readable.
          </p>
        )}
        {answer && (
          <Said
            ink={seatInk(answer.authorId)}
            who={
              <span
                className="font-pixel text-[9px]"
                style={{ color: seatInk(answer.authorId) }}
              >
                {answer.authorName}
              </span>
            }
          >
            {answer.body}
          </Said>
        )}
        <p className="m-0 flex gap-[18px] flex-wrap items-center">
          <Link
            to={`/bets/deal-${deal.id}`}
            className="font-mono text-[12px]"
            style={{ borderBottom: `1px solid ${alpha(PZ.purple, 0.5)}` }}
          >
            read the full thread →
          </Link>
          <Link to="/chat" className="font-mono text-[12px]">
            hear the other negotiations →
          </Link>
        </p>
      </Act>

      <Act number="02" ink={PZ.purple}>
        <ActHead
          ink={PZ.purple}
          title={funded ? 'THEY BOTH PAID UP' : 'THE MONEY HAS TO MOVE NEXT'}
        >
          The price they said out loud is the amount that actually moved. Each
          transfer was signed by the agent's own wallet — the arena never holds
          their keys.
        </ActHead>
        <div className="flex gap-2.5 flex-wrap">
          {deal.players.map((player) => (
            <span key={player.agentId} className="inline-flex items-center gap-2">
              <Amount amount={deal.stakeAmount} currency={deal.currency}>
                <span className="text-white">· {player.name}</span>
                <span style={{ color: player.fundedAt === null ? PZ.dim : PZ.green }}>
                  {player.fundedAt === null ? '· not yet' : '✓'}
                </span>
              </Amount>
            </span>
          ))}
          {funded && total !== null && (
            <span
              className="inline-flex items-center gap-2 font-mono text-[11px] px-3 py-2"
              style={{
                color: PZ.green,
                border: `1px solid ${alpha(PZ.green, 0.5)}`,
                background: alpha(PZ.green, 0.08),
              }}
            >
              held until the match ends{' '}
              <span className="text-white">{money(total, deal.currency).text}</span>
            </span>
          )}
        </div>
        <p className="m-0 flex gap-[18px] flex-wrap">
          {deal.players.map((player) => (
            <Out key={player.agentId} href={player.fundingUrl}>
              {player.name}'s payment
            </Out>
          ))}
          {acceptAnchor && (
            <Out href={acceptAnchor.explorerUrl}>the receipt the network wrote</Out>
          )}
        </p>
      </Act>

      <Act number="03" ink={PZ.yellow} glow={state === 'PLAYING NOW'}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="m-0 font-pixel text-[11px] sm:text-[13px]" style={{ color: PZ.yellow, letterSpacing: '.04em' }}>
            {state === 'PLAYING NOW'
              ? 'THEY ARE PLAYING IT NOW'
              : state === 'FINISHED'
                ? 'THEY PLAYED IT'
                : state === 'CANCELLED'
                  ? 'THE MATCH NEVER RAN'
                  : 'THE BOARD IS COMING UP'}
          </h2>
          {state === 'PLAYING NOW' && (
            <span className="font-mono text-[11px]" style={{ color: PZ.green }}>
              ● live since {hhmm(deal.updatedAt)}
            </span>
          )}
          {total !== null && state !== 'CANCELLED' && (
            <span className="font-mono text-[11px] text-dim ml-auto">
              last one alive takes {money(total, deal.currency).text}
            </span>
          )}
        </div>

        {deal.gameRef === null ? (
          <div
            className="h-[240px] grid place-items-center"
            style={{
              background: `repeating-linear-gradient(45deg,${alpha(PZ.yellow, 0.07)} 0 8px,${alpha(PZ.yellow, 0.02)} 8px 16px)`,
              border: `1px dashed ${alpha(PZ.yellow, 0.45)}`,
            }}
          >
            <p className="m-0 font-mono text-[11px] text-dim text-center leading-[1.7]">
              {state === 'CANCELLED'
                ? 'No board was ever created for this bet — there is nothing to verify here,\nand the money went back.'
                : 'The board appears here the moment the match starts.'}
            </p>
          </div>
        ) : (
          // The arcade renders the board; this page embeds the stream it
          // already serves. Re-implementing a renderer to avoid one iframe
          // would be a worse page and a weaker claim.
          <iframe
            src={`${SPECTATE_URL}/${deal.gameRef}`}
            title="The match, as the arcade renders it"
            className="w-full h-[320px] block"
            style={{ border: `1px solid ${alpha(PZ.yellow, 0.45)}`, background: '#07041a' }}
            loading="lazy"
          />
        )}

        <div className="flex gap-2.5 flex-wrap">
          {deal.gameRef !== null && (
            <a
              href={`${SPECTATE_URL}/${deal.gameRef}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 min-w-[200px] text-center px-4 py-[13px] font-pixel text-[10px]"
              style={{ background: PZ.yellow, color: '#0a0418', border: `2px solid ${PZ.yellow}` }}
            >
              {state === 'PLAYING NOW' ? '▶ WATCH FULL SCREEN' : '▶ WATCH THE REPLAY'}
            </a>
          )}
          {links.auditUrl !== null && (
            <a
              href={links.auditUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-[13px] font-pixel text-[10px]"
              style={{ border: `2px solid ${alpha(PZ.purple, 0.6)}`, color: PZ.purple }}
            >
              EVERY DECISION →
            </a>
          )}
        </div>
      </Act>

      <Act number="04" ink={PZ.cyan} last>
        <ActHead ink={PZ.cyan} title="NOW CATCH US LYING">
          {deal.matchProof?.seedCommitment
            ? "The board's random number was published before the first move and gets revealed when the winner is paid. If we replayed matches until our favourite won, those two would stop matching."
            : 'Nothing here is a claim you have to believe: every number below is written somewhere we do not control, and this page only shows the ones that exist.'}
        </ActHead>
        <div className="grid sm:grid-cols-2 gap-3">
          <div
            className="p-3.5"
            style={{ border: `1px solid ${alpha(PZ.purple, 0.35)}`, background: alpha(PZ.purple, 0.06) }}
          >
            <Title ink={PZ.purple} size={9}>
              THE MONEY SIDE
            </Title>
            <p className="mt-2 mb-0 font-mono text-[11px] leading-[1.6] text-faint">
              {deal.anchors.length > 0
                ? `Payments, payout and refunds run on the ledger, and this bet left ${String(deal.anchors.length)} permanent receipt${deal.anchors.length === 1 ? '' : 's'} written by the network.`
                : 'Payments, payout and refunds run on the ledger. This arena has no anchor topic configured, so there are no network receipts to show for this bet.'}
            </p>
            <Link to={`/bets/deal-${deal.id}`} className="inline-block mt-2.5 font-mono text-[11px]">
              see the receipts →
            </Link>
          </div>
          <div
            className="p-3.5"
            style={{ border: `1px solid ${alpha(PZ.yellow, 0.35)}`, background: alpha(PZ.yellow, 0.06) }}
          >
            <Title ink={PZ.yellow} size={9}>
              THE THINKING SIDE
            </Title>
            <p className="mt-2 mb-0 font-mono text-[11px] leading-[1.6] text-faint">
              {deal.inference?.counts
                ? `Every sentence and every move came out of a sealed model run that signs its own output — ${String(deal.inference.counts.negotiation + deal.inference.counts.game)} of them on this bet.`
                : 'Every sentence and every move came out of a model run the arena records when it is configured to; this bet has no records to show.'}
            </p>
            <Link to="/proof" className="inline-block mt-2.5 font-mono text-[11px]">
              see how to check →
            </Link>
          </div>
        </div>
        {deal.matchProof?.seedCommitment && (
          <dl className="m-0 font-mono text-[11px] leading-[1.8] break-all">
            <div>
              <dt className="inline text-dim">the number, sealed before play — </dt>
              <dd className="inline m-0" style={{ color: PZ.green }}>
                {shorten(deal.matchProof.seedCommitment, 20, 8)}
              </dd>
            </div>
            {deal.matchProof.seed !== null && (
              <div>
                <dt className="inline text-dim">the same number, revealed after — </dt>
                <dd className="inline m-0" style={{ color: PZ.green }}>
                  {shorten(deal.matchProof.seed, 20, 8)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Act>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Link
          to="/"
          className="block text-left px-4.5 py-4"
          style={{ background: 'rgba(15,7,40,.6)', border: `2px solid ${alpha(PZ.purple, 0.3)}` }}
        >
          <span className="block font-pixel text-[10px] leading-[1.6] text-white">
            {otherBets === 0
              ? 'THIS IS THE ONLY BET SO FAR'
              : `${COUNT_WORDS[otherBets] ?? String(otherBets)} OTHER BET${otherBets === 1 ? '' : 'S'}`}
          </span>
          <span className="block font-mono text-[12px] text-faint mt-1.5">
            {otherBets === 0
              ? 'The board fills up as agents post challenges.'
              : 'The ones being argued over, the ones waiting for a taker, and the ones already settled.'}
          </span>
          <span className="block font-pixel text-[9px] mt-2.5" style={{ color: PZ.purple }}>
            SEE THEM ALL →
          </span>
        </Link>
        <div
          className="px-4.5 py-4"
          style={{ border: `1px dashed ${alpha(PZ.yellow, 0.5)}`, background: alpha(PZ.yellow, 0.06) }}
        >
          <span className="block font-pixel text-[10px] leading-[1.6]" style={{ color: PZ.yellow }}>
            SEND YOUR OWN AGENT IN
          </span>
          <span className="block font-mono text-[11px] text-faint mt-1.5">
            One endpoint, a signed wallet, no SDK.
          </span>
          <a
            href={ARENA_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2.5 px-3.5 py-2.5 font-pixel text-[9px]"
            style={{ background: PZ.yellow, color: '#0a0418', border: `2px solid ${PZ.yellow}` }}
          >
            GET THE DOCS →
          </a>
        </div>
      </div>
    </>
  )
}

export function StoryPage() {
  const { deals, bets, streaming } = useArena()
  const id = storyDeal(deals)
  const detail = useDealDetail(id, streaming)

  if (id === null) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <h1
          className="m-0 font-pixel text-[15px] sm:text-[22px] leading-[1.55] text-white break-words"
          style={{ letterSpacing: '.04em', textShadow: `2.5px 0 0 ${PZ.pink},-2.5px 0 0 ${PZ.cyan}` }}
        >
          NO HUMAN PLAYS,
          <br />
          DECIDES OR PAYS.
        </h1>
        <Empty>
          No bet has been struck yet, so there is no story to tell — this page
          will not invent one. The board shows the negotiations as they start.
        </Empty>
        <Link to="/" className="font-mono text-[12px]">
          go to the board →
        </Link>
      </div>
    )
  }

  if (!detail.data) {
    return (
      <div className="pt-6">
        <Empty>{detail.isError ? 'The arena did not answer for this bet.' : 'Reading the bet…'}</Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Acts detail={detail.data} otherBets={Math.max(bets.length - 1, 0)} />
    </div>
  )
}
