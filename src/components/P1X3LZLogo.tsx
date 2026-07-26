// The mark, as the arcade draws it. Pixel-rendered on purpose: this is a
// 16-bit product, and a smoothed logo would be the first thing that looks wrong.

const RATIO = 1536 / 784

export function P1X3LZLogo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/brand/logo.png"
      alt="P1X3LZ"
      width={size * RATIO}
      height={size}
      style={{
        height: size,
        width: size * RATIO,
        objectFit: 'contain',
        imageRendering: 'pixelated',
        filter: `drop-shadow(0 0 ${size / 3}px rgba(245,183,49,0.35))`,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  )
}
