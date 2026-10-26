import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel } from '../src/game/model.ts'
const idle={x:0,y:0,fire:false,dash:false,rally:false}
function arena(){const m=new GameModel(()=>.5);m.start();m.enemies=[];m.player.x=1600;m.player.y=900;return m}
function add(m:GameModel,kind:'melee'|'ranged',x:number,y=900,elite=false){const e=m.spawnEnemy(kind,2100,900,elite)!;Object.assign(e,{x,y,cd:100});return e}
test('近战和远程偏好只选对应普通怪，找不到时不回退到其他类型或精英',()=>{
  const m=arena(),melee=add(m,'melee',1650),ranged=add(m,'ranged',1900);add(m,'melee',1630,900,true)
  m.setCapturePreference('ranged');assert.equal(m.weaponTarget!.enemy,ranged);assert.equal(m.weaponTarget!.inRange,false)
  m.update(.01,{...idle,fire:true});assert.equal(m.weaponCooldown,0)
  m.enemies=m.enemies.filter(e=>e!==ranged);assert.equal(m.weaponTarget,undefined)
  m.setCapturePreference('melee');assert.equal(m.weaponTarget!.enemy,melee)
  m.setCapturePreference('nearest');assert.equal(m.weaponTarget!.enemy.elite,true)
})
test('锁定后近处出现其他敌人不会抢目标，超出保留范围后自动重选',()=>{
  const m=arena(),first=add(m,'ranged',1800)
  m.setCapturePreference('ranged');m.update(.01,idle)
  const closer=add(m,'ranged',1700)
  assert.equal(m.weaponTarget!.enemy,first)
  first.x=m.player.x+m.weaponRange+201
  assert.equal(m.weaponTarget!.enemy,closer)
})
test('目标死亡、离开敌群或切换偏好会重新选择，重开恢复就近',()=>{
  const m=arena(),first=add(m,'melee',1700),second=add(m,'ranged',1800)
  m.update(.01,idle);first.hp=0;assert.equal(m.weaponTarget!.enemy,second)
  m.enemies=[];assert.equal(m.weaponTarget,undefined)
  m.cycleCapturePreference();assert.equal(m.capturePreference,'melee')
  m.cycleCapturePreference();assert.equal(m.capturePreference,'ranged')
  m.cycleCapturePreference();assert.equal(m.capturePreference,'nearest')
  m.status='upgrade';m.setCapturePreference('ranged');assert.equal(m.capturePreference,'nearest')
  assert.equal(new GameModel().capturePreference,'nearest')
})
test('瞄准明确提示挡路怪，捕获弹按实际路径先撞到挡路目标',()=>{
  const m=arena(),target=add(m,'ranged',1800),blocker=add(m,'melee',1700)
  m.setCapturePreference('ranged');assert.equal(m.weaponTarget!.enemy,target);assert.equal(m.weaponTarget!.blockedBy,blocker)
  m.update(.05,{...idle,fire:true});for(let i=0;i<8;i++)m.update(.05,idle)
  assert.equal(m.captured,1);assert.equal(m.allies[0].kind,'melee');assert.ok(m.enemies.includes(target))
})
test('偏好切换与 HUD 读取不消耗出手或冷却，暂停不会因目标移动而主动重选',()=>{
  const m=arena(),a=add(m,'ranged',1800);m.setCapturePreference('ranged');m.update(.01,idle)
  m.togglePause();const before=m.weaponTarget!.enemy.id
  for(let i=0;i<20;i++){void m.weaponTarget;m.update(.05,idle)}
  assert.equal(m.weaponTarget!.enemy.id,before);assert.equal(m.weaponCooldown,0);assert.equal(m.bullets.length,0)
  assert.equal(m.weaponTarget!.enemy,a)
})

test('不同半径的敌人按碰撞边界首次接触排序，阻挡提示与实际命中一致',()=>{
  const m=arena();add(m,'ranged',1700)
  const normal=add(m,'melee',1625,923),elite=add(m,'melee',1640,900,true)
  for(const e of m.enemies)e.frozen=10
  m.setCapturePreference('ranged');assert.equal(m.weaponTarget!.blockedBy,elite)
  const hp=elite.hp;m.update(.05,{...idle,fire:true})
  assert.equal(m.captured,0);assert.equal(elite.hp,hp-1);assert.equal(normal.hp,1)
})
