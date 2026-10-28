<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {ChronicleEntry} from '../store'
import ReportActions from './ReportActions.vue'
const props=defineProps<{entries:ChronicleEntry[]}>(),query=ref(''),kind=ref<ChronicleEntry['kind']|'all'>('all'),page=ref(0)
const filtered=computed(()=>{const q=query.value.trim().normalize('NFKC').toLowerCase();return props.entries.filter(c=>{
 if(kind.value!=='all'&&c.kind!==kind.value)return false
 if(!q)return true
 const parts=c.kind==='content'?[c.seed,c.from,c.to]:[c.seed,c.report.name,c.report.background,c.report.cause,c.report.epitaph,...(c.report.discoveries?.records.flatMap(r=>[r.title,...r.details])??[])]
 return parts.join(' ').normalize('NFKC').toLowerCase().includes(q)
})})
const pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/8))),rows=computed(()=>filtered.value.slice(page.value*8,page.value*8+8))
watch([query,kind,()=>props.entries],()=>{page.value=0})
</script>
<template>
  <section v-if="entries.length" class="df df-celtic mt-4 space-y-3" data-testid="chronicle">
    <h2 class="font-title text-lg font-bold text-[#e8d7a8]">연대기</h2>
    <div class="flex flex-wrap gap-2"><input v-model="query" class="dbtn min-w-0 flex-1" type="search" placeholder="생애·시드·원인·발견 찾기" aria-label="연대기 검색" data-testid="chronicle-search"><select v-model="kind" class="dbtn" aria-label="연대기 종류" data-testid="chronicle-kind"><option value="all">모든 기록</option><option value="death">사망</option><option value="retire">은퇴</option><option value="escape">원정의 끝</option><option value="content">구성 변경</option></select></div>
    <p class="text-xs text-ash-400">보관된 {{ entries.length }}개 중 {{ filtered.length }}개 · {{ page+1 }}/{{ pages }}쪽</p>
    <p v-if="!rows.length" class="text-xs text-ash-400">조건에 맞는 생애 기록이 없다.</p>
    <ul class="grid gap-3 text-xs sm:grid-cols-2">
      <li v-for="(c,index) in rows" :key="`${c.at}-${index}`" class="border-l-2 pl-3 leading-5" :class="c.kind!=='death'?'border-moss-500':'border-blood-500'" data-testid="chronicle-entry">
        <template v-if="c.kind==='content'"><div class="text-amber-200">모드 변경됨 · {{ c.turn }}턴 · 시드 {{ c.seed }}</div><p class="break-all font-mono text-[10px]">{{ c.from }} → {{ c.to }}</p></template>
        <template v-else>
          <div :class="c.kind==='death'?'text-blood-300':'text-moss-300'">{{ c.kind==='retire'?'은퇴':c.kind==='death'?'사망':'원정의 끝' }} · {{ c.report.title }}</div>
          <div class="text-ash-200">{{ c.report.epitaph }}</div><div v-if="c.saveModeLabel" class="text-amber-200">{{ c.saveModeLabel }} 방식</div>
          <div class="text-ash-400">{{ c.report.background }} · {{ c.report.traits.join(', ') }} · 시드 {{ c.seed }}</div>
          <details class="mt-2 text-ash-300" data-testid="chronicle-life"><summary class="cursor-pointer text-[#bba36f]">전체 생애 기록</summary><p class="mt-2 text-amber-200">마지막 기록</p><p v-for="(line,i) in c.report.chain" :key="`chain-${i}`" class="text-[11px]">{{ line }}</p><p class="mt-2 text-amber-200">그때의 몸</p><p v-for="(line,i) in c.report.vitals" :key="`body-${i}`" class="text-[11px]">{{ line }}</p><p class="mt-2 text-amber-200">원정 기록</p><p v-for="(line,i) in c.report.stats" :key="`stat-${i}`" class="text-[11px]">{{ line }}</p><ReportActions :report="c.report" :seed="c.seed" :mode-label="c.saveModeLabel" /></details>
        </template>
      </li>
    </ul>
    <div v-if="pages>1" class="flex gap-2"><button class="dbtn" :disabled="page<=0" data-testid="chronicle-prev" @click="page--">이전 생애</button><button class="dbtn" :disabled="page+1>=pages" data-testid="chronicle-next" @click="page++">다음 생애</button></div>
  </section>
</template>
