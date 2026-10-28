import { player, projectThermalState, temperatureDelta, thermalState, warmthError, type Creature, type World } from '../core'

/** 현재 몸/자리에서의 조건 비교. 예상치를 세계에 반영하거나 미래 날씨를 읽지 않는다. */
export function thermalGuidance(w: World, c: Creature = player(w)) {
  const state = thermalState(w, c)
  const current = temperatureDelta(c, state)
  const rest = temperatureDelta(c, projectThermalState(w, c, 'rest'))
  const sleep = temperatureDelta(c, projectThermalState(w, c, 'sleep'))
  const warmError = warmthError(w, c)
  const warm = warmError ? undefined : temperatureDelta(c, projectThermalState(w, c, 'work'))
  const atFire = state.heat >= 15
  let notice: string | undefined
  if (c.needs.bodyTemp < 37) {
    if (current < 0) notice = atFire ? '불 곁에서도 체온 하락' : '체온 하락'
    else if (rest < 0 && c.needs.bodyTemp < 36.8) notice = '멈추면 체온 하락'
    else if (current === 0 && c.needs.bodyTemp < 36.8) notice = '체온 회복 정체'
  }
  const advice = rest > 0 ? '현재 자리에서는 휴식으로 체온을 회복할 수 있다.'
    : warm !== undefined && warm > 0 ? '불 곁에서 몸 풀기를 하면 회복할 수 있다. 열량과 피로를 쓰므로 음식도 필요하다.'
    : '불만으로 부족할 수 있다. 지붕 아래에서 바람·비를 피하고 마른 의복을 갖추자.'
  const format = (delta: number) => `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${delta!==0&&Math.abs(delta)<.005?'<0.01':Math.abs(delta).toFixed(2)}°C/10분`
  return { state, current, rest, sleep, warm, warmError, notice, advice, format }
}
