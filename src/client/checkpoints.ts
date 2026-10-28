import { browserDisk, createImprintStorage } from './imprint'

// 수동 저장은 현재 자동 각인과 별도 키를 사용한다. 사망 tombstone도 서로 덮지 않는다.
const slots = new Map<string, ReturnType<typeof createImprintStorage>>()
export function checkpointStorage(mode: string) {
  let storage = slots.get(mode)
  if (!storage) {
    const key = 'ashveil.checkpoint.v1.' + encodeURIComponent(mode)
    storage = createImprintStorage(browserDisk('checkpoint:' + mode), {
      get: () => localStorage.getItem(key),
      set: value => localStorage.setItem(key, value),
    })
    slots.set(mode, storage)
  }
  return storage
}
