import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel, walkable, DURATION } from '../src/game/model.ts'
const idle={x:0,y:0,aimX:1200,aimY:900,fire:false,dash:false,rally:false}
test('自动攻击：无需按攻击键即可捕获普通怪物',()=>{
  const m=new GameModel(()=>.5);m.start();m.enemies=[];m.spawnEnemy('ranged',1150,945)
  for(let i=0;i<30;i++)m.update(.05,idle)
  assert.ok(m.captured>=1);assert.ok(m.allies.some(a=>a.kind==='ranged'))
})
test('三个同类一级合成二级，九个同类合成三级',()=>{
  const m=new GameModel();for(let i=0;i<3;i++)m.recruit('melee')
  assert.equal(m.allies.length,1);assert.equal(m.allies[0].tier,2)
  for(let i=0;i<6;i++)m.recruit('melee')
  assert.equal(m.allies.length,1);assert.equal(m.allies[0].tier,3);assert.equal(m.merges,4)
})
test('不同类型和不同等级不会混合合成',()=>{
  const m=new GameModel();m.recruit('melee');m.recruit('melee');m.recruit('ranged')
  assert.equal(m.allies.length,3);assert.ok(m.allies.every(a=>a.tier===1))
  m.recruit('melee');m.recruit('melee');m.recruit('ranged')
  assert.equal(m.allies.filter(a=>a.kind==='melee'&&a.tier===2).length,1)
  assert.equal(m.allies.filter(a=>a.kind==='melee'&&a.tier===1).length,1)
})
test('三级封顶，三只三级不会继续合成',()=>{
  const m=new GameModel();for(let i=0;i<27;i++)m.recruit('ranged')
  assert.equal(m.allies.length,3);assert.ok(m.allies.every(a=>a.tier===3))
})
test('满编时仍能捕获第三个同类触发合成，不匹配则治疗',()=>{
  const m=new GameModel();m.capacity=3;m.recruit('melee');m.recruit('melee');m.recruit('ranged');m.recruit('melee')
  assert.equal(m.allies.length,2);assert.equal(m.allies[1].tier,2)
  const n=new GameModel();n.capacity=2;n.recruit('melee');n.recruit('ranged');n.allies[0].hp=10;n.recruit('ranged')
  assert.equal(n.allies.length,2);assert.equal(n.allies[0].hp,22)
})
test('暂停和升级时战斗、计时均冻结，强化仅能选择一次',()=>{
  const m=new GameModel();m.start();m.togglePause();m.update(.05,idle);assert.equal(m.time,0)
  m.togglePause();m.xp=100;m.update(.05,idle);assert.equal(m.status,'upgrade');const time=m.time
  m.update(.05,idle);assert.equal(m.time,time)
  const choice=m.upgradeChoices[0];m.chooseUpgrade(choice.id);assert.equal(m.status,'running');const hp=m.player.maxHp
  m.chooseUpgrade(choice.id);assert.equal(m.player.maxHp,hp)
})
test('道路碰撞阻止穿过建筑，斜向移动不会增加速度',()=>{
  assert.ok(walkable(820,945));assert.ok(!walkable(1600,450))
  const a=new GameModel(),b=new GameModel();a.start();b.start();a.enemies=[];b.enemies=[]
  const p={...a.player};a.update(.05,{...idle,x:1});b.update(.05,{...idle,x:1,y:1})
  assert.ok(Math.abs(Math.hypot(a.player.x-p.x,a.player.y-p.y)-Math.hypot(b.player.x-p.x,b.player.y-p.y))<.001)
})
test('家门在十分钟前锁定，满十分钟抵达后胜利',()=>{
  const m=new GameModel();m.start();m.enemies=[];m.player.x=4820;m.time=599;m.update(.05,idle)
  assert.notEqual(m.status,'won');m.time=600;m.update(.05,idle);assert.equal(m.status,'won')
})
test('十分钟压力流程：五段推进、精英刷新、敌群受限、全程无数值异常',()=>{
  let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const m=new GameModel(random);m.start();m.player.hp=m.player.maxHp=100000;let sawElite=false,maxEnemies=0
  for(let i=0;i<=DURATION*20+40;i++){
    if(m.status==='upgrade')m.chooseUpgrade(m.upgradeChoices[0].id)
    const target=1000+Math.min(4,Math.floor(m.time/120))*900
    const dx=target-m.player.x
    m.update(.05,{...idle,x:Math.abs(dx)>20?Math.sign(dx):0})
    sawElite ||= m.enemies.some(a=>a.elite);maxEnemies=Math.max(maxEnemies,m.enemies.length)
    assert.ok(Number.isFinite(m.player.x)&&Number.isFinite(m.player.hp));assert.ok(m.enemies.length<=85);assert.ok(m.allies.every(a=>a.tier<=3))
    if(m.status==='won')break
  }
  assert.equal(m.stage,4);assert.ok(sawElite);assert.ok(maxEnemies>10);assert.ok(m.time>=600)
  m.player.x=4820;m.player.y=900;if(m.status==='upgrade')m.chooseUpgrade(m.upgradeChoices[0].id);m.update(.05,idle);assert.equal(m.status,'won')
})
