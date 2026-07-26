import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PZ, alpha, pixelBorder } from './pixel'
import { money } from './vocab'

// The pieces the prototype is made of. Every one of them exists because the
// same shape shows up on four screens: a plate in a pixel frame, a chip, a
// money marker, a link that only exists when it has a target.

export function Card({
  ink = PZ.purple,
  glow = false,
  className = '',
  style,
  children,
}: {
  ink?: string
  glow?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={`bg-[rgba(15,7,40,.85)] p-[18px] ${className}`}
      style={{
        boxShadow: glow
          ? `${pixelBorder(ink)},0 0 30px ${alpha(ink, 0.2)}`
          : pixelBorder(ink),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A section heading: pixel type, 10px, in the section's own ink. */
export function Title({
  ink = PZ.ink,
  size = 10,
  className = '',
  children,
}: {
  ink?: string
  size?: number
  className?: string
  children: ReactNode
}) {
  return (
    <p
      className={`font-pixel leading-[1.7] m-0 ${className}`}
      style={{ color: ink, fontSize: `${String(size)}px`, letterSpacing: '.04em' }}
    >
      {children}
    </p>
  )
}

/** The page-level heading of a view. */
export function PageHead({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <h2 className="font-pixel text-[14px] leading-[1.6] text-white m-0">{title}</h2>
      {children !== undefined && (
        <p className="m-0 text-[13px] leading-[1.7] text-dim max-w-[620px]">{children}</p>
      )}
    </div>
  )
}

export function Chip({ ink, children }: { ink: string; children: ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] px-[7px] py-[3px] shrink-0 whitespace-nowrap"
      style={{ color: ink, border: `1px solid ${alpha(ink, 0.53)}` }}
    >
      {children}
    </span>
  )
}

/**
 * An amount, marked for what it is. Play money is purple and dashed and says
 * so; real money is solid yellow. The two never look alike, and neither ever
 * carries a `$`.
 */
export function Amount({
  amount,
  currency,
  suffix,
  children,
}: {
  amount: string
  currency: string
  suffix?: string | undefined
  children?: ReactNode
}) {
  const value = money(amount, currency)
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-[11px] px-[7px] py-[3px]"
      style={{
        color: value.ink,
        border: `1px ${value.play ? 'dashed' : 'solid'} ${alpha(value.ink, 0.7)}`,
        background: alpha(value.ink, 0.08),
      }}
      title={value.play ? 'Play money — testnet ℏ, worth nothing outside this arena' : 'Real value'}
    >
      {value.mark} {value.text}
      {suffix !== undefined && <span className="text-dim">{suffix}</span>}
      {children}
    </span>
  )
}

/**
 * A link, only when there is something to open. Rule from the page's own
 * promise: a dead `—` that looks clickable costs more than an empty cell.
 */
export function Out({
  href,
  children,
  className = '',
}: {
  href: string | null | undefined
  children: ReactNode
  className?: string
}) {
  if (href === null || href === undefined || href === '') {
    return <span className={`font-mono text-[11px] text-dim ${className}`}>{children}</span>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-[11px] ${className}`}
    >
      {children} ↗
    </a>
  )
}

/** An agent's name in its own ink, linking to its page. */
export function AgentLink({
  id,
  name,
  ink,
  size = 9,
}: {
  id: string
  name: string
  ink: string
  size?: number
}) {
  return (
    <Link
      to={`/agents/${encodeURIComponent(id)}`}
      className="font-pixel hover:underline"
      style={{ color: ink, fontSize: `${String(size)}px` }}
      title="Open this agent"
    >
      {name}
    </Link>
  )
}

/** A line an agent said, in its ink, quoted rather than summarised. */
export function Said({
  ink,
  who,
  time,
  offer,
  children,
}: {
  ink: string
  who: ReactNode
  time?: string
  offer?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className="px-[14px] py-3"
      style={{ borderLeft: `3px solid ${ink}`, background: alpha(ink, 0.06) }}
    >
      <p className="m-0 flex items-baseline gap-2.5 flex-wrap">
        {who}
        {offer}
        {time !== undefined && (
          <span className="font-mono text-[11px] text-dim ml-auto tabular-nums">{time}</span>
        )}
      </p>
      <p className="mt-2 mb-0 font-mono text-[12px] leading-[1.6] text-white whitespace-pre-wrap break-words">
        {children}
      </p>
    </div>
  )
}

/** The primary call to action of a screen — one per screen, at most. */
export function BigButton({
  href,
  to,
  ink,
  children,
}: {
  href?: string
  to?: string
  ink: string
  children: ReactNode
}) {
  const style: CSSProperties = {
    background: ink,
    color: '#0a0418',
    border: `2px solid ${ink}`,
  }
  const className =
    'block text-center px-4 py-[13px] font-pixel text-[10px] leading-[1.6] hover:opacity-90'
  if (to !== undefined) {
    return (
      <Link to={to} className={className} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} style={style}>
      {children}
    </a>
  )
}

/** Nothing to show, said plainly — the degraded state is the nominal state. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 font-mono text-[12px] leading-[1.7] text-dim px-4 py-3"
      style={{ border: `1px dashed ${alpha(PZ.purple, 0.35)}` }}
    >
      {children}
    </p>
  )
}
