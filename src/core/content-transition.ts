import {contentCompatibility} from './content-compatibility'
import {GAME_VERSION,DEF_SCHEMA_VERSION} from './content-version'
import {applyScriptContentChanges} from './script-content-changes'
import {applyItemRenames} from './item-renames'
import {applyStatusRenames} from './status-renames'
import {applyEventRenames} from './event-renames'
import {applyBodyRenames} from './body-renames'
import {applyCreatureRenames} from './creature-renames'
import {applyMissingCreatures} from './missing-creatures'
import {applyMissingEvents} from './missing-events'
import {applyMissingStatuses} from './missing-statuses'
import {applyMissingItems} from './missing-items'
import type {World} from './ctx'
/** 클라이언트가 검토/승인한 소유 후보에 공통 이행을 적용한다. 실행 중 원본에는 직접 호출하지 않는다. */
export function applyContentTransition({s,db}:World):string|null{
 const compatibility=contentCompatibility(s,db),changed=compatibility.status==='changed'
    const scriptChangeError=applyScriptContentChanges({s,db});if(scriptChangeError)return '각인의 스크립트 구성을 복구할 수 없다: '+scriptChangeError
    const renameError=applyItemRenames(s,db);if(renameError)return '각인의 물품 ID를 이행할 수 없다: '+renameError
    const statusRenameError=applyStatusRenames(s,db);if(statusRenameError)return '각인의 상태 ID를 이행할 수 없다: '+statusRenameError
    const eventRenameError=applyEventRenames(s,db);if(eventRenameError)return '각인의 사건 ID를 이행할 수 없다: '+eventRenameError
    const bodyRenameError=applyBodyRenames(s,db);if(bodyRenameError)return '각인의 몸 ID를 이행할 수 없다: '+bodyRenameError
    const creatureRenameError=applyCreatureRenames(s,db);if(creatureRenameError)return '각인의 개체 ID를 이행할 수 없다: '+creatureRenameError
    const creatureError=applyMissingCreatures({s,db});if(creatureError)return '각인의 개체를 정리할 수 없다: '+creatureError
    const eventError=applyMissingEvents({s,db});if(eventError)return '각인의 사건 예약을 정리할 수 없다: '+eventError
    const statusError=applyMissingStatuses({s,db});if(statusError)return '각인의 상태를 복구할 수 없다: '+statusError
    const recoveryError=applyMissingItems(s,db)
    if(recoveryError)return '각인의 물품을 복구할 수 없다: '+recoveryError
    if(changed){
      const from=s.loadHash!;s.loadHash=db.loadHash;s.gameVersion=GAME_VERSION;s.defSchemaVersion=DEF_SCHEMA_VERSION;s.contentMods=db.modManifest();s.contentDefinitions=db.definitionManifest();s.contentItemShapes=db.itemShapeManifest();s.mods=[...db.loadedMods]
      s.contentChanges=[...(s.contentChanges??[]).slice(-63),{turn:Math.floor(s.time/100),from,to:db.loadHash}];s.achievementsDisabled=true
    }else if(compatibility.status==='same'){s.gameVersion=GAME_VERSION;s.defSchemaVersion=DEF_SCHEMA_VERSION;if(s.contentMods===undefined)s.contentMods=db.modManifest();if(s.contentDefinitions===undefined)s.contentDefinitions=db.definitionManifest();if(s.contentItemShapes===undefined)s.contentItemShapes=db.itemShapeManifest()}
 return null
}
