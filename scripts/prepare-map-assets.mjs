import sharp from 'sharp'
import fs from 'node:fs/promises'

const root=new URL('../',import.meta.url)
const sections=['west','central','east']
const rows=['top','bottom']
const feather=40
const reference=new URL('assets/source/city.png',root).pathname
const {width:tileWidth,height:tileHeight}=await sharp(new URL('assets/source/city-hd-west-top.png',root).pathname).metadata()
if(!tileWidth||!tileHeight||tileWidth<1700||tileWidth>2048||tileWidth!==tileHeight*2)throw new Error('City tiles must be native 2:1 images between 1700 and 2048 pixels wide')
const referenceBuffer=await sharp(reference).resize(tileWidth*sections.length,tileHeight*rows.length).png().toBuffer()

for(const section of sections)for(const row of rows){
  const source=new URL(`assets/source/city-hd-${section}-${row}.png`,root)
  const {width,height}=await sharp(source.pathname).metadata()
  if(width<1700||height<850||width!==height*2)throw new Error(`City ${section}-${row} must be a native 2:1 image of at least 1700×850px; received ${width}×${height}`)
  if(width!==tileWidth||height!==tileHeight)throw new Error('All city tiles must have matching native dimensions')
  const col=sections.indexOf(section),line=rows.indexOf(row)
  // Lock shared edges to the original continuous map, fading into the generated
  // detail over 40 pixels. This removes independent-generation color/crop seams.
  const alpha=Buffer.alloc(width*height)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const distance=Math.min(col>0?x:feather,col<sections.length-1?width-1-x:feather,line>0?y:feather,line<rows.length-1?height-1-y:feather)
    const t=Math.min(1,distance/feather)
    alpha[y*width+x]=Math.round(255*t*t*(3-2*t))
  }
  const detail=await sharp(source.pathname).removeAlpha().joinChannel(alpha,{raw:{width,height,channels:1}}).png().toBuffer()
  const base=await sharp(referenceBuffer).extract({left:col*width,top:line*height,width,height}).png().toBuffer()
  const output=new URL(`public/assets/city-${section}-${row}.webp`,root)
  const info=await sharp(base).composite([{input:detail}]).removeAlpha().webp({quality:94,effort:6}).toFile(output.pathname)
  console.log(`City ${section}-${row}: ${info.width}×${info.height}, ${Math.round((await fs.stat(output)).size/1024)} KiB`)
}

// The low-resolution map is retained as an art reference, but is no longer shipped.
await fs.rm(new URL('public/assets/city.webp',root),{force:true})
