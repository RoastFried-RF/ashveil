// 시드 기반 결정론 난수 (sfc32). 상태는 number[4] 로 직렬화 가능.

export type RngState = [number, number, number, number]

export function hashString(str: string): number {
  // xmur3
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

export function seedState(seed: string, stream: string): RngState {
  const base = hashString(`${seed}::${stream}`)
  // splitmix32 로 4워드 확장
  let x = base
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) >>> 0
    let z = x
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
    out.push((z ^ (z >>> 16)) >>> 0)
  }
  const s = out as RngState
  const r = new Rng(s)
  for (let i = 0; i < 12; i++) r.next()
  return s
}

export class Rng {
  constructor(public s: RngState) {}

  next(): number {
    const s = this.s
    let a = s[0], b = s[1], c = s[2], d = s[3]
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c >>> 0; s[3] = d >>> 0
    return t >>> 0
  }

  /** [0, 1) */
  float(): number {
    return this.next() / 4294967296
  }

  /** [lo, hi] 정수 */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1))
  }

  range(lo: number, hi: number): number {
    return lo + this.float() * (hi - lo)
  }

  chance(p: number): boolean {
    return this.float() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.float() * arr.length)]
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    if (total <= 0) return undefined
    let roll = this.float() * total
    for (const it of items) {
      roll -= Math.max(0, weight(it))
      if (roll < 0) return it
    }
    return items[items.length - 1]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

export const RNG_STREAMS = ['world', 'combat', 'loot', 'story', 'ai', 'body'] as const
export type RngStream = (typeof RNG_STREAMS)[number]
