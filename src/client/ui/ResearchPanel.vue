<script setup lang="ts">
import {computed} from 'vue'
import {player,researchThreads,type World} from '../../core'
import {version,world} from '../store'
import {journalSection} from '../ui'
const threads=computed(()=>{void version.value;const w=world.value as World;return researchThreads(w,player(w))})
</script>
<template>
  <section class="research-panel" data-testid="research-panel">
    <div class="research-intro"><span>문헌과 현장의 사이</span><h3>서로 잇는 기록</h3><p>온전히 읽은 문헌과 직접 남긴 기록을 맞춰 본다. 누가 쓴 말인지, 무엇을 직접 보았는지 구분하자.</p></div>
    <p v-if="!threads.length" class="research-empty">아직 서로 맞출 수 있는 기록이 없다. 책을 온전히 읽고 현장의 기구를 직접 점검하면 실마리가 남는다.</p>
    <article v-for="thread in threads" :key="thread.id" class="research-thread"><div class="research-thread-heading"><h4>{{ thread.label }}</h4><span>{{ thread.confirmed }}/{{ thread.total }} 연결</span></div><ol><li v-for="step in thread.steps" :key="step.id" :class="{'is-confirmed':step.confirmed}"><span class="research-dot" aria-hidden="true">{{ step.confirmed?'◆':'◇' }}</span><div><h5>{{ step.label }}</h5><p v-if="step.text">{{ step.text }}</p><p v-else-if="step.found" class="research-incomplete">확인한 단서 {{ step.found }}/{{ step.total }} · 더 맞춰 볼 기록이 있다.</p><p v-else class="research-incomplete">아직 직접 확인한 연결이 없다.</p><div v-if="step.sources.length" class="research-sources"><span v-for="source in step.sources" :key="source.kind+source.label">{{ source.kind==='book'?'문헌':source.kind==='field'?'현장':'청중' }} · {{ source.label }}</span></div></div></li></ol></article>
    <button v-if="threads.length" class="dbtn" @click="journalSection='endings'">이 기록으로 고를 수 있는 갈림길</button>
  </section>
</template>
<style scoped>
.research-intro{padding:8px 0 16px;border-bottom:1px solid #5b4c34;margin-bottom:16px}.research-intro>span{font-size:10px;letter-spacing:.12em;color:#b39b6f}.research-intro h3{font-family:'Gowun Batang',serif;font-size:20px;color:#e1d0a7;margin-block:7px}.research-intro p,.research-empty{font-size:11px;color:#aaa087;line-height:1.8}.research-empty{padding:18px;border:1px dashed #5b4c34}.research-thread{border:1px solid #574b36;margin-bottom:16px;background:#24251e}.research-thread-heading{padding:11px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #4d4632}.research-thread h4{color:#d5c59d;font-size:14px}.research-thread-heading>span{color:#9da38a;font-size:10px}.research-thread ol{padding:8px 14px}.research-thread li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #3c3b2c}.research-thread li:last-child{border-bottom:0}.research-dot{font-size:10px;color:#7f795d;padding-top:2px}.is-confirmed .research-dot{color:#a9b58e}.research-thread h5{font-size:12px;color:#bbb193;margin-bottom:6px}.is-confirmed h5{color:#e0d1ae}.research-thread li p{font-size:11px;line-height:1.8;color:#c1b69b}.research-thread li .research-incomplete{font-size:10px;color:#888773}.research-sources{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.research-sources span{border:1px solid #55533c;padding:3px 6px;font-size:9px;color:#9ba58c;background:#1a2019}
</style>
