import test from 'node:test'
import assert from 'node:assert/strict'
import { ABILITIES, type AbilityId } from '../src/game/abilities.ts'
import { ALLY_BULLET_LIMIT, GameModel } from '../src/game/model.ts'

const idle={x:0,y:0,fire:false,dash:false,rally:false}
function arena(){const m=new GameModel(()=>.5);m.start();m.enemies=[];m.player.x=1600;m.player.y=900;m.weaponCooldown=100;m.nextXp=100000;return m}
function learn(m:GameModel,id:AbilityId,rank=1){
  for(let i=m.rank(id);i<rank;i++){m.status='upgrade';m.upgradeChoices=[m.availableUpgrades.find(u=>u.ability===id)!];m.chooseUpgrade(`ability:${id}`)}
}
function enemy(m:GameModel,x:number,y=900,hp=100){const e=m.spawnEnemy('melee',2100,900)!;Object.assign(e,{x,y,hp,maxHp:hp,cd:100});return e}
function tick(m:GameModel,time:number){for(let i=0;i<Math.ceil(time/.01);i++)m.update(.01,idle)}
function allyBullet(m:GameModel,x:number,y=900,extra={}){m.bullets.push({id:99000+m.bullets.length,x,y,vx:480,vy:0,life:2,team:'ally',damage:1,distance:0,hitIds:[],...extra})}

test('八条能力各能升三级，展示下一等级且满级退出候选池；只能在升级选择时生效',()=>{
  const m=arena();assert.equal(ABILITIES.length,8)
  for(const ability of ABILITIES){
    for(let rank=1;rank<=3;rank++){
      const card=m.availableUpgrades.find(u=>u.ability===ability.id)!
      assert.equal(card.rank,rank);assert.equal(card.description,ability.levels[rank-1])
      m.status='upgrade';m.upgradeChoices=[card];m.chooseUpgrade(card.id);assert.equal(m.rank(ability.id),rank)
      m.chooseUpgrade(card.id);assert.equal(m.rank(ability.id),rank)
    }
    assert.ok(!m.availableUpgrades.some(u=>u.ability===ability.id))
  }
})
test('三选一始终含能力，已学能力未满级时提供续升机会',()=>{
  const m=arena();learn(m,'chain');m.xp=m.nextXp;m.update(.01,idle)
  assert.equal(m.status,'upgrade');assert.equal(m.upgradeChoices.length,3)
  assert.ok(m.upgradeChoices.some(u=>u.ability==='chain'&&u.rank===2))
  assert.equal(new Set(m.upgradeChoices.map(u=>u.id)).size,3)
})
test('能力等级与伙伴等级独立，合成和新捕获不会清空能力，重开清空',()=>{
  const m=arena();learn(m,'barrier',3)
  for(let i=0;i<3;i++)m.recruit('melee')
  assert.equal(m.allies[0].tier,2);assert.equal(m.rank('barrier'),3)
  m.recruit('melee');assert.equal(m.rank('barrier'),3)
  assert.deepEqual(new GameModel().abilities,{})
})
test('护卫屏障各等级抵挡真实敌弹并使用对应冷却，三级产生击退',()=>{
  for(const rank of [1,2,3]){
    const m=arena();learn(m,'barrier',rank);m.recruit('melee');const ally=m.allies[0];ally.cd=100
    const foe=enemy(m,ally.x+60);const before=foe.x,hp=ally.hp
    m.bullets.push({id:999,x:ally.x,y:ally.y,vx:-200,vy:0,life:1,team:'enemy',damage:8,distance:0})
    m.update(.01,idle)
    assert.equal(ally.hp,hp);assert.equal(m.player.hp,100);assert.equal(ally.barrierCd,[0,8,5,4][rank]);assert.equal(m.bullets.length,0)
    assert.ok(m.abilityEffects.some(e=>e.kind==='barrier'))
    if(rank===3)assert.ok(foe.x>before)
  }
})
test('重锤按等级次数触发，三级重击在扇形内追加伤害',()=>{
  for(const rank of [1,2,3]){
    const m=arena();learn(m,'smash',rank);m.recruit('melee');const ally=m.allies[0],foe=enemy(m,1640)
    const count=rank===1?4:3
    for(let i=0;i<count;i++){Object.assign(foe,{x:1640,y:900});ally.cd=0;m.update(.01,idle)}
    assert.ok(m.abilityEffects.some(e=>e.kind==='smash'));assert.ok(foe.x>1640)
    if(rank===3)assert.ok(foe.hp<100-count*.65)
  }
})
test('掩护减伤不因多个护卫叠加，三级受伤会回援且不绕过冷却',()=>{
  for(const count of [1,2]){
    const m=arena();learn(m,'cover',3);for(let i=0;i<count;i++)m.recruit('melee')
    for(const ally of m.allies)ally.cd=100
    const e=enemy(m,1620);e.cd=0;m.update(.01,idle)
    assert.ok(Math.abs(m.player.hp-(100-10*(1+.01/1200)*.78))<.001)
    assert.ok(m.allies.every(a=>a.escort===2&&a.escortCd===8))
    m.player.invincible=0;e.cd=0;m.update(.01,idle)
    assert.ok(m.allies.every(a=>(a.escortCd??0)<8))
  }
})
test('射手弹射不重复命中同一目标，三级末次爆裂有范围反馈',()=>{
  const m=arena(),first=enemy(m,1700),second=enemy(m,1800)
  allyBullet(m,1690,900,{chain:2,burst:true})
  m.update(.01,idle);assert.ok(m.abilityEffects.some(e=>e.kind==='chain'));tick(m,.39)
  assert.equal(first.hp,99);assert.ok(Math.abs(second.hp-98.8)<.0001)
  assert.ok(m.abilityEffects.some(e=>e.kind==='burst'))
  assert.equal(m.bullets.length,0)
})
test('贯穿不会每帧重复命中，分裂弹保留寒霜但不能继续连锁',()=>{
  const m=arena(),e=enemy(m,1700)
  allyBullet(m,1690,900,{pierce:1,split:true,frost:2,chain:1})
  m.update(.01,idle)
  const children=m.bullets.filter(b=>b.secondary)
  assert.equal(children.length,2)
  assert.ok(children.every(b=>b.frost===2&&!b.split&&!b.pierce&&!b.chain&&!b.burst&&b.hitIds?.includes(e.id)))
  tick(m,.05);assert.equal(e.hp,99)
})
test('贯穿在一段弹道按前后顺序命中，不受敌人数组顺序影响',()=>{
  const m=arena(),far=enemy(m,1724),near=enemy(m,1700)
  allyBullet(m,1688,900,{pierce:1})
  m.update(.05,idle);assert.equal(near.hp,99)
  tick(m,.05);assert.equal(far.hp,99);assert.equal(near.hp,99)
})
test('寒霜减慢移动，三级累计命中冻结；精英冻结更短且有再次冻结免疫',()=>{
  for(const elite of [false,true]){
    const m=arena(),e=enemy(m,1700);e.elite=elite
    for(let i=0;i<3;i++){allyBullet(m,e.x-4,e.y,{frost:3});m.update(.01,idle)}
    assert.equal(e.slowRate,.4);assert.equal(e.frozen,elite?.2:.7)
    const x=e.x;tick(m,.1);assert.equal(e.x,x)
    for(let i=0;i<4;i++){allyBullet(m,e.x-4,e.y,{frost:3});m.update(.01,idle)}
    assert.ok((e.frozen??0)<(elite?.2:.7))
  }
})
test('救护优先低生命比例伙伴，三级溢出护盾吸收伤害后正常到期',()=>{
  const m=arena();learn(m,'medic',3);m.recruit('melee');m.recruit('ranged')
  const [a,b]=m.allies;a.hp=a.maxHp-4;b.hp=b.maxHp-12
  tick(m,6.02);assert.equal(a.hp,a.maxHp);assert.equal(b.hp,b.maxHp)
  assert.equal(a.shield,12);assert.equal(b.shield,4)
  // Stop later pulses so expiry is independently observable.
  m.abilities.medic=0;m.player.x=1900
  m.bullets.push({id:999,x:a.x,y:a.y,vx:0,vy:0,team:'enemy',life:1,damage:8,distance:0})
  m.update(.01,idle);assert.equal(a.hp,a.maxHp);assert.equal(a.shield,4)
  tick(m,6.1);assert.equal(a.shield,0)
})
test('收编鼓舞刷新而非叠加持续时间，三级合成护盾不累计',()=>{
  const m=arena();learn(m,'inspire',3);m.recruit('melee');assert.equal(m.inspireTime,6)
  tick(m,1);m.recruit('melee');assert.equal(m.inspireTime,6)
  m.recruit('melee');assert.equal(m.allies[0].shield,12);assert.equal(m.allies[0].shieldTime,5)
  m.recruit('ranged');assert.equal(m.allies[1].shield??0,0)
})
test('能力弹射、爆裂与重击都保留瞄准目标和精英退化怪',()=>{
  const m=arena();m.weaponCooldown=0
  const target=enemy(m,1680),weak=enemy(m,1690);weak.weakened=3.2
  const other=enemy(m,1700)
  allyBullet(m,1698,900,{chain:2,burst:true,split:true,frost:3,pierce:2})
  tick(m,.05)
  assert.equal(target.hp,100);assert.equal(weak.hp,100);assert.ok(other.hp<100)
})
test('暂停和升级冻结能力冷却、护盾、冰冻、鼓舞与特效',()=>{
  const m=arena();learn(m,'barrier',3);learn(m,'inspire',3);m.recruit('melee');const e=enemy(m,1700)
  Object.assign(m.allies[0],{barrierCd:3,shield:12,shieldTime:4,escort:2,escortCd:8})
  Object.assign(e,{slow:2,frozen:.7,frostWindow:2,freezeImmunity:3})
  for(const status of ['paused','upgrade'] as const){
    m.status=status;const before=structuredClone({allies:m.allies,enemies:m.enemies,fx:m.abilityEffects,inspire:m.inspireTime})
    tick(m,2)
    assert.deepEqual({allies:m.allies,enemies:m.enemies,fx:m.abilityEffects,inspire:m.inspireTime},before)
  }
})
test('所有能力满级与三级散射组合，长时间战斗遵守友弹和特效预算',()=>{
  const m=arena();for(const ability of ABILITIES)learn(m,ability.id,3)
  m.player.hp=m.player.maxHp=100000;m.capacity=10
  for(let i=0;i<27;i++)m.recruit('ranged')
  for(let i=0;i<9;i++)m.recruit('melee')
  for(let i=0;i<40;i++)enemy(m,1800+i%8*40,760+Math.floor(i/8)*55,1000)
  for(let i=0;i<1200;i++){
    m.update(.05,idle)
    assert.ok(m.bullets.filter(b=>b.team==='ally'&&b.life>0).length<=ALLY_BULLET_LIMIT)
    assert.ok(m.abilityEffects.length<=160)
    assert.ok(m.enemies.every(e=>Number.isFinite(e.hp)&&Number.isFinite(e.x)))
  }
})

test('寒霜累计窗口从首击计时，相邻命中不足两秒但总跨度超过两秒不会冻结',()=>{
  const m=arena(),e=enemy(m,1900)
  const hit=()=>{allyBullet(m,e.x-4,e.y,{frost:3});m.update(.01,idle)}
  hit();tick(m,1.1);hit();tick(m,1.1);hit()
  assert.equal(e.frozen??0,0);assert.equal(e.frostHits,1)
})
test('满编且不能合成时的成功捕获，依然刷新收编鼓舞',()=>{
  const m=arena();learn(m,'inspire',2);m.capacity=2;m.recruit('melee');m.recruit('ranged')
  tick(m,1);assert.ok(m.inspireTime<5)
  m.recruit('ranged');assert.equal(m.allies.length,2);assert.equal(m.inspireTime,5)
  assert.equal(m.captured,3)
})
