import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Crosshair, Expand, Footprints, Heart, Home, MapPin, Pause, Play, RotateCcw, Shield, Sparkles, Swords, Timer, Users, Volume2, VolumeX, X, Zap } from 'lucide-react'
import type Phaser from 'phaser'
import { Button } from './components/ui/button'
import { DURATION, ELITE_RULES, GameModel, STAGES, type Upgrade } from './game/model'
import { LOAD_ASSET_MIN, LOAD_READY, assetLoadPercent, loadStage } from './game/loading'

const formatTime = (seconds:number) => `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`
const upgradeIcons = {rope:Crosshair,heart:Heart,team:Users,bolt:Zap,shield:Shield,speed:Footprints}
function Plunger({className=''}:{className?:string}) { return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M27 6v24" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><path d="M14 38c0-9 4-15 13-15s13 6 13 15H14Z" fill="#ee7955" stroke="currentColor" strokeWidth="3"/><path d="M10 39h34" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M15 12C3 11 3 27 12 26" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"/></svg> }
function App() {
  const modelRef=useRef(new GameModel())
  const model=modelRef.current
  const [revision,redraw]=useState(0)
  const [ready,setReady]=useState(false)
  const [loadError,setLoadError]=useState('')
  const [loadPercent,setLoadPercent]=useState(0)
  const [help,setHelp]=useState(false)
  const helpRef=useRef(false)
  const [muted,setMuted]=useState(()=>{try{return localStorage.getItem('xiaoqiang-muted')==='true'}catch{return false}})
  const mutedRef=useRef(muted)
  const viewport=useRef<HTMLDivElement>(null)
  const shell=useRef<HTMLDivElement>(null)
  const gameRef=useRef<Phaser.Game|null>(null)
  const move=useRef({x:0,y:0,dash:false,fire:false})
  const [stick,setStick]=useState({x:0,y:0})
  const joystickPointer=useRef<number|null>(null)
  void revision
  useEffect(()=>{mutedRef.current=muted;try{localStorage.setItem('xiaoqiang-muted',String(muted))}catch{/* Private browsing can disable storage. */}},[muted])
  useEffect(()=>{
    let disposed=false
    void Promise.all([import('phaser'),import('./game/scene')]).then(([{default:Phaser},{StreetScene}])=>{
      if(disposed||!viewport.current)return
      setLoadPercent(previous=>Math.max(previous,LOAD_ASSET_MIN))
      const bridge={get model(){return modelRef.current},onChange:()=>redraw(v=>v+1),onReady:()=>{setLoadPercent(LOAD_READY);setReady(true)},onProgress:(ratio:number)=>setLoadPercent(previous=>Math.max(previous,assetLoadPercent(ratio))),onPause:()=>{if(!helpRef.current){modelRef.current.togglePause();redraw(v=>v+1)}},muted:()=>mutedRef.current,move:move.current}
      const game=new Phaser.Game({type:Phaser.AUTO,parent:viewport.current,backgroundColor:'#738776',width:Math.max(1,viewport.current.clientWidth),height:Math.max(1,viewport.current.clientHeight),scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,min:{width:1,height:1}},render:{antialias:true,pixelArt:false,roundPixels:true},scene:[new StreetScene(bridge)],audio:{noAudio:true},input:{activePointers:3},banner:false})
      gameRef.current=game
      const resize=new ResizeObserver(()=>{const element=viewport.current;if(element&&gameRef.current&&element.clientWidth>0&&element.clientHeight>0)gameRef.current.scale.resize(element.clientWidth,element.clientHeight)})
      resize.observe(viewport.current)
      game.events.once('destroy',()=>resize.disconnect())
    }).catch(()=>{if(!disposed)setLoadError('游戏加载失败，请刷新页面重试。')})
    const hide=()=>{const m=modelRef.current;if(document.hidden&&m.status==='running'){m.togglePause();move.current.x=0;move.current.y=0;move.current.dash=false;move.current.fire=false;redraw(v=>v+1)}}
    document.addEventListener('visibilitychange',hide)
    return()=>{disposed=true;gameRef.current?.destroy(true);gameRef.current=null;document.removeEventListener('visibilitychange',hide)}
  },[])
  const refresh=()=>redraw(v=>v+1)
  const start=()=>{model.start();refresh();shell.current?.scrollIntoView({behavior:'smooth',block:'start'})}
  const restart=()=>{modelRef.current=new GameModel();move.current.x=0;move.current.y=0;move.current.dash=false;move.current.fire=false;gameRef.current?.events.emit('reset');modelRef.current.start();refresh();shell.current?.scrollIntoView({behavior:'smooth',block:'start'})}
  const togglePause=()=>{if(!helpRef.current){model.togglePause();refresh()}}
  const showHelp=()=>{helpRef.current=true;if(model.status==='running')model.togglePause();setHelp(true);refresh()}
  const closeHelp=(resume=false)=>{helpRef.current=false;setHelp(false);if(resume&&model.status==='paused')model.togglePause();refresh()}
  const choose=(u:Upgrade)=>{model.chooseUpgrade(u.id);refresh()}
  const fullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void shell.current?.requestFullscreen().catch(()=>{})}
  const joystick=(event:PointerEvent<HTMLDivElement>)=>{
    if(joystickPointer.current!==event.pointerId)return
    const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2,d=Math.hypot(x,y),r=Math.min(34,d)
    const sx=d?x/d*r:0,sy=d?y/d*r:0
    setStick({x:sx,y:sy});move.current.x=sx/34;move.current.y=sy/34
  }
  const resetStick=()=>{joystickPointer.current=null;setStick({x:0,y:0});move.current.x=0;move.current.y=0}
  const progress=Math.min(100,model.time/DURATION*100)
  const loadingStage=loadStage(loadPercent)
  const booting=loadPercent<LOAD_ASSET_MIN
  const target=STAGES[model.stage]
  const distance=Math.round(Math.abs(target.x-model.player.x)/10)
  const active=model.status==='running'
  const elites=model.enemies.filter(enemy=>enemy.elite)
  const slamCharging=elites.some(enemy=>enemy.slam?.phase==='windup')
  const weaponTarget=model.weaponTarget
  const aimedEnemy=weaponTarget?.enemy
  const primaryAction=aimedEnemy?.elite?'攻击精英':'捕获当前目标'
  const targetLabel=aimedEnemy?.elite?`Lv.${aimedEnemy.tier} 精英 · ${Math.ceil(aimedEnemy.hp)}/${aimedEnemy.maxHp} HP`:aimedEnemy?.weakened?'一级普通怪 · 可捕获':aimedEnemy?(aimedEnemy.kind==='ranged'?'远程射手 · 难以接近':'近战护卫 · 容易捕获'):'暂无目标'
  const canFire=active&&model.weaponCooldown===0&&!!weaponTarget?.inRange
  const fireWeapon=()=>{if(canFire)move.current.fire=true}
  const captureLabel=model.weaponCooldown>0?`冷却 ${model.weaponCooldown.toFixed(1)} 秒`:weaponTarget?.inRange?primaryAction:weaponTarget?'靠近目标再出手':'走位寻找目标'
  return <div className="site-wrap">
    <header className="site-header">
      <a href="#" className="brand" aria-label="小强历险记首页"><span className="brand-mark"><Plunger/></span><span>不正经游戏社<span className="brand-edition">AN ORDINARY HERO.</span></span></a>
      <nav aria-label="游戏工具"><Button variant="ghost" onClick={showHelp}><CircleHelp size={17}/>怎么玩</Button><span className="nav-divider"/><Button variant="ghost" size="icon" aria-label={muted?'开启声音':'关闭声音'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</Button><span className="version-label">VOL. 001</span></nav>
    </header>
    <main>
      <section className="hero-heading">
        <div><div className="eyebrow"><span className="live-dot"/> 手动捕获 · 自动瞄准 · 三合一升级 <span className="edition-pill">10 MIN ADVENTURE</span></div><h1>小强<span className="title-last">历险记<svg viewBox="0 0 290 13" aria-hidden="true"><path d="M4 8Q145 -1 286 7M10 11Q180 3 274 10"/></svg></span><span className="title-spark">✳</span></h1><p className="english-title">THE LONG WAY HOME <span>一把皮搋子，一条回家的路。</span></p></div>
        <div className="hero-note"><span className="note-stamp"><Home size={20}/></span><p>店打烊了，天也快黑了。<br/>今天的愿望，还是<span>平安回家。</span></p><div className="hand-arrow">往下，开始这趟冒险 <ArrowDown size={16}/></div></div>
      </section>
      <section className="game-shell" ref={shell} aria-label="小强历险记游戏">
        <div className="game-topbar">
          <div className="health-block"><span className="health-icon"><Heart size={17} fill="currentColor"/></span><div><div className="health-label">小强 <span>{Math.ceil(model.player.hp)}<em> / {model.player.maxHp}</em></span></div><div className="health-track"><i style={{width:`${model.player.hp/model.player.maxHp*100}%`}}/></div></div><span className="level-badge">Lv.{model.level}</span></div>
          <div className="stage-heading"><MapPin size={14}/><span>{target.name}</span><span className="stage-number">0{model.stage+1} / 05</span></div>
          <div className="game-top-right"><div className="timer"><Timer size={16}/><span>{formatTime(model.time)}</span><small>/ 10:00</small></div><Button size="icon" variant="ghost" aria-label={model.status==='paused'?'继续游戏':'暂停游戏'} onClick={togglePause} disabled={!active&&model.status!=='paused'}>{model.status==='paused'?<Play size={16}/>:<Pause size={16}/>}</Button><Button size="icon" variant="ghost" aria-label="全屏游戏" onClick={fullscreen}><Expand size={16}/></Button></div>
        </div>
        <div className={`threat-bar ${active&&slamCharging?'charging':''}`} aria-label="震地精英威胁"><span><Shield size={13}/><strong>{elites.length?`震地精英 × ${elites.length}`:'震地精英'}</strong><em>{elites.length>=ELITE_RULES.maxAlive?'全场巡猎中':`下一只 ${formatTime(Math.ceil(model.eliteCountdown))}`}</em></span><span>{slamCharging?'正在蓄力！离开红圈':'先击破护甲 · 退化后捕获'}</span></div>
        <div className="game-body">
          <div className="game-stage">
            <div className="phaser-viewport" ref={viewport}/>
            <div className="screen-grain"/>
            {active&&<><div className="location-tag"><span className="live-dot"/> {model.time<model.messageUntil?model.message:`${model.visited.has(model.stage)?'守住街区':'前往补给'} · ${distance} m ${model.player.x<target.x?'→':'←'}`}</div><div className="auto-tag"><Crosshair size={12}/> 自动瞄准 · 手动出手</div><div className="weapon-widget"><div className="weapon-target"><Crosshair size={13}/><strong>{targetLabel}</strong><span>{weaponTarget?.inRange?'射程内':'射程外'}</span></div><button className="weapon-button" onClick={fireWeapon} disabled={!canFire} aria-label={primaryAction}><span className="weapon-cooldown-fill" style={{width:`${(1-model.weaponCooldown/model.weaponCooldownMax)*100}%`}}/><kbd>F</kbd><strong>{captureLabel}</strong><span className="weapon-base-cd">CD {model.weaponCooldownMax.toFixed(1)}s</span></button><small>走位切换最近目标 · 按 F / 鼠标左键</small></div><div className="dash-meter"><kbd>SPACE</kbd><span>{model.player.dashCd>0?`冲刺 ${model.player.dashCd.toFixed(1)}s`:'冲刺就绪'}</span><i style={{width:`${(1-Math.min(1,model.player.dashCd/3.7))*100}%`}}/></div></>}
            <div className="mini-map" aria-label="回家路线小地图"><span>街区导航 <i>N ↑</i></span><svg viewBox="0 0 166 46"><path d="M0 23H166M28 0V46M83 0V46M138 0V46" stroke="#8d9a7d" strokeWidth="9"/><path d="M0 23H166" stroke="#e1ca7f" strokeWidth="1" strokeDasharray="3 4"/><circle cx={model.player.x/5400*166} cy={model.player.y/1800*46} r="4" fill="#ffe079" stroke="#25372b" strokeWidth="1.5"/><path d="m146 16 6-5 6 5v10h-12Z" fill="#d8e6b9"/></svg></div>
            {model.status==='ready'&&<div className="start-overlay"><div className="start-card"><div className="card-kicker"><span/> 下班生存指南 001</div><h2>今天也要，<br/><span>活着下班。</span></h2><p>从马桶店到家，只差五条街。<br/>拿好你的皮搋子，把拦路怪变成自己人。</p><div className="start-facts"><span><Crosshair size={13}/>手动捕获</span><span><Users size={13}/>怪物当僚机</span><span><Sparkles size={13}/>三合一升级</span></div><div className={`load-meter${booting?' is-booting':''}${ready?' is-done':''}${loadError?' is-error':''}`} aria-hidden={ready||undefined}><div className="load-meter-head"><span aria-live="polite">{loadingStage.label}</span><strong>{booting?'…':`${loadPercent}%`}</strong></div><div className="load-meter-track" role="progressbar" aria-label="游戏加载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={booting?undefined:loadPercent} aria-valuetext={booting?'正在唤醒引擎，进度未知':`${loadPercent}% · ${loadingStage.label}`}><i style={{width:`${loadPercent}%`}}/>{booting&&<span className="load-meter-boot"/>}</div><small>{loadingStage.detail}</small></div><Button size="large" onClick={start} disabled={!ready||!!loadError}><Play size={17} fill="currentColor"/>{loadError?'加载失败':ready?'关店，回家！':'正在准备街区…'}<ArrowRight size={20}/></Button><span className="start-note">一局约 10 分钟 · 走位选目标，抓准时机出手</span>{loadError&&<small role="alert">{loadError}</small>}</div><div className="floating-note"><span>你的武器？</span><Plunger/><strong>没错，就是皮搋子。</strong><svg viewBox="0 0 130 45"><path d="M5 8q70-20 107 22m-2-16 8 22-24-3"/></svg></div></div>}
            {model.status==='paused'&&!help&&<div className="modal-scrim"><div className="pause-card"><span className="modal-icon"><Pause size={27}/></span><div className="card-kicker">TAKE A BREATHER</div><h2>歇会儿，再赶路。</h2><p>街上的时间已经暂停，你的小队也在等你。</p><Button size="large" onClick={togglePause}><Play size={17}/>继续回家<ArrowRight size={17}/></Button><Button variant="ghost" onClick={restart}><RotateCcw size={15}/>重新出发</Button></div></div>}
            {model.status==='upgrade'&&<div className="modal-scrim upgrade-scrim"><div className="upgrade-modal"><div className="card-kicker">LEVEL UP · LV.{model.level}</div><h2>下班，也要变强一点。</h2><p>选一项强化，继续你的回家之路。选择期间游戏暂停。</p><div className="upgrade-options">{model.upgradeChoices.map(u=>{const Icon=upgradeIcons[u.icon];return <button key={u.id} className="upgrade-option" onClick={()=>choose(u)}><span className="upgrade-icon"><Icon size={25}/></span><small>{u.tag}</small><strong>{u.name}</strong><p>{u.description}</p><span className="upgrade-select">选择强化<ArrowRight size={17}/></span></button>})}</div></div></div>}
            {(model.status==='won'||model.status==='lost')&&<div className="modal-scrim"><div className="result-card"><span className="modal-icon">{model.status==='won'?<Home size={29}/>:<Heart size={29}/>}</span><div className="card-kicker">{model.status==='won'?'HOME, SWEET HOME':'ANOTHER DAY, ANOTHER TRY'}</div><h2>{model.status==='won'?'到家了，辛苦啦。':'这次，先歇一歇。'}</h2><p>{model.status==='won'?'热饭还在，灯还亮着。你和小队平安回家。':'回家的路还在。多捕获同类，合成更强的伙伴。'}</p><div className="result-stats"><div><strong>{formatTime(model.time)}</strong><span>坚持时间</span></div><div><strong>{model.captured}</strong><span>捕获怪物</span></div><div><strong>{model.merges}</strong><span>合成次数</span></div></div><Button size="large" onClick={restart}><RotateCcw size={18}/>{model.status==='won'?'再走一趟':'再试一次'}<ArrowRight size={18}/></Button></div></div>}
            <div className={`touch-controls ${active?'visible':''}`}><div className="joystick" onPointerDown={e=>{joystickPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);joystick(e)}} onPointerMove={joystick} onPointerUp={resetStick} onPointerCancel={resetStick} onLostPointerCapture={resetStick} role="application" aria-label="移动摇杆"><span style={{transform:`translate(${stick.x}px,${stick.y}px)`}}><Crosshair size={23}/></span></div><button className="touch-capture" aria-label={`触屏${primaryAction}`} disabled={!canFire} onClick={fireWeapon}><Crosshair size={25}/><strong>{model.weaponCooldown>0?`${model.weaponCooldown.toFixed(1)}s`:aimedEnemy?.elite?'破甲':'捕获'}</strong></button><button className="touch-dash" aria-label="冲刺" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move.current.dash=true}} onPointerUp={()=>move.current.dash=false} onPointerCancel={()=>move.current.dash=false} onLostPointerCapture={()=>move.current.dash=false}><Zap size={23}/>冲刺</button></div>
          </div>
          <aside className="squad-panel"><div className="panel-heading"><div><Users size={16}/><h2>僚机编队</h2></div><span>{model.allies.length}<em> / {model.capacity}</em></span></div><p className="panel-sub">近战易捕 · 护卫扛伤 / 远程难抓 · 高伤灵活</p><div className="team-legend" aria-label="阵营颜色说明"><span className="team-player">● 小强 · 金色</span><span className="team-friend">● 友方 · 青蓝圆环</span><span className="team-enemy">◆ 敌方 · 红色菱形</span></div><div className="squad-slots">{Array.from({length:model.capacity},(_,i)=>{const ally=model.allies[i];return <div key={ally?.id??`empty-${i}`} title={ally?(ally.kind==='melee'?'近战护卫：易捕，生命较多，伤害较低':'远程射手：难以接近，高伤远射，泛用性强'):undefined} className={`squad-slot ${ally?`filled tier-${ally.tier}`:''}`}>{ally?<><img src={`${import.meta.env.BASE_URL}assets/${ally.kind}.png`} alt=""/><div><strong>{ally.kind==='melee'?'近战护卫':'远程射手'}<span className="ally-stars">{'★'.repeat(ally.tier)}</span></strong><span className="ally-health"><i style={{width:`${ally.hp/ally.maxHp*100}%`}}/></span></div><span className="ally-level">Lv.{ally.tier}</span></>:<><span className="empty-plus">+</span><span>等待捕获</span><small>0{i+1}</small></>}</div>})}</div><div className="merge-guide"><span><Sparkles size={13}/> 同类 × 同级 · 自动合成</span><div><span>Ⅰ</span><b>+</b><span>Ⅰ</span><b>+</b><span>Ⅰ</span><ArrowRight size={14}/><span className="merge-result">Ⅱ</span></div><p>3 个合 1 个，最高可升至 <strong>3 级</strong></p></div><div className="capture-count"><Plunger/><span>累计捕获</span><strong>{String(model.captured).padStart(2,'0')}</strong></div></aside>
        </div>
        <div className="game-bottom"><div><span className="xp-label">LV.{model.level} <Sparkles size={12}/></span><span className="xp-track"><i style={{width:`${Math.min(100,model.xp/model.nextXp*100)}%`}}/></span><span className="xp-hint">捕获与战斗获得经验</span></div><span className="engine-tag"><span/> PHASER 3 <i>·</i> CITY SURVIVAL</span></div>
      </section>
      <section className="under-game"><div className="keyboard-guide"><div><span className="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>移动</span><span className="or">或方向键</span></div><div><kbd>F</kbd><span>出手</span><span className="or">或鼠标左键</span></div><div><kbd className="wide-key">SPACE</kbd><span>冲刺</span></div><div><kbd>ESC</kbd><span>暂停</span></div><div className="auto-explain"><Crosshair size={15}/><span>走位选择目标，僚机自动战斗</span></div></div><span className="headphone-note"><AudioLines size={15}/>戴上耳机，街区更有感觉</span></section>
      <section className="journey"><div className="journey-heading"><div><span className="section-number">01 — 05</span><h2>回家路线</h2></div><p>五条街，十分钟。<span>每个路口，都离家近一点。</span></p><span className="journey-duration"><Timer size={15}/>10:00</span></div><div className="route"><div className="route-line"><i style={{width:`${progress}%`}}/></div>{STAGES.map((s,i)=><div key={s.name} className={`route-stop ${model.stage===i?'current':''} ${model.time>=i*120&&i<model.stage?'completed':''}`}><span className="route-dot">{i<model.stage?<Check size={13}/>:i===4?<Home size={13}/>:<span/>}</span><strong>{s.name}</strong><small>{formatTime(i*120)} — {formatTime((i+1)*120)}</small></div>)}</div></section>
      <section className="feature-notes"><div><span className="feature-icon coral"><Plunger/></span><div><h3>吸住，就算自己人</h3><p>自动瞄准最近敌人，按 F / 左键出手。<br/>基础冷却 2.4 秒，把机会留给想要的伙伴。</p></div><span className="feature-index">01</span></div><div><span className="feature-icon green"><Swords size={25}/></span><div><h3>组队，才好回家</h3><p>近战容易捕获，扛伤可靠但输出较低。<br/>远程会后退风筝，收编后高伤又灵活。</p></div><span className="feature-index">02</span></div><div><span className="feature-icon yellow"><Zap size={25}/></span><div><h3>越接近家，越不简单</h3><p>精英随小队成长，先破甲再捕获。<br/>离开红圈，穿过远程弹幕，拉扯反击。</p></div><span className="feature-index">03</span></div></section>
    </main>
    <footer><span>小强历险记 <i>©</i> 2026</span><p>献给每个努力下班、认真回家的人。</p><span className="footer-sign">MADE FOR A LITTLE ESCAPE <span>✳</span></span></footer>
    {help&&<div className="help-backdrop" onClick={()=>closeHelp()}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><Button variant="ghost" size="icon" className="close-help" aria-label="关闭玩法说明" onClick={()=>closeHelp()}><X size={20}/></Button><div className="card-kicker">THE SURVIVAL HANDBOOK</div><h2 id="help-title">小强的下班生存指南</h2><p>这是一个 10 分钟的手动捕获生存游戏。用走位选择最近的敌人，把每次出手留给想要的伙伴。</p><ol><li><Footprints/><div><strong>青蓝是伙伴，红色是敌人</strong><p>青蓝描边和圆环是友方，珊瑚红描边和菱形是敌方，小强是金黄色。受击会闪白并出现冲击光圈。WASD / 方向键移动，空格冲刺；F / 鼠标左键单次出手，手机用摇杆和攻击/捕获按钮。</p></div></li><li><Plunger/><div><strong>自动瞄准，手动捕获</strong><p>淡瞄准线会指向最近敌人，包括精英。基础捕获距离 24 米、冷却 2.4 秒；射程外不会出手，冷却内不会缓存。武器就绪时，僚机会让出附近普通怪，继续集火精英。近战主动靠近、易捕但输出较低；远程会在射程外后退，接近难但收编后射程更远、伤害更高。普通怪命中即捕获；每次命中精英只扣血，血量归零会退化为一级普通怪，需要再次出手才能捕获。退化后有 3.2 秒保护，僚机暂不补刀。</p></div></li><li><Sparkles/><div><strong>同类、同级，三个自动合一</strong><p>3 个 1 级合成 2 级，3 个 2 级合成 3 级。最高 3 级。近战获得范围攻击，3 级射手获得三发散射。编队满员时仍可触发合成，否则转化为治疗。</p></div></li><li><Shield/><div><strong>精英砸地，提前走位</strong><p>45 秒出现第一只震地精英，此后每 60 秒再来一只，最多同时 3 只。新精英按存活僚机的最高等级生成（1–3 级），空队为 1 级；血量、伤害与砸地范围随等级增加。砸地前固定蓄力 1.2 秒；离开整个红圈或抓准时机冲刺免伤，趁收招集火。更多远程怪会从外围压缩走位空间，僚机也会尝试撤出红圈。</p></div></li><li><Home/><div><strong>活过十分钟，走到家门口</strong><p>每两分钟推进一个街区。黄色标记是当前街区补给；绿色十字回复 25 点生命；血包变得稀少，场上最多 2 个，记得利用街区补给和生命强化。经验满后选强化，10:00 后前往地图最右侧的家。</p></div></li></ol><Button size="large" onClick={()=>closeHelp(true)}>明白了，出发<ChevronRight size={18}/></Button></section></div>}
  </div>
}
export default App
