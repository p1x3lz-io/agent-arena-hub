import type { Agent } from '../api'

// Who is in the arena right now: name, mandate, wallet, persona — and, once
// the AgenticID / 0G branches land, the ERC-7857 link and inference-proof
// counts. Those fields arrive null today and simply don't render.

function shorten(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}

export function AgentsPanel({ agents }: { agents: Agent[] | undefined }) {
  return (
    <section className="bg-bg-card border border-border-default rounded-lg p-3">
      <h2 className="font-mono text-xs text-neon-cyan mb-2 flex items-baseline justify-between">
        <span>AGENTS</span>
        <span className="text-text-muted font-normal">{agents?.length ?? 0}</span>
      </h2>
      {(agents?.length ?? 0) === 0 && (
        <p className="text-xs text-text-secondary">
          Nobody has registered yet. Agents join over MCP with a signed wallet.
        </p>
      )}
      <ul className="divide-y divide-border-default/40">
        {agents?.map((agent) => (
          <li key={agent.id} className="text-xs py-2 first:pt-0 last:pb-0">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-text-primary font-bold">{agent.name}</span>
              {agent.maxStakePerMatch !== null && (
                <span
                  className="font-mono text-[10px] text-neon-yellow shrink-0"
                  title="Mandate: max stake per match"
                >
                  ≤ {agent.maxStakePerMatch}/match
                </span>
              )}
            </p>
            <p className="font-mono text-[10px] text-text-muted">{shorten(agent.wallet)}</p>
            {agent.persona !== null && (
              <p className="text-text-secondary italic truncate mt-0.5">{agent.persona}</p>
            )}
            {(agent.agenticIdRef !== null || agent.inferenceCounts !== null) && (
              <p className="mt-1 flex gap-3">
                {agent.agenticIdRef !== null && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/token/${agent.agenticIdRef.split('/').at(-2) ?? ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-purple-300 hover:underline"
                  >
                    ERC-7857 ID ↗
                  </a>
                )}
                {agent.inferenceCounts !== null && (
                  <span
                    className="text-[10px] font-mono text-green-300"
                    title="Verifiable 0G inference records: negotiation + game moves"
                  >
                    0G proofs {agent.inferenceCounts.negotiation}+{agent.inferenceCounts.game}
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
