<script setup lang="ts">
import { computed, ref } from 'vue'
import { activeBeddingLice,beddingWashQuote,beddingScorch,beddingFireMaterial,beddingFireQuote,unheatedMealQuote,allItems, batchStatus, beddingAt, furnitureQuote, cheb, craftError, craftMaterialQuote, materialCandidates, materialMixPenalty, rawStock, craftingQuality, craftTurns, gearCareError, primaryMaterial, itemDef, itemLabel, maintenanceError, multiTurnFactor, nearbyBedding, nearbyGather, player, repairPreview, salvagePreview, terrainAt, tileAt, workshop, type GearCare, type RecipeDef, type World, type MaterialSelection, type MaterialDef } from '../../core'
import { simulating, version, world } from '../store'
import { craftSection as tab, doAct, hideTip, showTip, wins } from '../ui'
import { itemTip } from '../info'
import ItemIcon from './ItemIcon.vue'
import Win from './Win.vue'
import BaseCampPanel from './BaseCampPanel.vue'
import CampfirePanel from './CampfirePanel.vue'
import TerrainFirePanel from './TerrainFirePanel.vue'
import TeaPanel from './TeaPanel.vue'
import CookingPanel from './CookingPanel.vue'
import BoilPanel from './BoilPanel.vue'
import SeasonalForagePanel from './SeasonalForagePanel.vue'
import CultivationPanel from './CultivationPanel.vue'
import ContainerLockPanel from './ContainerLockPanel.vue'
import MachinePanel from './MachinePanel.vue'
import FieldDevicePanel from './FieldDevicePanel.vue'
import MarinePanel from './MarinePanel.vue'
import BeaconPanel from './BeaconPanel.vue'
import AquaticPanel from './AquaticPanel.vue'
import BrushClearingPanel from './BrushClearingPanel.vue'

const query=ref('')
const onlyReady=ref(false)
const onlyKnown=ref(false)
const pinned=ref<string[]>([])
const onlyPinned=ref(false)
function pin(id:string){pinned.value=pinned.value.includes(id)?pinned.value.filter(x=>x!==id):[...pinned.value,id]}
function chooseRecipe(label:string){category.value='all';query.value=label;onlyReady.value=false;onlyKnown.value=false;onlyPinned.value=false}
const normalized=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,'')
const category = ref('all')
const materialAmounts=ref<Record<string,Record<string,Record<number,number>>>>({})
function selection(id:string):MaterialSelection|undefined{const entries=Object.entries(materialAmounts.value[id]??{}).map(([slot,amounts])=>[slot,Object.entries(amounts).filter(([,grams])=>grams!==0).map(([uid,grams])=>({uid:Number(uid),grams}))]as const).filter(([,rows])=>rows.length);return entries.length?Object.fromEntries(entries):undefined}
function setAmount(id:string,slot:string,uid:number,grams:number){const recipe=materialAmounts.value[id]??={};const amounts=recipe[slot]??={};amounts[uid]=grams}
const CATEGORY: Record<string, string> = { all: '전체', medical: '의료', cooking: '조리', woodwork: '목공', smithing: '대장', textile: '직물', survival: '생존' }
const CARE: Record<GearCare, string> = { wax: '밀랍칠', oil: '기름칠', sharpen: '날 갈기', string: '시위 걸기', unstring: '시위 풀기' }
const STATION: Record<string, string> = { hand: '맨땅', campfire: '모닥불', workbench: '작업대', forge: '대장간', loom: '베틀', tanning: '무두질 통', artisan: '장인 작업대' }
const d = computed(() => {
  void version.value
  const w = world.value as World, pl = player(w), station = workshop(w, pl)
  return {
    station: STATION[station.id] ?? station.id,
    job: pl.workJob,
    recipes: w.db.all<RecipeDef>('Recipe').filter((r) => category.value === 'all' || r.category === category.value).map((r) => {const selected=selection(r.id),quote=craftMaterialQuote(w,pl,r,selected),stuff=pl.workJob?.recipe===r.id?pl.workJob.materialPlan?.stuff:quote.plan?.stuff;return{
      r,selected,dependencies:r.inputs.map(input=>({label:w.db.item(input.item).label,count:input.count,recipes:w.db.all<RecipeDef>('Recipe').filter(recipe=>recipe.id!==r.id&&recipe.output.item===input.item).map(recipe=>({id:recipe.id,label:recipe.label}))})), error: craftError(w, pl, r,selected),unheated:r.boiledMeal?.unheated?unheatedMealQuote(w,pl,r.id):undefined, known: r.basic || pl.recipes?.includes(r.id),
      materials: [...(r.boiledMeal?['실제 물 '+r.boiledMeal.waterMl+'ml · 원래 그릇/같은 장작불']:[]),...(r.evaporation?[`실제 소금물 ${r.evaporation.ml}ml / 염도${r.evaporation.salinity}g/L`]:[]),...r.inputs.map((i) => `${w.db.item(i.item).label} ${pl.bag.filter((it) => it.def === i.item).reduce((n, it) => n + it.count, 0)}/${i.count}`),...(r.materialInputs??[]).map(i=>`${i.label??i.slot} ${i.grams}g`)].join(' · '),
      slots:(r.materialInputs??[]).map(spec=>({...spec,candidates:materialCandidates(w,pl,r,spec.slot,workshop(w,pl,r.stations).id).map(x=>({uid:x.it.uid,label:w.db.item(x.it.def).rawFragment?x.stock!.material.label+' 조각':w.db.item(x.it.def).label,grams:rawStock(w,x.it)!.grams}))})),
      mixed:materialMixPenalty(stuff)<0,
      bound:pl.workJob?.recipe===r.id?pl.workJob.materialPlan?.bindings.map(input=>`${w.db.get<MaterialDef>(input.material).label} ${input.usedGrams}g`).join(' · '):undefined,
      duration: craftTurns(w, pl, r, multiTurnFactor(w, pl)),
      q: `${craftingQuality(w, pl, r, 0,stuff)}~${craftingQuality(w, pl, r, 30,stuff)}`,
      station: r.stations?.map((s) => STATION[s] ?? s).join(' / '),
    }}),
    gear: allItems(pl).filter((it) => itemDef(w, it).repair || itemDef(w, it).salvage).map((it) => ({ it, def: itemDef(w, it), repair: repairPreview(w, pl, it.uid), salvage: salvagePreview(w, pl, it.uid), repairError: maintenanceError(w, pl, 'repair', it.uid), salvageError: maintenanceError(w, pl, 'salvage', it.uid),
      care: (Object.keys(CARE) as GearCare[]).filter((k) => k === 'oil' ? primaryMaterial(w, it)?.category === 'Metal' : k === 'sharpen' ? it.edge !== undefined && !itemDef(w, it).ranged : !!itemDef(w, it).ranged&&!itemDef(w,it).ranged!.firearm).map((k) => ({ k, label: CARE[k], error: gearCareError(w, pl, it.uid, k) })),
    })),
    bedding: nearbyBedding(w, pl).map((p) => ({ p, label: terrainAt(w, p).label, wetness:beddingAt(w,p).wetness, scorch:beddingScorch(tileAt(w,p)),lice:activeBeddingLice(w,p),wash:beddingWashQuote(w,pl,p),burning:!!tileAt(w,p).beddingFire,material:beddingFireMaterial(w,p),putOut:beddingFireQuote(w,pl,p),portable: terrainAt(w, p).bedding?.portable && !!tileAt(w, p).placed, fixed: !terrainAt(w,p).bedding?.portable, pack: furnitureQuote(w,pl,p) })),
    gather: nearbyGather(w, pl).map((p) => ({ p, def: terrainAt(w, p), product: w.db.item(terrainAt(w, p).gather!.item).label })),
    batches: (w.s.map.batches ?? []).filter((b) => cheb(pl.pos, b.pos) <= 1).map((b) => ({ ...b, label: w.db.get<RecipeDef>(b.recipe).label, ...batchStatus(w,b) })),
  }
})
const recipes=computed(()=>{
 const needle=normalized(query.value)
 return d.value.recipes.filter(x=>(!onlyPinned.value||pinned.value.includes(x.r.id))&&(!onlyKnown.value||x.known)&&(!onlyReady.value||!x.error)&&(!needle||normalized([x.r.label,(world.value as World).db.item(x.r.output.item).label,x.materials,x.station??''].join(' ')).includes(needle))).sort((a,b)=>Number(pinned.value.includes(b.r.id))-Number(pinned.value.includes(a.r.id))||Number(!!a.error)-Number(!!b.error)||Number(!!b.known)-Number(!!a.known)||a.r.label.localeCompare(b.r.label,'ko'))
})
function tip(e: MouseEvent, uid: number) {
  const w = world.value as World, it = allItems(player(w)).find((i) => i.uid === uid)
  if (it) { const t = itemTip(w, it); showTip(e, t.title, t.lines, t.color) }
}
</script>

<template>
  <Win title="제작·야영" :x="180" :y="80" :width="680" testid="win-craft" @close="wins.craft = false">
    <div class="craft-heading"><div><span class="craft-eyebrow">손으로 일군 것들</span><p>{{ d.station }} <span>· 사용할 작업장</span></p></div><span class="craft-count">제작법 {{ d.recipes.filter(x=>x.known).length }}개 습득</span></div>
    <nav class="craft-tabs" aria-label="제작 및 현장 작업">
      <button v-for="[key,label] in [['recipes','제작법'],['field','현장·야영'],['maintenance','수리·분해']] as const" :key="key" class="dbtn" :class="{'craft-tab-active':tab===key}" :aria-pressed="tab===key" :data-testid="'craft-tab-'+key" @click="tab=key">{{ label }}</button>
    </nav>
    <template v-if="tab==='field'">
      <p class="mb-3 text-xs text-ash-400">곁에 있는 불·시설·밭에서 할 수 있는 일. 필요한 장소로 이동하면 작업이 나타난다.</p>
      <ContainerLockPanel />
      <AquaticPanel />
      <BeaconPanel />
      <MarinePanel />
      <FieldDevicePanel />
      <BaseCampPanel />
      <CampfirePanel />
      <TerrainFirePanel />
      <TeaPanel />
      <CookingPanel />
      <BoilPanel />
      <SeasonalForagePanel />
      <BrushClearingPanel />
      <CultivationPanel />
    </template>
    <p class="mb-2 text-xs text-ash-400">현재 작업장: {{ d.station }} · 제작·수리 재료는 완료할 때 소비한다. 중단해도 제작·수리 진행은 남는다.</p>
    <div v-if="d.job" class="df df-tab mb-2 text-xs text-amber-200" data-testid="craft-progress">
      진행 {{ d.job.progress }}/{{ d.job.total }}턴
      <button class="dbtn ml-2" :disabled="simulating" @click="doAct({ type: 'cancelWork' })">작업 취소·진행 초기화</button>
    </div>
    <template v-if="tab==='field'">
      <div v-for="b in d.bedding" :key="`${b.p.x},${b.p.y}`" class="mb-1 text-xs text-ash-300">
        {{ b.label }} · 젖음 {{ Math.round(b.wetness) }}% · 그 위로 이동한 뒤 잠을 잔다.
        <span v-if="b.lice" class="text-amber-200"> · 이 흔적 있음 · 몸 씻기 별도</span>
        <span v-if="b.scorch"> · 그을음 {{ Math.ceil(b.scorch) }}%</span>
        <span v-if="b.burning" class="text-red-300"> · 불붙음</span>
        <span v-if="b.material"> · {{ b.material.label }} 가연성 {{ b.material.flammability }} · 실제 모닥불에서 2칸 이상 띄우기</span>
        <button class="dbtn ml-1" :disabled="simulating || !!b.wash.error" :title="b.wash.error ?? '실제 물과 노동으로 같은 침구를 씻는다. 몸의 이는 따로 씻어야 한다.'" :data-testid="'wash-bedding-'+b.p.x+'-'+b.p.y" @click="doAct({type:'washBedding',pos:b.p})">침구 세탁 ({{ b.wash.waterMl }}ml<span v-if="!b.wash.error"> · {{ b.wash.turns }}턴</span>)</button>
        <button v-if="b.burning" class="dbtn ml-1" :disabled="simulating || !!b.putOut.error" :title="b.putOut.error ?? '같은 침구를 적시며 그을음은 남는다.'" :data-testid="`put-out-bedding-${b.p.x}-${b.p.y}`" @click="doAct({type:'putOutBeddingFire',pos:b.p})">물 {{ b.putOut.waterMl }}ml로 불 끄기 (1턴)</button>
        <button v-if="b.portable" class="dbtn ml-1" :disabled="simulating || b.burning" @click="doAct({ type: 'packBedding', pos: b.p })">접어 가져가기</button>
        <button v-else-if="b.fixed" class="dbtn ml-1" :disabled="simulating || !!b.pack.error" :title="b.pack.error ?? '배낭에 포장한 침구를 실제로 운반한 뒤 다시 설치한다.'" :data-testid="`pack-furniture-${b.p.x}-${b.p.y}`" @click="doAct({type:'packFurniture',pos:b.p})">침구 포장<span v-if="!b.pack.error"> ({{ b.pack.turns }}턴)</span></button>
      </div>
      <div v-if="d.gather.length" class="mb-2 flex flex-wrap gap-1">
        <button v-for="g in d.gather" :key="`${g.p.x},${g.p.y}`" class="dbtn !text-xs" :disabled="simulating" @click="doAct({ type: 'gather', pos: g.p })">{{ g.product }} 채집 ({{ g.def.gather!.turns }}턴)</button>
      </div>
      <div v-for="b in d.batches" :key="b.id" :data-preservation-id="b.processing?b.id:undefined" class="mb-1 text-xs text-ash-300">
        {{ b.label }} · {{ b.remaining ? b.remaining<20?'거의 완료':`${(b.remaining / 1200).toFixed(1)}시간 남음` : '완료' }}
        <span v-if="b.processing&&b.freshness!==undefined" class="ml-2">신선도 {{ b.freshness.toFixed(0) }}%</span>
        <span v-if="b.reason" class="ml-2 text-amber-200">{{ b.reason }}</span>
        <button :data-batch-id="b.id" class="dbtn ml-2" :disabled="simulating || b.remaining > 0" @click="doAct({ type: 'collectCraft', id: b.id })">회수</button>
      </div>
    </template>
    <template v-if="tab === 'recipes'">
      <div class="craft-search"><input v-model="query" type="search" placeholder="제작법·완성품·재료 찾기" aria-label="제작법 검색" data-testid="craft-search"><button v-if="query" class="dbtn" @click="query=''">지우기</button></div>
      <div class="craft-filters"><label><input v-model="onlyKnown" type="checkbox"> 배운 제작법</label><label><input v-model="onlyReady" type="checkbox"> 지금 제작 가능</label><label><input v-model="onlyPinned" type="checkbox"> 찜한 제작법</label><span>{{ recipes.length }}개 표시</span></div>
      <select v-model="category" class="mb-2 bg-[#211e18] p-1 text-xs text-ash-200" aria-label="제작 분야">
        <option v-for="(label, key) in CATEGORY" :key="key" :value="key">{{ label }}</option>
      </select>
      <p v-if="!recipes.length" class="craft-empty">조건에 맞는 제작법이 없다. 검색어·분야·필터를 바꿔 보자.</p>
      <div v-for="x in recipes" :key="x.r.id" class="mb-1 flex gap-2 border-b border-[#393428] pb-2 text-xs" :data-testid="x.r.id">
        <ItemIcon :name="(world as World).db.item(x.r.output.item).sprite" :size="24" />
        <div class="min-w-0 flex-1">
          <p class="text-ash-100"><button class="recipe-pin" :aria-label="x.r.label+(pinned.includes(x.r.id)?' 찜 해제':' 찜하기')" :aria-pressed="pinned.includes(x.r.id)" @click="pin(x.r.id)">{{ pinned.includes(x.r.id)?'◆':'◇' }}</button>{{ x.r.label }} <span v-if="!x.known" class="text-ash-500">(제작법 미습득)</span></p>
          <p class="text-ash-400">{{ x.materials }}</p>
          <details v-if="x.dependencies.some(input=>input.recipes.length)" class="recipe-chain"><summary>재료를 만드는 공정</summary><div v-for="input in x.dependencies" :key="input.label"><span>{{ input.label }} {{ input.count }}개</span><button v-for="recipe in input.recipes" :key="recipe.id" @click="chooseRecipe(recipe.label)">{{ recipe.label }} ↗</button><span v-if="!input.recipes.length" class="text-ash-500">채집·거래로 구한다</span></div></details>
          <p v-if="x.bound" class="text-amber-200">이번 작업 재료: {{ x.bound }}</p>
          <p class="text-ash-500">{{ x.duration }}턴 · 품질 Q {{ x.q }}{{ x.station ? ` · ${x.station}` : '' }}{{ x.r.passiveTurns ? ` · 이후 ${x.r.passiveTurns / 28800}일 가공` : '' }}</p>
          <details v-if="x.slots.length" class="my-1" :data-material-recipe="x.r.id">
            <summary class="cursor-pointer text-amber-200">사용할 재료 고르기{{ x.mixed ? ' · 혼합 Q −5' : '' }}</summary>
            <p class="my-1 text-ash-400">0으로 두면 자동으로 고른다. 직접 고를 때에는 해당 부위의 필요량을 맞춘다.</p>
            <button class="dbtn mb-1" @click="materialAmounts[x.r.id]={}">자동 선택으로 돌리기</button>
            <div v-for="slot in x.slots" :key="slot.slot" class="mb-2 border-l border-[#665a43] pl-2">
              <p>{{ slot.label??slot.slot }} · 필요 {{ slot.grams }}g</p>
              <p v-if="!slot.candidates.length" class="text-ash-500">지금 쓸 수 있는 원재료가 없다.</p>
              <label v-for="candidate in slot.candidates" :key="candidate.uid" class="my-1 flex items-center justify-between gap-2">
                <span>{{ candidate.label }} · 남음 {{ candidate.grams }}g</span>
                <span><input type="number" min="0" :max="candidate.grams" step="1" class="w-20 bg-[#211e18] p-1" :aria-label="`${x.r.label} ${slot.label??slot.slot} ${candidate.label} 사용량`" :data-material-uid="candidate.uid" :data-material-slot="slot.slot" :value="materialAmounts[x.r.id]?.[slot.slot]?.[candidate.uid]??0" @input="setAmount(x.r.id,slot.slot,candidate.uid,Number(($event.target as HTMLInputElement).value))"> g</span>
              </label>
            </div>
          </details>
          <p v-if="x.error" class="text-[#b99a79]">{{ x.error }}</p>
        </div>
        <button class="dbtn self-center" :disabled="simulating || !!x.error" @click="doAct({ type: 'craft', id: x.r.id,materials:x.selected })">{{ d.job?.recipe === x.r.id ? '재개' : '제작' }}</button>
        <button v-if="x.unheated" class="dbtn ml-2 self-start" data-unheated-action="prepare" :disabled="simulating||!!x.unheated.error" :title="x.unheated.error??''" @click="doAct({type:'prepareUnheatedMeal',id:x.r.id})">모닥불에 두고 끓이기</button>
      </div>
    </template>
    <template v-else-if="tab==='maintenance'">
      <p class="mb-2 text-xs text-ash-400">수리마다 최대 내구가 영구 감소한다. 현장 수리는 최대의 60%까지만 회복한다. 분해하면 물건은 사라진다.</p>
      <div v-for="g in d.gear" :key="g.it.uid" :data-testid="`gear-${g.it.def}`" class="mb-2 border-b border-[#393428] pb-2 text-xs" @mouseenter="tip($event, g.it.uid)" @mousemove="tip($event, g.it.uid)" @mouseleave="hideTip">
        <p class="text-ash-100">{{ itemLabel(world as World, g.it) }} · 내구 {{ g.it.durability?.toFixed(1) ?? '-' }}/{{ (g.it.maxDurability ?? 100).toFixed(1) }}</p>
        <div v-if="g.care.length" class="my-1 flex flex-wrap gap-1">
          <button v-for="c in g.care" :key="c.k" class="dbtn" :disabled="simulating || !!c.error" :title="c.error ?? c.label" @click="doAct({ type: 'gearCare', uid: g.it.uid, care: c.k })">{{ c.label }}</button>
        </div>
        <p v-if="g.repair && !g.repairError" class="text-ash-400">{{ g.it.partDurability ? '수리 후 최저 부위' : '수리 후' }} {{ g.repair.next.toFixed(1) }}/{{ g.repair.nextMax.toFixed(1) }} · {{ (world as World).db.item(g.repair.material).label }} {{ g.repair.count }}개</p>
        <p v-if="g.repair?.failureChance !== undefined" class="text-[#dfaa73]">실패 {{ Math.round(g.repair.failureChance * 100) }}% · 실패하면 영구 파손되고 부품을 잃는다.</p>
        <p v-if="g.repairError && g.def.repair" class="text-ash-500">수리: {{ g.repairError }}</p>
        <p v-if="g.salvageError" class="text-ash-500">분해: {{ g.salvageError }}</p>
        <p v-if="g.salvage && !g.salvageError" class="text-ash-400">분해 시 <template v-if="'outputs'in g.salvage&&g.salvage.outputs">{{ g.salvage.outputs.map(row=>`${(world as World).db.get<MaterialDef>(row.material).label} ${row.grams}g`).join(' · ') }}</template><template v-else>{{ (world as World).db.item(g.salvage.material).label }} {{ g.salvage.count }}개</template> 회수</p>
        <button v-if="g.def.repair" class="dbtn mr-1" :disabled="simulating || !!g.repairError" @click="doAct({ type: 'repair', uid: g.it.uid })">수리</button>
        <button v-if="g.def.salvage" class="dbtn" :disabled="simulating || !!g.salvageError" @click="doAct({ type: 'salvage', uid: g.it.uid })">분해</button>
      </div>
    </template>
    <MachinePanel v-if="tab==='field'" />
  </Win>
</template>

<style scoped>
.recipe-pin{color:#bea471;margin-right:6px;font-size:13px}.recipe-chain{margin-block:6px;color:#a69777;font-size:10px}.recipe-chain summary{cursor:pointer}.recipe-chain>div{border-left:1px solid #67583d;padding:5px 0 5px 8px}.recipe-chain>div>span{margin-right:8px}.recipe-chain button{display:inline-block;margin-right:6px;color:#cbb48a;text-decoration:underline}.craft-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:4px 0 12px;border-bottom:1px solid #574b37}.craft-eyebrow{display:block;color:#a58d61;font-size:10px;letter-spacing:.14em;margin-bottom:4px}.craft-heading p{font-size:15px;color:#e7d9b6}.craft-heading p span,.craft-count{font-size:11px;color:#a29780}.craft-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.craft-tabs .craft-tab-active{border-color:#b39b65;background:#403525;color:#f2e3bd}.craft-search{display:flex;gap:6px;margin-bottom:10px}.craft-search input{flex:1;min-width:0;background:#191815;border:1px solid #66583f;padding:9px 10px;color:#e2d7bf;font-size:12px}.craft-filters{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#b7ad96;margin-bottom:10px}.craft-filters label{display:flex;align-items:center;gap:5px}.craft-filters span{margin-left:auto}.craft-empty{padding:22px 12px;border:1px dashed #61543d;color:#b4a68b;text-align:center;font-size:12px}
</style>
