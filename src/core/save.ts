import {validRecordedItemShape} from './missing-items'
import {storedItemStateError} from './storage-state'
// 각인(Imprint) 세이브: 단일 슬롯 직렬화. 저장소(localStorage/파일)는 클라이언트가 결정.

import { SAVE_VERSION } from './game'
import type { Creature, GameState } from './types'

export function serialize(s: GameState): string {
  return JSON.stringify(s)
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState
  if (s.version === 2) {
    const all = [...s.creatures, ...Object.values(s.offCreatures ?? {}).flat()]
    for (const c of all) migrateNutrition(c, Math.floor(s.time / (28800 * 100)))
    s.version = 3
  }
  // v4의8날씨 값은 구형 클라이언트의3날씨 분기와 호환되지 않는다. v3의 몸·영양 값은 그대로 둔다.
  if (s.version === 3) s.version = 4
  // v5는 외용약 medicate 활동을 추가한다. 구형 몸·영양·진행 중 효과는 변환하지 않는다.
  if (s.version === 4) s.version = 5
  // v6는 부분 알약과 taste 활동을 추가한다. v5의 약효·몸 값은 그대로 둔다.
  if (s.version === 5) s.version = 6
  // v7는 사체 해부 활동을 추가한다. 기존 도감/몸/약물 기록은 유지한다.
  if (s.version === 6) s.version = 7
  // v8는 타인 처치/진료 대기를 추가한다. 기존 몸·재고·진행 중 자가 처치는 유지한다.
  if (s.version === 7) s.version = 8
  // v9는 진찰 활동/과거 진료 기록을 추가한다. 기존 치료·돈·몸은 그대로 둔다.
  if (s.version === 8) s.version = 9
  // v10는 의사의 실제 투약 활동을 추가한다. 기존 약효/내성/재고/진료 기록을 보존한다.
  if (s.version === 9) s.version = 10
  // v11은 유한한 여관 침대/대여 기한을 추가한다. 기존 몸·돈·활동은 보존한다.
  if (s.version === 10) s.version = 11
  // v12는 손 씻기 활동/손 오염과 물의 실제 잔량을 추가한다. 기존 몸·물병은 보존한다.
  if (s.version === 11) s.version = 12
  // v13의 수면 활동은 시야/대화/기습과 같은 asleep 상태를 쓴다. 기존 몸·잔량은 보존한다.
  if (s.version === 12) {
    const scenes = Object.values(s.overworld?.scenes ?? {})
    const all = [...s.creatures, ...Object.values(s.offCreatures ?? {}).flat(), ...scenes.flatMap((scene) => [...scene.creatures, ...Object.values(scene.offCreatures).flat()])]
    for (const c of all) if (c.alive && c.activity?.kind === 'sleep' && !c.activity.wokeBy) c.asleep = true
    s.version = 13
  }
  // v14는 주민 개인 침대/휴식 계획을 추가한다. 구형 몸·수면·주민을 보존한다.
  if (s.version === 13) s.version = 14
  // v15는 실제 주민 배급/소비 원장을 저장한다. 기존 몸·식량·개인 침대는 보존한다.
  if (s.version === 14) s.version = 15
  // v16는 주민 우물/급수 재시도를 추가한다. 기존 물병/수질/배급 원장은 보존한다.
  if (s.version === 15) s.version = 16
  // v17은 주민 연료 배급/끓이기 계획을 추가한다. 기존 병·수질·몸·소비 원장은 유지한다.
  if (s.version === 16) s.version = 17
  // v18은 실제 수업/서로 다른 날짜의 문해 이정표를 추가한다. 몸·책·기존 문해는 유지한다.
  if (s.version === 17) s.version = 18
  // v19는 주민의 수면 준비/화덕 보온을 추가한다. 구형 몸·영양·수면과 수업 진도는 유지한다.
  if (s.version === 18) s.version = 19
  // v20은 침구 포장/운반·실제 UID와 소유 바닥을 추가한다. 기존 침대/몸/수업은 이동시키지 않는다.
  if (s.version === 19) s.version = 20
  // v21은 실제 주민 사망 원장과 시체 지갑 회수를 추가한다. 기존 인구/몸/돈은 보존한다.
  if (s.version === 20) s.version = 21
  // v22는 실제 조달 계약과 시장 보수 예치를 추가한다. 기존 돈·물품·인구는 보존한다.
  if (s.version === 21) s.version = 22
  // v23은 소문 현장 조사 계약/실제 현장 기록을 추가한다. 기존 조달/예치·지갑은 유지한다.
  if (s.version === 22) s.version = 23
  // v24는 방향별 세력 관계/원한·대화로 들은 정책을 추가한다. 기존 평판/몸/계약은 보존한다.
  if (s.version === 23) s.version = 24
  // v25는 저체온 탈의 요청/실제 착탈·바닥 놓기를 추가한다. 기존 몸·옷·원한은 보존한다.
  if (s.version === 24) s.version = 25
  // v26는 동료의 실제 계약/이동 명단을 추가한다. 기존 몸·장비/착탈 진행은 보존한다.
  if (s.version === 25) s.version = 26
  // v27은 동료 관계/관찰한 태도를 추가한다. 구형 몸·특성·계약·진행은 유지한다.
  if (s.version === 26) s.version = 27
  // v28은 실제 포박 밧줄/항복 선택의 진행을 추가한다. 기존 몸·장비·관계는 유지한다.
  if (s.version === 27) s.version = 28
  // v29은 포로의 돌봄/감시·밧줄 탈출 진행을 추가한다. 기존 몸·밧줄·소문은 유지한다.
  if (s.version === 28) s.version = 29
  // v30은 실제 호송/손 점유와 발목 결박 상태를 추가한다. 구형 포로/돌봄/밧줄은 보존한다.
  if (s.version === 29) s.version = 30
  // v31은 실제 여러 날의 포로 대화/동행 동의를 추가한다. 몸·밧줄·호송/돌봄은 보존한다.
  if (s.version === 30) s.version = 31
  // v32는 실제 해방/구조 기억과 시험 동행 기한을 추가한다. 기존 몸·포박/동의/급료는 보존한다.
  if (s.version === 31) s.version = 32
  // v33은 자유 구조자의 동행 대화와 초대 짝을 추가한다. 기존 동의/몸·밧줄·급료는 보존한다.
  if (s.version === 32) s.version = 33
  // v34는 실제 거점/작업 배정을 추가한다. 과거 지도/물품/계약은 그대로 둔다.
  if (s.version === 33) s.version = 34
  // v35는 실제 정찰 보고/약탈대 기록을 추가한다. 기존 거점·작업·몸/재고는 보존한다.
  if (s.version === 34) s.version = 35
  // v36는 실제 운반/채집 배정을 추가한다. 기존 거점·습격/몸과 재고는 보존한다.
  if (s.version === 35) s.version = 36
  // v37는 실제 물병 급수/정수 목표를 추가한다. 기존 거점·물품·몸/계약은 보존한다.
  if (s.version === 36) s.version = 37
  // v38는 실제 침구의 동료 사용 허가를 추가한다. 기존 거점·물품·몸/계약은 보존한다.
  if (s.version === 37) s.version = 38
  if (s.version === 38) s.version = 39
  if (s.version === 39) s.version = 40
  if (s.version === 40) s.version = 41
  // v42는 물품의 마지막 환경 정산 시각을 추가한다. 기존 물품·몸·노출 진행은 보존한다.
  if (s.version === 41) s.version = 42
  // v43는 실제 원재료 질량/예약과 남은 조각을 추가한다. 구형 원재료/진행은 보존한다.
  if (s.version === 42) s.version = 43
  // v44는 기계의 냉각액/전원/현물 부품과 정비 채널을 보존한다. 기존 몸은 변경하지 않는다.
  if (s.version === 43) s.version = 44
  // v45는 후속 지역의 실제 지도/키/종자와 성장 시각을 보존한다. 기존 물품은 유지한다.
  if (s.version === 44) s.version = 45
  // v46는 실제 친족 목격/이탈과 지연 소식, 숲 방문별 빛 예절을 보존한다.
  if (s.version === 45) s.version = 46
  // v47는 실제 설비와 원본 부품/도구 예약·중단한 정비 진행을 보존한다.
  if (s.version === 46) s.version = 47
  // v48는 봉인 설비의 실제 지형 변화와 목격된 재산 침해 소식을 보존한다.
  if (s.version === 47) s.version = 48
  // v49는 원본 인가 증표/설비 전력과 탑 정지의 계절·수년 이력을 보존한다.
  if (s.version === 48) s.version = 49
  // v50는 실제 증거 청중의 개별 판단/공개 소식과 원래 시민 소속을 보존한다.
  if (s.version === 49) s.version = 50
  // v51는 실제 장기 거처·은퇴 보고서와 같은 시드의 정보 전용 주민을 보존한다.
  if (s.version === 50) s.version = 51
  // v52 adds optional dissolved salt and physical bottle transfers. Old water stays fresh.
  if (s.version === 51) s.version = 52
  // v53 preserves actual evaporation reservations and salt/food ash through processing.
  if (s.version === 52) s.version = 53
  // v54 adds single-instance boat deck/hull and bound sea travel.
  if (s.version === 53) s.version = 54
  // v55는 유한 원본 기생 개체/제거 진행과 늪 안개를 추가한다. 기존 몸/지도는 보존한다.
  if(s.version===54)s.version=55
  // v56는 실제 봉화/유한 연료와 전송 중 소식을 추가한다. 구형 지식/몸을 보존한다.
  if(s.version===55)s.version=56
  // v57은 실제 깊은 물/호흡·구조 진행을 추가한다. 구형 몸/장비는 보존한다.
  if(s.version===56)s.version=57
  // v58은 원래 상인/화물·현금이 움직이는 캐러밴을 추가한다. 기존 인물을 생성하지 않는다.
  if(s.version===57)s.version=58
  // v59는 실제 길목 정차/보행과 한 번 만난 칸을 보존한다. 과거 만남을 만들어 내지 않는다.
  if(s.version===58)s.version=59
  // v60은 원래 약탈자/강탈 화물의 실제 출정과 귀환 운반을 보존한다.
  if(s.version===59)s.version=60
  // v61은 원래 선체의 침수/복구와 같은 승선자/화물을 보존한다.
  if(s.version===60)s.version=61
  // v62는 실제 노출 원인·잠복/발병·치료와 질병 기능 손실을 보존한다.
  if(s.version===61)s.version=62
  // v63는 실제 흡입 재와 유한 여과포 교체의 원본 예약을 보존한다.
  if(s.version===62)s.version=63
  // v64는 실제 물림의 원래 상처·예방 기한·단 한 번 뽑은 판정과 잠복 시계를 보존한다.
  if(s.version===63)s.version=64
  // v65는 실제 최근 식사와 원래 마지막 섭취/구토 기록만 보존한다. 구형 식사를 지어내지 않는다.
  if(s.version===64)s.version=65
  // v66는 실제 잇몸 출혈과 모든 남은 흉터 재개방을 정산한다. 과거 출혈/상처를 지어내지 않는다.
  if(s.version===65)s.version=66
  // v67는 당사자의 실제 수면 박탈 지각/판정 시각만 보존한다. 구형에 환청을 만들지 않는다.
  if(s.version===66)s.version=67
  // v68는 실제 첫 만남의 상대별 인상을 보존한다. 구형의 과거 인상을 지어내지 않는다.
  if(s.version===67)s.version=68
  // v69는 실제 가공 배치의 원본 재료/연료/환경 진행만 보존한다. 구형 배치를 바꾸지 않는다.
  if(s.version===68)s.version=69
  // v70는 실제 발효 용기/남은 회분을 보존한다. 구형 음식을 임의 분할하지 않는다.
  if(s.version===69)s.version=70
  // v71는 원래 밀봉 음식과 실제 개봉 활동만 보존한다. 과거 개봉을 생성하지 않는다.
  if(s.version===70)s.version=71
  // v72는 실제 솔잎/원래 물병의 조리와 채집 재생 시각만 보존한다. 과거 차/나무를 만들지 않는다.
  if(s.version===71)s.version=72
  // v73는 원래 그릇/물/곡물의 조리와 실제 보온 시각만 보존한다. 구형에 뜨거운 음식을 만들지 않는다.
  if(s.version===72)s.version=73
  // v74는 실제 계절 채집/원래 작물의 성장 시각만 보존한다. 구형 지도에 덤불이나 과거 열매를 만들지 않는다.
  if(s.version===73)s.version=74
  // v75는 실제 날고기 음식UID의 노출과 원래 배급 팩 개봉만 보존한다. 구형 고기의 과거 종/질병을 추정하지 않는다.
  if(s.version===74)s.version=75
  // v76는 실제 바닥 충격으로 깨진 원래 달걀만 보존한다. 구형 물품의 과거 낙하를 추정하지 않는다.
  if(s.version===75)s.version=76
  // v77는 실제 모닥불 위 원래 한 회분과 연속 조리/탄 음식 상태를 보존한다.
  if(s.version===76)s.version=77
  // v78는 원래 그릇/실제 물의 끓기 전 상태와400턴 정산을 보존한다.
  if(s.version===77)s.version=78
  // v79는 실제 저장된 차 끓이기의 원래 남은 시간을 보존한다. 과거 중단은 추정하지 않는다.
  if(s.version===78){
    for(const c of [...s.creatures,...Object.values(s.offCreatures??{}).flat(),...Object.values(s.overworld?.scenes??{}).flatMap(scene=>[...scene.creatures,...Object.values(scene.offCreatures??{}).flat()]),...(s.overworld?.caravans??[]).flatMap(g=>g.actors??[]),...(s.overworld?.roadRaids??[]).flatMap(g=>g.actors??[])]){
      const a=c.activity;if(a?.kind==='brewTea'&&a.brew&&a.uid!==undefined&&!c.brewJob)c.brewJob={uid:a.uid,remaining:a.remaining,total:a.total??a.remaining,brew:structuredClone(a.brew)}
    }
    s.version=79
  }
  // v80는 새로 시작한 원래 물/열원의 끓임을 보존한다. 구형 활동은 기록된 남은 시간으로 계속하며 과거 열원을 추정하지 않는다.
  if(s.version===79)s.version=80
  // v81는 실제 마지막 조리의 음식Q를 보존한다. 구형 완성 음식에 과거 품질을 추정하지 않는다.
  if(s.version===80)s.version=81
  // v82는 원래 지형 침대의 실제 젖음을 보존한다. 구형 침대에 과거 비나 새 물품을 소급하지 않는다.
  if(s.version===81)s.version=82
  // v83은 실제 침구 화재와 그을음만 보존한다. 과거의 화재나 물품을 소급하지 않는다.
  if(s.version===82)s.version=83
  // v84는 실제 침구의 이/관찰된 접촉과 세탁을 보존한다. 과거 전염이나 새 물품은 만들지 않는다.
  if(s.version===83)s.version=84
  // v85는 실제 물 용기 용량/정수 묶음을 보존한다. 빈 용기에 물을 소급하지 않는다.
  if(s.version===84)s.version=85
  // 주민 위생은 현재의 실제 물과 관찰만 쓴다. 과거 세탁/침구 기억을 소급하지 않는다.
  if(s.version===85)s.version=86
  // 실제 상점의 유한 용기 조달만 추가한다. 구형 주민에게 새 용기/현금을 주지 않는다.
  if(s.version===86)s.version=87
  // 실제 완료한 생활 기억만 추가한다. 구형 인물의 과거 목욕/식사/대화/숙박을 지어내지 않는다.
  if(s.version===87)s.version=88
  // 조건 사고는 현재 상태에서만 계산한다. 과거 조건 기억은 추가하지 않는다.
  if(s.version===88)s.version=89
  // 피로 단계는 현재 몸/실제 수면 시작값에서 읽는다. 구형 시작 부채는 채워 넣지 않는다.
  if(s.version===89)s.version=90
  // 증상/환경/실제 복용은 현재 상태에서만 읽고 과거 기억을 추가하지 않는다.
  if(s.version===90)s.version=91
  // 현재 감염의 물리 단계만 바뀐다. 과거 증상/치유/물 소비는 소급하지 않는다.
  if(s.version===91)s.version=92
  // 실제 약물 단계는 현재 기록에서 읽고 과거 복용/금단 기억을 추가하지 않는다.
  if(s.version===92)s.version=93
  // 기록된 수면 관찰만 보존한다. 과거 수면 품질/침구/젖음을 추정하지 않는다.
  if(s.version===93)s.version=94
  // 실제 관찰 시작/성공한 대화만 보존한다. 과거의 무대화 시간을 만들지 않는다.
  if(s.version===94)s.version=95
  // NPC는 기록된 실제 사건만 이어가며 과거 스트레스/붕괴를 만들지 않는다.
  if(s.version===95)s.version=96
  // 동물은 실제 성공한 도주에서만 배운다. 과거의 상대/무리 학습은 소급하지 않는다.
  if(s.version===96)s.version=97
  // 실제 치료/복구만 기억하고 저장된 수리 위험/영구 파손을 보존한다. 과거를 소급하지 않는다.
  if(s.version===97)s.version=98
  // 실제 들은 소리와 목격한 동료 사망만 보존하며 과거 인지를 소급하지 않는다.
  if(s.version===98)s.version=99
  // 이미 알게 된 소식만 보존한다. 과거 글의 문장으로 역병 인지를 추측하지 않는다.
  if(s.version===99)s.version=100
  // 현재 실제 냄새와 완료한 수색만 읽고 과거 수색/시체 나이를 추정하지 않는다.
  if(s.version===100)s.version=101
  // 현재 풍경과 실제 새 발견만 연결하며 과거 방 발견 기억은 소급하지 않는다.
  if(s.version===101)s.version=102
  // 실제 확정한 거래 이득만 기억하고 과거 흥정/포위는 소급하지 않는다.
  if(s.version===102)s.version=103
  // 실제 교전 전력과 승리만 보존하며 과거의 위협도를 소급하지 않는다.
  if(s.version===103)s.version=104
  if(s.version===104)s.version=105
  if(s.version===105)s.version=106
  if(s.version===106)s.version=107
  if(s.version===107)s.version=108
  if(s.version===108)s.version=109
  if(s.version===109)s.version=110
  if(s.version===110)s.version=111
  if(s.version===111)s.version=112
  if(s.version===112)s.version=113
  if(s.version===113)s.version=114
  if(s.version===114)s.version=115
  if(s.version===115)s.version=116
  if(s.version===116)s.version=117
  if(s.version===117)s.version=118
  if(s.version===118)s.version=119
  if(s.version===119)s.version=120
  if(s.version===120)s.version=121
  if(s.version===121)s.version=122
  if(s.version===122)s.version=123
  if(s.version===123)s.version=124
  if(s.version===124)s.version=125
  if(s.version===125)s.version=126
  if(s.version===126)s.version=127
  if(s.version===127)s.version=128
  if(s.version===128)s.version=129
  if(s.version===129)s.version=130
  if(s.version===130)s.version=131
  if(s.version===131)s.version=132
  if(s.version===132)s.version=133
  if(s.version===133)s.version=134
  if(s.version===134)s.version=135
  // v136은 새로 배치한 공급원의 원래 인원 명단을 보존한다. 구형 명단/과거 소속은 추정하지 않는다.
  if(s.version===135)s.version=136
  // v137은 새 토벌 계약의 원래 명단/실제 증거를 보존한다. 구형 계약/과거 처치는 추정하지 않는다.
  if(s.version===136)s.version=137
  // v138은 새로 물리화한 정착지 집단의 원래 명단/소유 세력을 보존한다. 구형 명단은 추정하지 않는다.
  if(s.version===137)s.version=138
  // v139는 새 의뢰인의 주장과 직접 들은 당사자 증언만 보존한다. 과거 계약의 거짓/증언은 추정하지 않는다.
  if(s.version===138)s.version=139
  // v140는 실제 관로 봉쇄의 완료 시각/시공자/현장만 기록한다. 과거 봉쇄는 추정하지 않는다.
  if(s.version===139)s.version=140
  // v141은 실제 관찰한 기구와 새 봉쇄 의뢰/작업 증거를 보존한다. 과거 의뢰/기구 관찰은 추정하지 않는다.
  if(s.version===140)s.version=141
  // v142는 직접 확인한 용기의 원래 물품 관찰과 새 회수 계약만 보존한다. 구형 물품/의뢰는 추정하지 않는다.
  if(s.version===141)s.version=142
  // v143은 명시적으로 맡긴 동료 원본 회수와 실제 운반 원본만 기록한다. 과거 임무/운반은 추정하지 않는다.
  if(s.version===142)s.version=143
  // v144는 직접 식별한 포박/해방/시신 목격만 보존한다. 과거 인물 위치나 포박 이력을 추정하지 않는다.
  if(s.version===143)s.version=144
  // v145는 실제 목격 뒤 맡은 구조와 같은 사람의 귀환 장부만 보존한다. 과거 의뢰를 추정하지 않는다.
  if(s.version===144)s.version=145
  // v146는 현장 시신 수색으로 식별한 같은 유품만 보존한다. 과거 사망/유품을 추정하지 않는다.
  if(s.version===145)s.version=146
  // v147는 실제 NPC가 시작한 포획/같은 밧줄/목격 위치만 보존한다. 과거 포획을 추정하지 않는다.
  if(s.version===146)s.version=147
  // v148은 NPC 개인 목격과 실제 대화로 들은 출처만 보존한다. 과거 목격/소식을 추정하지 않는다.
  if(s.version===147)s.version=148
  // v149는 실제 완료한 포로 심문으로 전해 들은 목격만 구분한다. 과거 심문을 추정하지 않는다.
  if(s.version===148)s.version=149
  // v150은 실제 포로/밧줄/개인 지갑의 미완료 몸값 협상만 보존한다. 과거 지급을 추정하지 않는다.
  if(s.version===149)s.version=150
  // v151은 실제 두 포로/원래 밧줄의 미완료 교환 합의만 보존한다. 과거 교환을 추정하지 않는다.
  if(s.version===150)s.version=151
  // v152는 새 야영지의 겹친 시작 칸만 고친다. 과거 살아온 인물의 실제 위치는 옮기지 않는다.
  if(s.version===151)s.version=152
  // v153은 수락 뒤 직접 확인한 순찰 지점만 보존한다. 과거 이동으로 소급하지 않는다.
  if(s.version===152)s.version=153
  // v154는 실제 주민 대화 뒤에만 관계를 기록한다. 과거 만남/대화/친구를 소급하지 않는다.
  if(s.version===153)s.version=154
  // v155는 실제 대화로 전해 들은 이웃 관계만 기록한다. 과거 주민 대화를 소급 공개하지 않는다.
  if(s.version===154)s.version=155
  // v156은 새로 실체화한 주민의 개인 이름만 보존한다. 옛 인물의 이름/소개를 소급하지 않는다.
  if(s.version===155)s.version=156
  // v157는 실제 수락한 동행 호송만 기록한다. 과거 NPC에게 임무를 소급하지 않는다.
  if(s.version===156)s.version=157
  // v158는 실제 수락/작업한 봉인 보관함 발굴만 기록한다. 과거 발굴은 만들지 않는다.
  if(s.version===157)s.version=158
  // v159는 실제 이웃 처치와 원래 물품 예약만 보존한다. 옛 돌봄을 소급하지 않는다.
  if(s.version===158)s.version=159
  // v160은 실제 완료한 이웃 처치의 관계 사건만 보존한다. 옛 돌봄 점수를 소급하지 않는다.
  if(s.version===159)s.version=160
  // v161는 실제 선택한 격리 스크립트의 상태/소스 해시만 보존한다. 기본 게임에 과거 훅을 만들지 않는다.
  if(s.version===160)s.version=161
  // v162는 스크립트가 예약한 실제 장소 사건만 보존한다. 과거 예약을 만들지 않는다.
  if(s.version===161)s.version=162
  // v163은 실제 장소 사건 워커의 자기 데이터/하위 난수만 보존한다. 과거 호출을 만들지 않는다.
  if(s.version===162)s.version=163
  // v164는 실제 보이는 적 후보의 스크립트 AI 점수만 보존한다. 과거 판단을 만들지 않는다.
  if(s.version===163)s.version=164
  // v165는 실제 원래 물품 소비 뒤 아이템 워커 데이터만 보존한다. 과거 사용을 만들지 않는다.
  if(s.version===164)s.version=165
  // v166은 검증된 실제 최초 지도 생성 워커 상태만 보존한다. 옛 지도를 다시 만들지 않는다.
  if(s.version===165)s.version=166
  // v167은 최초 지상/던전·아이템 완료 워커와 훅 API 범위를 연결한다. 과거 효과를 소급하지 않는다.
  if(s.version===166)s.version=167
  // v168은 원래 공급원에서 출발한 새 모드 사건의 귀환/예약 상태만 보존한다.
  if(s.version===167)s.version=168
  // v169은 실제 의료 적용/제작 재료 소비 콜백만 보존한다. 과거 사용을 만들지 않는다.
  if(s.version===168)s.version=169
  // v170은 현재 활성 밭의 증발만 정산한다. 과거 날씨/물 손실은 추정하지 않는다.
  if(s.version===169)s.version=170
  // v171은 이후 실제 관수만 기록한다. 기존 밭/먹거리의 오염 이력을 만들지 않는다.
  if(s.version===170)s.version=171
  // v172은 이후 실제 주민 파종만 기록한다. 기존 밭의 주인을 추정하지 않는다.
  if(s.version===171)s.version=172
  // v173은 이후 실제 주민 수확의 출처만 기록한다. 기존 음식의 농사 출처는 추정하지 않는다.
  if(s.version===172)s.version=173
  // v174은 새 배양목에만 배지 횟수를 기록한다. 기존 밭의 배지를 추정하지 않는다.
  if(s.version===173)s.version=174
  // v175는 이후 실제 의수족 완료만 알린다. 과거 수술 콜백을 소급하지 않는다.
  if(s.version===174)s.version=175
  // v176는 실제 주민 재배 재료 확인만 기억한다. 과거 구매나 제작을 추정하지 않는다.
  if(s.version===175)s.version=176
  // v177은 이후 실제 지도 이탈만 표시한다. 구형 정지 밭에 지난 성장 시간을 채우지 않는다.
  if(s.version===176)s.version=177
  // 구형 각인의 과거 콘텐츠 해시는 추정해서 채우지 않는다.
  if(s.version===177)s.version=178
  // 과거 Def 목록은 소급하지 않는다. 같은 기록 해시를 실제 검증한 로드에서만 보강한다.
  if(s.version===178)s.version=179
  // 원래 칸 크기가 기록되지 않은 구형 각인은 현재 값으로 추정하지 않는다.
  if(s.version===179)s.version=180
  // 과거 게임/스키마/개별 모드 내용은 소급하지 않는다.
  if(s.version===180)s.version=181
  // 기록 시작은 실제 명시 동작에만 남긴다. 구형 각인에는 과거 기록 시작을 채우지 않는다.
  if(s.version===181)s.version=182
  // 내부 격자는 이후 만든 실제 가방에만 생긴다. 구형 소지품에 자루나 내용물을 추가하지 않는다.
  if(s.version===182)s.version=183
  // 기존 허리띠에 물품이나 과거 사용 기록을 채우지 않는다. 주머니는 실제 열 때 빈 상태로 시작한다.
  if(s.version===183)s.version=184
  // 구형 상자는 잠그지 않는다. 새 지도 생성의 실제 잠금과 진행 중 작업만 저장한다.
  if(s.version===184)s.version=185
  // 기존 장비에 화살통/화살을 채우지 않는다. 실제 새 화살통은 비어 있다.
  if(s.version===185)s.version=186
  if(s.contentAdoptedAt!==undefined&&(!s.contentAdoptedAt||typeof s.contentAdoptedAt!=='object'||!Number.isSafeInteger(s.contentAdoptedAt.turn)||s.contentAdoptedAt.turn<0||typeof s.contentAdoptedAt.hash!=='string'||!/^sha256-[0-9a-f]{64}$/.test(s.contentAdoptedAt.hash)))throw new Error('각인의 현재 구성 기록 시작 형식이 올바르지 않다')
  if(s.gameVersion!==undefined&&(typeof s.gameVersion!=='string'||!s.gameVersion.trim()))throw new Error('각인의 게임 버전 기록 형식이 올바르지 않다')
  if(s.defSchemaVersion!==undefined&&(!Number.isSafeInteger(s.defSchemaVersion)||s.defSchemaVersion<=0))throw new Error('각인의 정의 스키마 버전 기록 형식이 올바르지 않다')
  if(s.contentMods!==undefined&&(!Array.isArray(s.contentMods)||!s.contentMods.length||s.contentMods.some(m=>!m||typeof m.id!=='string'||!m.id.trim()||typeof m.version!=='string'||!m.version.trim()||typeof m.hash!=='string'||!/^sha256-[0-9a-f]{64}$/.test(m.hash))||new Set(s.contentMods.map(m=>m.id)).size!==s.contentMods.length))throw new Error('각인의 개별 모드 내용 기록 형식이 올바르지 않다')
  if(s.contentItemShapes!==undefined&&(!s.contentItemShapes||typeof s.contentItemShapes!=='object'||Array.isArray(s.contentItemShapes)||Object.values(s.contentItemShapes).some(v=>!validRecordedItemShape(v))))throw new Error('각인의 원래 물품 크기 기록 형식이 올바르지 않다')
  if(s.contentDefinitions!==undefined&&(!s.contentDefinitions||typeof s.contentDefinitions!=='object'||Array.isArray(s.contentDefinitions)||Object.values(s.contentDefinitions).some(v=>typeof v!=='string'||!v)))throw new Error('각인의 콘텐츠 정의 목록 형식이 올바르지 않다')
  if(s.contentChanges!==undefined&&(!Array.isArray(s.contentChanges)||s.contentChanges.some(c=>!c||!Number.isSafeInteger(c.turn)||c.turn<0||typeof c.from!=='string'||!/^sha256-[0-9a-f]{64}$/.test(c.from)||typeof c.to!=='string'||!/^sha256-[0-9a-f]{64}$/.test(c.to))))throw new Error('각인의 콘텐츠 변경 이력 형식이 올바르지 않다')
  if(s.achievementsDisabled!==undefined&&typeof s.achievementsDisabled!=='boolean')throw new Error('각인의 업적 상태 형식이 올바르지 않다')
  if(s.loadHash!==undefined&&(typeof s.loadHash!=='string'||!/^sha256-[0-9a-f]{64}$/.test(s.loadHash)))throw new Error('각인의 콘텐츠 로드 해시 형식이 올바르지 않다')
  if (s.version !== SAVE_VERSION) throw new Error(`세이브 버전 불일치: ${s.version} (현재 ${SAVE_VERSION})`)
  const storageError=storedItemStateError(s);if(storageError)throw new Error(storageError)
  return s
}

/** 결정론 검증용 상태 해시 (FNV-1a) */
/** 키 순서와 무관한 직렬화: 런타임에 키가 붙은 순서는 불러오기 전후로 달라질 수 있다 */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
}

export function stateHash(s: GameState): string {
  const str = canonical(s)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** v2는1800을 시작 비축량으로 썼다. v3의0기준 균형/결손으로 한 번만 변환한다. */
function migrateNutrition(c: Creature, day: number) {
  const legacy = c.needs as unknown as Record<string, number>
  c.needs.kcal -= 1800
  c.needs.waterDeficit = Math.max(0, 1800 - (legacy.water ?? 1800))
  delete legacy.water
  c.needs.protein = 100; c.needs.hygiene = 100; c.needs.nutritionDay = day
  c.needs.kcalRemainder = 0; c.needs.waterRemainder = 0; c.needs.scurvy = 0
}
