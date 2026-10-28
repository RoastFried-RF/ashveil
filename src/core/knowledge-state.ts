// 비밀 대응표를 조회하지 않는 지식 표시·기록. 소지품/책과 공통으로 쓴다.
import {rememberLifeEvent} from './life-memories'
import { player,rng, turnOf, type World } from './ctx'
import type { Creature, KnowledgeDef, PillBelief } from './types'
export const knowledgeDef = (w: World) => w.db.get<KnowledgeDef>('Knowledge.Human')
export function pillBelief(w: World, appearance: string): Readonly<PillBelief> | undefined {
  const certain = w.s.knowledge.pillKnown[appearance]
  if (certain) return { belief: certain, confidence: 'certain', ruledOut: [], evidence: w.s.knowledge.pillBeliefs?.[appearance]?.evidence ?? [] }
  return w.s.knowledge.pillBeliefs?.[appearance]
}
export function recordPill(w: World, appearance: string, method: PillBelief['evidence'][number]['method'], text: string, belief?: string, confidence: PillBelief['confidence'] = 'unknown') {
  const k = w.s.knowledge, old = pillBelief(w, appearance)
  const state: PillBelief = { belief: confidence === 'unknown' ? old?.belief : belief, confidence: confidence === 'unknown' ? old?.confidence ?? 'unknown' : confidence, ruledOut: [...old?.ruledOut ?? []], evidence: [...old?.evidence ?? [], { turn: turnOf(w), method, text }].slice(-30) }
  // 추정/오독이 이미 확정한 지식을 덮어쓰지 않는다.
  if (old?.confidence === 'certain') { state.belief = old.belief; state.confidence = 'certain' }
  if (state.confidence === 'certain' && state.belief) { k.pillKnown[appearance] = state.belief; state.ruledOut = state.ruledOut.filter((id) => id !== state.belief) }
  ;(k.pillBeliefs ??= {})[appearance] = state
  if(state.confidence==='certain'&&state.belief===k.pillMap[appearance]){
    let refuted=false
    for(const receipt of k.appraisalReceipts??[])if(receipt.appearance===appearance&&receipt.paid>0&&receipt.refutedAt===undefined&&receipt.belief!==state.belief){receipt.refutedAt=turnOf(w);refuted=true}
    if(refuted&&player(w).alive)rememberLifeEvent(w,player(w),'tradeDeception')
  }
  return state
}
export function readingPageTurns(w: World, c: Creature): number {
  const d = knowledgeDef(w), level = c.literacy ?? (c.literate ? 2 : 0)
  return Math.ceil(d.pageTurns * (d.literacySpeed[level] ?? 1))
}

export function learnPillsFromBook(w: World, c: Creature, effects: string[], misread: boolean) {
  if (c.id !== w.s.playerId) return
  for (const [appearance, truth] of Object.entries(w.s.knowledge.pillMap)) {
    if (!effects.includes(truth)) continue
    const choices = w.db.all<import('./types').PillEffectDef>('PillEffect').filter((d) => d.id !== truth).sort((a,b) => a.id<b.id?-1:a.id>b.id?1:0)
    const belief = misread && choices.length ? rng(w,'world.knowledge').pick(choices).id : truth
    recordPill(w,appearance,'book',misread ? '문헌을 읽고 외형과 효능을 짚어 두었다.' : '문헌으로 대응 관계를 확인했다.',belief,misread ? 'likely' : 'certain')
  }
}
