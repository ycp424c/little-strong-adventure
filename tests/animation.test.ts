import test from 'node:test'
import assert from 'node:assert/strict'
import { DIRECTIONS, HeroAnimator, MonsterAnimator, facing, projectileFrame } from '../src/game/animation.ts'

const idle={running:true,dx:0,dy:0,dashing:false}
test('主角移动与瞄准在八个方向分界附近不闪换动画行，真实转向仍立即响应',()=>{
  for(let i=0;i<8;i++)for(const moving of [false,true]){
    const animation=new HeroAnimator(),center=i*Math.PI/4
    const move=(angle:number)=>animation.update(.016,{...idle,dx:moving?Math.cos(angle)*3:0,dy:moving?Math.sin(angle)*3:0,aimAngle:angle})
    move(center)
    for(let j=0;j<40;j++)assert.equal(move(center+Math.PI/8+(j%2?1:-1)*.01).direction,DIRECTIONS[i])
    assert.equal(move(center+Math.PI/8+.2).direction,DIRECTIONS[(i+1)%8])
    for(let j=0;j<40;j++)assert.equal(move(center+Math.PI/8+(j%2?1:-1)*.01).direction,DIRECTIONS[(i+1)%8])
    assert.equal(move(center).direction,DIRECTIONS[i])
  }
})
test('怪物移动和静止瞄准都稳定跨越方向临界点，包含正负π接缝',()=>{
  for(let i=0;i<8;i++)for(const moving of [false,true]){
    const animation=new MonsterAnimator(),center=i*Math.PI/4
    const aim=(angle:number)=>animation.update(.016,{running:true,dx:moving?Math.cos(angle)*3:0,dy:moving?Math.sin(angle)*3:0,aimAngle:angle})
    aim(center)
    for(let j=0;j<40;j++)assert.equal(aim(center+Math.PI/8+(j%2?1:-1)*.01).direction,DIRECTIONS[i])
    assert.equal(aim(center+Math.PI/8+.2).direction,DIRECTIONS[(i+1)%8])
    assert.equal(aim(center).direction,DIRECTIONS[i])
  }
})
test('八方向朝向覆盖正交与斜向，角度跨越整圈仍正确',()=>{
  DIRECTIONS.forEach((direction,i)=>{
    for(const turns of [-3,0,3])assert.equal(facing(i*Math.PI/4+turns*2*Math.PI),direction)
  })
})
test('真实位移播放行走循环，停下或撞墙后停止踏步并保留朝向',()=>{
  const animation=new HeroAnimator(),frames=new Set<number>()
  for(let i=0;i<20;i++){const pose=animation.update(.05,{...idle,dx:-5,dy:-5});frames.add(pose.frame);assert.equal(pose.direction,'nw');assert.equal(pose.action,'walk')}
  assert.equal(frames.size,6)
  const stopped=animation.update(.05,idle)
  assert.equal(stopped.action,'idle');assert.equal(stopped.direction,'nw')
  assert.deepEqual(animation.update(.5,idle),stopped)
})
test('攻击锁定出手方向，播放完四帧后恢复当前移动方向',()=>{
  const animation=new HeroAnimator(),frames=new Set<number>()
  const attack=animation.update(.05,{...idle,shotAngle:Math.PI})
  frames.add(attack.frame);assert.equal(attack.direction,'w');assert.equal(attack.action,'attack')
  for(let i=0;i<5;i++){const pose=animation.update(.05,{...idle,dx:5,dy:0,aimAngle:0});assert.equal(pose.direction,'w');assert.equal(pose.action,'attack');frames.add(pose.frame)}
  assert.equal(frames.size,4)
  const recovered=animation.update(.05,{...idle,dx:5,dy:0})
  assert.equal(recovered.direction,'e');assert.equal(recovered.action,'walk')
})
test('暂停与升级期间冻结攻击进度，恢复时不会跳过剩余动作',()=>{
  const animation=new HeroAnimator()
  animation.update(.05,{...idle,shotAngle:-Math.PI/2})
  const before=animation.update(.08,idle)
  for(let i=0;i<100;i++)assert.deepEqual(animation.update(.05,{...idle,running:false}),before)
  const after=animation.update(.08,idle)
  assert.equal(after.action,'attack');assert.equal(after.direction,'n');assert.ok(after.frame>before.frame)
})
test('重新开始会清除未完成的攻击、朝向与行走进度',()=>{
  const animation=new HeroAnimator()
  animation.update(.1,{...idle,shotAngle:Math.PI/4})
  const reset=animation.reset()
  assert.equal(reset.action,'idle');assert.equal(reset.direction,'s');assert.deepEqual(animation.update(.05,idle),reset)
})
test('皮搋子、友弹与敌弹使用独立的六帧动画区间',()=>{
  for(const [row,team]of (['rope','ally','enemy'] as const).entries()){
    const frames=new Set<number>()
    for(let i=0;i<6;i++)frames.add(projectileFrame(team,i/18,0))
    assert.equal(frames.size,6);assert.ok([...frames].every(f=>f>=row*6&&f<(row+1)*6))
  }
})
