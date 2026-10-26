/** Display-only foot anchors in already-interpolated map pixels. No 3D ground or balance model. */
export type HumanFacing = 'down' | 'left' | 'right' | 'up'
export type HumanFootSide = 'left' | 'right'
export interface HumanGaitPoint { x: number; y: number }
export interface HumanGaitAvailability { left: boolean; right: boolean }
export interface HumanGaitInput {
  root: HumanGaitPoint
  facing: HumanFacing
  moving: boolean
  dtMs: number
  instant: boolean
  available?: HumanGaitAvailability
}
export interface HumanFootPose extends HumanGaitPoint {
  lift: number
  contact: boolean
  present: boolean
  swing: boolean
  /** Changes on each newly committed contact, including after reset/restoration. */
  plantId: number
  stanceAnchor: HumanGaitPoint | null
}
export interface HumanGaitPose {
  root: HumanGaitPoint
  facing: HumanFacing
  left: HumanFootPose
  right: HumanFootPose
  supportContacts: number
  maxStanceDrift: number
  stepCount: number
  /** Rebased observations have no contact; do not compare them as a continuous stance. */
  rebased: boolean
  epoch: number
}

export const HUMAN_GAIT = Object.freeze({ lateral: 2.2, threshold: 6, ahead: 6, swingMs: 230, lift: 2, discontinuity: 48 })
const EPS = 1e-9
const SIDES: readonly HumanFootSide[] = ['left', 'right']
const FACING: Readonly<Record<HumanFacing, HumanGaitPoint>> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
}
interface Foot extends HumanGaitPoint {
  lift: number
  present: boolean
  anchor: HumanGaitPoint | null
  plantId: number
  needsPlacement: boolean
}
interface Swing {
  side: HumanFootSide
  from: HumanGaitPoint
  to: HumanGaitPoint
  elapsed: number
}
const other = (side: HumanFootSide): HumanFootSide => side === 'left' ? 'right' : 'left'

/** Time when a linearly moving rest point exits a planted foot's threshold circle. */
function exitTime(dx: number, dy: number, vx: number, vy: number, radius: number): number {
  const c = dx * dx + dy * dy - radius * radius, a = vx * vx + vy * vy
  if (a < 1e-20) return c > EPS ? 0 : Infinity
  const radial = dx * vx + dy * vy, discriminant = radial * radial - a * c
  if (c > EPS && (radial >= 0 || discriminant <= 0)) return 0
  if (Math.abs(c) <= EPS && radial >= 0) return 0
  return Math.max(0, (-radial + Math.sqrt(Math.max(0, discriminant))) / a)
}

export class HumanGait {
  private root: HumanGaitPoint | null = null
  private heading: HumanGaitPoint = { x: 0, y: 1 }
  private feet: Record<HumanFootSide, Foot> = {
    left: { x: 0, y: 0, lift: 0, present: true, anchor: null, plantId: 0, needsPlacement: false },
    right: { x: 0, y: 0, lift: 0, present: true, anchor: null, plantId: 0, needsPlacement: false },
  }
  private swing: Swing | null = null
  private next: HumanFootSide = 'left'
  private nextPlantId = 0
  private epoch = 0
  private stepCount = 0
  private maxStanceDrift = 0

  /** Call on scene/owner changes and hidden reentry, even if the new root is nearby. */
  reset(): void {
    this.root = null
    this.swing = null
    this.next = 'left'
    this.stepCount = 0
    this.maxStanceDrift = 0
  }

  update(input: HumanGaitInput): HumanGaitPose {
    const { root, facing, dtMs } = input
    if (![root.x, root.y, dtMs].every(Number.isFinite) || dtMs < 0 || !Object.hasOwn(FACING, facing)) {
      throw new Error('Human gait requires finite map pixels, nonnegative time and a valid facing')
    }
    const available = input.available ?? { left: true, right: true }
    if (!this.root || input.instant || Math.hypot(root.x - this.root.x, root.y - this.root.y) > HUMAN_GAIT.discontinuity) {
      this.rebase(root, facing, available)
      return this.observe(input, true)
    }
    for (const side of SIDES) {
      const foot = this.feet[side], present = available[side]
      if (!present) {
        foot.anchor = null
        foot.lift = 0
        if (this.swing?.side === side) this.swing = null
      } else if (!foot.present) {
        foot.needsPlacement = true
      }
      foot.present = present
    }
    // Retain the last processed root as well: a zero-time observation cannot eat queued travel.
    // Explicit reset/instant/discontinuity above is a new ownership epoch, not a zero-time step.
    if (dtMs === 0) return this.observe(input, false)

    const start = this.root, vx = (root.x - start.x) / dtMs, vy = (root.y - start.y) / dtMs
    const travel = Math.hypot(root.x - start.x, root.y - start.y)
    if (travel > EPS) this.heading = { x: (root.x - start.x) / travel, y: (root.y - start.y) / travel }
    for (const side of SIDES) {
      const foot = this.feet[side]
      if (!foot.present || this.swing?.side === side) continue
      if (foot.needsPlacement) {
        Object.assign(foot, this.rest(start, facing, side))
        foot.needsPlacement = false
      }
      if (!foot.anchor) this.plant(side)
    }

    // Exact event times make subdivision of the same linear root path equivalent.
    // Piecewise paths remain caller-owned; no resmoothing or guessed path between turns.
    let time = 0
    while (true) {
      if (this.swing) {
        const swing = this.swing, foot = this.feet[swing.side]
        const advance = Math.min(dtMs - time, HUMAN_GAIT.swingMs - swing.elapsed)
        swing.elapsed += advance
        time += advance
        const progress = Math.min(1, swing.elapsed / HUMAN_GAIT.swingMs)
        const ease = progress * progress * (3 - 2 * progress)
        foot.x = swing.from.x + (swing.to.x - swing.from.x) * ease
        foot.y = swing.from.y + (swing.to.y - swing.from.y) * ease
        foot.lift = HUMAN_GAIT.lift * Math.sin(Math.PI * progress)
        if (swing.elapsed < HUMAN_GAIT.swingMs - EPS) break
        foot.x = swing.to.x
        foot.y = swing.to.y
        this.plant(swing.side)
        this.swing = null
      }

      const here = { x: start.x + vx * time, y: start.y + vy * time }
      let side: HumanFootSide | null = null, wait = Infinity
      for (const candidate of [this.next, other(this.next)]) {
        const foot = this.feet[candidate]
        if (!foot.present) continue
        const rest = this.rest(here, facing, candidate)
        const delay = exitTime(rest.x - foot.x, rest.y - foot.y, vx, vy, input.moving ? HUMAN_GAIT.threshold : .15)
        if (delay < wait - EPS) { side = candidate; wait = delay }
      }
      if (!side || wait > dtMs - time + EPS) break
      time = Math.min(dtMs, time + wait)
      const at = { x: start.x + vx * time, y: start.y + vy * time }
      const target = this.rest(at, facing, side), foot = this.feet[side]
      if (input.moving) {
        target.x += this.heading.x * HUMAN_GAIT.ahead
        target.y += this.heading.y * HUMAN_GAIT.ahead
      }
      this.swing = { side, from: { x: foot.x, y: foot.y }, to: target, elapsed: 0 }
      foot.anchor = null
      this.next = other(side)
      this.stepCount++
      if (time >= dtMs - EPS) break
    }
    this.root = { ...root }
    return this.observe(input, false)
  }

  private rest(root: HumanGaitPoint, facing: HumanFacing, side: HumanFootSide): HumanGaitPoint {
    const forward = FACING[facing], offset = HUMAN_GAIT.lateral * (side === 'left' ? 1 : -1)
    return { x: root.x + forward.y * offset, y: root.y - forward.x * offset }
  }

  private rebase(root: HumanGaitPoint, facing: HumanFacing, available: HumanGaitAvailability): void {
    this.root = { ...root }
    this.heading = { ...FACING[facing] }
    this.swing = null
    this.next = 'left'
    this.epoch++
    for (const side of SIDES) {
      this.feet[side] = { ...this.rest(root, facing, side), lift: 0, present: available[side], anchor: null, plantId: ++this.nextPlantId, needsPlacement: false }
    }
  }

  private plant(side: HumanFootSide): void {
    const foot = this.feet[side]
    foot.lift = 0
    foot.anchor = { x: foot.x, y: foot.y }
    foot.plantId = ++this.nextPlantId
  }

  private observe(input: HumanGaitInput, rebased: boolean): HumanGaitPose {
    const footPose = (side: HumanFootSide): HumanFootPose => {
      const foot = this.feet[side], contact = foot.present && !!foot.anchor
      if (contact) this.maxStanceDrift = Math.max(this.maxStanceDrift, Math.hypot(foot.x - foot.anchor!.x, foot.y - foot.anchor!.y))
      return { x: foot.x, y: foot.y, lift: foot.lift, present: foot.present, contact, swing: foot.present && this.swing?.side === side, plantId: foot.plantId, stanceAnchor: contact ? { ...foot.anchor! } : null }
    }
    const left = footPose('left'), right = footPose('right')
    return { root: { ...input.root }, facing: input.facing, left, right, supportContacts: Number(left.contact) + Number(right.contact), maxStanceDrift: this.maxStanceDrift, stepCount: this.stepCount, rebased, epoch: this.epoch }
  }
}
