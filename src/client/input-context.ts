// Shared UI input rules. These never advance the simulation.
import type {Command} from './keybindings'
export const DIRECTION_COMMANDS:readonly Command[]=['north','northEast','east','southEast','south','southWest','west','northWest']
export function directionOf(command:Command){const i=DIRECTION_COMMANDS.indexOf(command);return i<0?null:i}
export function repeatableCommand(command:Command){return directionOf(command)!==null||command==='wait'}
export function editableTarget(target:EventTarget|null){return target instanceof HTMLElement&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')}
export function focusableIn(root:HTMLElement){return [...root.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a[href],[tabindex]')].filter(el=>el.offsetParent!==null&&!el.matches(':disabled,[inert],[tabindex="-1"]')&&!el.closest('[inert]'))}
export function cycleFocus(root:HTMLElement,event:KeyboardEvent){
 const controls=focusableIn(root),at=controls.indexOf(document.activeElement as HTMLElement)
 event.preventDefault()
 const next=at<0?(event.shiftKey?controls.length-1:0):(at+(event.shiftKey?-1:1)+controls.length)%controls.length
 ;(controls[next]??root).focus()
}
