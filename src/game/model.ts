export type Kind = 'melee' | 'ranged'
export type Status = 'ready' | 'running' | 'paused' | 'upgrade' | 'won' | 'lost'
export type Actor = { id: number; x: number; y: number; hp: number; maxHp: number; kind: Kind; tier: number; cd: number; elite?: boolean; angle: number; flash: number }
export type Bullet = { id: number; x: number; y: number; vx: number; vy: number; life: number; team: 'rope' | 'enemy' | 'ally'; damage: number; returning?: boolean; distance: number }
export type Effect = { x: number; y: number; text: string; color: string; life: number; max: number }
export type Control = { x: number; y: number; aimX: number; aimY: number; fire: boolean; dash: boolean; rally: boolean }
export type Upgrade = { id: string; name: string; tag: string; description: string; icon: 'rope' | 'heart' | 'team' | 'bolt' | 'shield' | 'speed' }
export const UPGRADES: Upgrade[] = [
  { id: 'speed', name: '快一点下班', tag: '机动强化', description: '移动速度 +18%，冲刺冷却减少 0.5 秒。', icon: 'speed' },
  { id: 'rope', name: '祖传加长绳', tag: '武器强化', description: '皮搋子射程 +25%，发射间隔减少 12%。', icon: 'rope' },
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
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x, a.y-b.y)
const allyHP = (kind: Kind, tier: number) => (kind === 'melee' ? 92 : 65) * [0, 1, 2.5, 6][tier]
export function walkable(x: number, y: number, radius = 16) {
  if (x < radius + 35 || x > WORLD.width-radius-35 || y < radius+35 || y > WORLD.height-radius-35) return false
  return Math.abs(y-900) < 236-radius || [900,2700,4500].some(cx => Math.abs(x-cx)<170-radius)
}
export class GameModel {
  status: Status = 'ready'
  time = 0
  player = { x: 820, y: 945, hp: 100, maxHp: 100, angle: 0, invincible: 0, dash: 0, dashCd: 0, rallyCd: 0 }
  enemies: Actor[] = []
  allies: Actor[] = []
  bullets: Bullet[] = []
  effects: Effect[] = []
  pickups: {id:number;x:number;y:number;life:number}[] = []
  captured = 0
  merges = 0
  kills = 0
  level = 1
  xp = 0
  nextXp = 5
  capacity = 6
  stage = 0
  upgradeChoices: Upgrade[] = []
  autoFire = true
  message = '第一站 · 马桶店街口'
  messageUntil = 7
  visited = new Set<number>()
  sounds: string[] = []
  private uid = 0
  private spawnCd = 2
  private shotCd = 0
  private pickupCd = 24
  private speed = 190
  private shotInterval = .46
  private range = 500
  private armor = 1
  private power = 1
  private allyArmor = 1
  private rallyTime = 0
  private dashMax = 3.7
  private wave = 0
  random: () => number
  constructor(random: () => number = Math.random) { this.random=random }
  start() { if (this.status === 'ready') { this.status='running'; for(let i=0;i<4;i++)this.spawnEnemy(i%2 ? 'ranged':'melee',1100+i*95,850+(i%2)*100) } }
  togglePause() { if(this.status==='running')this.status='paused';else if(this.status==='paused')this.status='running' }
  text(x:number,y:number,text:string,color='#f5d65b',life=1.4) {this.effects.push({x,y,text,color,life,max:life})}
  spawnEnemy(kind?: Kind, x?: number, y?: number, elite=false) {
    const a=this.random()*Math.PI*2
    let sx=x??clamp(this.player.x+Math.cos(a)*650,60,WORLD.width-60)
    let sy=y??clamp(this.player.y+Math.sin(a)*440,60,WORLD.height-60)
    if (!walkable(sx,sy)) sy=clamp(sy,705,1095)
    if(dist({x:sx,y:sy},this.player)<290) sx=clamp(this.player.x+(sx>this.player.x?500:-500),60,WORLD.width-60)
    elite=elite||(this.time>180&&this.random()<.02+this.time/12000)
    const hp=elite?3+Math.floor(this.time/120):1+Math.floor(this.time/240)
    this.enemies.push({ id:++this.uid,x:sx,y:sy,kind:kind??(this.random()<.28+this.time/1900?'ranged':'melee'),hp,maxHp:hp,tier:1,cd:1+this.random(),elite,angle:0,flash:0 })
  }
  recruit(kind: Kind, x=this.player.x, y=this.player.y) {
    this.captured++;this.xp++;this.kills++
    const pair = this.allies.filter(a=>a.kind===kind&&a.tier===1)
    if(this.allies.length>=this.capacity&&pair.length<2){this.text(x,y,'编队已满 · 回复全队','#a5d6c0');this.allies.forEach(a=>a.hp=Math.min(a.maxHp,a.hp+12));this.player.hp=Math.min(this.player.maxHp,this.player.hp+2);return}
    const hp=allyHP(kind,1)*this.allyArmor
    this.allies.push({id:++this.uid,x,y,kind,tier:1,hp,maxHp:hp,cd:.2,angle:0,flash:0})
    this.text(x,y,kind==='melee'?'近战护卫 +1':'远程射手 +1','#b4ead0');this.sounds.push('capture')
    this.mergeAllies()
  }
  mergeAllies() {
    for(const kind of ['melee','ranged'] as Kind[])for(let tier=1;tier<3;tier++){
      let group=this.allies.filter(a=>a.kind===kind&&a.tier===tier)
      while(group.length>=3){
        const consumed=group.slice(0,3), ids=new Set(consumed.map(a=>a.id)), center=consumed[0]
        this.allies=this.allies.filter(a=>!ids.has(a.id));const hp=allyHP(kind,tier+1)*this.allyArmor
        this.allies.push({id:++this.uid,x:center.x,y:center.y,kind,tier:tier+1,hp,maxHp:hp,cd:.1,angle:0,flash:.6})
        this.merges++;this.text(center.x,center.y,`合成！${tier+1} 级${kind==='melee'?'护卫':'射手'}`,'#ffe07b',2.5);this.sounds.push('merge')
        group=this.allies.filter(a=>a.kind===kind&&a.tier===tier)
      }
    }
  }
  chooseUpgrade(id:string) {
    if(this.status!=='upgrade'||!this.upgradeChoices.some(u=>u.id===id))return
    switch(id){
      case 'speed':this.speed*=1.18;this.dashMax=Math.max(1.5,this.dashMax-.5);break
      case 'rope':this.range*=1.25;this.shotInterval*=.88;break
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
  private hurtPlayer(damage:number) {
    if(this.player.invincible>0)return
    this.player.hp=Math.max(0,this.player.hp-damage*this.armor);this.player.invincible=.65
    this.text(this.player.x,this.player.y-30,`−${Math.ceil(damage*this.armor)}`,'#ff816d');this.sounds.push('hurt')
    if(this.player.hp<=0)this.status='lost'
  }
  private hitEnemy(enemy:Actor,damage:number,capture:boolean) {
    if(enemy.hp<=0)return
    enemy.hp-=damage;enemy.flash=.12
    if(enemy.hp>0){this.text(enemy.x,enemy.y,'护甲破裂','#f4a56c');return}
    if(capture){this.recruit(enemy.kind,enemy.x,enemy.y);if(enemy.elite){this.player.hp=Math.min(this.player.maxHp,this.player.hp+18);this.text(enemy.x,enemy.y-45,'精英捕获 · 生命 +18')}}
    else {this.kills++;this.xp+=.45;this.text(enemy.x,enemy.y,'+能量','#b5dbba',.65);if(this.random()<.08)this.pickups.push({id:++this.uid,x:enemy.x,y:enemy.y,life:22})}
  }
  private fire(x:number,y:number,angle:number,team:Bullet['team'],damage=1) {
    const speed=team==='rope'?850:team==='ally'?480:205+this.time*.08
    this.bullets.push({id:++this.uid,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,team,damage,life:team==='rope'?3:3.1,distance:0})
  }
  update(dt:number,input:Control) {
    if(this.status!=='running')return
    dt=Math.min(dt,.05);this.time+=dt
    const p=this.player
    p.invincible=Math.max(0,p.invincible-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.rallyCd=Math.max(0,p.rallyCd-dt);p.dash=Math.max(0,p.dash-dt);this.rallyTime=Math.max(0,this.rallyTime-dt)
    const len=Math.hypot(input.x,input.y)||1
    if(input.dash&&p.dashCd===0&&(input.x||input.y)){p.dash=.19;p.dashCd=this.dashMax;p.invincible=.3;this.sounds.push('dash')}
    this.move(p,input.x/len*this.speed*(p.dash>0?3.8:1),input.y/len*this.speed*(p.dash>0?3.8:1),dt)
    p.angle=Math.atan2(input.aimY-p.y,input.aimX-p.x)
    if(input.rally&&p.rallyCd===0){p.rallyCd=10;this.rallyTime=2.3;this.allies.forEach(a=>a.hp=Math.min(a.maxHp,a.hp+15));this.enemies.forEach(e=>{const d=dist(e,p);if(d<210){const angle=Math.atan2(e.y-p.y,e.x-p.x);this.move(e,Math.cos(angle)*120,Math.sin(angle)*120,1);}});this.text(p.x,p.y,'集结！全队回复','#a5dfd0');this.sounds.push('merge')}
    this.shotCd-=dt
    if((input.fire||this.autoFire)&&this.shotCd<=0){
      let angle=p.angle
      if(this.autoFire){let nearest:Actor|undefined;let nd=this.range;for(const e of this.enemies){const d=dist(e,p);if(e.hp>0&&d<nd){nearest=e;nd=d}}if(nearest)angle=Math.atan2(nearest.y-p.y,nearest.x-p.x);else angle=p.angle}
      this.fire(p.x,p.y,angle,'rope');this.shotCd=this.shotInterval;this.sounds.push('shot')
    }
    const stage=Math.min(4,Math.floor(this.time/120))
    if(stage!==this.stage){this.stage=stage;this.message=`第 ${stage+1} 站 · ${STAGES[stage].name}`;this.messageUntil=this.time+6;for(let i=0;i<stage+1;i++)this.spawnEnemy('melee',undefined,undefined,true);this.sounds.push('upgrade')}
    const target=STAGES[stage]
    if(!this.visited.has(stage)&&Math.abs(p.x-target.x)<145&&Math.abs(p.y-900)<220){this.visited.add(stage);p.hp=Math.min(p.maxHp,p.hp+22);this.xp+=2;this.text(p.x,p.y-50,'街区补给 · 生命 +22','#c8e9b0',2.4)}
    this.spawnCd-=dt
    if(this.spawnCd<=0){const count=1+Math.floor(this.time/110);for(let i=0;i<count;i++)if(this.enemies.length<85)this.spawnEnemy();this.spawnCd=Math.max(.48,1.9-this.time*.002)/(1+this.allies.length*.06)}
    const wave=Math.floor(this.time/60)
    if(wave>this.wave){this.wave=wave;for(let i=0;i<5+stage*2;i++)if(this.enemies.length<85)this.spawnEnemy(undefined,undefined,undefined,i===0&&wave>1);if(wave%2===1){this.message='怪物潮来袭 · 保持移动！';this.messageUntil=this.time+5;this.sounds.push('upgrade')}}
    this.pickupCd-=dt
    if(this.pickupCd<=0){this.pickupCd=32;this.pickups.push({id:++this.uid,x:clamp(p.x+180*(this.random()>.5?1:-1),80,5300),y:clamp(p.y+80*(this.random()>.5?1:-1),735,1065),life:30})}
    for(const e of this.enemies){
      if(e.hp<=0)continue
      e.flash=Math.max(0,e.flash-dt);e.cd-=dt
      let target:{x:number;y:number;hp:number}=p,nd=dist(e,p)
      for(const ally of this.allies){const d=dist(e,ally);if(d<nd*.85){target=ally;nd=d}}
      e.angle=Math.atan2(target.y-e.y,target.x-e.x)
      const speed=(e.kind==='melee'?94:75)*(1+this.time/1200)*(e.elite?1.22:1)
      if(e.kind==='melee'||nd>285||this.rallyTime>0)this.move(e,Math.cos(e.angle)*speed,Math.sin(e.angle)*speed,dt)
      else if(nd<170)this.move(e,-Math.cos(e.angle)*speed*.7,-Math.sin(e.angle)*speed*.7,dt)
      if(e.kind==='melee'&&nd<(e.elite?47:33)&&e.cd<=0){const damage=(e.elite?23:10)*(1+this.time/1200);if(target===p)this.hurtPlayer(damage);else{target.hp-=damage/this.allyArmor;this.text(target.x,target.y,'−','#f09a82',.4)}e.cd=.95}
      if(e.kind==='ranged'&&nd<540&&e.cd<=0){this.fire(e.x,e.y,e.angle,'enemy',8);if(this.time>360){this.fire(e.x,e.y,e.angle+.18,'enemy',6);this.fire(e.x,e.y,e.angle-.18,'enemy',6)}e.cd=Math.max(1.25,2.5-this.time/800)}
    }
    for(let i=0;i<this.allies.length;i++){
      const a=this.allies[i];a.cd-=dt;a.flash=Math.max(0,a.flash-dt)
      let enemy:Actor|undefined,nd=a.kind==='melee'?330:510
      if(this.rallyTime<=0)for(const e of this.enemies){const d=dist(a,e);if(e.hp>0&&d<nd){nd=d;enemy=e}}
      const orbit=i*2.399+this.time*.1;let tx=p.x+Math.cos(orbit)*78,ty=p.y+Math.sin(orbit)*66
      if(enemy){a.angle=Math.atan2(enemy.y-a.y,enemy.x-a.x);if(a.kind==='melee'){tx=enemy.x;ty=enemy.y}}
      const d=Math.hypot(tx-a.x,ty-a.y);if(d>12){const speed=dist(a,p)>420?350:225;this.move(a,(tx-a.x)/d*speed,(ty-a.y)/d*speed,dt)}
      const damage=[0,.8,2.1,5.2][a.tier]*this.power
      if(enemy&&a.cd<=0){
        if(a.kind==='melee'&&nd<46+a.tier*12){const radius=[0,58,85,125][a.tier];this.enemies.forEach(e=>{if(e.hp>0&&dist(a,e)<radius)this.hitEnemy(e,damage,false)});this.text(a.x,a.y,'✦',a.tier===3?'#ffe18b':'#d5e5bc',.25);a.cd=.85/Math.sqrt(this.power)}
        else if(a.kind==='ranged'){this.fire(a.x,a.y,a.angle,'ally',damage);if(a.tier===3){this.fire(a.x,a.y,a.angle-.16,'ally',damage*.7);this.fire(a.x,a.y,a.angle+.16,'ally',damage*.7)}a.cd=1.1/Math.sqrt(this.power)}
      }
    }
    for(const b of this.bullets){
      b.life-=dt
      if(b.team==='rope'&&b.returning){const d=dist(b,p);if(d<25){b.life=0;continue}b.vx=(p.x-b.x)/d*1100;b.vy=(p.y-b.y)/d*1100}
      const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.distance+=Math.hypot(b.vx,b.vy)*dt
      if(b.team==='rope'&&!b.returning&&b.distance>this.range)b.returning=true
      if(!walkable(b.x,b.y,3)){if(b.team==='rope')b.returning=true;else b.life=0}
      if(b.team==='enemy'){
        if(dist(b,p)<22){this.hurtPlayer(b.damage);b.life=0}
        else for(const a of this.allies)if(dist(b,a)<22){a.hp-=b.damage/this.allyArmor;b.life=0;break}
      }else if(!b.returning){
        for(const e of this.enemies){if(e.hp<=0)continue;const vx=b.x-oldX,vy=b.y-oldY,den=vx*vx+vy*vy;const t=den?clamp(((e.x-oldX)*vx+(e.y-oldY)*vy)/den,0,1):0;const distance=Math.hypot(e.x-(oldX+t*vx),e.y-(oldY+t*vy));if(distance<(e.elite?36:24)){this.hitEnemy(e,b.damage,b.team==='rope');if(b.team==='rope')b.returning=true;else b.life=0;break}}
      }
    }
    this.enemies=this.enemies.filter(e=>e.hp>0&&dist(e,p)<1800)
    this.allies=this.allies.filter(a=>{if(a.hp<=0){this.text(a.x,a.y,'僚机倒下了','#efbca6');return false}return true})
    this.bullets=this.bullets.filter(b=>b.life>0)
    for(const pickup of this.pickups){pickup.life-=dt;if(dist(pickup,p)<38){pickup.life=0;p.hp=Math.min(p.maxHp,p.hp+25);this.text(p.x,p.y,'生命 +25','#ade8cb');this.sounds.push('capture')}}
    this.pickups=this.pickups.filter(a=>a.life>0)
    for(const e of this.effects){e.life-=dt;e.y-=dt*19}this.effects=this.effects.filter(e=>e.life>0)
    if(this.status==='running'&&this.xp>=this.nextXp){this.level++;this.xp-=this.nextXp;this.nextXp+=7;this.upgradeChoices=[...UPGRADES].filter(u=>(u.id!=='team'||this.capacity<10)&&(u.id!=='shield'||this.armor>.4)).map(u=>({u,s:this.random()})).sort((a,b)=>a.s-b.s).slice(0,3).map(a=>a.u);this.status='upgrade';this.sounds.push('upgrade')}
    if(this.status==='running'&&this.time>=DURATION&&p.x>4650&&Math.abs(p.y-900)<235){this.status='won';this.sounds.push('upgrade')}
    if(this.time>=DURATION&&this.message!=='家门已打开 · 前往最右侧的家'){this.message='家门已打开 · 前往最右侧的家';this.messageUntil=this.time+60}
  }
}
