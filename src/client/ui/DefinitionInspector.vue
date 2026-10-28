<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { definitionInspector as model, definitionInspectorOpen } from '../definition-inspector-ui'
import type { DefinitionSource } from '../../core/defs'
import { definitionFieldValue } from '../../core/definition-provenance'
import { parseContentJson } from '../../core/content-json'
import { definitionSchemaIssues,hasDefinitionSchema } from '../../core/definition-schema'

const text = ref(''), defType = ref(''), includeAbstract = ref(false), selected = ref(''), page = ref(0)
const tab = ref<'resolved'|'raw'|'differences'|'references'|'fields'>('resolved')
const rows = computed(() => model.value?.query({text:text.value,defType:defType.value,includeAbstract:includeAbstract.value}) ?? [])
const visible = computed(() => rows.value.slice(page.value*100,(page.value+1)*100))
const detail = computed(() => model.value?.detail(selected.value))
const jsonText=ref(''),jsonFile=ref('붙여넣기.json'),jsonError=ref(''),jsonChecked=ref(false),jsonResult=ref<unknown>(),jsonMode=ref<'syntax'|'raw'|'resolved'>('syntax')
function checkJson(){jsonChecked.value=true;jsonError.value='';jsonResult.value=undefined;try{
 const parsed=parseContentJson(jsonText.value,jsonFile.value.trim()||'붙여넣기.json')
 if(jsonMode.value!=='syntax'){
  const rows=Array.isArray(parsed)?parsed:[parsed],errors:string[]=[]
  for(const[rowIndex,row]of rows.entries()){
   if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`항목 ${rowIndex+1}: Def 객체가 필요하다`);continue}
   const def=row as Record<string,unknown>
   if(!hasDefinitionSchema(def.defType)){errors.push(`항목 ${rowIndex+1} /defType: 지원하는 Def 종류가 필요하다`);continue}
   for(const issue of definitionSchemaIssues(def,jsonMode.value))errors.push(`항목 ${rowIndex+1} ${issue.path||'/'}: ${issue.message}`)
  }
  if(errors.length)throw Error(errors.join('\n'))
 }
 jsonResult.value=parsed
}catch(error){jsonError.value=(error as Error).message}}
watch([jsonText,jsonFile,jsonMode],()=>{jsonChecked.value=false;jsonError.value=''})
const auditText=ref(''),auditStatus=ref('all')
const auditRows=computed(()=>model.value?.audit.patches.map((p,index)=>({...p,index})).filter(p=>(auditStatus.value==='all'||p.status===auditStatus.value)&&(!auditText.value.trim()||[p.modId,p.operation.target,p.operation.path].join(' ').toLowerCase().includes(auditText.value.trim().toLowerCase())))??[])
const previousFocus = document.activeElement as HTMLElement|null
const source = (s?:DefinitionSource) => s ? `${s.modId} · ${s.file ?? '파일 정보 없음'} · 항목 ${s.entry+1}` : '원본 정보 없음'
const json = (v:unknown) => JSON.stringify(v,null,2) ?? '해당 정의 없음'
function select(id:string) { selected.value=id }
watch([text,defType,includeAbstract],()=>{page.value=0})
watch(rows,()=>{if(!selected.value&&rows.value.length)select(rows.value[0].id)},{immediate:true})
onMounted(async()=>{await nextTick();document.querySelector<HTMLInputElement>('[data-testid="definition-search"]')?.focus()})
onBeforeUnmount(()=>previousFocus?.isConnected&&previousFocus.focus())
</script>

<template>
  <div class="fixed inset-0 z-[7000] bg-black/75 p-2 sm:p-6" @pointerdown.stop @wheel.stop>
    <section class="df df-celtic flex h-full flex-col text-xs text-ash-200" role="dialog" aria-modal="true" aria-label="Def 조회 · 읽기 전용" data-testid="definition-inspector">
      <header class="flex items-center justify-between gap-2 border-b border-ash-600 pb-2">
        <h2 class="font-title text-lg text-amber-100">Def 조회 · 읽기 전용</h2>
        <button class="dbtn-gold" @click="definitionInspectorOpen=false">닫기 (Esc)</button>
      </header>
      <p class="py-2 text-ash-400">모드 제작 도구 · 실제 로더의 데이터 정의를 조회한다. 게임 속 인물의 지식과는 별개다. 스크립트는 실행하지 않는다.</p>
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <input v-model="text" class="min-w-40 flex-1 border border-ash-600 bg-ash-900 p-2" placeholder="ID 또는 이름 검색" aria-label="ID 또는 이름 검색" data-testid="definition-search" />
        <select v-model="defType" class="bg-ash-800 p-2" aria-label="정의 종류" data-testid="definition-type"><option value="">모든 종류</option><option v-for="t in model?.types" :key="t">{{ t }}</option></select>
        <label class="flex items-center gap-1"><input v-model="includeAbstract" type="checkbox" data-testid="definition-abstract" />추상 정의 포함</label>
        <span data-testid="definition-count">{{ rows.length }}개</span>
      </div>
      <details class="mb-2 border-b border-ash-600 pb-1" data-testid="content-json-checker">
        <summary>JSON 원문·Def 스키마 검사</summary>
        <div class="max-h-72 overflow-auto">
          <p class="my-1 text-ash-400">원문을 붙여 넣어 문법 또는 Def 스키마를 검사한다. 원본은 부분 필드, 완성값은 상속·패치가 끝난 필수 필드를 검사한다. 참조/의미 검사는 실제 로드 결과에서 확인한다. 모드나 게임에 적용하지 않는다.</p>
          <label class="block">표시할 파일 이름<input v-model="jsonFile" class="ml-2 bg-ash-900 p-1" aria-label="검사 파일 이름" data-testid="content-json-file" /></label>
          <label class="my-1 block">검사 범위<select v-model="jsonMode" class="ml-2 bg-ash-900 p-1" aria-label="JSON 검사 범위" data-testid="content-json-mode"><option value="syntax">JSON 문법</option><option value="raw">Def 원본 부분 스키마</option><option value="resolved">Def 완성값 스키마</option></select></label>
          <textarea v-model="jsonText" class="my-1 block w-full bg-ash-900 p-2 font-mono text-xs" rows="5" aria-label="검사할 JSON 원문" data-testid="content-json-text" spellcheck="false" />
          <button class="dbtn" data-testid="content-json-run" @click="checkJson">{{ jsonMode==='syntax'?'JSON 문법 검사':'Def 스키마 검사' }}</button>
          <p v-if="jsonError" role="alert" class="my-1 whitespace-pre-wrap break-all text-red-300" data-testid="content-json-error">{{ jsonError }}</p>
          <div v-else-if="jsonChecked" data-testid="content-json-success"><p class="text-moss-300">{{ jsonMode==='syntax'?'문법 검사 통과 · 중복 키/BOM 없음':jsonMode==='raw'?'Def 원본 부분 스키마 통과':'Def 완성값 스키마 통과' }}</p><pre class="whitespace-pre-wrap break-all font-mono">{{ json(jsonResult) }}</pre></div>
        </div>
      </details>
      <details v-if="model" class="mb-2 border-b border-ash-600 pb-1" data-testid="definition-report">
        <summary>데이터 검증 · 오류 {{ model.report.errors.length }} / 경고 {{ model.report.warnings.length }} · 로드 {{ model.report.order.join(' → ') }}</summary>
        <p v-if="!model.report.errors.length" class="break-all font-mono" data-testid="definition-load-hash">콘텐츠 로드 해시: {{ model.loadHash }}</p>
        <p class="text-ash-400">정의·패치·참조 검증 결과다. 스크립트 실행 검증은 포함하지 않는다.</p>
        <p v-for="(e,i) in model.report.errors" :key="`e${i}`" class="text-red-300">{{ e }}</p>
        <p v-for="(e,i) in model.report.warnings" :key="`w${i}`" class="text-amber-200">{{ e }}</p>
      </details>
      <details v-if="model" class="mb-2 border-b border-ash-600 pb-1" data-testid="definition-audit">
        <summary>패치 적용 미리보기 · 적용 {{ model.audit.counts.applied }} / 건너뜀 {{ model.audit.counts.skipped }} / 실패 {{ model.audit.counts.failed }} · 참고 경고 {{ model.audit.warnings.length }}</summary>
        <p class="py-1 text-ash-400">선택한 구성의 실제 로더 결과다. 아래 차이는 상속 전 원시 정의 값이며 게임이나 원본 파일을 수정하지 않는다. 스크립트 실행 검사는 포함하지 않는다.</p>
        <div class="my-1 flex gap-2"><input v-model="auditText" class="flex-1 bg-ash-900 p-1" aria-label="패치 대상·모드·경로 검색" data-testid="definition-audit-search" placeholder="패치 대상·모드·경로 검색" /><select v-model="auditStatus" class="bg-ash-800 p-1" aria-label="패치 적용 상태" data-testid="definition-audit-status"><option value="all">모든 상태</option><option value="applied">적용</option><option value="skipped">건너뜀</option><option value="failed">실패</option></select></div>
        <div class="max-h-64 overflow-auto" data-testid="definition-audit-rows">
          <p>{{ auditRows.length }}개 중 처음 {{ Math.min(100,auditRows.length) }}개 표시</p>
          <details v-for="p in auditRows.slice(0,100)" :key="p.index" class="my-1 break-all border border-ash-700 p-1" :data-patch-index="p.index">
            <summary>{{ p.status==='applied'?'적용':p.status==='skipped'?'건너뜀':'실패' }} · {{ p.operation.target }} {{ p.operation.path||'/' }} · {{ source(p) }}</summary>
            <p v-if="p.reason" class="text-amber-200">{{ p.reason }}</p><pre class="whitespace-pre-wrap break-all">{{ json(p.operation) }}</pre>
            <p v-if="!p.changes.length">실제 원시값 차이 없음</p><pre v-else class="whitespace-pre-wrap break-all" data-testid="definition-audit-changes">{{ json(p.changes) }}</pre>
          </details>
        </div>
        <details class="mt-1" data-testid="definition-audit-warnings"><summary>참고 경고 {{ model.audit.warnings.length }}개</summary><div class="max-h-48 overflow-auto"><p class="text-ash-400">동일 경로의 다른 replace·숫자 인덱스형 경로·최종 자식에 전달되지 않은 부모 스칼라 replace를 표시한다. 경고는 적용 실패가 아니다.</p><p v-for="(warning,index) in model.audit.warnings" :key="index" class="my-1 text-amber-200">{{ warning.message }}</p></div></details>
      </details>
      <div class="grid min-h-0 flex-1 grid-cols-[minmax(150px,30%)_1fr] gap-3">
        <aside class="flex min-h-0 flex-col border-r border-ash-600 pr-2">
          <div class="mb-2 flex items-center justify-between gap-1"><button class="dbtn" :disabled="page===0" @click="page--">이전</button><span>{{ page+1 }} / {{ Math.max(1,Math.ceil(rows.length/100)) }}</span><button class="dbtn" :disabled="(page+1)*100>=rows.length" @click="page++">다음</button></div>
          <div class="min-h-0 overflow-auto" data-testid="definition-results">
            <button v-for="r in visible" :key="r.id" class="mb-1 block w-full break-all border p-2 text-left" :class="selected===r.id?'border-amber-500 bg-ash-800':'border-ash-700'" :data-definition-id="r.id" @click="select(r.id)"><span class="block text-ash-100">{{ r.label }}</span><span class="font-mono text-[10px] text-ash-400">{{ r.id }}</span><span v-if="r.abstract" class="ml-1 text-amber-200">추상</span><span v-if="!r.available&&!r.abstract" class="ml-1 text-red-300">미해결</span></button>
            <p v-if="!rows.length" class="py-2 text-ash-400">검색 결과 없음</p>
          </div>
        </aside>
        <article v-if="detail" class="min-h-0 overflow-auto pr-2" data-testid="definition-detail">
          <h3 class="font-title text-base text-amber-100">{{ detail.row.label }}</h3>
          <p class="break-all font-mono" data-testid="definition-selected">{{ detail.row.id }} · {{ detail.row.defType }}{{ detail.row.abstract?' · 추상 정의':'' }}</p>
          <p class="mt-2 break-all" data-testid="definition-source">원본: {{ source(detail.row.source) }}</p>
          <p>최종 정의 표기 모드: {{ detail.row.lastMod ?? '없음' }}</p>
          <p class="text-ash-400">원본 위치·성공 패치 이력과 최종 필드의 출처를 각각 확인할 수 있다.</p>
          <div class="my-2 flex flex-wrap items-center gap-1" data-testid="definition-lineage"><span>상속:</span><template v-for="(id,i) in detail.lineage" :key="id"><span v-if="i">→</span><button class="dbtn break-all" @click="select(id)">{{ id }}</button></template></div>
          <details v-if="detail.children.length" class="my-2"><summary>직접 자식 {{ detail.children.length }}개</summary><button v-for="r in detail.children" :key="r.id" class="dbtn m-1" @click="select(r.id)">{{ r.id }}</button></details>
          <details class="my-2" data-testid="definition-patches"><summary>실제 성공한 패치 · 현재 정의와 부모 {{ detail.patches.length }}개</summary><p class="text-ash-400">성공한 적용 순서다. 자식의 재정의로 최종 값이 같을 수도 있다.</p><div v-for="(p,i) in detail.patches" :key="i" class="my-2 border-l border-ash-600 pl-2"><p>{{ source(p) }}</p><pre class="whitespace-pre-wrap break-all font-mono">{{ json(p.operation) }}</pre></div></details>
          <nav class="my-2 flex flex-wrap gap-1" aria-label="정의 상세 보기"><button class="dbtn" :aria-pressed="tab==='resolved'" @click="tab='resolved'">상속·패치 적용값</button><button class="dbtn" :aria-pressed="tab==='raw'" @click="tab='raw'">패치 후 원시값</button><button class="dbtn" :aria-pressed="tab==='differences'" data-testid="definition-diff-tab" @click="tab='differences'">코어와 차이 ({{ detail.differences.length }})</button><button class="dbtn" :aria-pressed="tab==='references'" data-testid="definition-reference-tab" @click="tab='references'">역참조 ({{ detail.references.length }})</button><button class="dbtn" :aria-pressed="tab==='fields'" data-testid="definition-fields-tab" @click="tab='fields'">필드별 출처 ({{ detail.fields.length }})</button></nav>
          <pre v-if="tab==='resolved'||tab==='raw'" class="whitespace-pre-wrap break-all bg-ash-900 p-2 font-mono text-[11px]" data-testid="definition-json">{{ json(tab==='raw'?detail.raw:detail.resolved) }}</pre>
          <div v-else-if="tab==='differences'" data-testid="definition-differences">
            <p class="text-ash-400">코어만 로드한 적용값과 선택한 모드 구성의 적용값을 비교한다. 경로는 JSON Pointer다.</p><p v-if="!detail.differences.length">코어와 동일</p><div v-for="d in detail.differences" :key="d.path" class="my-2 border border-ash-700 p-2">
              <p class="break-all">{{ d.path||'/' }} · {{ d.kind==='added'?'추가':d.kind==='removed'?'삭제':'변경' }}</p><pre class="whitespace-pre-wrap break-all">코어: {{ json(d.before) }}
현재: {{ json(d.after) }}</pre>
            </div>
          </div>
          <div v-else-if="tab==='fields'" data-testid="definition-fields"><p class="text-ash-400">실제 상속·패치 연산에서 최종 필드가 온 원본 위치다. 경로는 JSON Pointer이며 배열 항목은 현재 위치다. 빈 객체·배열은 마지막 구성 연산의 출처다.</p><div v-for="field in detail.fields" :key="field.path" :data-field-path="field.path" class="my-2 break-all border border-ash-700 p-2"><p class="font-mono text-amber-100">{{ field.path||'/' }} = {{ json(definitionFieldValue(detail.resolved,field.path)) }}</p><p>{{ source(field.source) }} · {{ field.source.kind==='patch'?'패치':'정의' }} {{ field.source.definitionId }}</p><p class="font-mono text-ash-400">원본 경로 {{ field.source.sourcePath||'/' }}<template v-if="field.source.operation"> · {{ field.source.operation.op }} {{ field.source.operation.path||'/' }}</template></p></div></div>
          <div v-else data-testid="definition-references"><p class="text-ash-400">상속·패치 적용값에서 이 ID와 정확히 같은 문자열을 찾는다. 스크립트 내부 참조는 포함하지 않는다.</p><p v-if="!detail.references.length">역참조 없음</p><button v-for="(r,i) in detail.references" :key="i" class="mb-1 block w-full break-all border border-ash-700 p-2 text-left" @click="select(r.id)">{{ r.id }}{{ r.abstract?' · 추상':'' }} <span class="text-ash-400">{{ r.path }}</span></button></div>
        </article>
        <p v-else>정의를 선택한다.</p>
      </div>
    </section>
  </div>
</template>
