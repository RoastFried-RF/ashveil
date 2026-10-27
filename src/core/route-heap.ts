/** Stable minimum queue shared by land and sea route cost searches. */
export class RouteHeap {
  private entries: { id: number; score: number; cost: number }[] = []
  get size() { return this.entries.length }
  push(id: number, score: number, cost = score) {
    const a = this.entries, entry = { id, score, cost }; let i = a.length; a.push(entry)
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(entry, a[p])) break; a[i] = a[p]; i = p }
    a[i] = entry
  }
  pop() {
    const a = this.entries, out = a[0], last = a.pop()!
    if (a.length) {
      let i = 0
      while (i * 2 + 1 < a.length) {
        let j = i * 2 + 1
        if (j + 1 < a.length && this.less(a[j + 1], a[j])) j++
        if (!this.less(a[j], last)) break
        a[i] = a[j]; i = j
      }
      a[i] = last
    }
    return out
  }
  private less(a: { id: number; score: number }, b: { id: number; score: number }) { return a.score < b.score || a.score === b.score && a.id < b.id }
}
