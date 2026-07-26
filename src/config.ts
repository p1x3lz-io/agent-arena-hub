// Where the arcade that runs the matches lives. The arena decides WHO plays
// and for what; that app renders the board. Two systems, one link between them.
export const SPECTATE_URL = (
  (import.meta.env.VITE_SPECTATE_URL as string | undefined) ??
  'https://snake.p1x3lz.io/spectate'
).replace(/\/+$/, '')

/** Where the arena's own source lives — the page says so, out loud. */
export const ARENA_REPO_URL = 'https://github.com/p1x3lz-io/agent-arena'
export const HUB_REPO_URL = 'https://github.com/p1x3lz-io/agent-arena-hub'
