import test from 'node:test'
import assert from 'node:assert/strict'
import { GameModel, walkable, DURATION, STAGES, UPGRADES, ELITE_RULES, type Kind } from '../src/game/model.ts'
const idle={x:0,y:0,fire:false,dash:false,rally:false}
function encounter(kind:Kind='melee',distance=150,hp=1){
  const m=new GameModel(()=>.5);m.start();m.enemies=[];m.player.x=1600;m.player.y=900
  m.spawnEnemy(kind,2000,900);Object.assign(m.enemies[0],{x:m.player.x+distance,y:900,hp,maxHp:hp,cd:100})
  return m
}
test('主角不会自动攻击，主动出手会捕获当前最近的普通敌人',()=>{
  const m=encounter();m.spawnEnemy('ranged',2100,900)
  for(let i=0;i<10;i++)m.update(.05,idle)
  assert.equal(m.captured,0);assert.equal(m.bullets.length,0);assert.equal(m.weaponCooldown,0)
  const closest=m.weaponTarget!.enemy.id
  m.update(.05,{...idle,fire:true})
  for(let i=0;i<8;i++)m.update(.05,idle)
  assert.equal(m.captured,1);assert.equal(m.allies[0].kind,'melee');assert.ok(!m.enemies.some(e=>e.id===closest));assert.ok(m.weaponCooldown>0)
})
test('瞄准随走位切换最近敌人，射程外不消耗冷却',()=>{
  const m=encounter('ranged',320);m.spawnEnemy('melee',2100,900)
  assert.equal(m.weaponTarget!.enemy.kind,'ranged');assert.equal(m.weaponTarget!.inRange,false)
  m.update(.05,{...idle,fire:true});assert.equal(m.weaponCooldown,0);assert.ok(!m.bullets.some(b=>b.team==='rope'))
  m.player.x=2110;m.update(.05,idle);assert.equal(m.weaponTarget!.enemy.kind,'melee')
  m.update(.05,{...idle,fire:true});assert.equal(m.weaponCooldown,m.weaponCooldownMax)
})
test('基础冷却为2.4秒，按住不连发，冷却内的出手不会排队',()=>{
  const m=encounter('melee',90,30)
  assert.equal(m.weaponCooldownMax,2.4)
  m.update(.05,{...idle,fire:true})
  for(let i=0;i<60;i++)m.update(.05,{...idle,fire:true})
  assert.equal(m.sounds.filter(s=>s==='shot').length,1);assert.equal(m.weaponCooldown,0)
  m.update(.05,idle);m.update(.05,{...idle,fire:true})
  assert.equal(m.sounds.filter(s=>s==='shot').length,2)
  m.update(.05,idle);m.update(.05,{...idle,fire:true})
  for(let i=0;i<60;i++)m.update(.05,{...idle,fire:true})
  assert.equal(m.sounds.filter(s=>s==='shot').length,2)
})
test('无目标不会浪费出手，暂停冻结冷却并吞掉暂停期间的按键',()=>{
  const m=encounter('melee',90,30);m.update(.05,{...idle,fire:true});const cd=m.weaponCooldown
  m.togglePause();for(let i=0;i<60;i++)m.update(.05,{...idle,fire:true})
  assert.equal(m.weaponCooldown,cd);m.weaponCooldown=0;m.togglePause();m.update(.05,{...idle,fire:true})
  assert.equal(m.sounds.filter(s=>s==='shot').length,1)
  m.enemies=[];m.update(.05,idle);m.update(.05,{...idle,fire:true});assert.equal(m.weaponCooldown,0)
})
test('武器强化保留至少1.2秒冷却，最大射程仍小于远程怪的游走距离',()=>{
  const m=encounter('melee',90,30);m.update(.05,{...idle,fire:true})
  for(let i=0;i<15;i++){m.status='upgrade';m.upgradeChoices=[UPGRADES.find(u=>u.id==='rope')!];m.chooseUpgrade('rope');assert.ok(m.weaponCooldown<=m.weaponCooldownMax)}
  assert.equal(m.weaponCooldownMax,1.2);assert.equal(m.weaponRange,300)
})
test('射程最后一段在不同帧率下都能命中，不会提前回收导致空耗冷却',()=>{
  for(const dt of [.05,1/60,.01])for(const distance of [235,238,239,240]){
    const m=encounter('ranged');m.player.x=5348-distance
    Object.assign(m.enemies[0],{x:5348,y:900,cd:100})
    assert.equal(m.weaponTarget!.inRange,true)
    m.update(dt,{...idle,fire:true});for(let i=0;i<Math.ceil(1/dt);i++)m.update(dt,idle)
    assert.equal(m.captured,1,`射程内目标未命中：distance=${distance}, dt=${dt}`)
  }
})
test('不同强化射程下，落空的皮搋子都能正常收回，不会越过主角来回振荡',()=>{
  for(const dt of [.05,1/60,.01])for(const upgrades of [0,1,2]){
    const m=encounter('ranged',200,30)
    for(let i=0;i<upgrades;i++){m.status='upgrade';m.upgradeChoices=[UPGRADES.find(u=>u.id==='rope')!];m.chooseUpgrade('rope')}
    m.update(dt,{...idle,fire:true});m.enemies=[]
    for(let i=0;i<Math.ceil(1.2/dt);i++)m.update(dt,idle)
    assert.equal(m.captured,0)
    assert.ok(!m.bullets.some(b=>b.team==='rope'),`返航未结束：range=${m.weaponRange}, dt=${dt}`)
  }
})
test('近战主动靠近且易捕，远程会退到捕获射程外',()=>{
  const melee=encounter('melee',320),ranged=encounter('ranged',320)
  melee.update(.05,idle);ranged.update(.05,idle)
  assert.ok(melee.weaponTarget!.distance<320);assert.ok(ranged.weaponTarget!.distance>320)
  assert.ok(ranged.weaponTarget!.distance>ranged.weaponRange)
})
test('远程僚机能攻击近战够不到的敌人，且单次伤害更高',()=>{
  const melee=encounter('melee',500,30),ranged=encounter('melee',500,30)
  melee.recruit('melee');ranged.recruit('ranged');for(let i=0;i<5;i++){melee.update(.05,idle);ranged.update(.05,idle)}
  assert.ok(!melee.bullets.some(b=>b.team==='ally'));assert.ok(ranged.bullets.some(b=>b.team==='ally'))
  const closeMelee=encounter('melee',30,30),closeRanged=encounter('melee',30,30)
  closeMelee.weaponCooldown=1;closeRanged.weaponCooldown=1
  closeMelee.recruit('melee');closeRanged.recruit('ranged');for(let i=0;i<10;i++){closeMelee.update(.05,idle);closeRanged.update(.05,idle)}
  assert.ok(closeRanged.enemies[0].hp<closeMelee.enemies[0].hp)
})
test('捕获武器就绪时，僚机会留出附近瞄准目标并攻击其他敌人',()=>{
  const m=encounter('ranged',320),target=m.enemies[0]
  m.spawnEnemy('melee',2200,900);m.recruit('ranged')
  for(let i=0;i<35;i++)m.update(.05,idle)
  assert.ok(m.enemies.includes(target));assert.equal(target.hp,1);assert.ok(m.kills>1);assert.equal(m.captured,1)
  m.player.x=target.x-180;m.update(.05,{...idle,fire:true});for(let i=0;i<12;i++)m.update(.05,idle)
  assert.ok(!m.enemies.includes(target));assert.equal(m.captured,2)
})
test('皮搋子飞行期间也为主角保留目标，不让僚机抢先击杀',()=>{
  const m=encounter('melee',190);m.recruit('ranged');m.allies[0].cd=0
  const target=m.enemies[0];m.update(.05,{...idle,fire:true})
  assert.equal(target.hp,1);assert.ok(!m.bullets.some(b=>b.team==='ally'))
  for(let i=0;i<10;i++)m.update(.05,idle)
  assert.equal(m.captured,2);assert.ok(m.allies.some(a=>a.kind==='melee'))
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
  assert.notEqual(m.status,'won');m.time=600;m.xp=100;m.update(.05,idle);assert.equal(m.status,'won')
})
test('街区精英和怪物潮同时触发时也遵守敌人数量上限',()=>{
  const m=new GameModel(()=>.5);m.start();for(let i=0;i<100;i++)m.spawnEnemy()
  assert.equal(m.enemies.length,85);m.time=239.99;m.update(.05,idle);assert.ok(m.enemies.length<=85)
})
test('支路尽头和地图边界的出生点始终在道路上，且不贴脸生成',()=>{
  const spots=[{x:900,y:60},{x:900,y:1740},{x:2700,y:60},{x:4500,y:1740},{x:70,y:900},{x:5330,y:900},{x:820,y:945}]
  for(const spot of spots)for(let angle=0;angle<24;angle++){
    const m=new GameModel(()=>angle/24);Object.assign(m.player,spot);m.spawnEnemy()
    assert.equal(m.enemies.length,1,`没有生成敌人 ${JSON.stringify({spot,angle})}`)
    const enemy=m.enemies[0]
    assert.ok(walkable(enemy.x,enemy.y),`敌人生成在建筑里 ${JSON.stringify({spot,enemy})}`)
    assert.ok(Math.hypot(enemy.x-spot.x,enemy.y-spot.y)>=290,`敌人贴脸生成 ${JSON.stringify({spot,enemy})}`)
  }
})
test('十分钟模拟稳定性：五段推进、精英刷新、敌群受限、全程无数值异常',()=>{
  let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const m=new GameModel(random);m.start();m.player.hp=m.player.maxHp=100000;let sawElite=false,maxEnemies=0
  for(let i=0;i<=DURATION*20+40;i++){
    if(m.status==='upgrade')m.chooseUpgrade(m.upgradeChoices[0].id)
    const target=1000+Math.min(4,Math.floor(m.time/120))*900
    const dx=target-m.player.x
    m.update(.05,{...idle,x:Math.abs(dx)>20?Math.sign(dx):0,fire:i%2===0&&m.weaponCooldown===0&&!!m.weaponTarget?.inRange})
    sawElite ||= m.enemies.some(a=>a.elite);maxEnemies=Math.max(maxEnemies,m.enemies.length)
    assert.ok(Number.isFinite(m.player.x)&&Number.isFinite(m.player.hp));assert.ok(m.enemies.length<=85);assert.ok(m.allies.every(a=>a.tier<=3))
    if(m.status==='won')break
  }
  assert.equal(m.stage,4);assert.ok(sawElite);assert.ok(maxEnemies>10);assert.ok(m.time>=600)
  m.player.x=4820;m.player.y=900;if(m.status==='upgrade')m.chooseUpgrade(m.upgradeChoices[0].id);m.update(.05,idle);assert.equal(m.status,'won')
})
test('正常生命下选择伙伴、寻找稀缺补给并预判弹幕，可以完成十分钟回家流程',()=>{
  let seed=1
  const m=new GameModel(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296})
  m.start()
  for(let i=0;i<13000&&m.status!=='won'&&m.status!=='lost';i++){
    if(m.status==='upgrade')m.chooseUpgrade((m.upgradeChoices.find(u=>u.id==='shield')??m.upgradeChoices.find(u=>u.id==='heart')??m.upgradeChoices.find(u=>u.id==='bolt')??m.upgradeChoices[0]).id)
    const target=m.time>=DURATION?4850:STAGES[m.stage].x
    let x=(target-m.player.x)*.02,y=Math.sin(m.time*.35)*.7
    const ranged=m.enemies.filter(e=>e.kind==='ranged'&&!e.elite).sort((a,b)=>Math.hypot(a.x-m.player.x,a.y-m.player.y)-Math.hypot(b.x-m.player.x,b.y-m.player.y))[0]
    let dash=false
    if(m.time<DURATION&&ranged&&m.weaponCooldown<.6&&m.allies.filter(a=>a.kind==='ranged').length<3){
      const dx=ranged.x-m.player.x,dy=ranged.y-m.player.y,distance=Math.hypot(dx,dy)
      if(distance<850){x=dx/(distance||1);y=dy/(distance||1);dash=distance>m.weaponRange&&distance<430}
    }
    const supply=m.player.hp<m.player.maxHp*.7?m.pickups.slice().sort((a,b)=>Math.hypot(a.x-m.player.x,a.y-m.player.y)-Math.hypot(b.x-m.player.x,b.y-m.player.y))[0]:undefined
    const weakened=m.enemies.filter(e=>(e.weakened??0)>0).sort((a,b)=>Math.hypot(a.x-m.player.x,a.y-m.player.y)-Math.hypot(b.x-m.player.x,b.y-m.player.y))[0]
    const priority=supply??(m.weaponCooldown<.6&&m.allies.filter(a=>a.kind==='melee').length<2?weakened:undefined)
    if(priority){const dx=priority.x-m.player.x,dy=priority.y-m.player.y,d=Math.hypot(dx,dy);if(d<1000){x=dx/(d||1);y=dy/(d||1);dash=d>220}}
    for(const enemy of m.enemies){
      const dx=m.player.x-enemy.x,dy=m.player.y-enemy.y,distance=Math.hypot(dx,dy)
      const margin=enemy.elite?240:85
      if(distance<margin){x+=dx/(distance||1)*(margin-distance)/(enemy.elite?38:35);y+=dy/(distance||1)*(margin-distance)/(enemy.elite?38:35)}
    }
    // 躲避固定红圈，并根据弹道的最近交点侧移；只使用玩家实际可用的走位和冲刺。
    for(const enemy of m.enemies){
      const slam=enemy.slam
      if(!slam||slam.phase!=='windup')continue
      const dx=m.player.x-slam.x,dy=m.player.y-slam.y,d=Math.hypot(dx,dy)
      if(d<slam.radius+40){x=dx/(d||1)*5;y=dy/(d||1)*5;dash=slam.time>.65}
    }
    // Choose a short safe movement trajectory using visible projectiles and warning circles.
    const directionLength=Math.hypot(x,y)||1,preferredX=x/directionLength,preferredY=y/directionLength,wantsDash=dash
    const nearbyBullets=m.bullets.filter(b=>b.team==='enemy'&&Math.hypot(b.x-m.player.x,b.y-m.player.y)<550)
    let best={score:Infinity,x,y,dash:false}
    for(let heading=0;heading<16;heading++)for(const useDash of [false,true]){
      if(useDash&&m.player.dashCd>0)continue
      const cx=Math.cos(heading*Math.PI/8),cy=Math.sin(heading*Math.PI/8)
      const burst=useDash?.19:m.player.dash
      const point=(t:number)=>{const travel=190*(t+2.8*Math.min(t,burst));return {x:m.player.x+cx*travel,y:m.player.y+cy*travel}}
      let score=(1-cx*preferredX-cy*preferredY)*4+(useDash?(wantsDash?-.6:1.8):0)
      if([.15,.3,.6].some(t=>{const p=point(t);return !walkable(p.x,p.y)}))continue
      for(const bullet of nearbyBullets){
        let previous={x:m.player.x-bullet.x,y:m.player.y-bullet.y}
        for(const t of [.15,.3,.45,.6]){
          if(t>bullet.life)break
          const p=point(t),relative={x:p.x-bullet.x-bullet.vx*t,y:p.y-bullet.y-bullet.vy*t}
          const dx=relative.x-previous.x,dy=relative.y-previous.y,den=dx*dx+dy*dy
          const along=den?Math.max(0,Math.min(1,-(previous.x*dx+previous.y*dy)/den)):0
          const d=Math.hypot(previous.x+dx*along,previous.y+dy*along)
          if(d<34)score+=80*(1-d/34)/(t+.1)
          else if(d<60)score+=(60-d)/60
          previous=relative
        }
      }
      const end=point(.6)
      for(const enemy of m.enemies){
        if(enemy.elite&&enemy.slam?.phase==='windup'){
          const until=ELITE_RULES.windup-enemy.slam.time
          if(until<=.6){const p=point(Math.max(0,until));if(Math.hypot(p.x-enemy.slam.x,p.y-enemy.slam.y)<enemy.slam.radius+20)score+=500}
        }else if(enemy.kind==='melee'&&!enemy.elite){
          const d=Math.hypot(end.x-enemy.x,end.y-enemy.y)
          if(d<100)score+=(100-d)/8
        }
      }
      if(score<best.score)best={score,x:cx,y:cy,dash:useDash}
    }
    x=best.x;y=best.y;dash=best.dash
    if(!walkable(m.player.x+x*8,m.player.y+y*8)){
      if(walkable(m.player.x+x*8,m.player.y))y=0
      else if(walkable(m.player.x,m.player.y+y*8))x=0
    }
    const aim=m.weaponTarget
    // 后退中的射手可能躲开射程末端的皮搋子，靠近后再出手，为飞行时间留出余量。
    const fire=i%2===0&&m.weaponCooldown===0&&!!aim?.inRange&&(aim.enemy.elite||(aim.enemy.kind==='ranged'&&aim.distance<m.weaponRange-60)||((m.allies.filter(a=>a.kind==='melee').length<2||aim.distance<55)&&aim.distance<100)||m.allies.length<2)
    m.update(.05,{...idle,x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y)),fire,dash})
  }
  assert.equal(m.status,'won');assert.ok(m.player.hp>0);assert.ok(m.time>=DURATION);assert.equal(m.visited.size,5)
})
