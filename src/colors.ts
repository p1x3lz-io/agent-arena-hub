// One palette for agent identity everywhere on the page. Inside a deal the
// colour follows the seat (players[0] is always cyan); outside a deal there is
// no seat, so the colour follows a stable hash of the agent id instead — the
// same agent keeps the same colour across the roster, the board and the feed.

export const SEAT_COLORS = [
  'text-neon-cyan',
  'text-neon-pink',
  'text-green-300',
  'text-neon-yellow',
]

export function agentColorOf(agentId: string): string {
  let hash = 0
  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0
  }
  return SEAT_COLORS[hash % SEAT_COLORS.length] ?? 'text-neon-cyan'
}
