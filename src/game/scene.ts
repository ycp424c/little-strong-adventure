import Phaser from 'phaser'
import { GameModel, STAGES, WORLD, type Actor, type Control } from './model'
import { DIRECTIONS, HERO_FRAME_SIZE, MONSTER_FRAME_SIZE, PROJECTILE_FRAME_SIZE, HeroAnimator, MonsterAnimator, TEAM_COLORS, hitReaction, projectileFrame } from './animation'

type ActorVisual={body:Phaser.GameObjects.Sprite;outline:Phaser.GameObjects.Sprite;wash:Phaser.GameObjects.Sprite;animation:MonsterAnimator;attackSeq:number;x:number;y:number}

export type GameBridge = { model: GameModel; onChange: () => void; onReady: () => void; onPause: () => void; muted: () => boolean; move: { x:number;y:number;dash:boolean;fire:boolean } }
export class StreetScene extends Phaser.Scene {
  bridge: GameBridge
  private actors = new Map<number, ActorVisual>()
  private playerSprite!: Phaser.GameObjects.Sprite
  private heroAnimation = new HeroAnimator()
  private lastShotId = 0
  private projectiles = new Map<number,{sprite:Phaser.GameObjects.Sprite;trail:{x:number;y:number}[]}>()
  private fx!: Phaser.GameObjects.Graphics
  private labels = new Map<number, Phaser.GameObjects.Text>()
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private hudTick = 0
  private clock = 0
  private audio?: AudioContext
  private marker!: Phaser.GameObjects.Container
  private markerText!: Phaser.GameObjects.Text
  private lastStatus = 'ready'
  private captureRequested = false
  constructor(bridge:GameBridge){super('street');this.bridge=bridge}
  private fillTexture(key:string,color:number) {
    if(this.game.renderer.type!==Phaser.CANVAS)return key
    const filled=`${key}-fill-${color.toString(16)}`
    if(this.textures.exists(filled))return filled
    // Canvas rendering ignores Phaser tint. Cache half-resolution alpha silhouettes once;
    // these overlays keep team colors and hit flashes visible without extra downloaded art.
    const original=this.textures.get(key),source=original.getSourceImage() as HTMLImageElement
    const texture=this.textures.createCanvas(filled,source.width/2,source.height/2)
    if(!texture)throw new Error(`Cannot create palette texture: ${filled}`)
    const context=texture.context
    context.drawImage(source,0,0,source.width/2,source.height/2)
    context.globalCompositeOperation='source-in';context.fillStyle=`#${color.toString(16).padStart(6,'0')}`
    context.fillRect(0,0,source.width/2,source.height/2);context.globalCompositeOperation='source-over'
    for(const name of original.getFrameNames()){
      const frame=original.get(name)
      texture.add(name,0,frame.cutX/2,frame.cutY/2,frame.cutWidth/2,frame.cutHeight/2)
    }
    texture.refresh()
    return filled
  }
  preload() {
    const assets=`${import.meta.env.BASE_URL}assets/`
    this.load.image('city',`${assets}city.webp`)
    this.load.spritesheet('hero-walk',`${assets}hero-walk.webp`,{frameWidth:HERO_FRAME_SIZE,frameHeight:HERO_FRAME_SIZE})
    this.load.spritesheet('hero-attack',`${assets}hero-attack.webp`,{frameWidth:HERO_FRAME_SIZE,frameHeight:HERO_FRAME_SIZE})
    this.load.spritesheet('projectiles',`${assets}projectiles.webp`,{frameWidth:PROJECTILE_FRAME_SIZE,frameHeight:PROJECTILE_FRAME_SIZE})
    for(const kind of ['melee','ranged'])this.load.spritesheet(`monster-${kind}`,`${assets}monster-${kind}.webp`,{frameWidth:MONSTER_FRAME_SIZE,frameHeight:MONSTER_FRAME_SIZE})
  }
  create() {
    const {model}=this.bridge
    this.add.image(WORLD.width/2,WORLD.height/2,'city').setDisplaySize(WORLD.width,WORLD.height).setDepth(-10)
    const shade=this.add.graphics().setDepth(-9)
    shade.fillStyle(0x203a32,.12);shade.fillRect(0,0,WORLD.width,WORLD.height)
    // These in-world labels keep map art free of AI-generated lettering.
    for(let i=0;i<5;i++){
      const x=STAGES[i].x
      this.add.text(x,637,STAGES[i].name,{fontFamily:'"PingFang SC",sans-serif',fontSize:'22px',fontStyle:'bold',color:'#eee5c7',backgroundColor:'#263b32',padding:{x:18,y:10}}).setOrigin(.5).setDepth(3)
    }
    this.add.text(685,692,'小强卫浴 · 今日打烊',{fontFamily:'"PingFang SC",sans-serif',fontSize:'17px',color:'#292f27',backgroundColor:'#eed471',padding:{x:13,y:8}}).setOrigin(.5).setDepth(4)
    this.add.text(4930,740,'家  HOME',{fontFamily:'Georgia,serif',fontSize:'28px',fontStyle:'bold',color:'#ffeb9c',backgroundColor:'#294c3b',padding:{x:24,y:14}}).setOrigin(.5).setDepth(4)
    this.playerSprite=this.add.sprite(model.player.x,model.player.y,'hero-walk',this.heroAnimation.reset().frame).setDisplaySize(141,141).setDepth(20)
    this.fx=this.add.graphics().setDepth(25)
    const circle=this.add.circle(0,0,34,0xf1cf55,.14).setStrokeStyle(2,0xf6dc6e,.8)
    const arrow=this.add.text(0,-2,'➜',{fontSize:'32px',color:'#ffdf68'}).setOrigin(.5)
    this.markerText=this.add.text(0,54,'前往街区补给',{fontSize:'14px',fontFamily:'"PingFang SC",sans-serif',color:'#fff0b5',backgroundColor:'#24392dcc',padding:{x:10,y:6}}).setOrigin(.5)
    this.marker=this.add.container(STAGES[0].x,900,[circle,arrow,this.markerText]).setDepth(5)
    const camera=this.cameras.main
    camera.setBounds(0,0,WORLD.width,WORLD.height);camera.setZoom(1)
    camera.startFollow(this.playerSprite,true,.085,.085,0,0)
    if(this.input.keyboard){
      this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC,P,F') as Record<string,Phaser.Input.Keyboard.Key>
      this.input.keyboard.on('keydown-ESC',()=>this.bridge.onPause())
      this.input.keyboard.on('keydown-P',()=>this.bridge.onPause())
      this.input.keyboard.addCapture(['UP','DOWN','LEFT','RIGHT','SPACE'])
    }
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(pointer.leftButtonDown()&&this.bridge.model.status==='running')this.captureRequested=true})
    this.game.canvas.setAttribute('aria-label','小强历险记游戏画面，WASD 或方向键移动，F 或鼠标左键手动捕获，自动瞄准最近敌人')
    this.game.canvas.setAttribute('role','img')
    this.game.events.on('reset',this.reset,this)
    this.events.once('shutdown',()=>{this.game.events.off('reset',this.reset,this);this.audio?.close()})
    this.bridge.onReady()
  }
  private reset() {
    this.captureRequested=false
    const pose=this.heroAnimation.reset();this.lastShotId=0;this.clock=0
    this.playerSprite.setTexture(pose.texture,pose.frame).setDisplaySize(141,141).clearTint().setAlpha(1)
    for(const projectile of this.projectiles.values())projectile.sprite.destroy();this.projectiles.clear()
    for(const visual of this.actors.values()){visual.body.destroy();visual.outline.destroy();visual.wash.destroy()}this.actors.clear()
    for(const label of this.labels.values())label.destroy();this.labels.clear()
    this.playerSprite.setPosition(this.bridge.model.player.x,this.bridge.model.player.y)
    if(this.keys)Object.values(this.keys).forEach(k=>k.reset())
    this.cameras.main.centerOn(this.bridge.model.player.x,this.bridge.model.player.y)
  }
  private tone(event:string) {
    if(this.bridge.muted())return
    try{
      this.audio??=new AudioContext();if(this.audio.state==='suspended')void this.audio.resume()
      const osc=this.audio.createOscillator(),gain=this.audio.createGain(),now=this.audio.currentTime
      const freq:Record<string,number>={shot:170,capture:660,merge:880,hurt:100,upgrade:1040,dash:260}
      osc.type=event==='hurt'?'sawtooth':'sine';osc.frequency.setValueAtTime(freq[event]??440,now);osc.frequency.exponentialRampToValueAtTime(event==='shot'?80:(freq[event]??440)*1.5,now+.12)
      gain.gain.setValueAtTime(event==='shot'?.014:.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15)
      osc.connect(gain);gain.connect(this.audio.destination);osc.start();osc.stop(now+.16)
    }catch{/* Gameplay remains available if audio is unsupported. */}
  }
  private syncActor(a:Actor,ally:boolean,dt:number,running:boolean) {
    let visual=this.actors.get(a.id)
    if(!visual){
      const texture=`monster-${a.kind}`
      visual={outline:this.add.sprite(a.x,a.y,texture),body:this.add.sprite(a.x,a.y,texture),wash:this.add.sprite(a.x,a.y,texture),animation:new MonsterAnimator(),attackSeq:0,x:a.x,y:a.y};this.actors.set(a.id,visual)
    }
    const pose=visual.animation.update(dt,{running,dx:a.x-visual.x,dy:a.y-visual.y,aimAngle:a.angle,attackAngle:a.attackSeq!==visual.attackSeq?a.angle:undefined})
    visual.x=a.x;visual.y=a.y;visual.attackSeq=a.attackSeq
    const size=a.elite?178:ally?118+a.tier*12:132,color=ally?TEAM_COLORS.ally:TEAM_COLORS.enemy,depth=10+a.y*.001
    const hit=hitReaction(a.hit,a.hitAngle),x=a.x+hit.x,y=a.y+hit.y,texture=`monster-${a.kind}`,filled=this.fillTexture(texture,color)
    visual.outline.setTexture(filled,pose.frame).setDisplaySize(size*1.08,size*1.08).setPosition(x,y).setDepth(depth).setTintFill(color).setAlpha(ally?.85:.64)
    visual.body.setTexture(hit.white?this.fillTexture(texture,0xffffff):texture,pose.frame).setDisplaySize(size,size).setPosition(x,y).setDepth(depth+.01)
    if(hit.white)visual.body.setTintFill(0xffffff);else visual.body.setTint(a.flash>0?0xffe9a4:ally?0xb3f3ff:0xffc3ae)
    visual.wash.setTexture(filled,pose.frame).setDisplaySize(size,size).setPosition(x,y).setDepth(depth+.02).setTintFill(color).setAlpha(hit.white?0:ally?.4:.24)
    const width=size*.48
    this.fx.fillStyle(color,ally?.12:.07);this.fx.fillEllipse(a.x,a.y+24,width+12,23)
    this.fx.lineStyle(ally?2.5:1.5,color,ally?.95:.65)
    if(ally){this.fx.strokeEllipse(a.x,a.y+24,width+10,23);this.fx.fillStyle(color);this.fx.fillTriangle(a.x-5,a.y+43,a.x+5,a.y+43,a.x,a.y+37)}
    else {this.fx.beginPath();this.fx.moveTo(a.x-width*.6,a.y+24);this.fx.lineTo(a.x,a.y+11);this.fx.lineTo(a.x+width*.6,a.y+24);this.fx.lineTo(a.x,a.y+37);this.fx.closePath();this.fx.strokePath()}
    if(ally){
      this.fx.fillStyle(0x142e25,.8);this.fx.fillRoundedRect(a.x-19,a.y+32,38,4,2)
      this.fx.fillStyle(color,1);this.fx.fillRoundedRect(a.x-19,a.y+32,38*Math.max(0,a.hp/a.maxHp),4,2)
      for(let i=0;i<a.tier;i++){this.fx.fillStyle(a.tier===3?0xffda68:color);this.fx.fillCircle(a.x+(i-(a.tier-1)/2)*9,a.y-38,2.8)}
    }else if(a.elite){this.fx.fillStyle(0x1c2725);this.fx.fillRect(a.x-28,a.y-51,56,5);this.fx.fillStyle(color);this.fx.fillRect(a.x-28,a.y-51,56*a.hp/a.maxHp,5);this.fx.lineStyle(2,0xffca70,.9);this.fx.strokeCircle(a.x,a.y-58,5)}
    if(pose.action==='attack'){
      const attackAngle=DIRECTIONS.indexOf(pose.direction)*Math.PI/4
      this.fx.lineStyle(ally?3:2,color,.7)
      if(a.kind==='melee'){this.fx.beginPath();this.fx.arc(a.x,a.y,36+a.tier*3,attackAngle-.65,attackAngle+.65,false);this.fx.strokePath()}
      else {this.fx.strokeCircle(a.x+Math.cos(attackAngle)*24,a.y+Math.sin(attackAngle)*24,10+Math.sin(this.clock*28)*2)}
    }
  }
  update(_time:number,delta:number) {
    if(!this.playerSprite)return
    const {model,move}=this.bridge, p=model.player
    const dt=Math.min(delta/1000,.05)
    const advancing=model.status==='running',oldX=p.x,oldY=p.y
    if(advancing)this.clock+=dt
    const k=this.keys
    const control:Control={x:(k?.D.isDown||k?.RIGHT.isDown?1:0)-(k?.A.isDown||k?.LEFT.isDown?1:0)+move.x,y:(k?.S.isDown||k?.DOWN.isDown?1:0)-(k?.W.isDown||k?.UP.isDown?1:0)+move.y,fire:!!(k?.F&&Phaser.Input.Keyboard.JustDown(k.F))||this.captureRequested||move.fire,dash:!!k?.SPACE.isDown||move.dash,rally:false}
    this.captureRequested=false;move.fire=false
    model.update(dt,control)
    const shot=model.bullets.find(b=>b.team==='rope'&&b.id>this.lastShotId)
    if(shot)this.lastShotId=shot.id
    const pose=this.heroAnimation.update(dt,{running:advancing,dx:p.x-oldX,dy:p.y-oldY,aimAngle:model.weaponTarget?p.angle:undefined,shotAngle:shot?Math.atan2(shot.vy,shot.vx):undefined,dashing:p.dash>0})
    const playerHit=hitReaction(p.hit,p.hitAngle),heroTexture=playerHit.white?this.fillTexture(pose.texture,0xffffff):pose.texture
    if(this.playerSprite.texture.key!==heroTexture)this.playerSprite.setTexture(heroTexture,pose.frame).setDisplaySize(141,141)
    else this.playerSprite.setFrame(pose.frame)
    this.fx.clear()
    const target=model.weaponTarget
    if(target&&model.status==='running'){
      const angle=Math.atan2(target.enemy.y-p.y,target.enemy.x-p.x),length=Math.min(target.distance,model.weaponRange),color=target.inRange?0xe9d88e:0xd2d9c8
      this.fx.lineStyle(1,color,model.weaponCooldown>0?.14:.3)
      for(let d=24;d<length-8;d+=18)this.fx.lineBetween(p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d,p.x+Math.cos(angle)*Math.min(d+9,length),p.y+Math.sin(angle)*Math.min(d+9,length))
      this.fx.lineStyle(1,color,target.inRange?.48:.2);this.fx.strokeCircle(target.enemy.x,target.enemy.y,target.enemy.elite?45:34)
      if(!target.inRange){this.fx.lineStyle(1,0xe9d88e,.13);this.fx.strokeCircle(p.x,p.y,model.weaponRange)}
    }
    this.fx.fillStyle(0x132d25,.35);this.fx.fillEllipse(p.x,p.y+26,48,18)
    this.fx.lineStyle(2,0xf0d573,.9);this.fx.strokeEllipse(p.x,p.y+22,63,30)
    this.playerSprite.setPosition(p.x+playerHit.x,p.y+playerHit.y).setDepth(20+p.y*.001)
    if(playerHit.white)this.playerSprite.setTintFill(0xffffff);else this.playerSprite.clearTint()
    this.playerSprite.setAlpha(p.invincible>0&&Math.floor(this.clock*20)%2===0?.45:1)
    if(p.dash>0){this.fx.lineStyle(4,0xf8d76b,.7);this.fx.strokeCircle(p.x,p.y,43)}
    const active=new Set<number>()
    for(const a of model.enemies){active.add(a.id);this.syncActor(a,false,dt,advancing)}
    for(const a of model.allies){active.add(a.id);this.syncActor(a,true,dt,advancing)}
    for(const [id,visual]of this.actors){if(!active.has(id)){visual.body.destroy();visual.outline.destroy();visual.wash.destroy();this.actors.delete(id)}}
    for(const impact of model.impacts){
      const progress=1-impact.life/impact.max,color=TEAM_COLORS[impact.team],radius=8+progress*29
      this.fx.lineStyle(3*(1-progress)+.5,color,1-progress);this.fx.strokeCircle(impact.x,impact.y,radius)
      this.fx.lineStyle(2,0xfff4d4,1-progress)
      for(let i=0;i<5;i++){const angle=impact.angle+(i-2)*.65,inner=8+progress*15,outer=inner+9*(1-progress);this.fx.lineBetween(impact.x+Math.cos(angle)*inner,impact.y+Math.sin(angle)*inner,impact.x+Math.cos(angle)*outer,impact.y+Math.sin(angle)*outer)}
    }
    const activeProjectiles=new Set<number>()
    for(const bullet of model.bullets){
      activeProjectiles.add(bullet.id)
      let visual=this.projectiles.get(bullet.id)
      if(!visual){visual={sprite:this.add.sprite(bullet.x,bullet.y,'projectiles').setOrigin(bullet.team==='rope'?.74:.5,.5).setDepth(28),trail:[]};this.projectiles.set(bullet.id,visual)}
      if(advancing){visual.trail.push({x:bullet.x,y:bullet.y});if(visual.trail.length>6)visual.trail.shift()}
      const angle=Math.atan2(bullet.vy,bullet.vx),phase=this.clock*22+bullet.id,color=bullet.team==='rope'?0xf0c990:TEAM_COLORS[bullet.team]
      const size=bullet.team==='rope'?54:30+Math.sin(phase)*2
      visual.sprite.setFrame(projectileFrame(bullet.team,this.clock,bullet.id)).setPosition(bullet.x,bullet.y).setDisplaySize(size,size).setRotation(angle+(bullet.team==='rope'?Math.sin(phase)*.08:this.clock*2)).setAlpha(bullet.returning?.84:1)
      for(let i=1;i<visual.trail.length;i++){
        const from=visual.trail[i-1],to=visual.trail[i]
        this.fx.lineStyle(1+i*.6,color,i/visual.trail.length*.35);this.fx.lineBetween(from.x,from.y,to.x,to.y)
      }
      if(bullet.team==='rope'){
        const dx=bullet.x-Math.cos(angle)*32-p.x,dy=bullet.y-Math.sin(angle)*32-p.y,length=Math.hypot(dx,dy)||1,sway=Math.min(bullet.returning?20:10,length*.1)*Math.sin(this.clock*17)
        this.fx.lineStyle(2,0xe7d3a6,.88);this.fx.beginPath();this.fx.moveTo(p.x,p.y+9)
        for(let i=1;i<=12;i++){const t=i/12,bend=Math.sin(t*Math.PI)*sway;this.fx.lineTo(p.x+dx*t-dy/length*bend,p.y+9+(dy-9)*t+dx/length*bend)}
        this.fx.strokePath()
      }else{
        this.fx.fillStyle(color,.08+Math.sin(phase)*.025);this.fx.fillCircle(bullet.x,bullet.y,16+Math.sin(phase)*2)
      }
    }
    for(const [id,visual]of this.projectiles)if(!activeProjectiles.has(id)){visual.sprite.destroy();this.projectiles.delete(id)}
    for(const pickup of model.pickups){const y=pickup.y+Math.sin(this.clock*4)*4;this.fx.fillStyle(0x83c4a3,.2);this.fx.fillCircle(pickup.x,y,25);this.fx.fillStyle(0xf2e8c8);this.fx.fillRoundedRect(pickup.x-12,y-12,24,24,5);this.fx.fillStyle(0x5c9d7b);this.fx.fillRect(pickup.x-7,y-2,14,4);this.fx.fillRect(pickup.x-2,y-7,4,14)}
    const effects=new Set<number>()
    model.effects.forEach((effect,index)=>{
      effects.add(index);let label=this.labels.get(index)
      if(!label){label=this.add.text(0,0,'',{fontFamily:'"PingFang SC",sans-serif',fontSize:'16px',fontStyle:'bold',stroke:'#263d32',strokeThickness:4}).setOrigin(.5).setDepth(40);this.labels.set(index,label)}
      label.setText(effect.text).setPosition(effect.x,effect.y-30).setColor(effect.color).setAlpha(Math.min(1,effect.life*2))
    })
    for(const [id,label]of this.labels)if(!effects.has(id)){label.destroy();this.labels.delete(id)}
    this.marker.setPosition(STAGES[model.stage].x,900).setAlpha(.75+Math.sin(this.clock*3)*.2)
    this.markerText.setText(model.stage===4?(model.time>=600?'家门已开启':'坚持到 10:00，回家！'):(model.visited.has(model.stage)?'继续守住街区':'街区补给 · 生命 +22'))
    if(model.status!==this.lastStatus){this.bridge.onChange();this.lastStatus=model.status}
    if(model.sounds.length){const sounds=model.sounds.splice(0);for(const sound of new Set(sounds)){this.tone(sound);if(sound==='hurt')this.cameras.main.shake(100,.002);if(sound==='merge')this.cameras.main.flash(180,210,190,80,false,undefined,this)}}
    this.hudTick+=delta
    if(this.hudTick>100){this.hudTick=0;this.bridge.onChange()}
  }
}
