import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { MONSTER_FRAME_SIZE } from '../src/game/animation.ts'

test('三类怪物图集均含64个独立透明帧，边缘留白且同一动作的四帧不重复',async()=>{
  for(const kind of ['melee','ranged','elite']){
    const {data,info}=await sharp(new URL(`../public/assets/monster-${kind}.webp`,import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    const size=MONSTER_FRAME_SIZE
    assert.equal(info.width,size*8);assert.equal(info.height,size*8)
    for(let row=0;row<8;row++){
      const hashes:string[]=[]
      for(let col=0;col<8;col++){
        let pixels=0;const frame=Buffer.alloc(size*size*4)
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
          const offset=((row*size+y)*info.width+col*size+x)*4,alpha=data[offset+3]
          data.copy(frame,(y*size+x)*4,offset,offset+4)
          if(alpha>8){pixels++;assert.ok(x>=4&&y>=4&&x<size-4&&y<size-4,`${kind} ${row},${col} 触及帧边界`)}
        }
        assert.ok(pixels>1500,`${kind} ${row},${col} 缺少完整角色`)
        hashes.push(createHash('sha256').update(frame).digest('hex'))
      }
      assert.equal(new Set(hashes.slice(0,4)).size,4);assert.equal(new Set(hashes.slice(4)).size,4)
    }
  }
})
