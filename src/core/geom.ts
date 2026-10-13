export interface Pos { x: number; y: number }

// 8방향, 시계방향 (0 = 북)
export const DIRS: readonly Pos[] = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
]

export const DIR_LABELS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const

export function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0
}

export function dirIndex(dx: number, dy: number): number {
  const sx = sign(dx), sy = sign(dy)
  return DIRS.findIndex((d) => d.x === sx && d.y === sy)
}

export function cheb(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function dist2(a: Pos, b: Pos): number {
  const dx = a.x - b.x, dy = a.y - b.y
  return dx * dx + dy * dy
}

export function eq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y
}

/** 브레젠험 선 (시작점 제외, 끝점 포함) */
export function line(a: Pos, b: Pos): Pos[] {
  const pts: Pos[] = []
  let x0 = a.x, y0 = a.y
  const x1 = b.x, y1 = b.y
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
    pts.push({ x: x0, y: y0 })
  }
  return pts
}

/** 방향 차이 0~4 (0 = 같은 방향, 4 = 정반대) */
export function dirDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 8
  return d > 4 ? 8 - d : d
}
