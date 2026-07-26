import type { Offer } from '../api'
import { PZ, alpha } from '../pixel'
import { clock, money, span } from '../vocab'

// The negotiation, drawn. X is when each offer was posted, Y is what it asked
// for, and the colour is the seat of whoever posted it — so the shape of the
// haggling is readable before a single word is.
//
// Two things this component refuses to do. It never draws a value it was not
// given: every point is one row of `offers[]`, and the green point at the end
// only exists once every player has a `fundedAt`. And it never puts the time
// axis in a layout of its own — labels sit at the same percentage as their
// point, translated by half their width, so the alignment survives any width.

const HEIGHT = 140
const LEFT = 8
const RIGHT = 92

export interface GraphPoint {
  at: number
  value: number
  ink: string
  label: string
}

function positions(points: GraphPoint[]): number[] {
  if (points.length === 1) return [50]
  const first = points[0]?.at ?? 0
  const last = points.at(-1)?.at ?? 0
  const width = last - first
  if (width <= 0) {
    // Same millisecond for everything (a replayed fixture, a fast bot): fall
    // back to even spacing rather than stacking every point on one column.
    return points.map(
      (_, index) => LEFT + ((RIGHT - LEFT) * index) / Math.max(points.length - 1, 1),
    )
  }
  return points.map((point) => LEFT + ((point.at - first) / width) * (RIGHT - LEFT))
}

export function NegotiationGraph({
  points,
  low,
  high,
  currency,
  legend,
}: {
  points: GraphPoint[]
  /** The bracket the challenge was posted with, when the page has it. */
  low: number
  high: number
  currency: string
  legend: string
}) {
  if (points.length === 0) return null
  const values = points.map((point) => point.value)
  // The bracket only counts as a bracket when it has width; a challenge posted
  // at a single price gets breathing room instead, so the line does not ride
  // the top edge of the plot.
  const bracketed = high > low
  let lo = Math.min(low, ...values)
  let hi = Math.max(high, ...values)
  if (hi === lo) {
    const padding = Math.max(Math.abs(hi) * 0.5, 1)
    lo -= padding
    hi += padding
  }
  const range = hi - lo || 1
  const xs = positions(points)
  const yOf = (value: number): number => ((hi - value) / range) * HEIGHT

  // Ticks are the prices that were actually asked for, plus the two ends of
  // the bracket when one was posted. Nothing invented in between, and never a
  // number the padding above made up.
  const ticks = [...new Set([...(bracketed ? [high, low] : []), ...values])]
    .sort((a, b) => b - a)
    .map((value) => ({
      value,
      ink: points.find((point) => point.value === value)?.ink ?? PZ.dim,
    }))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[46px_1fr] gap-2.5 pb-6">
        <div
          className="relative font-mono text-[11px] text-dim"
          style={{ height: HEIGHT }}
        >
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className="absolute right-0 whitespace-nowrap"
              style={{ top: yOf(tick.value) - 6, color: tick.ink }}
            >
              {money(String(tick.value), currency).text}
            </span>
          ))}
        </div>

        <div
          className="relative"
          style={{
            height: HEIGHT,
            borderLeft: `1px solid ${alpha(PZ.purple, 0.3)}`,
            borderBottom: `1px solid ${alpha(PZ.purple, 0.3)}`,
            background: `repeating-linear-gradient(0deg,${alpha(PZ.purple, 0.07)} 0 1px,transparent 1px ${String(Math.round(HEIGHT / 3))}px)`,
          }}
        >
          {/* Staircase: the price holds, then steps. No obliques — the price
              did not drift, it was changed, at a moment we can name. */}
          {points.map((point, index) => {
            const x = xs[index] ?? 0
            const next = xs[index + 1] ?? RIGHT
            const previous = points[index - 1]
            const y = yOf(point.value)
            return (
              <span key={`seg-${String(index)}`}>
                <span
                  className="absolute"
                  style={{
                    left: `${String(x)}%`,
                    width: `${String(Math.max(next - x, 0))}%`,
                    top: y,
                    height: 2,
                    background: point.ink,
                  }}
                />
                {previous !== undefined && previous.value !== point.value && (
                  <span
                    className="absolute"
                    style={{
                      left: `${String(x)}%`,
                      top: Math.min(y, yOf(previous.value)),
                      height: Math.abs(yOf(previous.value) - y),
                      width: 2,
                      background: `repeating-linear-gradient(180deg,${point.ink} 0 4px,transparent 4px 8px)`,
                    }}
                  />
                )}
              </span>
            )
          })}

          {points.map((point, index) => (
            <span key={`dot-${String(index)}`}>
              <span
                className="absolute"
                style={{
                  left: `${String(xs[index] ?? 0)}%`,
                  top: yOf(point.value) - 5,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  background: point.ink,
                  boxShadow: `0 0 10px ${point.ink}`,
                }}
              />
              <span
                className="absolute font-mono text-[10px] whitespace-nowrap"
                style={{
                  left: `${String(xs[index] ?? 0)}%`,
                  // Alternating above and below keeps neighbouring labels off
                  // each other; the clamp keeps them inside the plot.
                  top: Math.min(
                    Math.max(yOf(point.value) + (index % 2 === 0 ? 14 : -26), 2),
                    HEIGHT - 16,
                  ),
                  // Centred on its point, except at the ends, where centring
                  // would push the label off the plot.
                  transform: `translateX(${
                    (xs[index] ?? 50) > 70 ? '-92%' : (xs[index] ?? 50) < 20 ? '-8%' : '-50%'
                  })`,
                  color: point.ink,
                }}
              >
                {point.label}
              </span>
            </span>
          ))}

          {/* Same percentage as the point above it, half its own width back. */}
          {points.map((point, index) => (
            <span
              key={`t-${String(index)}`}
              className="absolute font-mono text-[11px] text-dim"
              style={{
                left: `${String(xs[index] ?? 0)}%`,
                top: HEIGHT + 4,
                transform: 'translateX(-50%)',
              }}
            >
              {clock(point.at)}
            </span>
          ))}
        </div>
      </div>
      <p className="m-0 text-[14px] leading-[1.7] text-dim">{legend}</p>
    </div>
  )
}

/**
 * What the graph shows, in a sentence, derived from the offers themselves —
 * who opened, who moved, where it landed, and how long that took. If the deal
 * closed at the second agent's number, the sentence says so; it never claims
 * they met in the middle when they did not.
 */
export function describeNegotiation(
  offers: Offer[],
  nameOf: (agentId: string) => string | null,
  currency: string,
  /** True once the bet exists — everyone in the room said yes to the last price. */
  agreed = false,
): string {
  const ordered = [...offers].sort((a, b) => a.version - b.version)
  const first = ordered[0]
  const last = ordered.at(-1)
  if (first === undefined || last === undefined) return ''
  const opener = nameOf(first.authorId) ?? 'The challenger'
  const openAmount = money(first.stakeAmount, currency).text

  if (ordered.length === 1) {
    return agreed
      ? `${opener} named ${openAmount} a seat, and the others took it without haggling.`
      : `${opener} asked ${openAmount} and nobody has moved it since.`
  }

  const closer = nameOf(last.authorId) ?? 'the other agent'
  const finalAmount = money(last.stakeAmount, currency).text
  const took = span(first.createdAt, last.createdAt)
  const gap = took === null ? '' : `, ${took} later`
  const up = Number(last.stakeAmount) > Number(first.stakeAmount)
  const down = Number(last.stakeAmount) < Number(first.stakeAmount)

  if (last.authorId === first.authorId) {
    return up || down
      ? `${opener} opened at ${openAmount} and ${up ? 'raised' : 'came down'} to ${finalAmount}${gap}.`
      : `${opener} opened at ${openAmount} and reposted the same price${gap}.`
  }
  if (!up && !down) {
    // Same number, different author: that is somebody taking the price, not
    // somebody refusing it.
    return `${opener} asked ${openAmount} a seat, and ${closer} took it${gap}.`
  }
  return `${opener} opened at ${openAmount}. ${closer} would not take it, and the price ended at ${finalAmount}${gap}.`
}
