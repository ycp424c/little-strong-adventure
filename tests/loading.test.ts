import test from 'node:test'
import assert from 'node:assert/strict'
import { LOAD_ASSET_MAX, LOAD_ASSET_MIN, LOAD_MAP_STAGE, LOAD_READY, assetLoadPercent, loadRatio, loadStage } from '../src/game/loading.ts'

test('素材比例折算为18%到96%的整数进度，边界与异常值被夹紧',()=>{
  assert.equal(assetLoadPercent(0),18)
  assert.equal(assetLoadPercent(.5),57)
  assert.equal(assetLoadPercent(1),96)
  assert.equal(assetLoadPercent(-3),18)
  assert.equal(assetLoadPercent(9),96)
  assert.equal(assetLoadPercent(Number.NaN),18)
  assert.equal(LOAD_ASSET_MIN,18)
  assert.equal(LOAD_ASSET_MAX,96)
})

test('进度随下载量单调不减，且不会提前到达100',()=>{
  let previous=assetLoadPercent(0)
  for(let step=0;step<=100;step++){
    const current=assetLoadPercent(step/100)
    assert.ok(Number.isInteger(current),`${step}% 应为整数`)
    assert.ok(current>=previous,'进度不得回退')
    assert.ok(current<=LOAD_ASSET_MAX)
    previous=current
  }
  assert.equal(assetLoadPercent(1),LOAD_ASSET_MAX)
  assert.ok(assetLoadPercent(1)<LOAD_READY)
})

test('加载文案按阶段切换，覆盖0到100且不会提前宣称就绪',()=>{
  const labels=(percent:number)=>loadStage(percent).label
  assert.equal(labels(0),'正在唤醒引擎')
  assert.equal(labels(LOAD_ASSET_MIN-1),'正在唤醒引擎')
  assert.equal(labels(LOAD_ASSET_MIN),'正在铺设城市街道')
  assert.equal(labels(LOAD_MAP_STAGE-1),'正在铺设城市街道')
  assert.equal(labels(LOAD_MAP_STAGE),'正在召唤角色与怪物')
  assert.equal(labels(LOAD_ASSET_MAX-1),'正在召唤角色与怪物')
  assert.equal(labels(LOAD_ASSET_MAX),'正在布置街区')
  assert.equal(labels(LOAD_READY-1),'正在布置街区')
  assert.equal(labels(LOAD_READY),'准备就绪')
  for(let percent=0;percent<LOAD_READY;percent++){
    const stage=loadStage(percent)
    assert.notEqual(stage.label,'准备就绪',`${percent}% 不应宣称就绪`)
    assert.ok(stage.label.length>0&&stage.detail.length>0)
  }
  assert.equal(loadStage(999).label,'准备就绪')
  assert.equal(loadStage(0).label,loadStage(-10).label)
})

test('整体进度用固定分母聚合，单个文件提前完成也不会把进度顶满',()=>{
  assert.equal(loadRatio(0,0,[],0),0,'没有预载文件时不应有进度')
  assert.equal(loadRatio(0,0,new Array(12).fill(0),12),0,'全部在途但尚未开始下载')
  assert.equal(loadRatio(1,0,[],12),1/12,'一个大文件完成只应占十二分之一')
  assert.ok(Math.abs(loadRatio(0,0,[.5,...new Array(11).fill(0)],12)-.5/12)<1e-9,'在途文件按完成度计入')
  assert.equal(loadRatio(0,1,[],12),1/12,'失败的文件也计入已处理')
  assert.equal(loadRatio(12,0,[],12),1)
  assert.equal(loadRatio(0,12,[],12),1)
})

test('加载事件序列的进度单调不减，异常数值被夹紧',()=>{
  const total=4
  const ratios:number[]=[]
  let complete=0,failed=0,inflight=[0,0,0,0]
  const push=()=>ratios.push(loadRatio(complete,failed,inflight,total))
  push();inflight=[.3,0,0,0];push()
  complete=1;inflight=[.1,0,0];push()
  inflight=[.9,.2,0,0];push()
  failed=1;inflight=[.4,0];push()
  complete=2;inflight=[1];push()
  complete=2;failed=2;inflight=[];push()
  for(let i=1;i<ratios.length;i++)assert.ok(ratios[i]>=ratios[i-1],`第 ${i} 步进度回退`)
  assert.equal(ratios[ratios.length-1],1)
  assert.equal(loadRatio(2,0,[Number.NaN,-5,9],4),Math.min(1,(2+0+1)/4),'越界完成度按 0–1 夹紧')
  assert.equal(loadRatio(Number.NaN,0,[],4),0)
  assert.equal(loadRatio(0,0,[],Number.NaN),0)
})
