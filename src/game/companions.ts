export type Kind = 'melee' | 'ranged'
export type CompanionForm = 'guard' | 'bulwark' | 'swordwind' | 'shooter'
export type CompanionIdentity = {kind:Kind;form?:CompanionForm;tier:number}
export const COMPANIONS = {
  guard: {name:'重装护卫',kind:'melee',description:'近战扛伤 · 范围攻击',hp:92,damage:[0,.65,1.5,3.5],color:0x7ae6cb},
  bulwark: {name:'回旋盾卫',kind:'melee',description:'近身盾击 · 飞盾挡弹与击退',hp:110,damage:[0,0,1.3,3.1],color:0xf0cb7b},
  swordwind: {name:'剑风护卫',kind:'ranged',description:'中短距离 · 直线穿透剑风',hp:78,damage:[0,0,2.3,5.2],color:0xbcb0ff},
  shooter: {name:'远程射手',kind:'ranged',description:'远距离输出 · 三级三发散射',hp:65,damage:[0,1.1,2.8,6.5],color:0x7ecbff},
} as const
export const RECIPES = [
  {id:'guard',melee:3,ranged:0},
  {id:'bulwark',melee:2,ranged:1},
  {id:'swordwind',melee:1,ranged:2},
  {id:'shooter',melee:0,ranged:3},
] as const
export function companionForm(ally:CompanionIdentity):CompanionForm {
  return ally.form??(ally.kind==='melee'?'guard':'shooter')
}
export function companionName(ally:CompanionIdentity) {
  return ally.tier===1?(ally.kind==='melee'?'近战护卫':'远程射手'):COMPANIONS[companionForm(ally)].name
}
export function companionHP(ally:CompanionIdentity) {
  return COMPANIONS[companionForm(ally)].hp*[0,1,2.5,6][ally.tier]
}
export function companionDamage(ally:CompanionIdentity) {
  return COMPANIONS[companionForm(ally)].damage[ally.tier]
}
