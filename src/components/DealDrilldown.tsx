import type { ReactNode } from 'react'
import { SPECTATE_URL } from '../config'
import type { DealDetail, Message, Offer } from '../api'

// The selected deal, end to end: the negotiation that produced it, who paid
// what (with the transaction each link proves), the consensus anchors, the
// match proof, and a way into the match itself.
//
// The board and the replay are rendered by the arcade that runs the match, not
// here: this page is about the DEAL, and re-implementing a game renderer to
// avoid one link would be a worse page and a worse claim.

const STATE_COLORS: Record<string, string> = {
  ACCEPTED: 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/5',
  FUNDED: 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/5',
  SPAWNING: 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/5',
  PLAYING: 'text-green-300 border-green-400/40 bg-green-400/5',
  SETTLING: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/5',
  SETTLED: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/5',
  ABORTING: 'text-red-400 border-red-400/40 bg-red-400/5',
  ABORTED: 'text-red-400 border-red-400/40 bg-red-400/5',
}

/** One colour per seat, applied to that agent's name everywhere in the deal. */
const SEAT_COLORS = ['text-neon-cyan', 'text-neon-pink', 'text-green-300', 'text-neon-yellow']

export function StateChip({ state }: { state: string }) {
  return (
    <span
      className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${STATE_COLORS[state] ?? 'text-text-muted border-border-default'}`}
    >
      {state}
    </span>
  )
}

function shorten(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-purple-300 hover:text-purple-200 hover:underline font-mono text-xs transition-colors duration-150"
    >
      {label} ↗
    </a>
  )
}

function Thread({
  messages,
  offers,
  colorOf,
}: {
  messages: Message[]
  offers: Offer[]
  colorOf: (agentId: string) => string
}) {
  const offerById = new Map(offers.map((offer) => [offer.id, offer]))
  return (
    <ol className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {messages.map((message) => {
        const offer = message.offerId === null ? undefined : offerById.get(message.offerId)
        return (
          <li key={message.id} className="text-xs bg-surface-800 rounded-md px-2.5 py-1.5">
            <p className="flex items-baseline justify-between gap-2">
              <span className={`font-mono font-bold ${colorOf(message.authorId)}`}>
                {message.authorName}
              </span>
              {offer && (
                <span className="font-mono text-[10px] text-neon-yellow shrink-0">
                  offer v{offer.version} · {offer.stakeAmount}
                </span>
              )}
            </p>
            <p className="text-text-primary mt-0.5 leading-snug">{message.body}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Section({
  title,
  children,
  flush = false,
}: {
  title: string
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className={`bg-bg-card border border-border-default rounded-lg ${flush ? 'overflow-hidden' : 'p-3'}`}>
      <h3 className={`font-mono text-xs text-neon-cyan ${flush ? 'p-3 pb-0' : ''} mb-2`}>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function DealDrilldown({ detail }: { detail: DealDetail }) {
  const { deal, negotiation, links } = detail
  const winner = deal.players.find((player) => player.agentId === deal.winnerId)
  const colorOf = (agentId: string): string => {
    const index = deal.players.findIndex((player) => player.agentId === agentId)
    return SEAT_COLORS[index >= 0 ? index % SEAT_COLORS.length : 0] ?? 'text-neon-cyan'
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2.5 flex-wrap bg-surface-800 border border-border-default rounded-lg px-3 py-2.5">
        <h2 className="font-mono text-sm text-text-primary font-bold">
          {deal.players.map((player, index) => (
            <span key={player.agentId}>
              {index > 0 && <span className="text-text-muted"> vs </span>}
              <span className={colorOf(player.agentId)}>{player.name}</span>
            </span>
          ))}
        </h2>
        <StateChip state={deal.state} />
        <span className="font-mono text-xs text-neon-yellow">
          {deal.stakeAmount} {deal.currency} × {deal.players.length}
        </span>
        {winner && (
          <span className="font-mono text-xs text-text-primary">
            🏆 <span className={colorOf(winner.agentId)}>{winner.name}</span> takes the pot
          </span>
        )}
        {deal.abortReason !== null && (
          <span className="font-mono text-xs text-red-400">{deal.abortReason}</span>
        )}
        <span className="font-mono text-[10px] text-text-muted ml-auto" title="Deal id">
          {shorten(deal.id)}
        </span>
      </header>

      {deal.gameRef !== null && (
        <div className="border border-neon-cyan/50 bg-neon-cyan/5 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="font-mono text-sm text-neon-cyan">
              {deal.state === 'PLAYING' ? '● LIVE' : '▶ REPLAY'} — on the arcade that ran it
            </span>
            <a
              href={`${SPECTATE_URL}/${deal.gameRef}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-neon-cyan hover:underline"
            >
              open full ↗
            </a>
          </div>
          {/* The real spectate page, framed. Nothing is re-implemented here:
              what plays below is the arcade's own renderer, which is the
              point — the hub shows the source, it does not paraphrase it. */}
          <iframe
            src={`${SPECTATE_URL}/${deal.gameRef}`}
            title={`Match ${deal.gameRef}`}
            loading="lazy"
            className="w-full aspect-video bg-black border-t border-neon-cyan/30"
            allow="fullscreen"
          />
        </div>
      )}

      {negotiation?.kind === 'challenge' && (
        <Section title="NEGOTIATION — the transcript behind the hash">
          <Thread
            messages={negotiation.challenge.messages}
            offers={negotiation.challenge.offers}
            colorOf={colorOf}
          />
          <p className="mt-2 font-mono text-[10px] text-text-muted break-all">
            sha256 <span className="text-text-secondary">{deal.transcriptHash}</span>
          </p>
        </Section>
      )}

      <Section title="FUNDING & PAYOUTS — every transfer, agent-signed" flush>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-text-muted font-mono text-[10px]">
              <th className="font-normal px-3 pb-1.5">AGENT</th>
              <th className="font-normal px-3 pb-1.5">FUNDED</th>
              <th className="font-normal px-3 pb-1.5">PAYOUT / REFUND</th>
            </tr>
          </thead>
          <tbody>
            {deal.players.map((player) => (
              <tr key={player.agentId} className="border-t border-border-default/50">
                <td className={`py-1.5 px-3 font-mono font-bold ${colorOf(player.agentId)}`}>
                  {player.name}
                </td>
                <td className="py-1.5 px-3">
                  {player.fundingUrl !== null ? (
                    <ExternalLink
                      label={shorten(player.fundingRef ?? '')}
                      href={player.fundingUrl}
                    />
                  ) : player.fundedAt !== null ? (
                    <span className="text-green-300 font-mono">✓ funded</span>
                  ) : (
                    <span className="text-text-muted font-mono">pending…</span>
                  )}
                </td>
                <td className="py-1.5 px-3">
                  {player.payoutUrl !== null && (
                    <ExternalLink
                      label={`payout ${shorten(player.payoutRef ?? '')}`}
                      href={player.payoutUrl}
                    />
                  )}
                  {player.refundUrl !== null && (
                    <ExternalLink
                      label={`refund ${shorten(player.refundRef ?? '')}`}
                      href={player.refundUrl}
                    />
                  )}
                  {player.payoutUrl === null && player.refundUrl === null && (
                    <span className="text-text-muted font-mono">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deal.escrowUrl !== null && (
          <p className="px-3 py-2 border-t border-border-default/50">
            <ExternalLink label="Escrow settlement" href={deal.escrowUrl} />
          </p>
        )}
      </Section>

      {(deal.transcript?.downloadUrl || deal.inference?.counts) && (
        <Section title="THINKING & TRANSCRIPT — what the agents actually did">
          {deal.inference?.counts && (
            <p className="font-mono text-xs text-text-secondary">
              <span className="text-neon-green">
                {deal.inference.counts.negotiation + deal.inference.counts.game}
              </span>{' '}
              verifiable 0G inference records
              <span className="text-text-muted">
                {' '}
                ({deal.inference.counts.negotiation} haggling,{' '}
                {deal.inference.counts.game} play)
              </span>
            </p>
          )}
          {deal.transcript?.downloadUrl && (
            <p className="mt-1.5 flex gap-4">
              <ExternalLink
                label="Negotiation transcript (0G Storage)"
                href={deal.transcript.downloadUrl}
              />
              {deal.transcript.explorerUrl && (
                <ExternalLink label="Storage record" href={deal.transcript.explorerUrl} />
              )}
            </p>
          )}
        </Section>
      )}

      {(deal.anchors.length > 0 || deal.matchProof !== null) && (
        <section className="bg-surface-900 border border-border-default rounded-lg p-3">
          <h3 className="font-mono text-xs text-neon-cyan mb-2">
            VERIFY — don't trust the arena, check the ledger
          </h3>
          {deal.anchors.length > 0 && (
            <ul className="flex gap-2 flex-wrap mb-2">
              {deal.anchors.map((anchor) => (
                <li key={anchor.moment}>
                  <a
                    href={anchor.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-mono text-[11px] px-2 py-1 rounded-sm border border-purple-400/40 bg-violet/10 text-purple-300 hover:bg-violet/25 transition-colors duration-150"
                    title={`HCS message ${anchor.topicId}#${String(anchor.sequenceNumber)}`}
                  >
                    ⚓ {anchor.moment} · seq {anchor.sequenceNumber} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
          {deal.matchProof !== null && (
            <dl className="font-mono text-[11px] leading-relaxed">
              {([
                ['commitment', deal.matchProof.seedCommitment],
                ['seed', deal.matchProof.seed],
                ['results', deal.matchProof.resultsHash],
              ] as const)
                .filter(([, value]) => value !== null)
                .map(([key, value]) => (
                  <div key={key} className="break-all">
                    <dt className="inline text-text-muted">{key.padEnd(11, ' ')}</dt>
                    <dd className="inline text-neon-green">{value}</dd>
                  </div>
                ))}
            </dl>
          )}
          {(links.replayUrl !== null || links.auditUrl !== null) && (
            <p className="mt-2 flex gap-4">
              {links.replayUrl !== null && (
                <ExternalLink label="Replay pin (IPFS)" href={links.replayUrl} />
              )}
              {links.auditUrl !== null && (
                <ExternalLink label="LLM decision audit (IPFS)" href={links.auditUrl} />
              )}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
