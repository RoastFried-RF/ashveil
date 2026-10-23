<script setup lang="ts">
import {ref} from 'vue'
import type {DeathReport} from '../../core/types'
import {downloadExpeditionReport,formatExpeditionReport} from '../report-export'
const props=defineProps<{report:DeathReport;seed:string;modeLabel?:string}>()
const message=ref(''),copying=ref(false)
async function copy(){
 if(copying.value)return;copying.value=true
 try{await navigator.clipboard.writeText(formatExpeditionReport(props));message.value='보고서를 복사했다.'}
 catch{message.value='클립보드에 복사하지 못했다. 파일로 저장할 수 있다.'}
 finally{copying.value=false}
}
function download(){try{downloadExpeditionReport(props);message.value='보고서 파일을 준비했다.'}catch{message.value='보고서 파일을 만들지 못했다.'}}
</script>
<template>
  <div class="report-actions" data-testid="report-actions"><div><button class="dbtn" :disabled="copying" @click="copy">{{ copying?'복사 중…':'보고서 복사' }}</button><button class="dbtn" @click="download">보고서 파일 저장</button></div><p v-if="message" role="status">{{ message }}</p></div>
</template>
<style scoped>
.report-actions{padding-block:8px}.report-actions>div{display:flex;flex-wrap:wrap;gap:8px}.report-actions p{font-size:10px;color:#b4a78b;margin-top:8px}
</style>
