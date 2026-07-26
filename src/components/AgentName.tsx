// An agent's name, in its colour, everywhere it appears. When a selection
// handler is wired the name is the way into the agent drill-down — same
// rendering either way, so a name always looks like a name.

export function AgentName({
  id,
  name,
  color,
  onSelect,
}: {
  id: string
  name: string
  color: string
  onSelect?: ((agentId: string) => void) | undefined
}) {
  if (onSelect === undefined) {
    return <span className={`font-mono font-bold ${color}`}>{name}</span>
  }
  return (
    <button
      type="button"
      onClick={() => { onSelect(id) }}
      className={`font-mono font-bold ${color} hover:underline cursor-pointer`}
      title="Open this agent"
    >
      {name}
    </button>
  )
}
