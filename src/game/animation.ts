export const DIRECTIONS = ['e','se','s','sw','w','nw','n','ne'] as const
export type Direction = typeof DIRECTIONS[number]
export const HERO_FRAME_SIZE = 256
export const PROJECTILE_FRAME_SIZE = 96
export const WALK_FRAMES = 6
export const ATTACK_FRAMES = 4
export const PROJECTILE_FRAMES = 6
const ATTACK_FRAME_TIME = .07

export function facing(angle:number):Direction {
  return DIRECTIONS[(Math.round(angle/(Math.PI/4))%8+8)%8]
}
export type HeroPose = { action:'idle'|'walk'|'attack'; direction:Direction; texture:'hero-walk'|'hero-attack'; frame:number }
type AnimationInput = { running:boolean; dx:number; dy:number; aimAngle?:number; shotAngle?:number; dashing:boolean }

// Use simulation time so frame animation freezes with battle, including upgrade dialogs.
export class HeroAnimator {
  private direction:Direction = 's'
  private walkTime = 0
  private attackTime?:number
  private pose:HeroPose = {action:'idle',direction:'s',texture:'hero-walk',frame:2*WALK_FRAMES}
  reset() {
    this.direction='s';this.walkTime=0;this.attackTime=undefined
    this.pose={action:'idle',direction:'s',texture:'hero-walk',frame:2*WALK_FRAMES}
    return this.pose
  }
  update(dt:number,input:AnimationInput):HeroPose {
    if(!input.running)return this.pose
    const moving=Math.hypot(input.dx,input.dy)>.01
    this.walkTime=moving?this.walkTime+dt*(input.dashing?1.65:1):0
    if(input.shotAngle!==undefined){this.direction=facing(input.shotAngle);this.attackTime=0}
    else if(this.attackTime!==undefined)this.attackTime+=dt
    if(this.attackTime!==undefined&&this.attackTime<ATTACK_FRAMES*ATTACK_FRAME_TIME){
      this.pose={action:'attack',direction:this.direction,texture:'hero-attack',frame:DIRECTIONS.indexOf(this.direction)*ATTACK_FRAMES+Math.floor(this.attackTime/ATTACK_FRAME_TIME)}
      return this.pose
    }
    this.attackTime=undefined
    if(moving)this.direction=facing(Math.atan2(input.dy,input.dx))
    else if(input.aimAngle!==undefined)this.direction=facing(input.aimAngle)
    this.pose={action:moving?'walk':'idle',direction:this.direction,texture:'hero-walk',frame:DIRECTIONS.indexOf(this.direction)*WALK_FRAMES+(moving?Math.floor(this.walkTime*12)%WALK_FRAMES:0)}
    return this.pose
  }
}

export function projectileFrame(team:'rope'|'ally'|'enemy',time:number,id:number) {
  const row=team==='rope'?0:team==='ally'?1:2
  return row*PROJECTILE_FRAMES+(Math.floor(time*18)+id)%PROJECTILE_FRAMES
}
