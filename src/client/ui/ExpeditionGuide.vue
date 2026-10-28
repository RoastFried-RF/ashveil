<script setup lang="ts">
import {computed,ref} from 'vue'
import {allItems,canSee,knownExpeditionEndings,hostile,hungerStage,itemDef,player,thirstStage,totalBleed,turnOf,type World} from '../../core'
import {drinkVolume} from '../../core/wash-water'
import {version,world} from '../store'
import {craftSection,journalSection,trackedContract,setWin,type WinKey} from '../ui'
import {primaryBindingText} from '../keybindings'
import {preferences} from '../preferences'

const expanded=ref(world.value?turnOf(world.value)<10:false)
function open(win:WinKey){if(win==='craft')craftSection.value='field';setWin(win,true)}
const state=computed(()=>{
 void version.value
 const w=world.value as World,c=player(w),items=allItems(c)
 const food=items.filter(i=>itemDef(w,i).food).reduce((n,i)=>n+i.count,0)
 const water=items.filter(i=>!itemDef(w,i).drink?.alcohol&&!i.waterFrozen).reduce((n,i)=>n+drinkVolume(w,i),0)
 const light=items.some(i=>!!itemDef(w,i).light)
 const bleed=totalBleed(w,c)
 const threats=w.s.creatures.filter(o=>o.alive&&o.id!==c.id&&(o.mapId===undefined||o.mapId===w.s.map.id)&&hostile(w,c,o)&&canSee(w,c,o.pos)).length
 const rows:{id:string;label:string;detail:string;ready:boolean;win:WinKey}[]=[
  {id:'wounds',label:'몸을 먼저 살핀다',detail:bleed>0?`출혈 ${bleed.toFixed(1)}ml/턴 · 신체 창에서 상처와 처치를 확인한다.`:'현재 출혈 없음 · 다친 부위와 회복 상한을 확인한다.',ready:bleed===0,win:'body'},
  {id:'water',label:'마실 물을 챙긴다',detail:`지닌 물 ${Math.floor(water)}ml · 물의 수질은 소지품에서 확인한다.`,ready:water>=500,win:'inv'},
  {id:'food',label:'먹을 것을 남겨 둔다',detail:`지닌 음식 ${food}개 · 날것·부패·조리 여부를 확인한다.`,ready:food>0,win:'inv'},
  {id:'light',label:'어둠에 들어갈 준비',detail:light?'광원이 있다. 켜기·연료와 남은 시간을 확인한다.':'광원을 구하고 어두운 장소에 들어간다.',ready:light,win:'inv'},
  {id:'ability',label:'싸우기 전에 능력을 고른다',detail:c.abilityPoints?`사용하지 않은 능력 포인트 ${c.abilityPoints} · 능력을 배우고 빠른 칸에 넣는다.`:'배운 능력을 빠른 칸에 넣고 기력·재사용 시간을 확인한다.',ready:!c.abilityPoints,win:'abil'},
  {id:'route',label:'돌아올 길을 기억한다',detail:'지도에서 직접 본 길·계단과 전해 들은 주장을 구분한다.',ready:w.s.map.rooms.some(r=>r.discovered&&r.type!=='entry'),win:'map'},
 ]
 const urgent=bleed>0?{label:'출혈부터 멈추자',detail:'신체 창에서 상처를 살피고 지닌 붕대·처치 도구를 사용한다.',win:'body' as WinKey}:c.needs.bodyTemp<35?{label:'몸을 데울 곳이 필요하다',detail:'불·마른 옷·침구를 확인한다. 추위 속 휴식은 위험하다.',win:'craft' as WinKey}:thirstStage(w,c)>=1?{label:'목을 축이고 수질을 확인하자',detail:'오염된 물은 끓이거나 처리한다. 소금물은 갈증을 키운다.',win:'inv' as WinKey}:hungerStage(w,c)>=1?{label:'다음 탐험 전에 먹어 두자',detail:'남은 식량의 신선도와 조리 여부를 확인한다.',win:'inv' as WinKey}:threats?{label:`눈앞에 적 ${threats}명`,detail:'지금은 자동 이동을 피하고 퇴로·기력·방어 반응을 확인한다.',win:'abil' as WinKey}:{label:'첫 원정의 준비',detail:'준비를 마치고 주변을 살핀다. 돌아올 여유를 남겨 두자.',win:'inv' as WinKey}
 const contract=w.s.overworld?.contracts?.find(r=>r.id===trackedContract.value&&r.status==='active')
 return{rows,urgent,endings:knownExpeditionEndings(w,c).length,contract,contractHours:contract?Math.max(0,Math.ceil((contract.deadline-turnOf(w))/1200)):0,ready:rows.filter(r=>r.ready).length}
})
</script>

<template>
  <section class="expedition-guide" data-testid="expedition-guide" aria-label="원정 준비 안내" @keydown.esc.stop="expanded=false">
    <button class="guide-toggle" :aria-expanded="expanded" @click="expanded=!expanded"><span><span class="guide-eyebrow">떠돌이의 수첩</span><strong>{{ state.urgent.label }}</strong></span><span class="guide-expand">{{ expanded?'접기':'펼치기' }}</span></button>
    <div v-if="state.contract" class="guide-contract"><span>고정한 계약 · {{ state.contractHours }}시간 남음</span><button @click="journalSection='contracts';setWin('journal',true)">{{ state.contract.label }} ↗</button></div>
    <button v-if="state.endings" class="guide-ending-link" @click="journalSection='endings';setWin('journal',true)">원정의 갈림길 {{ state.endings }}개 살피기 ↗</button>
    <template v-if="expanded">
      <p class="guide-advice">{{ state.urgent.detail }}</p>
      <button class="dbtn guide-action" @click="open(state.urgent.win)">확인할 창 열기</button>
      <p class="guide-progress">지금의 준비 {{ state.ready }}/{{ state.rows.length }} · 행동을 권하는 수첩</p>
      <ol class="guide-list"><li v-for="row in state.rows" :key="row.id" :class="{'is-ready':row.ready}"><span class="guide-mark" aria-hidden="true">{{ row.ready?'◆':'◇' }}</span><div><button @click="open(row.win)">{{ row.label }} <span aria-hidden="true">↗</span></button><p>{{ row.detail }}</p></div></li></ol>
      <p class="guide-footnote">준비 표시는 현재 상태다. {{ primaryBindingText(preferences.keyBindings,'help') }} 조작법 · {{ primaryBindingText(preferences.keyBindings,'map') }} 지도</p>
    </template>
  </section>
</template>

<style scoped>
.expedition-guide{width:292px;max-width:calc(100vw - 24px);border:1px solid #61543d;background:linear-gradient(125deg,#26251feb,#171714f5);box-shadow:0 4px 18px #0007;color:#d7c9ab;pointer-events:auto}.guide-ending-link{display:block;width:100%;border-top:1px solid #504630;padding:9px 12px;color:#cbb388;font-size:10px;text-align:left}.guide-contract{border-top:1px solid #4d4432;padding:9px 12px}.guide-contract span{display:block;font-size:9px;color:#9b9879;margin-bottom:4px}.guide-contract button{font-size:11px;color:#c8b88d;text-align:left}.guide-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;text-align:left}.guide-eyebrow{display:block;font-size:9px;color:#ab9467;letter-spacing:.16em;margin-bottom:3px}.guide-toggle strong{font-size:12px;font-weight:500}.guide-expand{font-size:10px;color:#a99b7d}.guide-advice{font-size:11px;color:#c3b89e;line-height:1.65;padding:0 12px 8px}.guide-action{margin:0 12px 12px}.guide-progress{font-size:10px;color:#ad9a72;padding:9px 12px;border-block:1px solid #4a4130}.guide-list{padding:6px 12px}.guide-list li{display:flex;gap:9px;padding:8px 0;border-bottom:1px solid #3c382b}.guide-mark{color:#887854;font-size:11px;padding-top:2px}.is-ready .guide-mark{color:#9aa97f}.guide-list button{font-size:11px;color:#dfd2b3;text-align:left}.guide-list button:hover{color:#f4e1a9;text-decoration:underline}.guide-list p{font-size:10px;line-height:1.6;color:#a59c86;margin-top:3px}.guide-footnote{font-size:9px;color:#8e856f;padding:6px 12px 10px}@media(max-height:800px){.guide-list{max-height:210px;overflow:auto}}
</style>
