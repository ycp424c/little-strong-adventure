import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel, ALLY_BULLET_LIMIT, UPGRADES } from '../src/game/model.ts'
import { COMPANIONS, RECIPES, companionForm, companionHP, type CompanionForm } from '../src/game/companions.ts'
import { fusionPose } from '../src/game/animation.ts'
import { ABILITIES } from '../src/game/abilities.ts'
const idle={x:0,y:0,fire:false,dash:false,rally:false}
function arena(){const m=new GameModel(()=>.5);m.start();m.enemies=[];m.player.x=1600;m.player.y=900;m.weaponCooldown=100;m.nextXp=100000;return m}
function tick(m:GameModel,time:number){for(let i=0;i<Math.ceil(time/.01);i++)m.update(.01,idle)}
function craft(m:GameModel,form:CompanionForm){
  const recipe=RECIPES.find(r=>r.id===form)!,before=new Set(m.allies.map(a=>a.id))
  for(let i=0;i<recipe.melee;i++)m.recruit('melee')
  for(let i=0;i<recipe.ranged;i++)m.recruit('ranged')
  m.openFusion();assert.ok(m.mergeRecipe(form))
  return m.allies.find(a=>!before.has(a.id))!
}
function foe(m:GameModel,x:number,y=900,elite=false){const e=m.spawnEnemy('melee',2100,900,elite)!;Object.assign(e,{x,y,hp:100,maxHp:100,cd:100,frozen:100});return e}
function settled(m:GameModel,form:CompanionForm){const a=craft(m,form);tick(m,.7);Object.assign(a,{x:1700,y:900,cd:0,throwCd:0});return a}
function enemyBullet(m:GameModel,x:number,y=900){const b={id:90000+m.bullets.length,x,y,vx:0,vy:0,life:2,team:'enemy' as const,damage:8,distance:0};m.bullets.push(b);return b}

test('四种一级材料配方必须手动确认，准确消耗三只并创建各自二级身份',()=>{
  for(const recipe of RECIPES){
    const m=arena();for(let i=0;i<recipe.melee;i++)m.recruit('melee');for(let i=0;i<recipe.ranged;i++)m.recruit('ranged')
    assert.equal(m.allies.length,3);assert.ok(m.allies.every(a=>a.tier===1));assert.equal(m.merges,0)
    assert.deepEqual(m.fusionRecipes.filter(r=>r.ready).map(r=>r.id),[recipe.id])
    m.openFusion();assert.equal(m.status,'fusion');assert.equal(m.mergeRecipe(recipe.id),true)
    assert.equal(m.allies.length,1);assert.equal(m.allies[0].tier,2);assert.equal(m.allies[0].form,recipe.id)
    assert.equal(m.allies[0].kind,COMPANIONS[recipe.id].kind);assert.equal(m.allies[0].maxHp,companionHP(m.allies[0]))
    assert.equal(m.status,'running');assert.equal(m.mergeRecipe(recipe.id),false);assert.equal(m.merges,1)
  }
})
test('一级可同时保留多种配方，材料不足、死亡材料及非配方状态都不能消耗伙伴',()=>{
  const m=arena();m.recruit('melee');m.recruit('melee');m.recruit('ranged');m.recruit('ranged')
  assert.deepEqual(m.fusionRecipes.filter(r=>r.ready).map(r=>r.id),['bulwark','swordwind'])
  assert.equal(m.mergeRecipe('bulwark'),false)
  m.openFusion();assert.equal(m.mergeRecipe('guard'),false);assert.equal(m.allies.length,4)
  m.allies.filter(a=>a.kind==='melee').forEach(a=>a.hp=0)
  assert.equal(m.mergeRecipe('bulwark'),false);assert.equal(m.merges,0)
  m.closeFusion();assert.equal(m.status,'running')
})
test('三个同配方二级自动合成三级，相同体系的不同配方不能混合升阶',()=>{
  const m=arena();craft(m,'guard');craft(m,'bulwark');craft(m,'bulwark')
  assert.equal(m.allies.length,3);assert.ok(m.allies.every(a=>a.kind==='melee'&&a.tier===2))
  craft(m,'bulwark')
  assert.equal(m.allies.length,2);assert.ok(m.allies.some(a=>a.form==='guard'&&a.tier===2));assert.ok(m.allies.some(a=>a.form==='bulwark'&&a.tier===3))
})
test('四条路线都能升到三级，三级封顶且死亡二级不参与自动合成',()=>{
  for(const recipe of RECIPES){
    const m=arena();for(let i=0;i<9;i++)craft(m,recipe.id)
    assert.equal(m.allies.length,3);assert.ok(m.allies.every(a=>a.form===recipe.id&&a.tier===3))
    m.mergeAllies();assert.equal(m.allies.length,3)
  }
  const m=arena();const first=craft(m,'guard');craft(m,'guard');first.hp=0;craft(m,'guard')
  assert.ok(!m.allies.some(a=>a.tier===3))
})
test('满编候补不参战、不突破编队上限，并可参与混合配方',()=>{
  const m=arena();m.capacity=3;m.recruit('melee');m.recruit('melee');m.recruit('ranged');m.recruit('ranged')
  const pending=m.pendingAlly!;assert.ok(pending);assert.equal(m.allies.length,3)
  tick(m,.3);assert.equal(pending.attackSeq,0);assert.ok(!m.allies.includes(pending))
  m.openFusion();assert.ok(m.mergeRecipe('swordwind'));assert.equal(m.pendingAlly,undefined)
  assert.equal(m.allies.length,2);assert.ok(m.allies.some(a=>a.form==='swordwind'))
})
test('未用于配方的候补在腾位后入队，已战死伙伴不会被多余捕获治疗复活',()=>{
  const m=arena();m.capacity=3;for(let i=0;i<3;i++)m.recruit('melee');m.recruit('ranged')
  const pending=m.pendingAlly!;m.openFusion();m.mergeRecipe('guard')
  assert.ok(m.allies.includes(pending));assert.equal(m.pendingAlly,undefined)
  const n=arena();n.capacity=2;n.recruit('melee');n.recruit('ranged');n.recruit('ranged')
  const reserve=n.pendingAlly!;n.allies[0].hp=0;n.update(.01,idle)
  assert.ok(n.allies.includes(reserve));assert.equal(n.pendingAlly,undefined);assert.equal(n.allies.length,2)
})
test('候补也继承新选的生命强化，回旋盾卫的独立生命基数不会被强化重置',()=>{
  const m=arena();m.capacity=3;const guard=craft(m,'bulwark');m.recruit('melee');m.recruit('melee');m.recruit('ranged')
  const pending=m.pendingAlly!,hp=pending.maxHp,guardHp=guard.maxHp
  m.status='upgrade';m.upgradeChoices=[UPGRADES.find(u=>u.id==='shield')!];m.chooseUpgrade('shield')
  assert.equal(pending.maxHp,hp*1.2);assert.equal(guard.maxHp,guardHp*1.2)
})
test('融合聚拢与护卫显形同步暂停、升级、配方菜单，动画结束才参战，重开清空',()=>{
  const m=arena(),a=craft(m,'swordwind');foe(m,1800)
  assert.equal(a.mergeTime,.65);assert.equal(fusionPose(a.mergeTime).bodyAlpha,0)
  for(const status of ['paused','upgrade','fusion'] as const){
    m.status=status;const before=structuredClone({time:m.time,allies:m.allies,effects:m.fusionEffects})
    tick(m,1);assert.deepEqual({time:m.time,allies:m.allies,effects:m.fusionEffects},before)
  }
  m.status='running';tick(m,.3);assert.equal(a.attackSeq,0);tick(m,.4);assert.ok(a.attackSeq>0)
  assert.equal(fusionPose(a.mergeTime).bodyAlpha,1);assert.equal(m.fusionEffects.length,0)
  const reset=new GameModel();assert.equal(reset.pendingAlly,undefined);assert.equal(reset.fusionEffects.length,0)
})
test('剑风的中短距离攻击内置穿透，贯穿强化增加穿透数，继承远程而不叠加近战能力',()=>{
  const m=arena();m.abilities={pierce:2,frost:2,chain:1,barrier:3};const a=settled(m,'swordwind')
  const enemies=[1760,1810,1860,1910,1960].map(x=>foe(m,x))
  m.update(.01,idle);const blade=m.bullets.find(b=>b.weapon==='swordwind')!
  assert.ok(blade);assert.equal(blade.range,330);assert.equal(blade.pierce,4);assert.equal(blade.frost,2);assert.equal(blade.chain,1)
  tick(m,.6);assert.ok(enemies.every(e=>e.hp<100));assert.ok(enemies.every(e=>(e.slow??0)>0))
  assert.equal(a.barrierCd,0)
})
test('剑风不会越过射程攻击，内置穿透不会无限重复命中同一敌人',()=>{
  const m=arena();settled(m,'swordwind');const e=foe(m,1900)
  m.update(.01,idle);tick(m,.9)
  assert.equal(e.hp,97.7);assert.ok(!m.bullets.some(b=>b.weapon==='swordwind'))
  const n=arena();settled(n,'swordwind');foe(n,2200);n.update(.01,idle)
  assert.ok(!n.bullets.some(b=>b.weapon==='swordwind'))
})
test('回旋盾卫投盾命中首个目标后回收，不继承远程弹射与寒霜，返回不重复伤害',()=>{
  const m=arena();m.abilities={chain:3,frost:3,pierce:3};const a=settled(m,'bulwark');a.cd=100
  const e=foe(m,1900),behind=foe(m,1980)
  m.update(.01,idle);const shield=m.bullets.find(b=>b.weapon==='shield')!
  assert.ok(shield);assert.equal(shield.frost,0);assert.equal(shield.chain,0);assert.equal(shield.split,false)
  tick(m,1);assert.ok(e.hp<100);assert.equal(behind.hp,100);assert.equal(m.hasFlyingShield(a),false)
  assert.equal(e.hp,98.7)
})
test('飞盾一趟最多抵挡两颗敌弹，三级最多三颗，离手时取消自身格挡',()=>{
  for(const tier of [2,3]){
    const m=arena(),a=settled(m,'bulwark');a.tier=tier;a.cd=100;foe(m,1900)
    m.update(.01,idle);const shield=m.bullets.find(b=>b.weapon==='shield')!
    const shots=Array.from({length:4},()=>enemyBullet(m,shield.x+30,shield.y))
    m.update(.01,idle);assert.equal(shots.filter(b=>b.life<=0).length,tier===3?3:2)
    const hp=a.hp;enemyBullet(m,a.x,a.y);m.update(.01,idle)
    assert.ok(a.hp<hp);assert.equal(a.guardShieldCd,0)
  }
})
test('回旋盾卫持盾时可格挡，盾击和近战能力生效，精英不被飞盾推动',()=>{
  const m=arena(),a=settled(m,'bulwark');a.throwCd=100;a.cd=100
  enemyBullet(m,a.x,a.y);const hp=a.hp;m.update(.01,idle)
  assert.equal(a.hp,hp);assert.equal(a.guardShieldCd,3.5)
  const n=arena(),b=settled(n,'bulwark');b.cd=100;const e=foe(n,1900,900,true),x=e.x
  n.update(.01,idle);tick(n,.7);assert.ok(e.hp<100);assert.equal(e.x,x)
})
test('新护卫的攻击遵守捕获目标和退化保护，回旋盾卫阵亡时飞盾清理',()=>{
  for(const form of ['bulwark','swordwind'] as const){
    const m=arena(),a=settled(m,form),reserved=foe(m,1770),weak=foe(m,1800);weak.weakened=3
    m.weaponCooldown=0;tick(m,.5)
    assert.equal(reserved.hp,100);assert.equal(weak.hp,100)
    m.weaponCooldown=100;tick(m,.1)
    a.hp=0;m.update(.01,idle);assert.ok(!m.bullets.some(b=>b.ownerId===a.id))
  }
})
test('配方界面冻结飞盾位置、挡弹余量与回收冷却，关闭后继续',()=>{
  const m=arena(),a=settled(m,'bulwark');foe(m,1900);m.update(.01,idle)
  m.openFusion();const before=structuredClone({bullets:m.bullets,cd:a.throwCd,time:m.time})
  tick(m,1);assert.deepEqual({bullets:m.bullets,cd:a.throwCd,time:m.time},before)
  m.closeFusion();tick(m,.05);assert.ok(m.time>before.time)
})
test('四条路线与全部三级能力共同战斗，弹幕、合成特效和数值保持有界',()=>{
  const m=arena();m.capacity=10;m.player.hp=m.player.maxHp=100000
  for(const ability of ABILITIES)m.abilities[ability.id]=3
  for(const form of RECIPES)for(let i=0;i<3;i++)craft(m,form.id)
  for(let i=0;i<30;i++)foe(m,1800+i%8*40,760+Math.floor(i/8)*55)
  for(let i=0;i<1200;i++){
    m.update(.05,idle)
    assert.ok(m.allies.length<=m.capacity);assert.ok(m.fusionEffects.length<=16)
    assert.ok(m.bullets.filter(b=>b.team==='ally'&&b.life>0).length<=ALLY_BULLET_LIMIT)
    assert.ok(m.allies.every(a=>Number.isFinite(a.hp)&&a.tier<=3&&RECIPES.some(r=>r.id===companionForm(a))))
  }
})

test('融合显形结束前不会成为近战目标、承受敌弹或精英群伤，也不会替队友挡弹',()=>{
  for(const attack of ['melee','bullet','slam']){
    const m=arena();m.player.x=1600
    for(let i=0;i<3;i++)m.recruit('melee',1900,900)
    m.openFusion();m.mergeRecipe('guard');const a=m.allies[0],hp=a.hp
    const e=foe(m,1920);e.frozen=0;e.cd=0
    let shot:ReturnType<typeof enemyBullet>|undefined
    if(attack==='bullet'){e.cd=100;shot=enemyBullet(m,a.x,a.y)}
    if(attack==='slam'){e.elite=true;e.slam={phase:'windup',time:1.19,x:a.x,y:a.y,radius:120}}
    m.update(.02,idle)
    assert.equal(a.hp,hp);assert.ok((a.mergeTime??0)>0);assert.equal(fusionPose(a.mergeTime).bodyAlpha,0)
    if(attack==='melee')assert.equal(e.attackSeq,0)
    if(shot)assert.ok(shot.life>0)
  }
})

test('剑风与二级弹射组合仍遵守累计飞行射程，不会借命中中心重定位额外前进',()=>{
  const m=arena();m.abilities.chain=2;settled(m,'swordwind')
  const enemies=[1800,1860,1920,1980,2120].map(x=>foe(m,x))
  m.update(.01,idle);const blade=m.bullets.find(b=>b.weapon==='swordwind')!,origin=blade.x-blade.vx*.01
  for(let i=0;i<90;i++){
    m.update(.01,idle)
    assert.ok(blade.distance<=(blade.range??330));assert.ok(blade.x<=origin+330+.001)
  }
  assert.ok(enemies.slice(0,4).every(e=>e.hp<100));assert.equal(enemies[4].hp,100)
})
