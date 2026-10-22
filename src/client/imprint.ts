// 브라우저 저장 어댑터. 큰 각인은 IndexedDB에 원자적으로 기록한다.
// 기존 localStorage 각인도 읽으며, 사망 표시는 비동기 쓰기보다 먼저 남긴다.
export const IMPRINT_KEY = 'ashveil.imprint.v1'
const POINTER = '{"ashveilIndexedDB":1}'
const DELETED = '{"ashveilDeleted":1}'
const MIRROR_LIMIT = 1_000_000
export interface ImprintRecord { raw: string | null; mirror: string | null }
export interface ImprintDisk {
  read(): Promise<ImprintRecord | undefined>
  write(record: ImprintRecord): Promise<void>
}
export interface ImprintMirror { get(): string | null; set(value: string): void }

export function browserDisk(slot = 'current'): ImprintDisk {
  let opened: Promise<IDBDatabase> | undefined
  function open() {
    return opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('ashveil', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('imprint')
      req.onerror = () => { opened = undefined; reject(req.error ?? new Error('각인 저장소를 열 수 없다')) }
      req.onblocked = () => { opened = undefined; reject(new Error('다른 창에서 각인 저장소를 사용 중이다')) }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => { db.close(); opened = undefined }
        resolve(db)
      }
    })
  }
  return {
    async read() {
      const db = await open()
      return new Promise<ImprintRecord | undefined>((resolve, reject) => {
        const tx = db.transaction('imprint', 'readonly')
        const req = tx.objectStore('imprint').get(slot)
        tx.oncomplete = () => resolve(req.result as ImprintRecord | undefined)
        tx.onabort = () => reject(tx.error ?? new Error('각인을 읽을 수 없다'))
        tx.onerror = () => { /* onabort에서 처리 */ }
      })
    },
    async write(record) {
      const db = await open()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('imprint', 'readwrite', { durability: 'strict' })
        tx.objectStore('imprint').put(record, slot)
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error ?? new Error('각인을 저장할 수 없다'))
        tx.onerror = () => { /* onabort에서 처리 */ }
      })
    },
  }
}

export function createImprintStorage(disk: ImprintDisk, mirror: ImprintMirror) {
  let tail: Promise<void> = Promise.resolve()
  let generation = 0
  const get = () => { try { return mirror.get() } catch { return null } }
  const set = (value: string) => { try { mirror.set(value); return get() === value } catch { return false } }
  return {
    async read(): Promise<string | null> {
      await tail
      const local = get()
      if (local === DELETED) return null
      let record: ImprintRecord | undefined
      try { record = await disk.read() } catch { /* 작은 구형 각인은 계속 읽을 수 있다 */ }
      // 외부에서 가져오거나 구형 빌드가 갱신한 각인은 현재 디스크 복사본보다 우선한다.
      if (local && local !== POINTER && local !== record?.mirror) return local
      if (record) return record.raw
      if (local === POINTER) throw new Error('각인 본문을 읽을 수 없다. 브라우저 저장소를 확인해 주세요')
      return local
    },
    write(raw: string | null): Promise<void> {
      const ticket = ++generation
      // 사망 직후 새로고침해도 이전 비동기 각인이 되살아나지 않는다.
      if (raw === null) set(DELETED)
      const operation = tail.then(async () => {
        if (ticket !== generation) return
        const small = raw !== null && raw.length <= MIRROR_LIMIT
        const mirrored = small ? set(raw) : raw === null ? set(DELETED) : false
        const local = get()
        try {
          await disk.write({ raw, mirror: local })
        } catch (e) {
          if (mirrored) return // 작은 각인은 동기 저장소에 완전히 기록됐다.
          throw e
        }
        if (ticket !== generation) return
        if (raw !== null && !small) set(POINTER)
      })
      tail = operation.catch(() => {})
      return operation
    },
    flush: () => tail,
  }
}

export const imprintStorage = createImprintStorage(browserDisk(), {
  get: () => localStorage.getItem(IMPRINT_KEY),
  set: (value) => localStorage.setItem(IMPRINT_KEY, value),
})
