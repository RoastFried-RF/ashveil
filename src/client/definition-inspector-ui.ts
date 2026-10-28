import { ref, shallowRef } from 'vue'
import { inspectDefinitions, type DefinitionInspector } from '../core/definition-inspection'
import { packages } from './store'

export const definitionInspectorOpen = ref(false)
export const definitionInspector = shallowRef<DefinitionInspector>()
export function openDefinitionInspector(enabled: string[]) {
  definitionInspector.value = inspectDefinitions(packages, [...enabled])
  definitionInspectorOpen.value = true
}
