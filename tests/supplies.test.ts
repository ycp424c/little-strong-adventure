import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel, SUPPLY_RULES } from '../src/game/model.ts'

const idle={x:0,y:0,fire:false,dash:false,rally:false}
function arena(random=()=>.5){const m=new GameModel(random);m.start();m.enemies=[];m.player.x=1600;m.player.y=900;return m}
function advance(m:GameModel,seconds:number){for(let i=0;i<Math.round(seconds/.05);i++){m.enemies=[];m.bullets=[];m.update(.05,idle)}}
function kill(m:GameModel){
  m.enemies=[];const enemy=m.spawnEnemy('melee',2000,900)!;enemy.cd=100
  m.weaponCooldown=1
  m.bullets.push({id:999,x:enemy.x,y:enemy.y,vx:0,vy:0,life:1,team:'ally',damage:1,distance:0})
  m.update(.01,idle)
}
test('定时血包从40秒开始，之后间隔60秒，暂停冻结刷新计时',()=>{
  const m=arena();advance(m,39.9);assert.equal(m.pickups.length,0)
  m.togglePause();advance(m,10);assert.equal(m.time<40,true);assert.equal(m.pickups.length,0)
  m.togglePause();advance(m,.2);assert.equal(m.pickups.length,1)
  const first=m.pickups[0].id
  advance(m,59.7);assert.equal(m.pickups.length,0)
  advance(m,.4);assert.equal(m.pickups.length,1);assert.notEqual(m.pickups[0].id,first)
})
test('击杀掉落率降到2%，相邻击杀不能连续刷血包',()=>{
  const miss=arena(()=>.03);kill(miss);assert.equal(miss.pickups.length,0)
  const m=arena(()=>.01);kill(m);assert.equal(m.pickups.length,1)
  const first=m.pickups[0].id
  kill(m);kill(m);assert.equal(m.pickups.length,1);assert.equal(m.pickups[0].id,first)
  m.togglePause();advance(m,25);m.togglePause();kill(m);assert.equal(m.pickups.length,1)
  advance(m,SUPPLY_RULES.minInterval+.1);kill(m);assert.equal(m.pickups.length,2)
})
test('血包总量上限同时限制定时生成与怪物掉落',()=>{
  const m=arena(()=>.01)
  m.pickups=[{id:900,x:2000,y:900,life:200},{id:901,x:2100,y:900,life:200}]
  kill(m);assert.equal(m.pickups.length,SUPPLY_RULES.maxAlive)
  advance(m,41);assert.equal(m.pickups.length,SUPPLY_RULES.maxAlive)
})
test('定时血包与击杀掉落共用20秒生成间隔',()=>{
  const m=arena(()=>.01);advance(m,35);kill(m)
  const first=m.pickups[0].id
  advance(m,5.1);assert.equal(m.pickups.length,1);assert.equal(m.pickups[0].id,first)
  advance(m,15.1);kill(m);assert.equal(m.pickups.length,2)
})
