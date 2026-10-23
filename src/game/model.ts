export type Kind = 'melee' | 'ranged'
export type Status = 'ready' | 'running' | 'paused' | 'upgrade' | 'won' | 'lost'
export type Slam = {phase:'windup'|'recover';time:number;x:number;y:number;radius:number}
export type Actor = { id: number; x: number; y: number; hp: number; maxHp: number; kind: Kind; tier: number; cd: number; elite?: boolean; angle: number; flash: number; hit:number; hitAngle:number; attackSeq:number; slam?:Slam }
export type Shockwave = {id:number;x:number;y:number;radius:number;life:number;max:number}
export type Impact = { id:number; x:number; y:number; angle:number; team:'player'|'ally'|'enemy'; life:number; max:number }
export type Bullet = { id: number; x: number; y: number; vx: number; vy: number; life: number; team: 'rope' | 'enemy' | 'ally'; damage: number; returning?: boolean; distance: number }
export type Effect = { x: number; y: number; text: string; color: string; life: number; max: number }
export type Control = { x: number; y: number; fire: boolean; dash: boolean; rally: boolean }
export type WeaponTarget = { enemy: Actor; distance: number; inRange: boolean }
export type Upgrade = { id: string; name: string; tag: string; description: string; icon: 'rope' | 'heart' | 'team' | 'bolt' | 'shield' | 'speed' }
export const UPGRADES: Upgrade[] = [
  { id: 'speed', name: '快一点下班', tag: '机动强化', description: '移动速度 +18%，冲刺冷却减少 0.5 秒。', icon: 'speed' },
  { id: 'rope', name: '祖传加长绳', tag: '武器强化', description: '捕获射程 +15%（最高 300），冷却减少 12%（最低 1.2 秒）。', icon: 'rope' },
  { id: 'heart', name: '打工人的韧性', tag: '生存强化', description: '生命上限 +25，立即回复 40 点生命。', icon: 'heart' },
  { id: 'team', name: '再带两个兄弟', tag: '编队扩容', description: '僚机上限 +2（最多 10 个），全队回复生命。', icon: 'team' },
  { id: 'bolt', name: '街头特训', tag: '僚机强化', description: '所有僚机攻击伤害 +30%，攻击间隔减少 10%。', icon: 'bolt' },
  { id: 'shield', name: '劳保加厚款', tag: '生存强化', description: '受到伤害降低 20%（最高 60%），全队生命上限 +20%（最高 120%）。', icon: 'shield' },
]
export const STAGES = [
  { name: '马桶店街口', sub: '关店了，出发吧', x: 1000 },
  { name: '梧桐老街', sub: '穿过熟悉的街区', x: 1850 },
  { name: '深夜小吃街', sub: '这条街有点热闹', x: 2750 },
  { name: '高架桥下', sub: '再坚持一个路口', x: 3650 },
  { name: '回家的路', sub: '灯亮着，有人在等你', x: 4820 },
]
export const DURATION = 600
export const WORLD = { width: 5400, height: 1800 }
export const ELITE_RULES = {firstAt:45,interval:60,maxAlive:3,windup:1.2,recovery:.8} as const
export const ENEMY_BULLET_LIMIT = 180
export const rangedSpawnChance = (time:number) => Math.min(.7,.42+time/1300)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x, a.y-b.y)
const allyHP = (kind: Kind, tier: number) => (kind === 'melee' ? 92 : 65) * [0, 1, 2.5, 6][tier]
export function walkable(x: number, y: number, radius = 16) {
  if (x < radius + 35 || x > WORLD.width-radius-35 || y < radius+35 || y > WORLD.height-radius-35) return false
  return Math.abs(y-900) < 236-radius || [900,2700,4500].some(cx => Math.abs(x-cx)<170-radius)
}
function streetSpawn(x: number, y: number) {
  const px=clamp(x,60,WORLD.width-60),py=clamp(y,60,WORLD.height-60)
  const candidates=[{x:px,y:clamp(py,705,1095)},...[900,2700,4500].map(cx=>({x:clamp(px,cx-140,cx+140),y:py}))]
  return candidates.reduce((nearest,point)=>dist(point,{x,y})<dist(nearest,{x,y})?point:nearest)
}
export class GameModel {
  status: Status = 'ready'
  time = 0
  player = { x: 820, y: 945, hp: 100, maxHp: 100, angle: 0, invincible: 0, dash: 0, dashCd: 0, rallyCd: 0, hit:0, hitAngle:0 }
  enemies: Actor[] = []
  allies: Actor[] = []
  bullets: Bullet[] = []
  effects: Effect[] = []
  impacts: Impact[] = []
  shockwaves: Shockwave[] = []
  pickups: {id:number;x:number;y:number;life:number}[] = []
  captured = 0
  merges = 0
  kills = 0
  eliteKills = 0
  elitesSpawned = 0
  level = 1
  xp = 0
  nextXp = 5
  capacity = 6
  stage = 0
  upgradeChoices: Upgrade[] = []
  message = '第一站 · 马桶店街口'
  messageUntil = 7
  visited = new Set<number>()
  sounds: string[] = []
  private uid = 0
  private spawnCd = 2
  weaponCooldown = 0
  private fireHeld = false
  private captureInFlightId?: number
  private pickupCd = 24
  private speed = 190
  private shotInterval = 2.4
  private range = 240
  private armor = 1
  private power = 1
  private allyArmor = 1
  private rallyTime = 0
  private dashMax = 3.7
  private wave = 0
  private nextEliteAt:number = ELITE_RULES.firstAt
  private enemyProjectileCount = 0
  random: () => number
  constructor(random: () => number = Math.random) { this.random=random }
  get weaponCooldownMax() { return this.shotInterval }
  get weaponRange() { return this.range }
  get eliteCountdown() { return Math.max(0,this.nextEliteAt-this.time) }
  get weaponTarget(): WeaponTarget | undefined {
    let nearest: Actor | undefined, distance=Infinity
    for(const enemy of this.enemies){const d=dist(enemy,this.player);if(enemy.hp>0&&!enemy.elite&&d<distance){nearest=enemy;distance=d}}
    return nearest?{enemy:nearest,distance,inRange:distance<=this.range}:undefined
  }
  start() { if (this.status === 'ready') { this.status='running'; for(let i=0;i<4;i++)this.spawnEnemy(i%2 ? 'ranged':'melee',1100+i*95,850+(i%2)*100) } }
  togglePause() { if(this.status==='running')this.status='paused';else if(this.status==='paused')this.status='running' }
  text(x:number,y:number,text:string,color='#f5d65b',life=1.4) {this.effects.push({x,y,text,color,life,max:life})}
  spawnEnemy(kind?: Kind, x?: number, y?: number, elite=false) {
    if(this.enemies.length>=85&&!elite)return
    if(elite&&this.enemies.filter(e=>e.elite&&e.hp>0).length>=ELITE_RULES.maxAlive)return
    const a=this.random()*Math.PI*2
    let spawn:{x:number;y:number}|undefined
    for(let attempt=0;attempt<12;attempt++){
      const angle=a+attempt*Math.PI/6
      const point=streetSpawn(attempt===0&&x!==undefined?x:this.player.x+Math.cos(angle)*650,attempt===0&&y!==undefined?y:this.player.y+Math.sin(angle)*440)
      if(walkable(point.x,point.y)&&dist(point,this.player)>=290){spawn=point;break}
    }
    if(!spawn)return
    // A scheduled elite must not be starved by the normal-enemy population cap.
    if(this.enemies.length>=85){
      const removable=this.enemies.filter(e=>!e.elite&&e.id!==this.captureInFlightId).sort((a,b)=>dist(b,this.player)-dist(a,this.player))[0]
      if(!removable)return
      this.enemies=this.enemies.filter(e=>e!==removable)
    }
    const threat=this.allies.reduce((sum,a)=>sum+(a.kind==='melee'?[0,.65,1.5,3.5]:[0,1.1,2.8,6.5])[a.tier],0)*Math.pow(this.power,1.5)
    const hp=elite?Math.ceil(48+this.time*.22+threat*8):1
    const enemy:Actor={ id:++this.uid,...spawn,kind:elite?'melee':kind??(this.random()<rangedSpawnChance(this.time)?'ranged':'melee'),hp,maxHp:hp,tier:1,cd:elite?1.5:1+this.random(),elite,angle:0,flash:0,hit:0,hitAngle:0,attackSeq:0 }
    this.enemies.push(enemy)
    if(elite)this.elitesSpawned++
    return enemy
  }
  recruit(kind: Kind, x=this.player.x, y=this.player.y) {
    this.captured++;this.xp++;this.kills++
    const pair = this.allies.filter(a=>a.kind===kind&&a.tier===1)
    if(this.allies.length>=this.capacity&&pair.length<2){this.text(x,y,'编队已满 · 回复全队','#a5d6c0');this.allies.forEach(a=>a.hp=Math.min(a.maxHp,a.hp+12));this.player.hp=Math.min(this.player.maxHp,this.player.hp+2);return}
    const hp=allyHP(kind,1)*this.allyArmor
    this.allies.push({id:++this.uid,x,y,kind,tier:1,hp,maxHp:hp,cd:.2,angle:0,flash:0,hit:0,hitAngle:0,attackSeq:0})
    this.text(x,y,kind==='melee'?'近战护卫 +1':'远程射手 +1','#b4ead0');this.sounds.push('capture')
    this.mergeAllies()
  }
  mergeAllies() {
    for(const kind of ['melee','ranged'] as Kind[])for(let tier=1;tier<3;tier++){
      let group=this.allies.filter(a=>a.kind===kind&&a.tier===tier)
      while(group.length>=3){
        const consumed=group.slice(0,3), ids=new Set(consumed.map(a=>a.id)), center=consumed[0]
        this.allies=this.allies.filter(a=>!ids.has(a.id));const hp=allyHP(kind,tier+1)*this.allyArmor
        this.allies.push({id:++this.uid,x:center.x,y:center.y,kind,tier:tier+1,hp,maxHp:hp,cd:.1,angle:0,flash:.6,hit:0,hitAngle:0,attackSeq:0})
        this.merges++;this.text(center.x,center.y,`合成！${tier+1} 级${kind==='melee'?'护卫':'射手'}`,'#ffe07b',2.5);this.sounds.push('merge')
        group=this.allies.filter(a=>a.kind===kind&&a.tier===tier)
      }
    }
  }
  chooseUpgrade(id:string) {
    if(this.status!=='upgrade'||!this.upgradeChoices.some(u=>u.id===id))return
    switch(id){
      case 'speed':this.speed*=1.18;this.dashMax=Math.max(1.5,this.dashMax-.5);break
      case 'rope':this.range=Math.min(300,this.range*1.15);this.shotInterval=Math.max(1.2,this.shotInterval*.88);this.weaponCooldown=Math.min(this.weaponCooldown,this.shotInterval);break
      case 'heart':this.player.maxHp+=25;this.player.hp=Math.min(this.player.maxHp,this.player.hp+40);break
      case 'team':this.capacity=Math.min(10,this.capacity+2);this.allies.forEach(a=>a.hp=a.maxHp);break
      case 'bolt':this.power*=1.3;break
      case 'shield':this.armor=Math.max(.4,this.armor*.8);this.allyArmor=Math.min(2.2,this.allyArmor*1.2);this.allies.forEach(a=>{a.maxHp=allyHP(a.kind,a.tier)*this.allyArmor;a.hp=Math.min(a.maxHp,a.hp*1.2)});break
    }
    this.status='running';this.upgradeChoices=[];this.sounds.push('upgrade')
  }
  private move(actor:{x:number;y:number},vx:number,vy:number,dt:number,radius=16) {
    if(walkable(actor.x+vx*dt,actor.y,radius))actor.x+=vx*dt
    if(walkable(actor.x,actor.y+vy*dt,radius))actor.y+=vy*dt
  }
  private impact(target:{x:number;y:number;hit:number;hitAngle:number},source:{x:number;y:number},team:Impact['team']) {
    target.hit=.22;target.hitAngle=Math.atan2(target.y-source.y,target.x-source.x)
    this.impacts.push({id:++this.uid,x:target.x,y:target.y,angle:target.hitAngle,team,life:.28,max:.28})
  }
  private hurtAlly(ally:Actor,damage:number,source:{x:number;y:number}) {
    if(ally.hp<=0)return
    ally.hp-=damage/this.allyArmor;this.impact(ally,source,'ally')
    this.text(ally.x,ally.y-24,`−${Math.ceil(damage/this.allyArmor)}`,'#8deaff',.65)
  }
  private hurtPlayer(damage:number,source:{x:number;y:number}) {
    if(this.player.invincible>0)return
    this.player.hp=Math.max(0,this.player.hp-damage*this.armor);this.player.invincible=.65;this.impact(this.player,source,'player')
    this.text(this.player.x,this.player.y-30,`−${Math.ceil(damage*this.armor)}`,'#ff816d');this.sounds.push('hurt')
    if(this.player.hp<=0)this.status='lost'
  }
  private hitEnemy(enemy:Actor,damage:number,capture:boolean,source:{x:number;y:number}) {
    if(enemy.hp<=0)return
    enemy.hp-=damage;this.impact(enemy,source,'enemy')
    if(enemy.hp>0){this.text(enemy.x,enemy.y,enemy.elite?(capture?'精英免疫捕获':'重甲命中'):'命中','#f4a56c',enemy.elite?.55:1.4);return}
    if(capture&&!enemy.elite)this.recruit(enemy.kind,enemy.x,enemy.y)
    else {
      this.kills++;this.xp+=enemy.elite?4:.45
      this.text(enemy.x,enemy.y,enemy.elite?'精英击破！':'+能量',enemy.elite?'#ffdc8a':'#b5dbba',enemy.elite?2:.65)
      if(enemy.elite){this.eliteKills++;this.sounds.push('eliteDown')}
      if(enemy.elite||this.random()<.08)this.pickups.push({id:++this.uid,x:enemy.x,y:enemy.y,life:22})
    }
  }
  private fire(x:number,y:number,angle:number,team:Bullet['team'],damage=1) {
    if(team==='enemy'){
      if(this.enemyProjectileCount>=ENEMY_BULLET_LIMIT)return false
      this.enemyProjectileCount++
    }
    const speed=team==='rope'?850:team==='ally'?480:205+this.time*.08
    this.bullets.push({id:++this.uid,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,team,damage,life:team==='rope'?3:3.1,distance:0})
    return true
  }
  private updateElite(enemy:Actor,dt:number) {
    const p=this.player
    if(enemy.slam){
      const slam=enemy.slam;slam.time+=dt
      if(slam.phase==='windup'&&slam.time>=ELITE_RULES.windup){
        slam.phase='recover';slam.time-=ELITE_RULES.windup;enemy.attackSeq++
        this.shockwaves.push({id:++this.uid,x:slam.x,y:slam.y,radius:slam.radius,life:.65,max:.65})
        if(dist(slam,p)<slam.radius+16)this.hurtPlayer(28+this.time*.012,slam)
        for(const ally of this.allies)if(ally.hp>0&&dist(slam,ally)<slam.radius+16)this.hurtAlly(ally,24+this.time*.018,slam)
        if(dist(enemy,p)<650)this.sounds.push('slam')
      }else if(slam.phase==='recover'&&slam.time>=ELITE_RULES.recovery){
        enemy.slam=undefined;enemy.cd=Math.max(3.7,4.8-this.time/800)
      }
      return
    }
    const distance=dist(enemy,p),radius=150+Math.min(35,this.time/18)
    enemy.angle=Math.atan2(p.y-enemy.y,p.x-enemy.x)
    if(distance<radius+45&&enemy.cd<=0){
      // Commit to this ground position: the warning never follows a dodging player.
      enemy.slam={phase:'windup',time:0,x:enemy.x,y:enemy.y,radius}
      return
    }
    const speed=122*(1+this.time/1800)
    this.move(enemy,Math.cos(enemy.angle)*speed,Math.sin(enemy.angle)*speed,dt,24)
  }
  update(dt:number,input:Control) {
    const firePressed=input.fire&&!this.fireHeld
    this.fireHeld=input.fire
    if(this.status!=='running')return
    dt=Math.min(dt,.05);this.time+=dt
    const p=this.player
    p.hit=Math.max(0,p.hit-dt)
    for(const impact of this.impacts)impact.life-=dt
    this.impacts=this.impacts.filter(impact=>impact.life>0)
    for(const wave of this.shockwaves)wave.life-=dt
    this.shockwaves=this.shockwaves.filter(wave=>wave.life>0)
    this.enemyProjectileCount=this.bullets.filter(b=>b.team==='enemy'&&b.life>0).length
    for(const actor of [...this.enemies,...this.allies])actor.hit=Math.max(0,actor.hit-dt)
    p.invincible=Math.max(0,p.invincible-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.rallyCd=Math.max(0,p.rallyCd-dt);p.dash=Math.max(0,p.dash-dt);this.rallyTime=Math.max(0,this.rallyTime-dt)
    const len=Math.hypot(input.x,input.y)||1
    if(input.dash&&p.dashCd===0&&(input.x||input.y)){p.dash=.19;p.dashCd=this.dashMax;p.invincible=.3;this.sounds.push('dash')}
    this.move(p,input.x/len*this.speed*(p.dash>0?3.8:1),input.y/len*this.speed*(p.dash>0?3.8:1),dt)
    const aimTarget=this.weaponTarget
    if(aimTarget)p.angle=Math.atan2(aimTarget.enemy.y-p.y,aimTarget.enemy.x-p.x)
    if(input.rally&&p.rallyCd===0){p.rallyCd=10;this.rallyTime=2.3;this.allies.forEach(a=>a.hp=Math.min(a.maxHp,a.hp+15));this.enemies.forEach(e=>{const d=dist(e,p);if(d<210){const angle=Math.atan2(e.y-p.y,e.x-p.x);this.move(e,Math.cos(angle)*120,Math.sin(angle)*120,1);}});this.text(p.x,p.y,'集结！全队回复','#a5dfd0');this.sounds.push('merge')}
    this.weaponCooldown=Math.max(0,this.weaponCooldown-dt)
    if(firePressed&&this.weaponCooldown===0){
      if(aimTarget?.inRange){this.captureInFlightId=aimTarget.enemy.id;this.fire(p.x,p.y,p.angle,'rope');this.weaponCooldown=this.shotInterval;this.sounds.push('shot')}
      else this.text(p.x,p.y-12,aimTarget?'目标太远 · 先靠近':'走位寻找捕获目标','#e3d7b3',1)
    }
    const reservedTarget=this.enemies.find(e=>!e.elite&&e.id===this.captureInFlightId)??(this.weaponCooldown===0&&aimTarget&&aimTarget.distance<=this.range+200?aimTarget.enemy:undefined)
    const stage=Math.min(4,Math.floor(this.time/120))
    if(stage!==this.stage){this.stage=stage;this.message=`第 ${stage+1} 站 · ${STAGES[stage].name}`;this.messageUntil=this.time+6;this.sounds.push('upgrade')}
    const target=STAGES[stage]
    if(!this.visited.has(stage)&&Math.abs(p.x-target.x)<145&&Math.abs(p.y-900)<220){this.visited.add(stage);p.hp=Math.min(p.maxHp,p.hp+22);this.xp+=2;this.text(p.x,p.y-50,'街区补给 · 生命 +22','#c8e9b0',2.4)}
    this.spawnCd-=dt
    if(this.spawnCd<=0){const count=(this.time<20?1:2)+Math.floor(this.time/120);for(let i=0;i<count;i++)if(this.enemies.length<85)this.spawnEnemy();this.spawnCd=Math.max(.48,1.75-this.time*.0019)/(1+this.allies.length*.065)}
    const wave=Math.floor(this.time/60)
    if(wave>this.wave){this.wave=wave;const count=6+stage*2;for(let i=0;i<count;i++)if(this.enemies.length<85)this.spawnEnemy(i<Math.ceil(count*.6)?'ranged':undefined);if(wave%2===1){this.message='远程怪物潮 · 别停在弹幕里！';this.messageUntil=this.time+5;this.sounds.push('upgrade')}}
    if(this.time>=this.nextEliteAt&&this.enemies.filter(e=>e.elite&&e.hp>0).length<ELITE_RULES.maxAlive){
      const elite=this.spawnEnemy('melee',undefined,undefined,true)
      if(elite){
        this.nextEliteAt=this.time+ELITE_RULES.interval
        for(let i=0;i<2+Math.floor(this.time/180);i++)this.spawnEnemy('ranged')
        this.message='震地精英来袭 · 无法捕获，躲开红圈！';this.messageUntil=this.time+6;this.sounds.push('elite')
      }
    }
    this.pickupCd-=dt
    if(this.pickupCd<=0){this.pickupCd=32;this.pickups.push({id:++this.uid,x:clamp(p.x+180*(this.random()>.5?1:-1),80,5300),y:clamp(p.y+80*(this.random()>.5?1:-1),735,1065),life:30})}
    for(const e of this.enemies){
      if(e.hp<=0)continue
      e.flash=Math.max(0,e.flash-dt);e.cd-=dt
      if(e.elite){this.updateElite(e,dt);continue}
      let target:{x:number;y:number;hp:number}=p,nd=dist(e,p)
      if(e.kind==='melee')for(const ally of this.allies){const d=dist(e,ally);if(ally.hp>0&&d<nd*.85){target=ally;nd=d}}
      e.angle=Math.atan2(target.y-e.y,target.x-e.x)
      const speed=(e.kind==='melee'?94:95)*(1+this.time/1200)*(e.elite?1.22:1)
      if(e.kind==='melee'||nd>420||this.rallyTime>0)this.move(e,Math.cos(e.angle)*speed,Math.sin(e.angle)*speed,dt)
      else if(nd<365)this.move(e,-Math.cos(e.angle)*Math.min(175,speed*1.4),-Math.sin(e.angle)*Math.min(175,speed*1.4),dt)
      if(e.kind==='melee'&&nd<(e.elite?47:33)&&e.cd<=0){const damage=(e.elite?23:10)*(1+this.time/1200);if(target===p)this.hurtPlayer(damage,e);else this.hurtAlly(target as Actor,damage,e);e.cd=.95;e.attackSeq++}
      if(e.kind==='ranged'&&nd<540&&e.cd<=0){
        if(this.fire(e.x,e.y,e.angle,'enemy',8)){if(this.time>240){this.fire(e.x,e.y,e.angle+.18,'enemy',6);this.fire(e.x,e.y,e.angle-.18,'enemy',6)}e.cd=Math.max(1.15,2.1-this.time/700);e.attackSeq++}
        else e.cd=.15
      }
    }
    for(let i=0;i<this.allies.length;i++){
      const a=this.allies[i];a.cd-=dt;a.flash=Math.max(0,a.flash-dt)
      let enemy:Actor|undefined,nd=a.kind==='melee'?290:620
      if(this.rallyTime<=0)for(const e of this.enemies){const d=dist(a,e);if(e.hp>0&&e!==reservedTarget&&d<nd){nd=d;enemy=e}}
      const orbit=i*2.399+this.time*.1;let tx=p.x+Math.cos(orbit)*78,ty=p.y+Math.sin(orbit)*66
      if(enemy){a.angle=Math.atan2(enemy.y-a.y,enemy.x-a.x);if(a.kind==='melee'){tx=enemy.x;ty=enemy.y}}
      const danger=this.enemies.find(e=>e.hp>0&&e.slam?.phase==='windup'&&dist(a,e.slam)<e.slam.radius+38)?.slam
      if(danger){
        const away=dist(a,danger)>1?Math.atan2(a.y-danger.y,a.x-danger.x):orbit
        for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){
          const angle=away+turn,x=danger.x+Math.cos(angle)*(danger.radius+56),y=danger.y+Math.sin(angle)*(danger.radius+56)
          if(walkable(x,y)){tx=x;ty=y;break}
        }
        enemy=undefined
      }
      const d=Math.hypot(tx-a.x,ty-a.y);if(d>12){const speed=dist(a,p)>420?350:225;this.move(a,(tx-a.x)/d*speed,(ty-a.y)/d*speed,dt)}
      const damage=(a.kind==='melee'?[0,.65,1.5,3.5]:[0,1.1,2.8,6.5])[a.tier]*this.power
      if(enemy&&a.cd<=0){
        if(a.kind==='melee'&&nd<46+a.tier*12){const radius=[0,58,75,100][a.tier];if(a.tier===1)this.hitEnemy(enemy,damage,false,a);else this.enemies.forEach(e=>{if(e.hp>0&&e!==reservedTarget&&dist(a,e)<radius)this.hitEnemy(e,damage,false,a)});this.text(a.x,a.y,'✦',a.tier===3?'#ffe18b':'#d5e5bc',.25);a.cd=1.1/Math.sqrt(this.power);a.attackSeq++}
        else if(a.kind==='ranged'){this.fire(a.x,a.y,a.angle,'ally',damage);if(a.tier===3){this.fire(a.x,a.y,a.angle-.16,'ally',damage*.7);this.fire(a.x,a.y,a.angle+.16,'ally',damage*.7)}a.cd=1.2/Math.sqrt(this.power);a.attackSeq++}
      }
    }
    for(const b of this.bullets){
      b.life-=dt
      if(b.team==='rope'&&b.returning){const d=dist(b,p);if(d<=Math.max(25,1100*dt)){b.life=0;continue}b.vx=(p.x-b.x)/d*1100;b.vy=(p.y-b.y)/d*1100}
      const oldX=b.x,oldY=b.y,outbound=b.team==='rope'&&!b.returning
      const step=Math.hypot(b.vx,b.vy)*dt,travel=outbound?Math.min(step,Math.max(0,this.range-b.distance)):step,ratio=step?travel/step:0
      b.x+=b.vx*dt*ratio;b.y+=b.vy*dt*ratio;b.distance+=travel
      const reachedRange=outbound&&b.distance>=this.range
      if(!walkable(b.x,b.y,3)){if(b.team==='rope')b.returning=true;else b.life=0}
      if(b.team==='enemy'){
        if(dist(b,p)<22){this.hurtPlayer(b.damage,{x:b.x-b.vx,y:b.y-b.vy});b.life=0}
        else for(const a of this.allies)if(dist(b,a)<22&&a.hp>0){this.hurtAlly(a,b.damage,{x:b.x-b.vx,y:b.y-b.vy});b.life=0;break}
      }else if(!b.returning){
        for(const e of this.enemies){if(e.hp<=0||(b.team==='ally'&&e===reservedTarget))continue;const vx=b.x-oldX,vy=b.y-oldY,den=vx*vx+vy*vy;const t=den?clamp(((e.x-oldX)*vx+(e.y-oldY)*vy)/den,0,1):0;const distance=Math.hypot(e.x-(oldX+t*vx),e.y-(oldY+t*vy));if(distance<(e.elite?36:24)){this.hitEnemy(e,b.damage,b.team==='rope',{x:oldX-b.vx*.01,y:oldY-b.vy*.01});if(b.team==='rope')b.returning=true;else b.life=0;break}}
      }
      if(reachedRange)b.returning=true
    }
    this.enemies=this.enemies.filter(e=>e.hp>0&&dist(e,p)<1800)
    this.allies=this.allies.filter(a=>{if(a.hp<=0){this.text(a.x,a.y,'僚机倒下了','#efbca6');return false}return true})
    this.bullets=this.bullets.filter(b=>b.life>0)
    if(!this.bullets.some(b=>b.team==='rope'&&!b.returning))this.captureInFlightId=undefined
    for(const pickup of this.pickups){pickup.life-=dt;if(dist(pickup,p)<38){pickup.life=0;p.hp=Math.min(p.maxHp,p.hp+25);this.text(p.x,p.y,'生命 +25','#ade8cb');this.sounds.push('capture')}}
    this.pickups=this.pickups.filter(a=>a.life>0)
    for(const e of this.effects){e.life-=dt;e.y-=dt*19}this.effects=this.effects.filter(e=>e.life>0)
    if(this.status==='running'&&this.time>=DURATION&&p.x>4650&&Math.abs(p.y-900)<235){this.status='won';this.sounds.push('upgrade')}
    if(this.status==='running'&&this.xp>=this.nextXp){this.level++;this.xp-=this.nextXp;this.nextXp+=7;this.upgradeChoices=[...UPGRADES].filter(u=>(u.id!=='team'||this.capacity<10)&&(u.id!=='shield'||this.armor>.4)&&(u.id!=='rope'||this.range<300||this.shotInterval>1.2)).map(u=>({u,s:this.random()})).sort((a,b)=>a.s-b.s).slice(0,3).map(a=>a.u);this.status='upgrade';this.sounds.push('upgrade')}
    if(this.time>=DURATION&&this.message!=='家门已打开 · 前往最右侧的家'){this.message='家门已打开 · 前往最右侧的家';this.messageUntil=this.time+60}
  }
}
