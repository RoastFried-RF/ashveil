<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {DISCOVERY_KIND_LABEL} from '../../core/discovery-archive'
import type {DiscoveryArchive,DiscoveryKind} from '../../core/types'
const props=defineProps<{archive?:DiscoveryArchive}>(),opened=ref(false),query=ref(''),kind=ref<DiscoveryKind|'all'>('all'),page=ref(0)
const filtered=computed(()=>{const q=query.value.trim().normalize('NFKC').toLowerCase();return(props.archive?.records??[]).filter(row=>(kind.value==='all'||row.kind===kind.value)&&(!q||[row.title,...row.details].join(' ').normalize('NFKC').toLowerCase().includes(q)))})
const pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/10))),rows=computed(()=>filtered.value.slice(page.value*10,page.value*10+10))
watch([query,kind,()=>props.archive],()=>{page.value=0})
</script>
<template>
  <details class="my-3 border border-ash-700 p-2 text-xs" data-testid="discovery-archive" @toggle="opened=($event.target as HTMLDetailsElement).open">
    <summary class="cursor-pointer text-amber-100">이 생애의 발견·학습 기록 · {{ archive?`${archive.records.length}개`:'이전 기록 없음' }}</summary>
    <div v-if="opened" class="mt-2">
      <p class="my-2 text-ash-400">당시의 지식·관찰·추정과 전해 들은 주장이다. 현재 세계의 사실을 다시 검사하지 않으며 새 인물의 지식·능력·물품으로 옮기지 않는다.</p>
      <p v-if="!archive" data-testid="discovery-archive-legacy">이 생애는 발견 목록을 기록하지 않은 옛 보고서다. 현재 구성으로 과거의 발견을 추정하지 않는다.</p>
      <template v-else>
        <div class="my-2 flex flex-wrap gap-2"><input v-model="query" class="dbtn min-w-0 flex-1" type="search" placeholder="발견·출처·내용 찾기" aria-label="발견 검색" data-testid="discovery-archive-search"><select v-model="kind" class="dbtn" aria-label="발견 갈래" data-testid="discovery-archive-kind"><option value="all">모든 갈래</option><option v-for="(label,key) in DISCOVERY_KIND_LABEL" :key="key" :value="key">{{ label }}</option></select></div>
        <p class="my-1 text-ash-400">조건에 맞는 기록 {{ filtered.length }}개 · {{ page+1 }}/{{ pages }}쪽</p>
        <p v-if="!filtered.length" class="my-2 text-ash-400">기록된 발견이 없거나 검색 조건에 맞지 않는다.</p>
        <article v-for="row in rows" :key="`${row.kind}:${row.id}`" class="my-2 border-b border-ash-700 pb-2" :data-discovery-kind="row.kind"><p class="text-amber-100">{{ DISCOVERY_KIND_LABEL[row.kind] }} · {{ row.title }}</p><p v-for="(line,i) in row.details" :key="i" class="my-1 whitespace-pre-wrap break-words text-ash-300">{{ line }}</p></article>
        <div v-if="pages>1" class="my-2 flex gap-2"><button class="dbtn" :disabled="page<=0" data-testid="discovery-archive-prev" @click="page--">이전 발견</button><button class="dbtn" :disabled="page+1>=pages" data-testid="discovery-archive-next" @click="page++">다음 발견</button></div>
        <p v-if="archive.omitted" class="my-2 text-amber-200">요약의 기술 한도를 넘어 목록에 넣지 못한 발견 {{ archive.omitted }}개가 있다.</p>
      </template>
    </div>
  </details>
</template>
