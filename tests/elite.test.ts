import test from 'node:test'
import assert from 'node:assert/strict'
import { ELITE_RULES, ENEMY_BULLET_LIMIT, GameModel, rangedSpawnChance } from '../src/game/model.ts'
import { eliteSlamPose } from '../src/game/animation.ts'

const idle={x:0,y:0,fire:false,dash:false,rally:false}
function arena(){const m=new GameModel(()=>.5);m.start();m.enemies=[];m.player.x=1600;m.player.y=900;return m}
function brute(){const m=arena(),enemy=m.spawnEnemy('melee',2000,900,true)!;Object.assign(enemy,{x:1650,y:900,cd:0});return {m,enemy}}

test('精英45秒首次出现，此后每60秒刷新并伴随远程增援',()=>{
  const m=arena();m.time=44.9;m.update(.05,idle)
  assert.equal(m.elitesSpawned,0)
  m.time=45;m.update(.01,idle)
  assert.equal(m.elitesSpawned,1);assert.ok(m.enemies.filter(e=>e.kind==='ranged').length>=2)
  assert.ok(m.enemies.find(e=>e.elite)!.hp>=48)
  m.time=104.9;m.update(.01,idle);assert.equal(m.elitesSpawned,1)
  m.time=105.1;m.update(.01,idle);assert.equal(m.elitesSpawned,2)
})
test('敌群满员仍能定时生成精英，同时保持85敌人和3精英上限',()=>{
  const m=arena();for(let i=0;i<85;i++)m.spawnEnemy('ranged',2000,900)
  m.time=45;m.update(.01,idle);assert.equal(m.enemies.length,85);assert.equal(m.elitesSpawned,1)
  m.time=105.1;m.update(.01,idle);m.time=165.2;m.update(.01,idle)
  assert.equal(m.enemies.filter(e=>e.elite).length,3)
  m.time=225.3;m.update(.01,idle);assert.equal(m.elitesSpawned,3);assert.ok(m.enemies.length<=85)
  assert.equal(m.spawnEnemy('melee',2000,900,true),undefined)
})
test('精英生命随时间与编队战力增加，捕获瞄准始终跳过精英',()=>{
  const {m,enemy}=brute(),initial=enemy.maxHp
  assert.equal(m.weaponTarget,undefined)
  const normal=m.spawnEnemy('ranged',2000,900)!;Object.assign(normal,{x:1800,y:900,cd:100})
  assert.equal(m.weaponTarget!.enemy,normal)
  m.time=180;m.recruit('ranged');m.recruit('ranged');m.recruit('ranged')
  const stronger=m.spawnEnemy('melee',2000,900,true)!
  assert.ok(stronger.maxHp>initial)
})
test('皮搋子击杀精英也不会捕获，击破奖励与普通怪收编分开',()=>{
  const {m,enemy}=brute();enemy.hp=.5;enemy.cd=100
  m.bullets.push({id:999,x:enemy.x,y:enemy.y,vx:0,vy:0,life:1,team:'rope',damage:1,distance:0})
  m.update(.01,idle)
  assert.equal(m.captured,0);assert.equal(m.allies.length,0);assert.equal(m.eliteKills,1)
  assert.equal(m.enemies.length,0);assert.equal(m.pickups.length,1);assert.equal(m.xp,4)
})
test('武器就绪不会为精英保留靶位，僚机仍会主动输出',()=>{
  const {m,enemy}=brute();enemy.x=1800;enemy.cd=100;m.recruit('ranged')
  for(let i=0;i<40;i++)m.update(.01,idle)
  assert.equal(m.weaponCooldown,0);assert.ok(m.allies[0].attackSeq>0)
  assert.ok(m.bullets.some(b=>b.team==='ally')||enemy.hp<enemy.maxHp)
})
test('精英蓄力锁定地面位置且不贴脸平砍，红圈结束前没有群伤',()=>{
  const {m,enemy}=brute();m.update(.01,idle)
  const initial={x:enemy.x,y:enemy.y};assert.equal(enemy.slam!.phase,'windup')
  for(let i=0;i<20;i++)m.update(.05,idle)
  assert.equal(m.player.hp,100);assert.equal(enemy.x,initial.x);assert.equal(enemy.y,initial.y)
  assert.equal(enemy.slam!.x,initial.x);assert.equal(enemy.slam!.y,initial.y);assert.equal(m.shockwaves.length,0)
})
test('砸地同时伤害圈内主角和僚机，每次只判定一次，圈外不受伤',()=>{
  const {m,enemy}=brute();m.recruit('melee',enemy.x,enemy.y)
  const ally=m.allies[0];ally.cd=100;enemy.slam={phase:'windup',time:ELITE_RULES.windup-.01,x:enemy.x,y:enemy.y,radius:155}
  const allyHp=ally.hp;m.update(.02,idle)
  assert.ok(m.player.hp<100);assert.ok(ally.hp<allyHp);assert.equal(m.shockwaves.length,1);assert.equal(enemy.attackSeq,1)
  const hp=m.player.hp,after=ally.hp
  for(let i=0;i<10;i++)m.update(.05,idle)
  assert.equal(m.player.hp,hp);assert.equal(ally.hp,after);assert.equal(enemy.attackSeq,1)
  m.player.x=1950;enemy.slam={phase:'windup',time:1.19,x:1650,y:900,radius:155};m.update(.02,idle)
  assert.equal(m.player.hp,hp)
})
test('预警期间正常移动可以走出红圈，圈内也可以精准冲刺免伤',()=>{
  const {m,enemy}=brute();m.update(.01,idle)
  for(let i=0;i<26;i++)m.update(.05,{...idle,x:-1})
  assert.equal(enemy.slam!.phase,'recover');assert.equal(m.player.hp,100)
  const second=brute();second.enemy.slam={phase:'windup',time:1.19,x:1650,y:900,radius:155}
  second.m.update(.02,{...idle,x:1,dash:true});assert.equal(second.m.player.hp,100);assert.equal(second.m.player.hit,0)
})
test('僚机会撤离预警圈，并在技能收招后重新参与战斗',()=>{
  const {m,enemy}=brute();m.recruit('melee',enemy.x-10,enemy.y)
  const ally=m.allies[0];enemy.slam={phase:'windup',time:0,x:enemy.x,y:enemy.y,radius:155}
  const hp=ally.hp
  for(let i=0;i<25;i++)m.update(.05,idle)
  assert.equal(ally.hp,hp);assert.ok(Math.hypot(ally.x-enemy.x,ally.y-enemy.y)>155)
  for(let i=0;i<40;i++)m.update(.05,idle)
  assert.ok(ally.attackSeq>0)
})
test('暂停和升级冻结精英计时、预警、冲击波，重新开局清空技能',()=>{
  const {m,enemy}=brute();m.update(.05,idle);m.shockwaves.push({id:999,x:1600,y:900,radius:155,life:.5,max:.65})
  m.togglePause();const before=structuredClone({time:m.time,slam:enemy.slam,waves:m.shockwaves,countdown:m.eliteCountdown})
  for(let i=0;i<20;i++)m.update(.05,idle)
  assert.deepEqual({time:m.time,slam:enemy.slam,waves:m.shockwaves,countdown:m.eliteCountdown},before)
  m.status='upgrade';m.update(.05,idle);assert.equal(m.time,before.time)
  const reset=new GameModel();assert.equal(reset.shockwaves.length,0);assert.equal(reset.enemies.length,0);assert.equal(reset.eliteCountdown,45)
})
test('更多远程怪与提早散射仍遵守全场敌弹预算',()=>{
  assert.ok(rangedSpawnChance(0)>.4);assert.equal(rangedSpawnChance(600),.7)
  const m=arena();m.time=300
  for(let i=0;i<85;i++){const e=m.spawnEnemy('ranged',2000,900)!;Object.assign(e,{x:1800,y:900,cd:0})}
  for(let i=0;i<20;i++){m.update(.01,idle);assert.ok(m.bullets.filter(b=>b.team==='enemy').length<=ENEMY_BULLET_LIMIT)}
  assert.ok(m.bullets.filter(b=>b.team==='enemy').length>100)
})
test('精英抬手、保持、下砸和回弹采用对应帧，收招后恢复比例',()=>{
  const slam={phase:'windup' as const,time:0,x:0,y:0,radius:155}
  assert.equal(eliteSlamPose(slam).frame,4)
  assert.equal(eliteSlamPose({...slam,time:.8}).frame,5)
  const impact=eliteSlamPose({...slam,phase:'recover',time:0})
  assert.equal(impact.frame,6);assert.ok(impact.scaleY<1);assert.ok(impact.scaleX>1)
  const recovered=eliteSlamPose({...slam,phase:'recover',time:ELITE_RULES.recovery})
  assert.equal(recovered.frame,7);assert.equal(recovered.scaleX,1);assert.equal(recovered.scaleY,1)
  assert.deepEqual(eliteSlamPose(),{frame:0,scaleX:1,scaleY:1,lift:0})
})
