<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {knownExpeditionEndings,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'

const rows=computed(()=>{void version.value;const w=world.value as World;return knownExpeditionEndings(w,player(w))})
const choice=ref<{id:string;signature:string}>()
watch(version,()=>{choice.value=undefined})
function finish(){const selected=choice.value;if(!selected)return;choice.value=undefined;doAct({type:'finishExpedition',ending:selected.id,expected:selected.signature})}
</script>

<template>
  <section class="expedition-endings" data-testid="expedition-endings">
    <div class="endings-intro"><span>한 생애의 갈림길</span><h3>어디에서 원정을 마칠 것인가</h3><p>직접 확인한 일들이 끝을 고를 이유가 된다. 결말을 고르기 전까지 탐험은 계속할 수 있다.</p></div>
    <p v-if="!rows.length" class="endings-empty">아직 이 수첩에 남긴 갈림길이 없다. 현장의 설비와 원본 기록을 직접 살펴보자. 정착지 여관에서 거처와 생활비를 확보해 은퇴할 수도 있다.</p>
    <article v-for="row in rows" :key="row.rule!.id" class="ending-card" :class="{'is-ready':!row.error}" :data-ending="row.rule!.id">
      <div class="ending-card-heading"><span aria-hidden="true">{{ row.error?'◇':'◆' }}</span><h4>{{ row.rule!.label }}</h4><span>{{ row.error?'기록을 잇는 중':'끝을 고를 수 있음' }}</span></div>
      <p>{{ row.rule!.summary }}</p>
      <ul v-if="row.notes.length"><li v-for="note in row.notes" :key="note.key">{{ note.title }} · 직접 확인</li></ul>
      <p v-if="row.disclosures.length" class="ending-evidence">원본 기록을 실제 청중에게 읽은 기록 {{ row.disclosures.length }}회</p>
      <p v-if="row.error" class="ending-reason">{{ row.error }}</p>
      <div v-if="choice?.id===row.rule!.id" class="ending-confirm" role="group" :aria-label="row.rule!.label+' 결말 확인'">
        <p>{{ row.rule!.epitaph }}</p><p>이 원정은 여기서 끝나며 생애 보고서와 연대기에 남는다.</p>
        <div><button class="dbtn-gold" :disabled="simulating||!!row.error||choice.signature!==row.signature" data-testid="ending-confirm" @click="finish">이 결말로 원정 마치기</button><button class="dbtn" @click="choice=undefined">탐험 계속하기</button></div>
      </div>
      <button v-else class="dbtn" :disabled="simulating||!!row.error" :data-ending-choose="row.rule!.id" @click="choice={id:row.rule!.id,signature:row.signature}">이 기록으로 마무리 검토</button>
    </article>
  </section>
</template>

<style scoped>
.endings-intro{border-bottom:1px solid #5b4d36;padding:8px 0 16px;margin-bottom:16px}.endings-intro>span{color:#b59b67;font-size:10px;letter-spacing:.12em}.endings-intro h3{color:#e3d3ad;font-size:20px;margin:6px 0 9px;font-family:'Gowun Batang',serif}.endings-intro p,.endings-empty{color:#a99e85;font-size:11px;line-height:1.8}.endings-empty{border:1px dashed #66563b;padding:18px}.ending-card{background:linear-gradient(110deg,#28271f,#1a1a15);border:1px solid #514936;padding:15px;margin-block:12px}.ending-card.is-ready{border-color:#9b8555}.ending-card-heading{display:flex;align-items:center;gap:8px;color:#9f8c62;margin-bottom:10px}.ending-card h4{flex:1;color:#dccaa0;font-size:15px;font-weight:400}.ending-card-heading>span:last-child{font-size:9px;color:#9d9b80}.ending-card>p{font-size:11px;color:#bbb096;line-height:1.8}.ending-card ul{font-size:10px;color:#94a485;line-height:1.8;margin:9px 0}.ending-card .ending-evidence{color:#9bad9f;font-size:10px}.ending-card .ending-reason{color:#b38f6c;font-size:10px;margin:10px 0}.ending-confirm{margin-top:12px;padding:12px;border:1px solid #9b8150;background:#3b3022}.ending-confirm p{font-size:11px;color:#d6c49e;line-height:1.8;margin-bottom:8px}.ending-confirm>div{display:flex;flex-wrap:wrap;gap:8px}
</style>
