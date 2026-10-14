import type { Pos } from './geom'
import type { RngState } from './rng'

// ───────────── Def (콘텐츠 데이터, JSON) ─────────────

export interface DefBase {
  defType: string
  id: string
  parent?: string
  abstract?: boolean
  label?: string
  description?: string
  /** 로더가 채움: 이 Def를 마지막으로 정의/수정한 모드 */
  _mod?: string
}

export type DamageType = 'cut' | 'stab' | 'blunt' | 'bite' | 'burn'
export type ArmorCategory = 'sharp' | 'blunt' | 'heat'
export type Capacity = 'consciousness' | 'moving' | 'manipulation' | 'sight' | 'hearing' | 'breathing' | 'bloodPumping'
export type Height = 'low' | 'mid' | 'high'

export interface BodyPartDef {
  id: string
  label: string
  parent?: string
  hp: number
  /** 외부 커버리지 ‰ (외부 부위만, 몸 전체 합 1000 · 07 §2.3) */
  coverage?: number
  /** 내부 분배 가중 (부모가 관통됐을 때 · 02 §2.2) */
  weight?: number
  height?: Height
  internal?: boolean
  vital?: boolean
  /** 파괴되면 24시간 뒤 사망 (간) */
  delayedDeath?: boolean
  /** 뼈 강도 = 골절 임계 (02 §2.1) */
  bone?: number
  /** 동맥 출혈 ml/턴 (02 §2.1: 경동맥 250 · 대퇴 150 …) */
  artery?: number
  /** 혈관계수 (02 §5) */
  vessel?: number
  /** 통증계수 (02 §5) */
  pain?: number
  /** 내출혈 장기계수 (02 §8) */
  organ?: number
  /** 장기 관통 판정의 빗나감 가중 (흉부 40 · 복부 15) */
  organMiss?: number
  /** 이 부위 피격 중 자식(손가락·발가락)으로 넘어가는 % */
  childShare?: number
  /** 관통 시 추가 오염 (장 80) */
  contam?: number
  /** 지혈대 단위 (그 팔·다리의 상완·대퇴) */
  limb?: string
  side?: 'l' | 'r'
  /** 힘줄 판정 부위 (손·전완·발) */
  tendon?: boolean
  /** 0이 되면 떨어져 나가는 부위 (손가락·손·발·귀·코) */
  detach?: boolean
  digit?: boolean
  /** 사족 다리 */
  qleg?: boolean
  /** 방어구 덮음 태그 (13 §6.2) */
  groups: string[]
  region: Region
  capacities?: Partial<Record<string, number>>
}

export interface BodyDef extends DefBase {
  defType: 'Body'
  bloodMl: number
  kind?: 'humanoid' | 'quadruped' | 'amalgam'
  parts: BodyPartDef[]
}

export interface WoundDef extends DefBase {
  defType: 'Wound'
  label: string
  /** sev 1당 턴당 출혈 ml (02 §5) */
  bleedPerSeverity: number
  painPerSeverity: number
  /** 생성 시 기본 오염 0~100 */
  contamination: number
  /** 하루 치유량 (sev) */
  healPerDay: number
  scarChance: number
  /** 외부에서 보이는가 (내출혈 = false) */
  visible?: boolean
}

export interface AttackDef {
  /** 공격 방식 id: slash 베기 · stab 찌르기 · blunt 타격 */
  id?: string
  label: string
  damageType: DamageType
  /** 기본 피해 (07 §7.1) */
  damage: number
  /** 관통 0~100 (07 §2.4) */
  pen: number
  /** 기력 (07 §6) */
  energy: number
  /** 무기 계열 (15 §7): blade·axe·blunt·spear·archery·unarmed */
  family: string
  /** 무기 정확도 (공격치 기본값) */
  accuracy: number
  reach?: number
  /** 출혈 배율 (07 §7.1) */
  bleedMult?: number
  noise?: number
  /** 이 능력치가 0이면 공격 불가 (예: 턱 파괴 시 물기 불가) */
  requiresCapacity?: Capacity
  /** 머리 기절 판정에 D + 이 값 (둔기 4) */
  stunD?: number
  /** 짧은 날: 잠든·기절 대상 첫 타 ×2 (07 §2.8) */
  shortBlade?: boolean
  /** 방패 내구 피해 배율 (손도끼 2) */
  shieldDamage?: number
  /** 맨손 등 밀치기 보정 (07 §7.2) */
  shove?: number
  /** 생성 상처 오염 가산 (녹 +10, 02 §10.1) */
  contam?: number
}

export type Slot = 'head' | 'chest' | 'hands' | 'feet' | 'belt' | 'back' | 'neck' | 'ring1' | 'ring2' | 'main' | 'off'
export const SLOTS: Slot[] = ['head', 'chest', 'hands', 'feet', 'belt', 'back', 'neck', 'ring1', 'ring2', 'main', 'off']
export type Region = 'head' | 'torso' | 'larm' | 'rarm' | 'lleg' | 'rleg'
export const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export interface RangedDef {
  /** 최대 사거리 */
  range: number
  /** 유효 사거리 (초과 1칸당 −3, 07 §2.1) */
  effective?: number
  ammo: string
}

export interface ItemDef extends DefBase {
  defType: 'Item'
  label: string
  sprite: string
  category: 'weapon' | 'apparel' | 'shield' | 'medical' | 'food' | 'drink' | 'drug' | 'tool' | 'ammo' | 'misc'
  weight: number
  /** 배낭 격자 크기 [가로, 세로] */
  size: [number, number]
  stackable?: boolean
  /** 읽을 수 있다 (쪽지 → 소문, 06 §7.0) */
  readable?: boolean
  maxStack?: number
  value?: number
  /** 장착 슬롯 (반지는 'ring') */
  slot?: Exclude<Slot, 'ring1' | 'ring2'> | 'ring'
  /** 장착 시 능력치·특성형 수정치 */
  mods?: Partial<Record<string, number>>
  /** 날 상태 시작값 % (녹슨 칼 60) */
  edgeStart?: number
  /** 공격 방식들 (07 §14 attacks[]). 첫 번째가 기본 */
  attacks?: AttackDef[]
  /** 무기 막기치 / 받아넘기기치 (07 §7.1) */
  weapon?: { block: number; parry: number }
  ranged?: RangedDef
  twoHanded?: boolean
  apparel?: {
    /** 판정 순서: 큰 값이 바깥 (망토 2 → 몸·머리·장갑·장화 1) */
    layer: number
    /** 덮는 세부 부위 태그 (13 §6.2) */
    groups: string[]
    insulation: number
    /** 날 / 타격 / 열 방어 0~100 (13 §6.2) */
    armor: Partial<Record<ArmorCategory, number>>
    noise?: number
    waterproof?: boolean
    durability: number
  }
  /** 방패: 막기치, 흡수량(넘친 피해는 방패 든 팔로), 밀치기 보정 (07 §2.2·§7.2) */
  shield?: { block: number; absorb: number; shove?: number }
  food?: { kcal: number; vitamin?: number; water?: number; raw?: boolean; scent?: number; needsTool?: string }
  drink?: { water: number; dirty?: boolean; alcohol?: number }
  medical?: {
    kind: 'bandage' | 'tourniquet' | 'splint' | 'disinfect'
    /** 처치 품질 Q 도구 항 (02 §12.1: 옷 찢은 천 −10 · 깨끗한 붕대 0) */
    tool?: number
    /** 더러운 붕대: 오염 +10 */
    dirty?: boolean
    /** 세척 배율 (술 0.4 · 깨끗한 물 0.75) */
    washMult?: number
  }
  drug?: { effect: string; durationTurns: number }
  /** 미확인 그룹 (예: 'pill') — 시드별로 외형이 섞임 */
  unidentified?: string
  light?: { radius: number; fuelTurns: number }
  /** 등불 연료 보충량 (턴) */
  refuel?: number
  /** 착/탈 턴 수 (13 §6.1). 없으면 1/1 */
  equipTurns?: [number, number]
  /** 둔중: 회피치에서 뺀다 (13 §6.2) */
  bulk?: number
  uses?: number
}

export interface CreatureDef extends DefBase {
  defType: 'Creature'
  label: string
  sprite?: string | string[]
  body: string
  faction: string
  sizeClass: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
  moveTU: number
  bloodMult?: number
  hpMult?: number
  /** 모피 등 자연 단열 */
  insulation?: number
  stats: Stats
  skills: Record<string, number>
  naturalAttack?: AttackDef
  ai: 'player' | 'packHunter' | 'raider' | 'skittish' | 'guard' | 'boss'
  morale: number
  lightThreshold: number
  sightRange: number
  scentSense?: number
  loadout?: { slots: { items: string[]; chance?: number; count?: [number, number] }[] }
  hunger?: [number, number]
  bestiary?: string[]
  /** 처치 경험치 */
  xp?: number
  /** 스프라이트 manifest 캐릭터 키 (여러 개면 무작위) */
  char?: string | string[]
  /** 배치 시 잠들어 있을 확률 */
  sleepChance?: number
  /** 화면 표시 배율 (보스 등) */
  scale?: number
  /** 기본 HP (없으면 활력 공식) */
  hpBase?: number
  /** 회피 보정 */
  evasion?: number
  /** 특성형 수정치 (고통 둔감 등) */
  mods?: Partial<Record<string, number>>
  /** 맞으면 주변에 뿌리는 효과 (포자 등) */
  onHit?: { effect: string; radius: number; turns: number; chance: number }
  /** 시체 배낭 격자 (13 §8.1: 약탈자 8×4 · 그늘 사람 4×3 …) */
  bagSize?: [number, number]
  /** 체중 kg (밀치기 체급, 07 §7.2) */
  weightKg?: number
  /** 자연 방어: 털·가죽·껍질 (07 §2.4 마지막 층) */
  naturalArmor?: Partial<Record<ArmorCategory, number>>
  /** 사기 판정을 하지 않는 종 (07 §8) */
  noMorale?: boolean
  /** 청각 보정 (07 §9.1) */
  hearing?: number
  /** 후각 배율 (07 §9.2: 인간 1/2 · 그늘 사람 1 · 포자 인간 0 · 융합체 2) */
  smell?: number
  /** 어둠 시야: [어둠, 칠흑] 명중 감점 (그늘 사람 −5 · −15, bestiary §17) */
  darkSight?: [number, number]
  /** 보유 능력 (15 §15) */
  abilities?: string[]
  /** 능력치 흔들림 범위 (약탈자만, H) */
  statRange?: Partial<Record<keyof Stats, [number, number]>>
  /** 든 무기 계열에 따라 받는 능력 (약탈자 근접: 도끼 → 쪼개기, 둔기 → 밀쳐내기) */
  weaponAbilities?: Record<string, string[]>
  /** 무리 우두머리 (사망 시 같은 무리 사기 −30) */
  leader?: boolean
  /** 빛을 싫어함: 광원 반경 안에서 사기 −10 (그늘 사람) */
  lightAverse?: boolean
  /** 광원 반경 안 사기 감소 (기본 10, 그늘 사람 25 — CANON D35) */
  lightMorale?: number
  /** 무리 절반을 잃으면 도주 (그늘 사람) */
  packFlee?: boolean
  /** 물 냄새에 끌리고 물을 주면 진정할 수 있다 (말라붙은 자) */
  thirsty?: boolean
  /** 맞아서 HP가 줄면 포자 구름 (포자 인간) */
  sporeOnHit?: { radius: number; turns: number; conc: number }
  /** 등 뒤가 없다 (융합체: 모든 방향이 정면) */
  noBack?: boolean
  /** 이 부위 묶음이 모두 파괴되면 죽는다 (융합체: 머리 셋, 심장 셋) */
  deathAllOf?: string[][]
}

export interface Stats { str: number; agi: number; per: number; vit: number; wil: number }

export interface TerrainDef extends DefBase {
  defType: 'Terrain'
  label: string
  sprites: string[]
  /** 계단 */
  stairs?: 'down' | 'up'
  /** 벽 렌더링 계열 */
  wall?: boolean
  /** 바닥 렌더링 계열 */
  floor?: 'kt' | 'cd' | 'earth'
  passable: boolean
  opaque: boolean
  moveMult: number
  /** 비틀거림 가산 % (01 §5.3) */
  stumble?: number
  water?: 'shallow' | 'deep'
  door?: 'open' | 'closed'
  container?: string // LootTable id
  /** 보관함 격자 [가로, 세로] (13: 야영지 보관함 12×8) */
  /** 루팅 격자 [가로, 세로] · 여는 턴 · 소음 (13 §8.1) */
  lootGrid?: [number, number]
  openTurns?: number
  openNoise?: number
  noiseMult?: number
}

export interface LootTableDef extends DefBase {
  defType: 'LootTable'
  rolls: [number, number]
  entries: { item: string; weight: number; count?: [number, number] }[]
}

export interface TraitDef extends DefBase {
  defType: 'Trait'
  label: string
  description: string
  conflicts?: string[]
  mods?: Partial<Record<string, number>>
  weight?: number
}

export interface BackgroundDef extends DefBase {
  defType: 'Background'
  label: string
  description: string
  stats?: Partial<Stats>
  skills: Record<string, number>
  passions?: Record<string, 1 | 2>
  /** 시작 숙달 단계 (15 §9.1) */
  mastery?: Partial<Record<'medicine' | 'survival', number>>
  /** 시작 능력 포인트 가산 (몰락한 길드 상인 +1) */
  bonusAbilityPoints?: number
  /** 능력 효율 보정 (15 §9.1: 탈영 경비병 창 액티브 기력 −2 …) */
  mods?: Partial<Record<string, number>>
  literate: boolean
  startItems: string[]
  startAbilities?: string[]
  traitWeights?: Record<string, number>
}

export interface ThoughtDef extends DefBase {
  defType: 'Thought'
  label: string
  mood: number
  durationTurns: number
  stack?: number
}

export interface EventDef extends DefBase {
  defType: 'Event'
  label: string
  cost: number
  weight: number
  spawn?: { creature: string; count: [number, number] }[]
  hint?: string
  minDay?: number
  cooldownTurns?: number
  nightWeight?: number
}

export interface PillEffectDef extends DefBase {
  defType: 'PillEffect'
  label: string
  description: string
  effect: string
  durationTurns: number
}

export interface SkillDef extends DefBase {
  defType: 'Skill'
  label: string
}

export interface AbilityAttackMods {
  /** 명중 가산 (조준 사격 +25) */
  hitBonus?: number
  damageMult?: number
  /** 상처 출혈 항 배율 (깊게 베기 ×2) */
  bleedMult?: number
  /** 동맥 확률 가산 %p (깊게 베기 +15) */
  arterialBonus?: number
  /** 관통 가산 (0~100 척도: 급소 찌르기 +20, 쪼개기 +25) */
  penBonus?: number
  /** 맞은 방어구 내구 추가 손실 %p (쪼개기 10) */
  armorDamage?: number
  /** 골절 확률 배율 */
  fractureMult?: number
  /** 기절 확률 가산 %p (머리 강타 +40) */
  stunBonus?: number
  partWeights?: Partial<Record<Region | 'neck', number>>
  aoe?: 'adjacent' | 'line2'
  knockback?: number
  knockdownChance?: number
  /** 조준형 (야행성: 조명 감점 절반) */
  aimed?: boolean
}

export interface AbilityDef extends DefBase {
  defType: 'Ability'
  label: string
  description: string
  tree: string
  tier: number
  kind: 'active' | 'passive' | 'toggle'
  energy?: number
  cooldown?: number
  requires?: string[]
  /** 요구 무기 계열 (주무기 attacks[].family). 패시브는 그 계열로 싸울 때만 (15 §7) */
  weapon?: string
  /** 요구 공격 방식 (깊게 베기 = slash, 급소 찌르기 = stab) */
  attackMode?: string
  /** 채널 턴 수 (조준 사격 2) */
  channel?: number
  /** 달려들기: 직선 N칸 이동 후 근접 공격 */
  lunge?: number
  /** 휩쓸기: 연속 N칸 */
  sweep?: number
  /** 포자 분출 */
  burst?: { radius: number; turns: number; conc: number }
  /** 붙잡기 */
  grab?: boolean
  target?: 'enemy' | 'self'
  attack?: AbilityAttackMods
  stance?: { effect: string; turns: number; magnitude?: number }
  self?: { energyPct?: number; painRelief?: number; turns?: number }
  mods?: Partial<Record<string, number>>
  icon: string
}

export type AnyDef =
  | BodyDef | WoundDef | ItemDef | CreatureDef | TerrainDef | LootTableDef | TraitDef
  | BackgroundDef | ThoughtDef | EventDef | PillEffectDef | SkillDef | AbilityDef

// ───────────── 런타임 상태 (직렬화 가능) ─────────────

export interface ItemInst {
  uid: number
  def: string
  count: number
  /** 배낭 격자 위치 */
  gx?: number
  gy?: number
  /** 90° 돌려 놓았는가 (13 §3, CANON D16) */
  rot?: boolean
  /** 입다가 끊겨 반쯤 걸친 상태: 방어·단열 50% (13 §6.1) */
  half?: boolean
  /** 품질 0 조악 · 1 보통(기본) · 2 좋음 · 3 뛰어남 · 4 명품 · 5 전설 (08 §4) */
  quality?: number
  /** 내구 % 0~100 (08 §5) */
  durability?: number
  /** 날 상태 % 0~100 (08 §5) */
  edge?: number
  fuel?: number
  lit?: boolean
  uses?: number
  dirty?: boolean
  /** 쪽지 내용 (06 §7.0) */
  note?: Rumor
}

export type FractureGrade = 'hairline' | 'simple' | 'compound'

export interface Wound {
  id: number
  def: string
  part: string
  /** 정수 피해 D (02 §4) */
  severity: number
  healed: number
  /** 상처 출혈 ml/턴 (응고 대상) */
  bleed: number
  /** 동맥 출혈 ml/턴 (자연 응고 없음, 02 §6) */
  artery?: number
  arterial: boolean
  internal: boolean
  /** 골절: 등급과 치유 진행 0~1 (02 §9) */
  fracture?: { grade: FractureGrade; progress: number }
  splint?: { quality: number; half?: boolean }
  /** 붕대: 처치 품질 Q, 감은 시각, 응급 처치 보너스 (02 §6 · 15 §6.6) */
  bandage?: { quality: number; at: number; dirty?: boolean; firstAid?: number }
  /** 힘줄 절단 (효율 상한 0.5) */
  tendon?: boolean
  cauterized?: boolean
  /** 오염 0~100 (02 §10.1) */
  contam: number
  infection?: { progress: number; immunity: number; sepsis?: number }
  infectionChecked?: boolean
  ageTurns: number
  source: string
  /** 상처를 낸 개체 id (사망 원인 기여, 15 §3) */
  sourceId?: number
  scar?: boolean
}

export interface BodyState {
  def: string
  blood: number
  bloodMax: number
  /** 부위별 최대 hp (hpMult 반영) */
  maxHp: Record<string, number>
  missing: string[]
  wounds: Wound[]
  /** 지혈대: 그 팔·다리의 상완/대퇴 id → 감은 시각(turn) */
  tourniquets: Record<string, number>
  pressing?: number // 압박 중인 wound id (이번 턴)
}

export interface Needs {
  kcal: number
  water: number
  vitamin: number
  fatigue: number
  bodyTemp: number
  wetness: number
  energy: number
  stress: number
}

export interface Effect { kind: string; untilTurn: number; magnitude?: number }

export interface Thought { def: string; untilTurn: number; count: number }

export interface Activity {
  kind: 'rest' | 'sleep' | 'search' | 'examine' | 'press' | 'equip' | 'unequip' | 'treat' | 'aim' | 'strip'
  remaining: number
  /** 시작 때 정한 전체 턴 */
  total?: number
  /** 처치 종류 */
  treat?: 'bandage' | 'tourniquet' | 'splint' | 'disinfect' | 'cauterize'
  limb?: string
  /** 채널 능력 id (조준 사격) */
  abilityId?: string
  slot?: Slot
  target?: Pos
  uid?: number
  woundId?: number
  label: string
  /** 중단 판정용: 시작 시점에 보이던 적, 상처 수 */
  seenHostiles?: number[]
  woundCount?: number
  /** 수면: 잠들 때 피로, 굶주림·갈증 단계, 젖음 · 깨운 이유 (01 §8) */
  sleep0?: { fatigue: number; hunger: number; thirst: number; wet: number }
  wokeBy?: string
  /** 자동 모드 중단 판정 스냅샷 (01 §6.2) */
  snap?: import('./autostop').AutoSnap
  /** 진행한 턴 수 */
  elapsed?: number
}

export interface AiState {
  mode: 'idle' | 'wander' | 'hunt' | 'investigate' | 'flee' | 'eat' | 'surrender' | 'guard' | 'return' | 'patrol' | 'calm'
  /** 사기 사건 (07 §8): 값 · 시각 · 감쇠 방식 */
  mev?: { v: number; t: number; k: 'half30' | 'fixed' | 't20' | 't30' }[]
  /** 궁지: 도주가 결정됐지만 도망칠 수 없다 (명중 +5, 반응 안 함) */
  cornered?: boolean
  /** 마지막 사기 판정 턴 */
  moraleCheck?: number
  target?: number
  dest?: Pos
  lastSeen?: Pos
  path?: Pos[]
  hunger: number
  morale: number
  alertTurn?: number
  /** 장소 사건 임무: 경보(흔적을 보고 귀환) · 수색(흔적 지점 → 보관함) */
  task?: { kind: 'alarm' | 'search'; pos: Pos; stash?: Pos }
  /** 도주로 시야에서 사라진 턴 (30턴 미귀환 = 도주시킴 경험치, 15 §3) */
  goneSince?: number
  /** 잠든 포자 인간 곁에 머문 턴 */
  nearTurns?: number
  /** 순찰 경로 (경유지 순서) · 현재 지점 · 대기 끝 턴 */
  route?: Pos[]
  routeIdx?: number
  waitUntil?: number
}

export interface Creature {
  id: number
  def: string
  name: string
  sprite: string
  pos: Pos
  facing: number
  faction: string
  nextAct: number
  alive: boolean
  unconscious: boolean
  body: BodyState
  stats: Stats
  /** 숙달 성공 횟수 (medicine·survival) */
  skills: Record<string, number>
  passions: Record<string, number>
  /** 숙달 카운트 기록 (같은 대상 1회, 시간당 3회) */
  masteryLog?: { keys: string[]; hour: number; inHour: Record<string, number> }
  traits: string[]
  background?: string
  needs: Needs
  effects: Effect[]
  thoughts: Thought[]
  /** 배낭(격자) */
  bag: ItemInst[]
  /** 장착 중 */
  equip: Partial<Record<Slot, ItemInst>>
  /** 빠른 슬롯 10칸 */
  hotbar: (HotbarRef | null)[]
  hp: number
  level: number
  xp: number
  statPoints: number
  abilityPoints: number
  abilities: string[]
  cooldowns: Record<string, number>
  sneaking?: boolean
  asleep?: boolean
  /** 깊은 잠 (각성 임계 8, 14 §7.2) */
  deepSleep?: boolean
  home?: Pos
  /** 지연 사망 장기가 멎은 시각 */
  organFailAt?: Record<string, number>
  /** 거주하는 방 번호 (재점거 판정, 14 §9.3) */
  room?: number
  mapId?: string
  ai: AiState
  activity?: Activity
  /** 이번 턴에 공격/방어로 기력을 썼는가 */
  exerted: boolean
  /** 몸 상태 시계: 쇼크·기절·통증 지속 (02 §6.3·§7) */
  cond?: { shock?: boolean; shockOkSince?: number; painHighSince?: number; faintUntil?: number }
  /** 같은 턴 안의 반응 횟수 (07 §2.2 연속 반응 피로) */
  reactions?: { turn: number; n: number }
  /** 반응 정책 (07 §2.2) */
  reactPolicy?: 'block' | 'parry' | 'none'
  /** 고른 공격 방식 id (베기/찌르기) */
  attackMode?: string
  /** 마지막으로 이동한 턴 (원거리 '대상 이동 중' −5) */
  movedTurn?: number
  /** 자유 행동을 쓴 턴 (01 §3.4, 턴당 1회) */
  freeActTurn?: number
  /** 잠기운 끝 턴 (01 §8.3) */
  drowsyUntil?: number
  /** 냄새 누적 (07 §9.2) */
  scent?: number
  scentCarry?: number
  /** 이번 턴에 대기했는가 (기력 회복 ×2) */
  rested?: boolean
  /** 자기 몸을 살핀 턴 (01 §4.1) */
  examinedAt?: number
  /** 소작 인두 가열 진행 (보존, 01 §7) */
  heat?: { done: number; at: number }
  lastAttacker?: string
  killedBy?: string
  deathCause?: string
  deathTurn?: number
  history: HistoryEvent[]
  literate?: boolean
  /** 시체를 처음 뒤졌는가 (13 §8.1: 첫 수색 2턴) */
  searched?: boolean
  /** 이 개체로 경험치를 이미 줬는가 (처치·항복·도주 중 한 번만) */
  xpAwarded?: boolean
  /** 재점거로 들어온 개체 (경험치 ×0.5, 14 §9.3) */
  reoccupied?: boolean
  /** 위기 극복 감시 (15 §3) */
  crisis?: CrisisWatch
}

export interface CrisisWatch {
  /** 종류 → 마지막으로 보상한 게임일 */
  last: Record<string, number>
  arterial: number[]
  bleeding: boolean
  wasUnconscious: boolean
  wokeAt?: number
  infectionWon?: boolean
}

export interface HistoryEvent { turn: number; kind: string; text: string }

export type HotbarRef = { kind: 'ability'; id: string } | { kind: 'item'; def: string }

export interface Tile {
  t: string // terrain def id
  v: number // sprite variant
  roof: boolean
  blood: number
  items: ItemInst[]
  searched?: boolean
  seen?: boolean
  /** 용기(상자·항아리·석관) 내용물 */
  cont?: { items: ItemInst[]; opened: boolean; kind: string }
  /** 방 번호 */
  room?: number
  /** 바닥 장식 (이끼 등) */
  deco?: string
  /** 오염(최심부) */
  taint?: number
  /** 포자 구름: 끝나는 턴과 농도 (07 §11) */
  spores?: { until: number; conc: number }
}

export interface MapProp { kind: string; x: number; y: number; w: number; h: number; anim?: string; blocks?: boolean; scale?: number }
export interface MapLink { pos: Pos; to: string; toPos: Pos; label: string }
export interface MapRoom {
  x: number; y: number; w: number; h: number; type: string; discovered: boolean; name: string
  /** 원래 거주 편성 (종 id 목록) */
  residents?: string[]
  /** 정리된 시각(턴). 다시 차면 지운다 */
  clearedAt?: number
}

/** 거주 인구 공급원 (14 §9.4) */
export interface PopSource { id: string; label: string; species: string; count: number; cap: number; regenDays: number; floors: string[]; lastRegenDay: number; needsAlive?: string }
export interface MapLight { pos: Pos; radius: number; kind: string; off?: boolean }

export interface MapState {
  id: string
  name: string
  kind: 'surface' | 'dungeon'
  depth: number
  /** 기본 밝기 (던전은 어둡다) */
  ambient: number
  w: number
  h: number
  tiles: Tile[]
  exits: Pos[]
  links: MapLink[]
  rooms: MapRoom[]
  /** 이 층 서가에서 아래층 방 위치 쪽지가 이미 나왔는가 (14 §5.1) */
  noteGiven?: boolean
  props: MapProp[]
  lights: MapLight[]
  /** 장소 사건 경유지 (14 §10: 약탈자 야영지·숲 개울·수도원 입구) */
  waypoints?: Record<string, Pos>
}

export type Weather = 'clear' | 'overcast' | 'ashrain'

export interface LogEntry {
  turn: number
  kind: 'info' | 'combat' | 'warn' | 'danger' | 'flavor' | 'good'
  text: string
  detail?: string[]
}

/** 소문 (06 §7.1 축약): 출처 단계 hop 0 목격자 · 1 전해 들음 · 2+ 떠도는 말 */
export interface Rumor {
  id: string
  kind: 'room' | 'boss' | 'supply'
  text: string
  source: string
  hop: number
  /** 작성 시점(턴) · 얻은 시점(턴) */
  writtenAt: number
  foundAt: number
  mapId?: string
  roomIdx?: number
  roomName?: string
  mapW?: number
  mapH?: number
  rect?: { x: number; y: number; w: number; h: number }
}

export interface Knowledge {
  /** 외형 -> 효과 def id (시드별 섞임, 비밀) */
  pillMap: Record<string, string>
  /** 플레이어가 아는 외형 -> 효과 */
  pillKnown: Record<string, string>
  bestiary: Record<string, { seen: number; fought: number; killed: number; dissected?: number }>
  rumors?: Rumor[]
}

export interface StorytellerState {
  budget: number
  lastEventTurn: number
  /** 수색대 출발 예정 (10 §3 #2): 순찰이 흔적을 보고 돌아온 1시간 뒤 */
  search?: { at: number; pos: Pos }
  pending?: { event: string; atTurn: number }
  history: { turn: number; event: string }[]
}

export interface GameState {
  version: number
  seed: string
  mods: string[]
  time: number // TU
  rng: Record<string, RngState>
  /** 현재 지도 */
  map: MapState
  /** 현재가 아닌 지도들 (정지 상태) */
  maps: Record<string, MapState>
  /** 현재 지도 밖에 있는 생물들 */
  offCreatures: Record<string, Creature[]>
  /** 현재 지도의 생물 */
  creatures: Creature[]
  playerId: number
  nextId: number
  log: LogEntry[]
  weather: Weather
  weatherUntil: number
  wind: Pos
  storyteller: StorytellerState
  /** 헤드리스 봇 기억 (밸런스 측정용, 세이브와 함께 직렬화해 결정론 유지) */
  bot?: { avoid: string[]; retreats: number; lastRetreat?: number; lootAt?: string; lastStairs?: number; lastHp?: number; hurtAt?: number }
  knowledge: Knowledge
  over?: { kind: 'death' | 'escape'; turn: number; report: DeathReport }
  visible: number[] // 이번 턴 플레이어가 보는 타일 인덱스
  noiseEvents: { pos: Pos; radius: number; source: number; turn: number }[]
  /** 자동 모드가 마지막으로 위협에 끊긴 턴 (01 §6.2 이력 현상) */
  autoStopTurn?: number
  /** 화면 연출용 이벤트 (렌더러가 소비) */
  fx: FxEvent[]
  /** 거주 인구 공급원 (14 §9.4) */
  sources?: PopSource[]
  /** 열려 있는 루팅 대상 */
  loot?: { pos: Pos; kind: 'cont' | 'floor' | 'corpse'; id?: number }
}

export type FxEvent =
  | { k: 'dmg'; id: number; v: number; crit?: boolean; text?: string; turn: number }
  | { k: 'miss' | 'block' | 'parry' | 'deflect'; id: number; turn: number }
  | { k: 'status'; id: number; text: string; color: string; turn: number }
  | { k: 'attack'; id: number; target: number; turn: number }
  | { k: 'move'; id: number; from: Pos; to: Pos; turn: number }
  | { k: 'death'; id: number; turn: number }
  | { k: 'level'; id: number; turn: number }
  | { k: 'xp'; id: number; v: number; turn: number }

export interface DeathReport {
  title: string
  name: string
  background: string
  traits: string[]
  cause: string
  chain: string[]
  vitals: string[]
  stats: string[]
  daysSurvived: number
  epitaph: string
}
