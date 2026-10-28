// Complete metadata joins and ASHVEIL consumer audit; never republishes reference pixels.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
const root=resolve(process.argv[2]??'test-results/wiki-resource-survey-v319'),out=resolve('tools/research/stoneshard-v319')
const read=name=>JSON.parse(readFileSync(join(root,name+'.json'),'utf8'))
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
const inventory=read('joined-resource-inventory'),articleCats=read('article-categories'),cache=read('visual-cache'),pages=read('contact-pages')
if(!articleCats.complete||articleCats.pages.length!==4372||inventory.images.length!==3937||cache.failures.length)throw Error('Incomplete source inventory')
const byArticle=new Map(articleCats.pages.map(p=>[p.title,p.categories]))
const rules={actors:/Enemy NPC|NPC images|PC images|Enemies|Animals|Bestiar|Character/,equipment:/Weapon|Armor|Ammo|Amulet|Axe|Belt|Boot|Bow |Chestpiece|Chestplate|Cloak|Crossbow|Dagger|Glove|Greatsword|Headgear|Helmet|Jewelry|Mace|Quiver|Shield|Spear|Staff|Sword/,supplies:/Beverage|Commodity|Food|Herb|Ingredient|Junk|Material|Medicine|Potion|Tool |Trap|Valuable|Wood|Bag images|Container images/,environment:/Dungeon|Location|Map marker|POI |Biome|Settlement/,interface:/Attribute|Condition|Contract|Health system|Icons|Injury|Interface|Psyche|Skill|Quest item/,documents:/Book|Scroll|Treatise/}
inventory.images=inventory.images.map(file=>{
 const articleCategories=[...new Set(file.articles.flatMap(title=>byArticle.get(title)??[]))].sort(),labels=[...file.categories,...articleCategories].join('\n')
 return{...file,articleCategories,onEnemyIndex:cache.cached.some(row=>row.name===file.name&&row.onEnemyIndex),routingHints:Object.entries(rules).filter(([,rule])=>rule.test(labels)).map(([family])=>family)}
})
inventory.routingScope='Nonexclusive category-based hints, not an authoritative semantic classification. Every file remains present, including uncategorized, unused, translated and ambiguous files.'
inventory.counts.articleCategoryPages=articleCats.pages.length
inventory.counts.noRoutingHint=inventory.images.filter(file=>!file.routingHints.length).length
mkdirSync(out,{recursive:true})
for(const name of ['inventory-audit','file-category-catalog'])writeFileSync(join(out,name+'.json'),JSON.stringify(read(name),null,2)+'\n')
writeFileSync(join(out,'joined-resource-inventory.json'),JSON.stringify(inventory,null,2)+'\n')
const before=read('ashveil-assets-before'),after=read('ashveil-assets-after'),m=after.registry
const frame=key=>{const f=m.frames[key];return{key,url:f?m.sheets[f[0]]:'tiles/'+key+'.png',new319:!!f&&m.sheets[f[0]].includes('direction-v319')}}
const mapping={scope:'Every resolved base-game definition and registered UI asset. Character aliases, legacy sprite fallback and dormant roles are included. Declared routing is not a claim that every world scene was played.',counts:after.counts,baseline:before.counts,
 items:after.consumers.items.map(d=>({...d,bindings:d.bindings.map(b=>({...b,...frame(b.key)}))})),
 abilities:after.consumers.abilities.map(d=>({...d,bindings:d.bindings.map(b=>({...b,...frame(b.key)}))})),
 terrains:after.consumers.terrains.map(d=>({...d,bindings:d.bindings.map(b=>({...b,...frame(b.key)}))})),
 creatures:after.consumers.creatures.map(d=>{
  const keys=[...new Set([...d.characterKeys,...(Array.isArray(d.legacySprites)?d.legacySprites:d.legacySprites?[d.legacySprites]:[])])].filter(key=>m.chars[key])
  return{...d,roles:keys.map(key=>({key,body:frame(m.chars[key].idle.down[0]),portrait:m.chars[key].portrait?frame(m.chars[key].portrait):null,scale:m.chars[key].renderScale,heldItems:!!m.chars[key].heldItems}))}
 }),ui:Object.entries(m.ui).map(([key,url])=>({key,url,new319:url.includes('direction-v319')})),
 rendererLimits:['Terrain definitions include compatibility keys; terrain-art and map renderer apply authored state/season/crop overrides.','A creature may share a role portrait; these are not individualized gender/age portraits.','Animal artwork can exceed one tile while logical collision remains one cell.']}
mapping.summary={newItemBindings:mapping.items.filter(d=>d.bindings.some(b=>b.new319)).length,newCreatureBindings:mapping.creatures.filter(d=>d.roles.some(r=>r.body.new319)).length,retainedTerrainDefinitions:mapping.terrains.length,retainedAbilityDefinitions:mapping.abilities.length,retainedUI:mapping.ui.length,creaturesWithoutRegisteredRole:mapping.creatures.filter(d=>!d.roles.length).map(d=>d.id)}
writeFileSync(join(out,'ashveil-resource-mapping.json'),JSON.stringify(mapping,null,2)+'\n')
const initial=JSON.parse(readFileSync(join(out,'visual-study-initial.json'),'utf8'))
const visual={...initial,metadataScope:inventory.routingScope,metadataCounts:inventory.counts,metadataFiles:{...initial.metadataFiles,'article-categories.json':sha(join(root,'article-categories.json'))},openedReferenceContactScreenshots:[...initial.openedReferenceContactScreenshots,...pages.filter(p=>p.group==='enemies').map(p=>'review-index-601/'+p.page.replace('.html','.png'))],referencesOnTheseScreens:cache.cached.length,enemyIndexUnique:cache.cached.filter(row=>row.onEnemyIndex).length,enemyUnion:pages.filter(p=>p.group==='enemies').flatMap(p=>p.images).length,referenceFiles:cache.cached.map(({path:_path,...row})=>row),pending:'Other file categories have representative visual review only. All uploaded images are inventoried, not all3937 visually reviewed. Original game-scene review is recorded separately.'}
writeFileSync(join(out,'visual-study.json'),JSON.stringify(visual,null,2)+'\n')
console.log(JSON.stringify({metadata:inventory.counts,reviewed:cache.cached.length,project:mapping.summary}))
