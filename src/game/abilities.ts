export const ABILITY_IDS = ['barrier', 'smash', 'cover', 'chain', 'pierce', 'frost', 'medic', 'inspire'] as const
export type AbilityId = typeof ABILITY_IDS[number]
export type AbilityRanks = Partial<Record<AbilityId, number>>
export type Ability = {
  id: AbilityId
  name: string
  scope: 'melee' | 'ranged' | 'team'
  icon: 'shield' | 'bolt' | 'team' | 'rope' | 'heart' | 'speed'
  levels: readonly [string, string, string]
}
export const ABILITIES: readonly Ability[] = [
  {id:'barrier',name:'护卫屏障',scope:'melee',icon:'shield',levels:[
    '近战护卫每 8 秒获得一面盾牌，抵挡一颗敌弹。',
    '盾牌恢复间隔从 8 秒缩短至 5 秒。',
    '恢复间隔缩短至 4 秒；抵挡后释放冲击波，击退周围敌人。',
  ]},
  {id:'smash',name:'重锤开路',scope:'melee',icon:'bolt',levels:[
    '近战护卫每第 4 次攻击追加重击，击退面前的敌人。',
    '每第 3 次攻击追加重击，击退距离增加。',
    '重击扩大为前方 160 距离的扇形攻击，并造成额外伤害。',
  ]},
  {id:'cover',name:'战友掩护',scope:'melee',icon:'team',levels:[
    '距离近战护卫 120 内，小强受到的伤害降低 12%，多个护卫不叠加。',
    '掩护范围扩大至 200，减伤提高至 18%。',
    '减伤提高至 22%；小强受伤时护卫加速回援 2 秒，各有 8 秒冷却。',
  ]},
  {id:'chain',name:'接力弹射',scope:'ranged',icon:'rope',levels:[
    '射手子弹命中后弹向 160 内的另一名敌人，伤害为上一跳的 75%。',
    '最多弹射两次，不会重复命中同一敌人。',
    '最后一次命中追加半径 75 的爆裂；爆裂不再触发弹射或分裂。',
  ]},
  {id:'pierce',name:'贯穿射击',scope:'ranged',icon:'bolt',levels:[
    '射手子弹穿过首个敌人后继续飞行。',
    '子弹最多穿过两名敌人，再命中一名敌人。',
    '首次贯穿后分出两颗斜向子弹；分裂弹可附带寒霜，不再贯穿、弹射或分裂。',
  ]},
  {id:'frost',name:'寒霜弹药',scope:'ranged',icon:'speed',levels:[
    '射手命中使敌人减速 25%，持续 1.2 秒。',
    '减速提高至 35%，持续时间延长至 2 秒。',
    '减速提高至 40%；首击起 2 秒内累计命中 3 次冻结 0.7 秒，精英仅冻结 0.2 秒，解冻后 2 秒免疫再次冻结。',
  ]},
  {id:'medic',name:'战地救护',scope:'team',icon:'heart',levels:[
    '每 6 秒治疗生命比例最低的附近伙伴 8 点生命。',
    '每 5 秒治疗两名伙伴，各回复 12 点生命。',
    '每 4 秒治疗两名伙伴，各回复 16 点；溢出治疗转为最多 20 点、持续 6 秒的临时护盾。',
  ]},
  {id:'inspire',name:'收编鼓舞',scope:'team',icon:'team',levels:[
    '成功捕获使全队攻击速度提高 25%，持续 3 秒，重复捕获刷新时长。',
    '鼓舞持续时间延长至 5 秒。',
    '鼓舞持续 6 秒；合成后全队获得 12 点临时护盾，持续 5 秒，不叠加。',
  ]},
]
export const ABILITY_SCOPE = {melee:'近战能力',ranged:'远程能力',team:'全队能力'} as const
export function abilityRank(ranks: AbilityRanks, id: AbilityId) {
  return Math.max(0, Math.min(3, Math.floor(ranks[id] ?? 0)))
}
