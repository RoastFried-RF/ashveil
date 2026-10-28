<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { clinicDef, clinicQuote, clinicSupplyStock, economyDef, handState, isMissing, itemDef, part, player, woundDef, type ClinicKind, type ClinicRequest, type DrugDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const props = defineProps<{ doctorId: number }>()
const selected = ref<ClinicRequest | null>(null), consent = ref(false), amputation = ref(false)
const labels: Record<ClinicRequest['kind'], string> = { dose: '투약', diagnose: '진찰', bandage: '붕대', disinfect: '세척', tourniquet: '지혈대', splint: '부목', suture: '봉합', ligate: '동맥 결찰', tendon: '힘줄 수복', amputate: '절단', extract: '이물질 제거', reduce: '관절 맞추기' }
const data = computed(() => {
  void version.value
  const w = world.value as World, p = player(w), doctor = w.s.creatures.find((c) => c.id === props.doctorId)!
  const stock = clinicSupplyStock(w, doctor)
  const hands = { washed: '씻음', normal: '보통', dirty: '피·흙 묻음' }[handState(w, doctor)], washing = doctor.activity?.kind === 'washHands', boiling = doctor.activity?.kind === 'water', warming = doctor.activity?.kind === 'warm'
  const medicines = doctor.bag.flatMap((it) => {
    const d = itemDef(w, it), entry = clinicDef(w, doctor)?.prescriptions.find((r) => r.item === it.def)
    if (!entry || !d.drug?.def || (it.uses ?? 1) <= 0 || d.relic && (it.appraisal ?? 0) < 2) return []
    return [{ it, drug: w.db.get<DrugDef>(d.drug.def) }]
  })
  const wounds = p.body.wounds.filter((wd) => !wd.internal && !isMissing(w, p, wd.part) && (wd.healed < wd.severity || wd.tendon || wd.dislocated || wd.foreign)).map((wd) => {
    const kinds: ClinicKind[] = []
    if (wd.healed < wd.severity) kinds.push('bandage', 'disinfect', 'suture')
    if (part(w, p, wd.part).limb && (wd.artery ?? 0) > 0) kinds.push('tourniquet')
    if ((wd.artery ?? 0) > 0) kinds.push('ligate')
    if (wd.fracture) kinds.push('splint')
    if (wd.tendon) kinds.push('tendon')
    if (wd.foreign) kinds.push('extract')
    if (wd.dislocated) kinds.push('reduce')
    return { wd, label: `${part(w, p, wd.part).label} · ${woundDef(w, wd).label}`, options: kinds.map((kind) => { const request = { kind, woundId: wd.id }; return { request, quote: clinicQuote(w, p, doctor, request) } }) }
  })
  const tendons = (p.body.damagedTendons ?? []).filter((id) => !isMissing(w, p, id) && !p.body.wounds.some((wd) => wd.part === id && wd.tendon))
  const limbs = w.db.body(p.body.def).parts.filter((pd) => pd.limb && !pd.internal && !pd.vital && !isMissing(w, p, pd.id) && /UpperArm|Thigh|Hand$|Foot$/.test(pd.id))
  return { w, p, doctor, hands, washing, boiling, warming, wounds, tendons, limbs, medicines, bandages: stock.find((n) => n.rule.item === 'Item.Bandage')?.count, missing: stock.filter((n) => n.count < n.rule.minimum).map((n) => w.db.item(n.rule.item).label), currency: economyDef(w).currency, quote: selected.value ? clinicQuote(w, p, doctor, selected.value) : null }
})
watch(() => props.doctorId, () => { selected.value = null; consent.value = false; amputation.value = false })
function choose(request: ClinicRequest) { selected.value = request; consent.value = false }
function confirm() {
  if (!selected.value || !data.value.quote || selected.value.kind === 'amputate' && !consent.value) return
  if (!doAct({ type: 'clinic', target: props.doctorId, request: { ...selected.value }, expectedFee: data.value.quote.fee })) selected.value = null
}
</script>
<template>
  <section class="mt-3 border-t border-ash-600 pt-2" data-testid="clinic-panel">
    <h3 class="text-sm font-bold text-gold-300">진료</h3>
    <p class="my-1 text-xs text-ash-300">의사의 물품과 숙달로 처치한다. 진료 중에도 출혈과 시간은 흐른다.</p>
    <p class="my-1 text-xs" data-testid="clinic-hands">의사의 손: {{ data.hands }}{{ data.washing ? ' · 손을 씻는 중' : '' }}</p>
    <p v-if="data.boiling" class="my-1 text-xs" data-testid="clinic-boiling">의사는 불에서 식수를 끓이고 있다.</p>
    <p v-if="data.warming" class="my-1 text-xs" data-testid="clinic-warming">의사는 불 곁에서 몸을 녹이고 있다.</p>
    <button v-if="data.washing || data.boiling || data.warming" class="dbtn" :disabled="simulating" data-testid="clinic-wait" @click="doAct({ type: 'wait' })">1턴 기다리기</button>
    <p v-if="data.bandages !== undefined" class="my-1 text-xs text-ash-300" data-testid="clinic-bandage-stock">붕대 재료 {{ data.bandages }}회분</p>
    <p v-if="data.missing.length" class="my-1 text-xs text-amber-200">부족한 물품: {{ data.missing.join(', ') }}. 의사는 거래가 가능하면 상점에서 물품을 구해 돌아온다.</p>
    <button class="dbtn my-1" :disabled="simulating" data-testid="clinic-diagnose" @click="choose({ kind: 'diagnose' })">진찰 상담</button>
    <p v-if="data.medicines.some((m) => !m.drug.external)" class="my-1 text-xs">의사에게 받을 약 · 규격 1회분</p>
    <div class="mb-2 flex flex-wrap gap-1"><button v-for="m in data.medicines.filter((m) => !m.drug.external)" :key="m.it.uid" class="dbtn text-xs" :disabled="simulating" :data-testid="`clinic-drug-${m.it.def}`" @click="choose({ kind: 'dose', uid: m.it.uid })">{{ m.drug.label }} · 재고 {{ m.it.count * (m.it.uses ?? 1) }}회분</button></div>
    <div class="max-h-[35vh] overflow-y-auto">
      <p v-if="!data.wounds.length && !data.tendons.length" class="my-2 text-xs">겉으로 드러난 상처가 없다.</p>
      <div v-for="row in data.wounds" :key="row.wd.id" class="my-2 border-b border-ash-700 pb-2 text-xs" :data-clinic-wound="row.wd.id">
        <p class="mb-1">{{ row.label }}</p>
        <div class="flex flex-wrap gap-1"><button v-for="option in row.options" :key="option.request.kind" class="dbtn" :title="option.quote.error ?? `예상 Q ${option.quote.quality} · ${option.quote.turns}턴`" :data-testid="`clinic-${option.request.kind}-${row.wd.id}`" :disabled="simulating" @click="choose(option.request)">{{ labels[option.request.kind] }} {{ option.quote.fee || '—' }}{{ data.currency }}</button></div>
        <div class="mt-1 flex flex-wrap gap-1"><button v-for="m in data.medicines.filter((m) => m.drug.external)" :key="m.it.uid" class="dbtn text-xs" :disabled="simulating" :data-testid="`clinic-topical-${row.wd.id}-${m.it.def}`" @click="choose({ kind: 'dose', uid: m.it.uid, woundId: row.wd.id })">{{ m.drug.label }} 바르기</button></div>
      </div>
      <p v-for="id in data.tendons" :key="id" class="my-2 text-xs">{{ part(data.w, data.p, id).label }} · 아문 힘줄 손상 <button class="dbtn" @click="choose({ kind: 'tendon', part: id })">힘줄 수복 상담</button></p>
      <button class="dbtn my-1 text-xs" @click="amputation = !amputation">절단 상담 {{ amputation ? '접기' : '펼치기' }}</button>
      <div v-if="amputation" class="my-1 flex flex-wrap gap-1"><button v-for="pd in data.limbs" :key="pd.id" class="dbtn text-xs" @click="choose({ kind: 'amputate', part: pd.id })">{{ pd.label }}</button></div>
    </div>
    <div v-if="selected && data.quote" class="mt-2 border-t border-ash-600 pt-2 text-xs" data-testid="clinic-quote">
      <p class="font-bold">{{ labels[selected.kind] }} · {{ data.quote.fee }}{{ data.currency }} · 대기 포함 약 {{ data.quote.turns }}턴 · {{ data.quote.quality === null ? '규격1회분' : `예상 Q ${data.quote.quality}` }}</p>
      <p class="my-1 text-ash-300">진료비는 시작할 때 지불하며, 중단해도 돌려받지 못한다. {{ selected.kind === 'dose' ? '투여 시점의 내성과 몸 상태에 따라 약효가 달라질 수 있다.' : '처치 품질은 완료 시 의사와 주변 상태에 따라 달라질 수 있다.' }}</p>
      <p v-if="selected.kind === 'diagnose'" class="my-1 text-ash-300">의사의 숙달과 검사 여건에 따라 겉의 상처·복부 소견·맥을 살핀다. 결과는 일지의 진료 기록에 남는다.</p>
      <p v-if="selected.kind === 'dose' && !data.quote.error" class="my-1 text-amber-200" data-testid="clinic-drug-preview">{{ data.quote.lines.join(' · ') }}</p>
      <details v-if="!data.quote.error" class="my-1 text-ash-300"><summary>{{ selected.kind === 'dose' ? '소모품 확인' : '품질과 소모품 확인' }}</summary><p v-if="selected.kind !== 'dose'">{{ data.quote.lines.join(' · ') }}</p><p v-for="supply in data.quote.activity?.supplies ?? []" :key="supply.uid">의사 소모품: {{ data.w.db.item(supply.def).label }} {{ supply.uses !== undefined ? `${supply.uses}회분` : `${supply.count}개` }}</p></details>
      <p v-if="selected.kind === 'extract'" class="my-1 text-amber-300">이물질을 뽑으면 피를 더 잃을 수 있으며, 실패하면 상처가 커진다.</p>
      <label v-if="selected.kind === 'amputate'" class="my-2 block text-red-300"><input v-model="consent" type="checkbox" /> 해당 부위가 영구적으로 사라지고 출혈·실신·사망할 수 있음을 확인했다.</label>
      <p v-if="data.quote.error" class="my-1 text-red-300" data-testid="clinic-error">{{ data.quote.error }}</p>
      <button class="dbtn-gold mt-1" :disabled="simulating || !!data.quote.error || selected.kind === 'amputate' && !consent" data-testid="clinic-confirm" @click="confirm">지불하고 진료 시작</button>
    </div>
  </section>
</template>
