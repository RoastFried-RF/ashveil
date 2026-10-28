import {patrolContractsFixture,type PatrolPhase} from './patrol-contracts-fixture'
// 실제 선택 모드와 같은 Def 구성의 초기 현장. 과거 각인 이관/월드 여행으로 주장하지 않는다.
export const patrolContractModFixture=(phase:PatrolPhase='offer')=>patrolContractsFixture(phase,['sample-patrol-contract'])
