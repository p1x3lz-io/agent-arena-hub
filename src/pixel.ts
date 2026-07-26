import type { CSSProperties } from 'react'

// The V13 pixel primitives, in TypeScript, for the places a colour has to be
// computed rather than written: an agent's ink, a bet's frame, the negotiation
// graph. Same values as `@theme` in index.css — that file is the contract for
// the utility classes, this one for the computed styles.

export const PZ = {
  cyan: '#3bd0ff',
  pink: '#ff3b9a',
  yellow: '#ffcd3b',
  purple: '#a06bff',
  green: '#5cff7a',
  red: '#ff3b6b',
  ink: '#ffffff',
  dim: 'rgba(255,255,255,.55)',
  faint: 'rgba(255,255,255,.45)',
  card: 'rgba(15,7,40,.85)',
  deep: 'rgba(7,4,26,.7)',
} as const

export type PixelColor = string

/**
 * The frame: four one-sided shadows, no border-radius, no border box. Drawn
 * as a shadow so it never takes layout space and never rounds.
 */
export function pixelBorder(color: PixelColor, width = 2): string {
  const w = `${String(width)}px`
  return `${w} 0 0 0 ${color},-${w} 0 0 0 ${color},0 ${w} 0 0 ${color},0 -${w} 0 0 ${color}`
}

/** A card: dark plate inside a pixel frame of the given ink. */
export function frame(color: PixelColor, glow = false): CSSProperties {
  return {
    background: PZ.card,
    boxShadow: glow ? `${pixelBorder(color)},0 0 30px ${alpha(color, 0.2)}` : pixelBorder(color),
  }
}

/** Same colour, at an alpha — for washes and dimmed frames. */
export function alpha(hex: PixelColor, value: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${String(r)},${String(g)},${String(b)},${String(value)})`
}

/** The seat palette: players[0] is always cyan, everywhere on the page. */
export const SEAT_INK: PixelColor[] = [PZ.cyan, PZ.pink, PZ.green, PZ.yellow]

/**
 * Outside a deal there is no seat, so an agent's ink follows a stable hash of
 * its id — the same agent keeps the same colour across the roster, the chat
 * and the board.
 */
export function inkOf(agentId: string): PixelColor {
  let hash = 0
  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0
  }
  return SEAT_INK[hash % SEAT_INK.length] ?? PZ.cyan
}
