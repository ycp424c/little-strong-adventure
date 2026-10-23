import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel, type Kind } from '../src/game/model.ts'
import { DIRECTIONS, MonsterAnimator, hitReaction } from '../src/game/animation.ts'

const idle={x:0,y:0,fire:false,dash:false,rally:false}
function battle(kind:Kind='melee',distance=25,hp=5){
  const model=new GameModel(()=>.5);model.start();model.enemies=[];model.player.x=1600;model.player.y=900
  model.spawnEnemy(kind,2000,900)
  Object.assign(model.enemies[0],{x:1600+distance,y:900,hp,maxHp:hp,cd:0})
  return model
}
test('近战命中触发主角受击和敌人攻击，主角无敌时不重复触发反馈',()=>{
  const m=battle(),enemy=m.enemies[0]
  m.update(.01,idle)
  assert.ok(m.player.hp<100);assert.equal(m.player.hit,.22);assert.equal(enemy.attackSeq,1)
  assert.equal(m.impacts.filter(hit=>hit.team==='player').length,1)
  const hp=m.player.hp;enemy.cd=0;m.update(.01,idle)
  assert.equal(m.player.hp,hp);assert.equal(m.impacts.length,1);assert.equal(enemy.attackSeq,2)
})
test('近战和子弹都能触发僚机受击，伤害读数与生命扣减一致',()=>{
  for(const projectile of [false,true]){
    const m=battle('melee',200);m.recruit('melee',1820,900)
    const ally=m.allies[0],enemy=m.enemies[0];ally.cd=100
    if(projectile){enemy.cd=100;m.bullets.push({id:999,x:ally.x,y:ally.y,vx:0,vy:0,team:'enemy',life:1,damage:8,distance:0})}
    const hp=ally.hp;m.update(.01,idle)
    assert.ok(ally.hp<hp);assert.equal(ally.hit,.22)
    assert.ok(m.impacts.some(hit=>hit.team==='ally'));assert.ok(m.effects.some(effect=>effect.text.startsWith('−')))
  }
})
test('命中和捕获都留下冲击事件，目标被移除后反馈仍能完整播放',()=>{
  for(const hp of [1,5]){
    const m=battle('ranged',80,hp);m.enemies[0].cd=100
    m.update(.05,{...idle,fire:true});m.update(.05,idle)
    assert.ok(m.impacts.some(hit=>hit.team==='enemy'))
    if(hp===1){assert.equal(m.captured,1);assert.equal(m.enemies.length,0)}
    else assert.ok(m.enemies[0].hit>0)
    m.enemies=[];m.bullets=[]
    for(let i=0;i<10;i++)m.update(.05,idle)
    assert.equal(m.impacts.length,0)
  }
})
test('冲刺免伤不会显示伪受击，暂停冻结受击计时与冲击事件',()=>{
  const m=battle();m.update(.01,{...idle,x:1,dash:true})
  assert.equal(m.player.hp,100);assert.equal(m.player.hit,0);assert.equal(m.impacts.length,0)
  m.player.invincible=0;m.player.dash=0;m.enemies[0].x=m.player.x+20;m.enemies[0].cd=0;m.update(.01,idle)
  const hit=m.player.hit,impacts=structuredClone(m.impacts)
  m.togglePause();for(let i=0;i<20;i++)m.update(.05,idle)
  assert.equal(m.player.hit,hit);assert.deepEqual(m.impacts,impacts)
})
test('远程敌人与僚机只在实际发弹时推进攻击序号',()=>{
  const m=battle('ranged',440);m.recruit('ranged');m.weaponCooldown=10
  m.update(.01,idle);assert.equal(m.enemies[0].attackSeq,1);assert.equal(m.allies[0].attackSeq,0)
  for(let i=0;i<25;i++)m.update(.01,idle)
  assert.equal(m.allies[0].attackSeq,1);assert.equal(m.enemies[0].attackSeq,1)
  assert.ok(m.bullets.some(b=>b.team==='ally'));assert.ok(m.bullets.some(b=>b.team==='enemy'))
})
test('怪物八方向各播放四帧行走和四帧攻击，攻击锁向后恢复真实走位',()=>{
  DIRECTIONS.forEach((direction,i)=>{
    const animation=new MonsterAnimator(),angle=i*Math.PI/4,walking=new Set<number>(),attacking=new Set<number>()
    const input={running:true,dx:Math.cos(angle),dy:Math.sin(angle),aimAngle:angle}
    for(let j=0;j<40;j++){const pose=animation.update(.01,input);walking.add(pose.frame);assert.equal(pose.direction,direction)}
    assert.equal(walking.size,4)
    attacking.add(animation.update(.01,{...input,attackAngle:angle}).frame)
    for(let j=0;j<31;j++){const pose=animation.update(.01,{...input,dx:-1,dy:0});attacking.add(pose.frame);assert.equal(pose.direction,direction);assert.equal(pose.action,'attack')}
    assert.equal(attacking.size,4);assert.ok([...attacking].every(frame=>frame>=i*8+4&&frame<i*8+8))
    assert.equal(animation.update(.02,{...input,dx:-1,dy:0}).direction,'w')
  })
})
test('怪物暂停时冻结帧，后退时朝实际移动方向行走，停下后面向目标',()=>{
  const animation=new MonsterAnimator(),input={running:true,dx:-5,dy:0,aimAngle:0}
  assert.equal(animation.update(.1,input).direction,'w')
  const attack=animation.update(.01,{...input,attackAngle:Math.PI/2})
  for(let i=0;i<30;i++)assert.deepEqual(animation.update(.1,{...input,running:false}),attack)
  animation.update(.4,input)
  const stop=animation.update(.01,{...input,dx:0})
  assert.equal(stop.action,'idle');assert.equal(stop.direction,'e')
})
test('受击抖动幅度有界，结束后复位，不改变物理坐标',()=>{
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/4])for(let remaining=0;remaining<=.22;remaining+=.01){
    const reaction=hitReaction(remaining,angle);assert.ok(Math.hypot(reaction.x,reaction.y)<=5)
  }
  assert.deepEqual(hitReaction(0,0),{x:0,y:0,white:false})
})
