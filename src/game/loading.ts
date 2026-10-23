// 启动加载进度：把「引擎脚本 → 地图 → 角色图集 → 场景就绪」映射到一条单调递增的进度条，
// 百分比只由真实事件推进，界面靠 CSS 过渡把跳变补成连续动画。
const LOAD_SCRIPT_MAX = 18
export const LOAD_ASSET_MIN = LOAD_SCRIPT_MAX
export const LOAD_ASSET_MAX = 96
export const LOAD_MAP_STAGE = 70
export const LOAD_READY = 100

const clampRatio=(value:number)=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):0
const clampPercent=(value:number)=>Number.isFinite(value)?Math.round(Math.min(LOAD_READY,Math.max(0,value))):0

/** 素材下载比例（0–1）折算成整体进度；引擎脚本阶段占前 18%，素材占 18%–96%。 */
export function assetLoadPercent(value:number):number {
  return clampPercent(LOAD_ASSET_MIN+(LOAD_ASSET_MAX-LOAD_ASSET_MIN)*clampRatio(value))
}

/** 整体进度：已完成、失败与在途文件的完成度之和，分母固定为本次预载的文件总数。 */
export function loadRatio(complete:number,failed:number,inflight:readonly number[],total:number):number {
  const expected=Number.isFinite(total)?Math.max(0,total):0
  if(expected<=0)return 0
  const count=(value:number)=>Number.isFinite(value)?Math.max(0,value):0
  let done=count(complete)+count(failed)
  for(const percent of inflight)done+=Number.isFinite(percent)?Math.min(1,Math.max(0,percent)):0
  return Math.min(1,done/expected)
}

export type LoadStage={label:string;detail:string}

/** 按当前整体进度给出加载阶段文案；边界值归属下一阶段，避免同时出现两套说法。 */
export function loadStage(value:number):LoadStage {
  const current=clampPercent(value)
  if(current>=LOAD_READY)return {label:'准备就绪',detail:'可以出发了'}
  if(current>=LOAD_ASSET_MAX)return {label:'正在布置街区',detail:'排列相机、输入与开场画面'}
  if(current>=LOAD_MAP_STAGE)return {label:'正在召唤角色与怪物',detail:'载入八方向动作图集与投射物'}
  if(current>=LOAD_ASSET_MIN)return {label:'正在铺设城市街道',detail:'载入六块街区地图'}
  return {label:'正在唤醒引擎',detail:'载入 Phaser 与游戏场景脚本'}
}
