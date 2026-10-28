import { describe, expect, it } from 'vitest'
import { createImprintStorage, type ImprintRecord } from '../src/client/imprint'

function fixture(initial: string | null = null) {
  let local = initial
  let record: ImprintRecord | undefined
  let diskError = false, mirrorError = false
  let pause: Promise<void> | undefined
  let started = () => {}
  const storage = createImprintStorage({
    async read() { if (diskError) throw new Error('disk blocked'); return record },
    async write(value) { started(); await pause; if (diskError) throw new Error('disk full'); record = structuredClone(value) },
  }, {
    get: () => local,
    set(value) { if (mirrorError) throw new Error('quota'); local = value },
  })
  return { storage, local: () => local, record: () => record, import: (raw: string) => { local = raw }, diskError: () => { diskError = true }, mirrorError: () => { mirrorError = true }, pause: (p: Promise<void>, onStart: () => void) => { pause = p; started = onStart } }
}

describe('각인 저장: 큰 세계·오류·단일 슬롯', () => {
  it('구형 동기 각인과 외부에서 교체한 각인을 읽는다', async () => {
    const f = fixture('old')
    expect(await f.storage.read()).toBe('old')
    await f.storage.write('current')
    f.import('imported')
    expect(await f.storage.read()).toBe('imported')
  })
  it('6 MiB 각인은 작은 포인터와 원자적 본문으로 복원된다', async () => {
    const f = fixture('old'), raw = '한'.repeat(6 * 1024 * 1024)
    await f.storage.write(raw)
    expect(f.local()!.length).toBeLessThan(100)
    expect(f.record()?.raw).toBe(raw)
    expect(await f.storage.read()).toBe(raw)
  })
  it('localStorage 할당량이 차도 최신 디스크 각인을 구형 복사본보다 우선한다', async () => {
    const f = fixture('old')
    await f.storage.write('before')
    f.mirrorError()
    await f.storage.write('latest')
    expect(f.local()).toBe('before')
    expect(await f.storage.read()).toBe('latest')
  })
  it('IndexedDB가 막혀도 작은 각인은 동기 저장으로 복원한다', async () => {
    const f = fixture()
    f.diskError()
    await f.storage.write('small')
    expect(await f.storage.read()).toBe('small')
  })
  it('큰 각인 쓰기가 실패하면 이전 각인을 보존하고 오류를 반환한다', async () => {
    const f = fixture('previous')
    f.diskError()
    await expect(f.storage.write('x'.repeat(1_000_001))).rejects.toThrow('disk full')
    expect(await f.storage.read()).toBe('previous')
  })
  it('실행 중인 저장 뒤에 사망을 기록하면 이전 생존 각인이 되살아나지 않는다', async () => {
    const f = fixture('previous')
    let release!: () => void, begin!: () => void
    const began = new Promise<void>((resolve) => { begin = resolve })
    f.pause(new Promise<void>((resolve) => { release = resolve }), begin)
    const saving = f.storage.write('alive')
    await began
    const dying = f.storage.write(null)
    expect(f.local()).toContain('Deleted')
    release()
    await Promise.all([saving, dying])
    expect(await f.storage.read()).toBeNull()
    expect(f.record()?.raw).toBeNull()
    await f.storage.write('new life')
    expect(await f.storage.read()).toBe('new life')
  })
  it('연속 갱신은 마지막 상태만 남기며 실패한 쓰기도 큐를 막지 않는다', async () => {
    const f = fixture()
    await Promise.all([f.storage.write('a'), f.storage.write('b'), f.storage.write('c')])
    expect(await f.storage.read()).toBe('c')
    expect(f.record()?.raw).toBe('c')
  })
  it('본문 없는 포인터는 빈 각인으로 숨기지 않고 읽기 오류를 반환한다', async () => {
    const f = fixture('{"ashveilIndexedDB":1}')
    f.diskError()
    await expect(f.storage.read()).rejects.toThrow('각인 본문')
  })
})
