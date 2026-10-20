<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { openDefinitionInspector } from './definition-inspector-ui'
import ModOrderControl from './ModOrderControl.vue'
import ModImportControl from './ModImportControl.vue'
import SeedShareControl from './SeedShareControl.vue'
import ContentChangeReview from './ContentChangeReview.vue'
import {reviewSeedShare} from '../core/seed-share'
import {modInstallation,packagesRevision} from './mod-catalog'
import { preferencesOpen } from './preferences'
import { newGame, player, economyDef, STAT_LABEL, type BackgroundDef, type Stats } from '../core'
import { createSeedCode, startSharedSeed, inspectDb, chronicle, continueImprint, imprintMods, reviewImprintMods, pendingContentReview, cancelContentReview, hasImprint, saveError, packages, randomSeed, starting, startNew } from './store'

const seed = ref(randomSeed())
const bg = ref<string>('')
const storyteller=ref('')
const storyProfiles=computed(()=>loadErrors.value.length?[]:selectedDb.value.event('Event.ReaverPatrol').director?.profiles??[])
const err = ref<string | null>(null)
const mods = ref<string[]>([])
const optionalMods = computed(()=>{void packagesRevision.value;return packages.filter((p) => p.manifest.id !== 'core')})
const modNames=computed(()=>Object.fromEntries(optionalMods.value.map(p=>[p.manifest.id,p.manifest.name])))
const imprint = ref(false)
const imprintSelectionOpen=ref(false),imprintSelection=ref<string[]>([]),savedImprintMods=ref<string[]>([])
const unavailableImprintMods=computed(()=>savedImprintMods.value.filter(id=>!optionalMods.value.some(p=>p.manifest.id===id)))
watch(()=>imprintSelection.value.join('\n'),()=>cancelContentReview())
const loading = ref(true)
onMounted(async () => { try{await modInstallation.initialize()}catch(error){err.value=(error as Error).message}finally{imprint.value = await hasImprint(); loading.value = false} })
const chron = ref(chronicle())

const creationRoll = ref<0 | 1>(0)
const sharedCode=ref<string|null>(null)
let applyingSharedCode=false
const sharedReview=computed(()=>{void packagesRevision.value;return sharedCode.value?reviewSeedShare(sharedCode.value,packages):null})
const sharedErrors=computed(()=>sharedReview.value?.errors??[])
const fallbackSeed = randomSeed()
const selectedLoad = computed(() => {void packagesRevision.value;return inspectDb(mods.value)})
const selectedDb = computed(() => selectedLoad.value.db)
const loadErrors = computed(() => selectedLoad.value.report.errors)
const backgrounds = computed(() => selectedDb.value.all<BackgroundDef>('Background'))
watch([seed, bg, () => mods.value.join(',')], () => { if(!applyingSharedCode){creationRoll.value = 0;sharedCode.value=null} },{flush:'sync'})
watch([storyteller,creationRoll],()=>{if(!applyingSharedCode)sharedCode.value=null},{flush:'sync'})
const preview = computed(() => {
  try {
    if(loadErrors.value.length)return null
    const db = selectedDb.value
    const s = newGame(db, {scriptPreview:true, seed: sharedReview.value?.shared.seed??(seed.value.trim() || fallbackSeed), background: bg.value || undefined, characterRoll: creationRoll.value })
    const pl = player({ db, s })
    return { pl, currency: economyDef({ db, s }).currency, background: db.background(pl.background!).label, traits: pl.traits.map((id) => db.trait(id)), stats: (Object.keys(STAT_LABEL) as (keyof Stats)[]).map((key) => ({ label: STAT_LABEL[key], value: pl.stats[key] })) }
  } catch { return null }
})

async function start() {
  err.value = null
  try { if(sharedCode.value)await startSharedSeed(sharedCode.value);else await startNew(seed.value.trim() || fallbackSeed, bg.value || undefined, mods.value, creationRoll.value,storyteller.value||undefined) }
  catch(e){err.value=(e as Error).message}
}
function shareCurrent(){if(sharedCode.value)return sharedCode.value;return createSeedCode(seed.value.trim()||fallbackSeed,bg.value||undefined,mods.value,creationRoll.value,storyteller.value||undefined)}
function applyShared(code:string){
 try{const review=reviewSeedShare(code,packages);if(review.errors.length)throw Error(review.errors.join('\n'));const s=review.shared;applyingSharedCode=true;seed.value=s.seed;bg.value=s.background??'';mods.value=s.mods.filter(mod=>mod.id!=='core').map(mod=>mod.id);storyteller.value=s.storyteller??'';creationRoll.value=s.characterRoll;sharedCode.value=code;err.value=null}catch(error){err.value=(error as Error).message}finally{applyingSharedCode=false}
}
async function openImprintSelection(){
 loading.value=true;err.value=null;cancelContentReview()
 try{savedImprintMods.value=await imprintMods();imprintSelection.value=savedImprintMods.value.filter(id=>optionalMods.value.some(p=>p.manifest.id===id));imprintSelectionOpen.value=true}catch(error){err.value=(error as Error).message}finally{loading.value=false}
}
async function reviewSelection(){loading.value=true;err.value=await reviewImprintMods(imprintSelection.value);loading.value=false}
async function cont(token?:string) {
  loading.value = true
  err.value = await continueImprint(token)
  imprint.value = await hasImprint()
  loading.value = false
}
</script>

<template>
  <div class="flex h-full items-start justify-center overflow-auto px-4 py-10">
    <div class="w-full max-w-3xl space-y-6">
      <header class="space-y-2 text-center">
        <h1 class="font-title text-6xl font-bold tracking-[0.3em] text-[#e8d7a8] [text-shadow:0_2px_0_#000,0_0_18px_rgba(255,170,80,.25)]">ASHVEIL</h1>
        <p class="font-title text-ash-300">재의 장막 아래, 잿빛 수도원과 그 아래 납골당. 피 한 방울도 기록된다.</p>
        <p class="text-xs text-ash-500">프로토타입 · 턴제 던전 RPG + 정밀 신체 · 각인 모드(단일 저장, 죽으면 끝) · 키보드·마우스</p>
        <button class="dbtn" @click="preferencesOpen = true">화면·접근성 설정 (F3)</button>
      </header>

      <p v-if="saveError" class="text-xs text-red-300" role="alert">{{ saveError }}</p>
      <section v-if="imprint" class="df df-celtic space-y-2">
        <h2 class="font-title text-base font-bold text-[#e8d7a8]">이어서 하기</h2>
        <p class="text-xs text-ash-400">각인된 떠돌이가 있다. 각인은 하나뿐이다. 새로 시작하면 덮어쓴다.</p>
        <button class="dbtn-gold !px-4 !text-sm" data-testid="continue" :disabled="loading" @click="cont()">각인 불러오기</button>
        <button class="dbtn ml-2" data-testid="imprint-mods-open" :disabled="loading" @click="openImprintSelection">각인 모드 구성 검토</button>
      </section>

      <section v-if="imprintSelectionOpen" class="df df-celtic space-y-2 text-xs" data-testid="imprint-mod-selection">
        <h2 class="font-title text-base text-amber-100">기존 각인에 사용할 모드</h2>
        <p>core는 항상 사용한다. 선택한 구성은 먼저 검토하며 실제 계속 전까지 각인을 바꾸지 않는다.</p>
        <p v-if="unavailableImprintMods.length" class="text-amber-200" data-testid="imprint-mods-unavailable">현재 설치되지 않은 원래 모드: {{ unavailableImprintMods.join(', ') }}</p>
        <div class="max-h-64 space-y-1 overflow-y-auto">
          <label v-for="m in optionalMods" :key="m.manifest.id" class="flex items-center gap-2 rounded border border-ash-700 p-2"><input v-model="imprintSelection" type="checkbox" :value="m.manifest.id" :data-testid="`imprint-mod-${m.manifest.id}`" :disabled="loading" /><span>{{ m.manifest.name }} · {{ m.manifest.version }}<span v-if="(m.manifest.scripts?.stage??0)>=1" class="ml-2 text-amber-200">스크립트 포함</span></span></label>
        </div>
        <ModOrderControl v-model="imprintSelection" :names="modNames" :disabled="loading" prefix="imprint" />
        <div class="flex gap-2"><button class="dbtn-gold" data-testid="imprint-mods-review" :disabled="loading" @click="reviewSelection">선택한 구성 검토</button><button class="dbtn" :disabled="loading" @click="imprintSelectionOpen=false;cancelContentReview()">닫기</button></div>
      </section>

      <ContentChangeReview :review="pendingContentReview" :loading="loading" @cancel="cancelContentReview();err=null" @accept="cont" />
      <SeedShareControl :disabled="loading||starting" :create-code="shareCurrent" @apply="applyShared" />
      <ModImportControl :disabled="loading||starting" @changed="cancelContentReview()" />
      <section class="df df-celtic space-y-4">
        <h2 class="font-title text-base font-bold text-[#e8d7a8]">새 떠돌이</h2>
        <label class="block space-y-1 text-xs">
          <span class="text-ash-400">시드 (같은 버전·시드·입력·콘텐츠 로드 해시 = 같은 세계)</span>
          <div class="flex gap-2">
            <input v-model="seed" data-testid="seed" class="w-full rounded border border-ash-600 bg-ash-800 px-2 py-1 font-mono text-sm text-ash-100 outline-none focus:border-amber-500" />
            <button class="dbtn" @click="seed = randomSeed()">무작위</button>
          </div>
        </label>
        <label class="block space-y-1 text-xs">
          <span class="text-ash-400">사건 흐름</span>
          <select v-model="storyteller" data-testid="story-persona" class="w-full bg-ash-800 p-2"><option value="">기존 고정 장소 규칙</option><option v-for="p in storyProfiles" :key="p.key" :value="p.key">{{ p.label }}</option></select>
          <p class="text-ash-400">{{ storyProfiles.find(p=>p.key===storyteller)?.description??'장소의 기존 순찰 규칙을 따른다.' }} 적은 실제 출발지 인원에서만 움직인다.</p>
        </label>
        <div class="space-y-1 text-xs">
          <span class="text-ash-400">배경</span>
          <div class="grid gap-2 sm:grid-cols-2">
            <button :class="['rounded border p-2 text-left', bg === '' ? 'border-amber-500 bg-ash-800' : 'border-ash-700 hover:border-ash-500']" @click="bg = ''">
              <div class="text-sm text-ash-100">무작위</div>
              <div class="text-ash-400">시드가 정한다.</div>
            </button>
            <button v-for="b in backgrounds" :key="b.id" :class="['rounded border p-2 text-left', bg === b.id ? 'border-amber-500 bg-ash-800' : 'border-ash-700 hover:border-ash-500']" @click="bg = b.id">
              <div class="text-sm text-ash-100">{{ b.label }} <span v-if="!b.literate" class="text-[10px] text-ash-500">(문맹)</span></div>
              <div class="text-ash-400">{{ b.description }}</div>
            </button>
          </div>
        </div>
        <div v-if="preview" class="df df-tab space-y-2 p-1 text-xs" data-testid="creation-preview">
          <div class="flex items-center justify-between"><span class="font-title text-sm text-amber-100">{{ preview.pl.name }} · {{ preview.pl.age?.years }}세 · {{ preview.background }}</span><button class="dbtn" data-testid="reroll" :disabled="creationRoll === 1" @click="creationRoll = 1">{{ creationRoll ? '재굴림 사용함' : '특성 다시 굴리기 (1회)' }}</button></div>
          <div class="flex flex-wrap gap-x-4"><span v-for="s in preview.stats" :key="s.label" class="text-ash-100">{{ s.label }} {{ s.value }}</span></div>
          <p v-if="preview.pl.money" class="text-ash-200">소지금 {{ preview.pl.money }}{{ preview.currency }}</p>
          <div class="flex flex-wrap gap-2"><span v-for="t in preview.traits" :key="t.id" class="text-amber-200" :title="t.description">{{ t.label }}</span></div>
          <p class="text-ash-400">기본 능력치 합50 · 배경 보정 포함 · 특성에 마우스를 올리면 효과가 보인다.</p>
        </div>
        <p v-else class="text-xs text-red-300">선택한 모드와 배경으로 떠돌이를 생성할 수 없다.</p>
        <div v-if="optionalMods.length" class="space-y-1 text-xs">
          <span class="text-ash-400">모드 (core 는 항상 켜짐)</span>
          <label v-for="m in optionalMods" :key="m.manifest.id" class="flex items-start gap-2 rounded border border-ash-700 p-2">
            <input v-model="mods" type="checkbox" :value="m.manifest.id" :data-testid="`new-mod-${m.manifest.id}`" class="mt-0.5" />
            <span>
              <span class="text-ash-100">{{ m.manifest.name }}</span>
              <span v-if="(m.manifest.scripts?.stage??0)>=1" class="ml-1 rounded border border-amber-800 px-1 text-[10px] text-amber-200">스크립트 포함</span>
              <span class="ml-1 text-ash-500">{{ m.manifest.version }}</span>
              <span class="block text-ash-400">{{ m.manifest.description }}</span>
            </span>
          </label>
        </div>
        <ModOrderControl v-model="mods" :names="modNames" :disabled="loading||starting" prefix="new" />
        <p v-if="!loadErrors.length" class="break-all font-mono text-[10px] text-ash-400" data-testid="title-load-hash">콘텐츠 로드 해시: {{ selectedDb.loadHash }}</p>
        <button class="dbtn" data-testid="open-definition-inspector" @click="openDefinitionInspector(mods)">모드 제작 · Def 조회</button>
        <div v-if="loadErrors.length" role="alert" class="rounded border border-blood-700 p-2 text-xs text-blood-300" data-testid="mod-errors">
          <p>모드 오류를 해결하거나 해당 모드를 꺼야 시작할 수 있다.</p>
          <ul class="list-disc pl-4"><li v-for="(message,index) in loadErrors" :key="index">{{ message }}</li></ul>
        </div>
        <p v-if="sharedCode" class="text-xs text-amber-200" data-testid="seed-share-active">공유한 생성 선택을 적용했습니다. 은퇴 인물 기록 {{ sharedReview?.shared.legacyResidents.length??0 }}명도 공유한 초기 기록을 사용합니다.</p>
        <p v-for="message in sharedErrors" :key="message" class="text-xs text-red-300">{{ message }}</p>
        <button class="dbtn-gold !px-4 !text-sm" data-testid="start" :disabled="!preview || loading || starting || !!loadErrors.length || !!sharedErrors.length" @click="start">{{ starting?'준비 중…':'고원으로 들어선다' }}</button>
        <p v-if="err" class="text-xs text-blood-300">{{ err }}</p>
      </section>

      <section v-if="chron.length" class="df df-celtic space-y-2" data-testid="chronicle">
        <h2 class="font-title text-base font-bold text-[#e8d7a8]">연대기</h2>
        <ul class="space-y-2 text-xs">
          <li v-for="c in chron.slice(0, 12)" :key="c.at" class="border-l-2 pl-2" :class="c.kind !== 'death' ? 'border-moss-500' : 'border-blood-500'">
            <template v-if="c.kind==='content'"><div class="text-amber-200">모드 변경됨 · {{ c.turn }}턴 · 시드 {{ c.seed }}</div><p class="break-all font-mono text-[10px]">{{ c.from }} → {{ c.to }}</p></template>
            <template v-else>
              <div v-if="c.kind==='retire'" class="text-moss-300">은퇴 · {{ c.report.title }}</div>
              <div class="text-ash-200">{{ c.report.epitaph }}</div>
              <div class="text-ash-500">{{ c.report.background }} · {{ c.report.traits.join(', ') }} · 시드 {{ c.seed }}</div>
            </template>
          </li>
        </ul>
      </section>

      <footer class="text-center text-[11px] text-ash-500">
        글꼴: 고운바탕 · <a class="underline" href="/fonts/gowun-batang-OFL.txt" target="_blank" rel="noopener">SIL Open Font License 1.1</a><br />
        그래픽: <a class="underline" href="https://pingupollas.itch.io/knowledge-temple" target="_blank" rel="noopener">Knowledge Temple</a> · <a class="underline" href="https://pingupollas.itch.io/crawling-depths" target="_blank" rel="noopener">Crawling Depths</a> by pingupollas · <a class="underline" href="https://arex-v.itch.io/damp-dungeons" target="_blank" rel="noopener">Damp Dungeons</a> by arex-v · <a class="underline" href="https://kaishido.itch.io/dark-world" target="_blank" rel="noopener">Dark World</a> by kaishido · <a class="underline" href="https://0x72.itch.io/dungeontileset-ii" target="_blank" rel="noopener">Dungeon Tileset II</a> by 0x72 · <a class="underline" href="https://hypnobius.itch.io/dark-ages-ui" target="_blank" rel="noopener">Dark Ages UI</a> by hypnobius · DCSS 32×32 (CC0)<br />인물과 장소가 이어가는 생존 이야기
      </footer>
    </div>
  </div>
</template>
