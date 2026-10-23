import Phaser from 'phaser'
import { GameModel, STAGES, WORLD, type Actor, type Control } from './model'

export type GameBridge = { model: GameModel; onChange: () => void; onReady: () => void; onPause: () => void; muted: () => boolean; move: { x:number;y:number;dash:boolean;fire:boolean } }
export class StreetScene extends Phaser.Scene {
  bridge: GameBridge
  private actors = new Map<number, Phaser.GameObjects.Image>()
  private playerSprite!: Phaser.GameObjects.Image
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
  preload() {
    const assets=`${import.meta.env.BASE_URL}assets/`
    this.load.image('city',`${assets}city.webp`)
    this.load.image('hero',`${assets}hero.png`)
    this.load.image('melee',`${assets}melee.png`)
    this.load.image('ranged',`${assets}ranged.png`)
    this.load.image('elite',`${assets}elite.png`)
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
    this.playerSprite=this.add.image(model.player.x,model.player.y,'hero').setDisplaySize(62,76).setDepth(20)
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
    for(const image of this.actors.values())image.destroy();this.actors.clear()
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
  private syncActor(a:Actor,ally:boolean) {
    let image=this.actors.get(a.id)
    if(!image){image=this.add.image(a.x,a.y,a.elite?'elite':a.kind);this.actors.set(a.id,image)}
    const size=(a.elite?82:ally?50+a.tier*8:58)
    image.setDisplaySize(size,size*1.08).setPosition(a.x,a.y+Math.sin(this.clock*7+a.id)*1.5).setDepth(10+a.y*.001).setFlipX(Math.cos(a.angle)<0)
    image.setTint(a.flash>0?0xffe9a4:ally?0xc0f4e4:0xffffff)
    this.fx.fillStyle(0x132d25,.26);this.fx.fillEllipse(a.x,a.y+22,size*.8,15)
    if(ally){
      const colors=[0,0x8fd7b9,0x76d7ed,0xffda68]
      this.fx.lineStyle(a.tier===3?3:1.5,colors[a.tier],.9);this.fx.strokeEllipse(a.x,a.y+19,size*.9,25)
      this.fx.fillStyle(0x142e25,.8);this.fx.fillRoundedRect(a.x-19,a.y+32,38,4,2)
      this.fx.fillStyle(colors[a.tier],1);this.fx.fillRoundedRect(a.x-19,a.y+32,38*Math.max(0,a.hp/a.maxHp),4,2)
      for(let i=0;i<a.tier;i++){this.fx.fillStyle(colors[a.tier]);this.fx.fillCircle(a.x+(i-(a.tier-1)/2)*9,a.y-38,2.8)}
    }else if(a.elite){this.fx.fillStyle(0x1c2725);this.fx.fillRect(a.x-28,a.y-51,56,5);this.fx.fillStyle(0xf48965);this.fx.fillRect(a.x-28,a.y-51,56*a.hp/a.maxHp,5)}
  }
  update(_time:number,delta:number) {
    if(!this.playerSprite)return
    const {model,move}=this.bridge, p=model.player
    const dt=Math.min(delta/1000,.05)
    if(model.status==='running')this.clock+=dt
    const k=this.keys
    const control:Control={x:(k?.D.isDown||k?.RIGHT.isDown?1:0)-(k?.A.isDown||k?.LEFT.isDown?1:0)+move.x,y:(k?.S.isDown||k?.DOWN.isDown?1:0)-(k?.W.isDown||k?.UP.isDown?1:0)+move.y,fire:!!(k?.F&&Phaser.Input.Keyboard.JustDown(k.F))||this.captureRequested||move.fire,dash:!!k?.SPACE.isDown||move.dash,rally:false}
    this.captureRequested=false;move.fire=false
    model.update(dt,control)
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
    this.playerSprite.setPosition(p.x,p.y+(model.status==='running'&&(control.x||control.y)?Math.sin(this.clock*13)*2:0)).setDepth(20+p.y*.001)
    if(control.x)this.playerSprite.setFlipX(control.x<0)
    this.playerSprite.setAlpha(p.invincible>0&&Math.floor(this.clock*20)%2===0?.45:1)
    if(p.dash>0){this.fx.lineStyle(4,0xf8d76b,.7);this.fx.strokeCircle(p.x,p.y,43)}
    const active=new Set<number>()
    for(const a of model.enemies){active.add(a.id);this.syncActor(a,false)}
    for(const a of model.allies){active.add(a.id);this.syncActor(a,true)}
    for(const [id,image]of this.actors){if(!active.has(id)){image.destroy();this.actors.delete(id)}}
    for(const bullet of model.bullets){
      if(bullet.team==='rope'){
        this.fx.lineStyle(2,0xe7d3a6,.95);this.fx.lineBetween(p.x,p.y,bullet.x,bullet.y)
        const angle=Math.atan2(bullet.vy,bullet.vx),cx=bullet.x,cy=bullet.y
        this.fx.lineStyle(5,0xb28754);this.fx.lineBetween(cx-Math.cos(angle)*20,cy-Math.sin(angle)*20,cx,cy)
        this.fx.fillStyle(0xef7e59);this.fx.fillCircle(cx,cy,10);this.fx.lineStyle(3,0x733c32);this.fx.strokeCircle(cx,cy,10)
      }else{
        const color=bullet.team==='ally'?0xa5efd3:0xf68c6e
        this.fx.fillStyle(color,.15);this.fx.fillCircle(bullet.x,bullet.y,12);this.fx.fillStyle(color);this.fx.fillCircle(bullet.x,bullet.y,5)
      }
    }
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
