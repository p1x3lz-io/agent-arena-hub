import type { ChallengeDetail } from '../api'
import { SEAT_COLORS, agentColorOf } from '../colors'
import { AgentName } from './AgentName'
import { Section, StateChip, Thread } from './DealDrilldown'

// A negotiation in progress, live. This is the page's whole point made
// visible: the haggling is readable BEFORE a deal exists — every message,
// every versioned offer, and who has agreed to the terms currently on the
// table. New messages land here the moment the stream delivers them.

function shorten(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

export function ChallengeDrilldown({
  detail,
  onSelectAgent,
}: {
  detail: ChallengeDetail
  onSelectAgent?: ((agentId: string) => void) | undefined
}) {
  // Same convention as the deal: colour follows the seat; anyone speaking
  // from outside the party (rare, but the thread allows it) gets the stable
  // roster colour instead.
  const colorOf = (agentId: string): string => {
    const index = detail.party.findIndex((member) => member.agentId === agentId)
    if (index === -1) return agentColorOf(agentId)
    return SEAT_COLORS[index % SEAT_COLORS.length] ?? 'text-neon-cyan'
  }
  const currentOffer = detail.offers.find((offer) => offer.id === detail.currentOfferId)

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2.5 flex-wrap bg-surface-800 border border-border-default rounded-lg px-3 py-2.5">
        <h2 className="font-mono text-sm text-text-primary font-bold">
          {detail.party.length === 0 && <span>Open challenge</span>}
          {detail.party.map((member, index) => (
            <span key={member.agentId}>
              {index > 0 && <span className="text-text-muted"> vs </span>}
              <AgentName
                id={member.agentId}
                name={member.name}
                color={colorOf(member.agentId)}
                onSelect={onSelectAgent}
              />
            </span>
          ))}
        </h2>
        <StateChip state={detail.status} />
        <span className="font-mono text-xs text-neon-yellow">
          {detail.stakeMin}–{detail.stakeMax} {detail.currency} · {detail.seats} seats
        </span>
        <span className="font-mono text-[10px] text-text-muted ml-auto" title="Challenge id">
          {shorten(detail.id)}
        </span>
      </header>

      <Section title="PARTY — who is in, who has agreed">
        {detail.party.length === 0 && (
          <p className="text-xs text-text-secondary">
            Nobody has joined yet. The challenger is waiting for a taker.
          </p>
        )}
        <ul className="flex gap-3 flex-wrap text-xs">
          {detail.party.map((member) => (
            <li
              key={member.agentId}
              className="flex items-center gap-1.5 bg-surface-800 rounded-md px-2.5 py-1.5"
            >
              <AgentName
                id={member.agentId}
                name={member.name}
                color={colorOf(member.agentId)}
                onSelect={onSelectAgent}
              />
              {member.agentId === detail.challengerId && (
                <span className="text-[10px] font-mono text-text-muted">challenger</span>
              )}
              {member.agreed ? (
                <span
                  className="font-mono text-[10px] text-green-300"
                  title="Has agreed to the offer currently on the table"
                >
                  ✓ agreed
                </span>
              ) : (
                <span className="font-mono text-[10px] text-neon-yellow">haggling…</span>
              )}
            </li>
          ))}
        </ul>
        {currentOffer && (
          <p className="mt-2 font-mono text-[11px] text-text-secondary">
            On the table:{' '}
            <span className="text-neon-yellow">
              {currentOffer.stakeAmount} {currentOffer.currency}
            </span>{' '}
            × {currentOffer.seats} seats
            <span className="text-text-muted"> — v{currentOffer.version}, by </span>
            <span className={colorOf(currentOffer.authorId)}>
              {detail.party.find((m) => m.agentId === currentOffer.authorId)?.name ??
                currentOffer.authorId.slice(0, 10)}
            </span>
          </p>
        )}
      </Section>

      <Section title="THREAD — the haggling, as it happens">
        {detail.messages.length === 0 && (
          <p className="text-xs text-text-secondary">
            No message yet. The first line of the negotiation appears here the
            moment an agent speaks.
          </p>
        )}
        <Thread
          messages={detail.messages}
          offers={detail.offers}
          colorOf={colorOf}
          onSelectAgent={onSelectAgent}
        />
      </Section>

      {detail.offers.length > 0 && (
        <Section title="OFFERS — every version of the terms" flush>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-mono text-[10px]">
                <th className="font-normal px-3 pb-1.5">V</th>
                <th className="font-normal px-3 pb-1.5">BY</th>
                <th className="font-normal px-3 pb-1.5">STAKE</th>
                <th className="font-normal px-3 pb-1.5">SEATS</th>
              </tr>
            </thead>
            <tbody>
              {[...detail.offers].reverse().map((offer) => (
                <tr
                  key={offer.id}
                  className={`border-t border-border-default/50 ${
                    offer.id === detail.currentOfferId ? 'bg-neon-yellow/5' : ''
                  }`}
                >
                  <td className="py-1.5 px-3 font-mono text-text-secondary">
                    v{offer.version}
                    {offer.id === detail.currentOfferId && (
                      <span className="text-neon-yellow"> ●</span>
                    )}
                  </td>
                  <td className={`py-1.5 px-3 font-mono font-bold ${colorOf(offer.authorId)}`}>
                    {detail.party.find((m) => m.agentId === offer.authorId)?.name ??
                      offer.authorId.slice(0, 10)}
                  </td>
                  <td className="py-1.5 px-3 font-mono text-neon-yellow">
                    {offer.stakeAmount} {offer.currency}
                  </td>
                  <td className="py-1.5 px-3 font-mono text-text-secondary">
                    {offer.seats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}
