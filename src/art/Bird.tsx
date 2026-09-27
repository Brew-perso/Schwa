import perch from './bird/bird-perch.webp'
import perchLeft from './bird/bird-perch-left.webp'
import fly from './bird/bird-fly.webp'
import listen from './bird/bird-listen.webp'
import cheer from './bird/bird-cheer.webp'

/**
 * The Schwa bird — the slate-blue songbird of the art direction (cork-board, 1930s–60s collage mock-up):
 * ink outline, coloured-pencil texture, cut out as a paper sticker. Raster illustrations derived from the
 * mock-up (FLUX.1 Kontext), cut out and edged by tools/art/sticker.py.
 * A calm companion, not a cartoon mascot (charte §1.2). Turn it towards the content it accompanies:
 * `perch` faces right (place it left of the content), `perch-left` faces left (place it on the right),
 * `listen` turns its head back to the left (place it right of what it listens to), `cheer` raises a wing
 * (end of a session, calibration done), `fly` for arrivals and new levels.
 */
type Pose = 'perch' | 'perch-left' | 'listen' | 'cheer' | 'fly'

const SRC: Record<Pose, { src: string; ratio: number }> = {
  perch: { src: perch, ratio: 431 / 420 },
  'perch-left': { src: perchLeft, ratio: 396 / 420 },
  listen: { src: listen, ratio: 502 / 420 },
  cheer: { src: cheer, ratio: 457 / 420 },
  fly: { src: fly, ratio: 427 / 480 },
}

export function Bird({ pose = 'perch', size = 160, className, title }: { pose?: Pose; size?: number; className?: string; title?: string }) {
  const { src, ratio } = SRC[pose]
  return (
    <img src={src} width={size} height={Math.round(size * ratio)} className={className} alt={title ?? ''}
      aria-hidden={title ? undefined : true} draggable={false} decoding="async" style={{ flex: 'none', userSelect: 'none' }} />
  )
}
