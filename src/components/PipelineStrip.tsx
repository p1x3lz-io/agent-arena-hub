import type { Stage, StageStatus } from '../stageModel'

// The A→Z rail — the hero of the demo. Nine nodes on one connected track;
// the filled segment shows how far the selected deal's story has run, the
// active node glows, a failure breaks the rail in red. Equal columns so the
// whole story always fits the viewport (scroll only under ~1000px).

const NODE_CLASSES: Record<StageStatus, string> = {
  done: 'bg-neon-cyan border-neon-cyan',
  active: 'bg-neon-yellow border-neon-yellow hub-node-active',
  pending: 'bg-surface-700 border-surface-600',
  failed: 'bg-neon-red border-neon-red',
}

const TITLE_CLASSES: Record<StageStatus, string> = {
  done: 'text-neon-cyan',
  active: 'text-neon-yellow',
  pending: 'text-text-muted',
  failed: 'text-red-400',
}

function railColor(left: Stage | undefined, right: Stage | undefined): string {
  if (left?.status === 'failed' || right?.status === 'failed') return 'bg-red-400/50'
  if (right?.status === 'done' || right?.status === 'active') return 'bg-neon-cyan/70'
  return 'bg-surface-600'
}

function Badge({ label, href }: { label: string; href: string }) {
  const classes =
    'inline-block max-w-full truncate px-1.5 py-0.5 text-[10px] font-mono rounded-sm ' +
    'border border-violet/40 bg-violet/10 text-purple-300 ' +
    'hover:bg-violet/25 hover:border-violet/70 transition-colors duration-150'
  return (
    <a href={href} target="_blank" rel="noreferrer" className={classes}>
      {label} ↗
    </a>
  )
}

export function PipelineStrip({ stages }: { stages: Stage[] }) {
  return (
    <div className="overflow-x-auto bg-surface-800 border border-border-default rounded-lg px-3 pt-4 pb-3">
      <ol
        className="grid min-w-[960px]"
        style={{ gridTemplateColumns: `repeat(${String(stages.length)}, 1fr)` }}
      >
        {stages.map((stage, index) => (
          <li key={stage.key} className="relative flex flex-col items-center gap-1.5 px-1">
            {/* Rail segments, drawn behind the node. */}
            {index > 0 && (
              <span
                aria-hidden
                className={`absolute left-0 right-1/2 top-[5px] h-0.5 mr-1.5 ${railColor(stages[index - 1], stage)}`}
              />
            )}
            {index < stages.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-1/2 right-0 top-[5px] h-0.5 ml-1.5 ${railColor(stage, stages[index + 1])}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-[1] w-3 h-3 border-2 ${NODE_CLASSES[stage.status]}`}
            />
            <p
              className={`font-mono text-[11px] font-bold leading-none ${TITLE_CLASSES[stage.status]}`}
            >
              {stage.status === 'failed' ? '✕ ' : ''}
              {stage.title}
            </p>
            <p
              className={`text-[10px] leading-tight text-center max-w-[9.5rem] ${
                stage.status === 'failed' ? 'text-red-400' : 'text-text-secondary'
              }`}
            >
              {stage.failureReason ?? stage.detail}
            </p>
            {stage.badges.length > 0 && (
              <p className="flex flex-wrap justify-center gap-1 max-w-[10rem]">
                {stage.badges.map((badge) => (
                  <Badge key={badge.label} label={badge.label} href={badge.href} />
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
