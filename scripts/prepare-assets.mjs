import sharp from 'sharp'
import fs from 'node:fs/promises'
import './prepare-map-assets.mjs'
const root = new URL('../', import.meta.url)
const characters = new URL('assets/source/characters.png',root).pathname
const {data,info}=await sharp(characters).ensureAlpha().raw().toBuffer({resolveWithObject:true})
const projections=[]
for(let x=0;x<info.width;x++){let n=0;for(let y=0;y<info.height;y++)if(data[(y*info.width+x)*4+3]>24)n++;projections.push(n)}
const ideal=info.width/4,bounds=[0]
for(let i=1;i<4;i++){let best=Infinity,bx=Math.round(i*ideal);for(let x=Math.floor((i-.24)*ideal);x<Math.ceil((i+.24)*ideal);x++){const score=projections[x]+Math.abs(x-i*ideal)*.005;if(score<best){best=score;bx=x}}bounds.push(bx)}
bounds.push(info.width)
for(const [i,name]of ['hero','melee','ranged','elite'].entries()){
  const crop=await sharp(characters).extract({left:bounds[i],top:0,width:bounds[i+1]-bounds[i],height:info.height}).png().toBuffer()
  await sharp(crop).trim({threshold:10}).resize({width:220,height:256,fit:'inside'}).png().toFile(new URL(`public/assets/${name}.png`,root).pathname)
}
await fs.writeFile(new URL('assets/source/sprite-crops.json',root),JSON.stringify({width:info.width,height:info.height,boundaries:bounds},null,2)+'\n')
console.log('Imagegen city and character assets prepared.',{boundaries:bounds})
