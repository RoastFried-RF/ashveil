import { describe, expect, it } from 'vitest'
import { HumanGait, HUMAN_GAIT, type HumanGaitInput, type HumanGaitPose } from '../src/client/render/human-gait'

const sides = ['left', 'right'] as const
const update = (gait: HumanGait, x: number, y: number, dtMs: number, options: Partial<HumanGaitInput> = {}) =>
  gait.update({ root: { x, y }, facing: 'down', moving: true, instant: false, dtMs, ...options })
function ready(x = 0, y = 0) {
  const gait = new HumanGait()
  update(gait, x, y, 0)
  return { gait, pose: update(gait, x, y, 1, { moving: false }) }
}
function continuousContacts(before: HumanGaitPose, after: HumanGaitPose) {
  for (const side of sides) {
    const a = before[side], b = after[side]
    if (a.contact && b.contact && a.plantId === b.plantId && before.epoch === after.epoch) {
      expect({ x: b.x, y: b.y }).toEqual({ x: a.x, y: a.y })
      expect(b.stanceAnchor).toEqual(a.stanceAnchor)
    }
    expect(b.contact).toBe(b.present && b.stanceAnchor !== null)
    if (b.contact) {
      expect(b.lift).toBe(0)
      expect(b.swing).toBe(false)
      expect(b.stanceAnchor).toEqual({ x: b.x, y: b.y })
    }
  }
  expect(after.maxStanceDrift).toBe(0)
}

describe('client human world foot anchors', () => {
  it('separates a fresh placement from a committed contact and keeps anatomical lateral offsets', () => {
    const gait = new HumanGait(), input = { root: { x: 100, y: -30 }, facing: 'down' as const, moving: false, dtMs: 0, instant: false }
    const fresh = gait.update(input)
    expect(fresh.root).toEqual(input.root)
    expect([fresh.left.x, fresh.right.x]).toEqual([102.2, 97.8])
    expect(fresh.supportContacts).toBe(0)
    expect(fresh.rebased).toBe(true)
    const planted = gait.update({ ...input, dtMs: 16 })
    expect(planted.supportContacts).toBe(2)
    expect(planted.left.plantId).not.toBe(fresh.left.plantId)
  })

  it('uses actual travel direction, a six-pixel threshold, a fixed swing and a frozen target', () => {
    const { gait, pose } = ready()
    const takeoff = update(gait, 6, 0, 60) // facing down, actually travelling east
    expect(takeoff.left.swing).toBe(true)
    expect(takeoff.right.contact).toBe(true)
    expect(takeoff.left.x).toBe(pose.left.x)
    const halfway = update(gait, 6, 0, HUMAN_GAIT.swingMs / 2)
    expect(halfway.left.lift).toBeCloseTo(2, 10)
    expect(halfway.left.x).toBeCloseTo(8.2, 10)
    expect(halfway.left.y).toBe(0)
    const landing = update(gait, 6, 0, HUMAN_GAIT.swingMs / 2)
    expect(landing.left.contact).toBe(true)
    expect(landing.left.x).toBeCloseTo(14.2, 10)
    expect(landing.left.lift).toBe(0)
    continuousContacts(pose, landing)
  })

  it('keeps continuous contacts fixed along a translated diagonal path and alternates normal steps', () => {
    const { gait, pose } = ready(157, -84)
    let previous = pose, lastSwing: string | null = null
    const starts: string[] = []
    for (let i = 1; i <= 700; i++) {
      const root = { x: 157 + i * .12, y: -84 + i * .09 }
      const p = update(gait, root.x, root.y, 12)
      expect(p.root).toEqual(root)
      expect(p.supportContacts).toBeGreaterThanOrEqual(1)
      const swing = p.left.swing ? 'left' : p.right.swing ? 'right' : null
      if (swing && swing !== lastSwing) starts.push(swing)
      lastSwing = swing
      continuousContacts(previous, p)
      previous = p
    }
    expect(new Set(starts).size).toBe(2)
    expect(starts.length).toBeGreaterThan(6)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).not.toBe(starts[i - 1])
    expect(previous.left.x).toBeGreaterThan(210)
  })

  it('finishes an in-flight swing after stop, settles without root drift and restarts', () => {
    const { gait } = ready()
    let p = update(gait, 7, 0, 100)
    expect(p.left.swing || p.right.swing).toBe(true)
    const root = { ...p.root }
    for (let i = 0; i < 100; i++) {
      const next = update(gait, root.x, root.y, 10, { moving: false })
      continuousContacts(p, next)
      expect(next.root).toEqual(root)
      p = next
    }
    expect(p.supportContacts).toBe(2)
    expect(p.left.x).toBeCloseTo(root.x + 2.2, 10)
    expect(p.right.x).toBeCloseTo(root.x - 2.2, 10)
    const settled = p
    p = update(gait, root.x, root.y, 2000, { moving: false })
    expect(p).toEqual(settled)
    for (let i = 1; i <= 40; i++) {
      const next = update(gait, root.x, root.y + i * .25, 16)
      continuousContacts(p, next)
      p = next
    }
    expect(p.stepCount).toBeGreaterThan(settled.stepCount)
  })

  it('does not advance or consume pending root travel on dt0 observations', () => {
    const { gait } = ready(), control = ready().gait
    const before = update(gait, 7, 0, 100)
    update(control, 7, 0, 100)
    for (let i = 0; i < 10; i++) {
      const frozen = update(gait, 8, 1, 0, { facing: 'up', moving: false })
      expect(frozen.root).toEqual({ x: 8, y: 1 })
      expect(frozen.left).toEqual(before.left)
      expect(frozen.right).toEqual(before.right)
      expect(frozen.stepCount).toBe(before.stepCount)
    }
    expect(update(gait, 8, 1, 20)).toEqual(update(control, 8, 1, 20))
  })

  it('reorients at rest one foot at a time instead of snapping planted feet on facing changes', () => {
    const { gait, pose } = ready(12, 20)
    const turn = update(gait, 12, 20, 0, { facing: 'up', moving: false })
    expect(turn.left).toEqual(pose.left)
    expect(turn.right).toEqual(pose.right)
    let previous = turn
    for (let i = 0; i < 60; i++) {
      const p = update(gait, 12, 20, 10, { facing: 'up', moving: false })
      continuousContacts(previous, p)
      expect(p.root).toEqual({ x: 12, y: 20 })
      expect(p.supportContacts).toBeGreaterThanOrEqual(1)
      previous = p
    }
    expect(previous.left.x).toBeCloseTo(9.8, 10)
    expect(previous.right.x).toBeCloseTo(14.2, 10)
    expect(previous.supportContacts).toBe(2)
    // Turning the camera/body side changes the planned lateral offsets, never anatomical IDs.
    const side = update(gait, 12, 20, 600, { facing: 'left', moving: false })
    expect(side.left.y).toBeCloseTo(22.2, 10)
    expect(side.right.y).toBeCloseTo(17.8, 10)
  })

  it('handles continuous turns and reversals without moving a retained stance anchor', () => {
    const { gait, pose } = ready(-20, 50)
    let p = pose, x = -20, y = 50
    for (const [dx, dy, facing] of [[.2, .1, 'right'], [-.2, .1, 'left'], [.1, -.2, 'up'], [0, .25, 'down']] as const) {
      for (let i = 0; i < 100; i++) {
        x += dx
        y += dy
        const next = update(gait, x, y, 16, { facing })
        continuousContacts(p, next)
        expect(next.root).toEqual({ x, y })
        p = next
      }
    }
    expect(p.stepCount).toBeGreaterThan(5)
  })

  it('never reports a missing leg as a support, including loss during swing and restoration at dt0', () => {
    const { gait } = ready()
    update(gait, 7, 0, 100)
    let p = update(gait, 7, 0, 16, { available: { left: false, right: true } })
    expect(p.left).toMatchObject({ present: false, contact: false, swing: false, lift: 0, stanceAnchor: null })
    let unsupportedSwing = false
    for (let i = 1; i <= 100; i++) {
      p = update(gait, 7 + i * .2, 0, 16, { available: { left: false, right: true } })
      expect(p.left.contact).toBe(false)
      expect(p.left.swing).toBe(false)
      if (p.right.swing) { expect(p.supportContacts).toBe(0); unsupportedSwing = true }
    }
    expect(unsupportedSwing).toBe(true)
    const oldPosition = { x: p.left.x, y: p.left.y }
    p = update(gait, 27, 0, 0)
    expect(p.left.present).toBe(true)
    expect(p.left.contact).toBe(false)
    expect({ x: p.left.x, y: p.left.y }).toEqual(oldPosition)
    p = update(gait, 27, 0, 800, { moving: false })
    expect(p.supportContacts).toBe(2)
    const missing = update(gait, 28, 0, 50, { available: { left: false, right: false } })
    expect(missing.supportContacts).toBe(0)
    expect(missing.left.swing || missing.right.swing).toBe(false)
  })

  it('rebases big jumps, explicit instant moves and hidden reentry without fabricated contacts', () => {
    const { gait, pose } = ready()
    const jump = update(gait, 100, -80, 16)
    expect(jump.rebased).toBe(true)
    expect(jump.epoch).toBeGreaterThan(pose.epoch)
    expect(jump.supportContacts).toBe(0)
    expect(jump.left.x).toBeCloseTo(102.2, 10)
    const plant = update(gait, 100, -80, 16, { moving: false })
    expect(plant.supportContacts).toBe(2)
    const instant = update(gait, 101, -80, 0, { instant: true })
    expect(instant.supportContacts).toBe(0)
    expect(instant.left.swing || instant.right.swing).toBe(false)
    expect(instant.epoch).toBeGreaterThan(plant.epoch)
    gait.reset()
    const reentry = update(gait, 101, -80, 16)
    expect(reentry.rebased).toBe(true)
    expect(reentry.supportContacts).toBe(0)
    expect(reentry.stepCount).toBe(0)
  })

  it('is invariant under subdivision of a straight interpolated path and stationary settlement', () => {
    const coarse = ready().gait, fine = ready().gait
    let a = update(coarse, 36, 27, 3600), b = update(fine, 0, 0, 0)
    for (let i = 1; i <= 180; i++) b = update(fine, 36 * i / 180, 27 * i / 180, 20)
    const compare = () => {
      expect(a.stepCount).toBe(b.stepCount)
      expect(a.supportContacts).toBe(b.supportContacts)
      for (const side of sides) {
        expect(a[side].x).toBeCloseTo(b[side].x, 8)
        expect(a[side].y).toBeCloseTo(b[side].y, 8)
        expect(a[side].lift).toBeCloseTo(b[side].lift, 8)
        expect(a[side].swing).toBe(b[side].swing)
        expect(a[side].plantId).toBe(b[side].plantId)
      }
    }
    compare()
    a = update(coarse, 36, 27, 1200, { moving: false, facing: 'right' })
    for (let i = 0; i < 120; i++) b = update(fine, 36, 27, 10, { moving: false, facing: 'right' })
    compare()
    expect(a.supportContacts).toBe(2)
  })

  it('is translation invariant, does not share mutable observations and rejects nonfinite inputs', () => {
    const a = ready().gait, b = ready(123, -456).gait
    for (let i = 1; i <= 80; i++) {
      const p = update(a, i * .2, i * .1, 16), q = update(b, 123 + i * .2, -456 + i * .1, 16)
      for (const side of sides) {
        expect(q[side].x - p[side].x).toBeCloseTo(123, 8)
        expect(q[side].y - p[side].y).toBeCloseTo(-456, 8)
        expect(q[side].contact).toBe(p[side].contact)
      }
    }
    const p = update(a, 16, 8, 1000, { moving: false })
    p.root.x = 999
    p.left.x = 999
    p.left.stanceAnchor!.x = 999
    const unchanged = update(a, 16, 8, 0, { moving: false })
    expect(unchanged.left.x).not.toBe(999)
    expect(unchanged.left.stanceAnchor!.x).not.toBe(999)
    expect(() => update(a, NaN, 0, 10)).toThrow('finite')
    expect(() => update(a, 0, Infinity, 10)).toThrow('finite')
    expect(() => update(a, 0, 0, -1)).toThrow('nonnegative')
  })
})
