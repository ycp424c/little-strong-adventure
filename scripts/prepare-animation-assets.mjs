import sharp from 'sharp'
import fs from 'node:fs/promises'

const root=new URL('../',import.meta.url)
const path=name=>new URL(name,root).pathname
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const layouts=[]

function components(data,width,height){
  const labels=new Int32Array(width*height),queue=new Int32Array(labels.length),parts=[]
  for(let pixel=0;pixel<labels.length;pixel++)if(!labels[pixel]&&data[pixel*4+3]>8){
    const id=parts.length+1
    let head=0,tail=1,left=width,top=height,right=0,bottom=0,sx=0,sy=0
    queue[0]=pixel;labels[pixel]=id
    while(head<tail){
      const p=queue[head++],x=p%width,y=Math.floor(p/width)
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);sx+=x;sy+=y
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy
        if(nx<0||ny<0||nx>=width||ny>=height)continue
        const n=ny*width+nx
        if(!labels[n]&&data[n*4+3]>8){labels[n]=id;queue[tail++]=n}
      }
    }
    parts.push({id,area:tail,left,top,right,bottom,cx:sx/tail,cy:sy/tail})
  }
  return {labels,parts:parts.sort((a,b)=>b.area-a.area)}
}

function isolate(data,sourceWidth,labels,part,row,col,offsetX=0,offsetY=0){
  const width=part.right-part.left+1,height=part.bottom-part.top+1,raw=Buffer.alloc(width*height*4)
  let lowerX=0,lowerPixels=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=(y+part.top)*sourceWidth+x+part.left
    if(labels[source]!==part.id)continue
    data.copy(raw,(y*width+x)*4,source*4,source*4+4)
    if(y>height*.7){lowerX+=x;lowerPixels++}
  }
  const pivotX=lowerPixels?lowerX/lowerPixels:width/2
  let coreTop=height
  for(let y=0;y<height;y++)for(let x=Math.max(0,Math.floor(pivotX-height*.13));x<Math.min(width,pivotX+height*.13);x++)if(raw[(y*width+x)*4+3]>32)coreTop=Math.min(coreTop,y)
  return {raw,width,height,row,col,pivotX,bodyHeight:height-coreTop,sourceBounds:{left:part.left+offsetX,top:part.top+offsetY,width,height}}
}

for(const spec of [
  {name:'hero-walk',cols:6,rows:8,size:256,hero:true,grid:true},
  {name:'hero-attack',cols:4,rows:8,size:256,hero:true,grid:false},
  {name:'projectiles',cols:6,rows:3,size:96,hero:false,grid:false},
]){
  const source=path(`assets/source/${spec.name}.png`)
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  let transparent=0
  for(let i=3;i<data.length;i+=4)if(data[i]<16)transparent++
  if(transparent<info.width*info.height*.1)throw new Error(`${spec.name}: expected a genuinely transparent sheet`)
  const frames=[]
  if(spec.grid){
    // Walking poses are tightly packed; isolate the main contour within each grid cell.
    for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.cols;col++){
      const x=Math.round(col*info.width/spec.cols),y=Math.round(row*info.height/spec.rows)
      const width=Math.round((col+1)*info.width/spec.cols)-x,height=Math.round((row+1)*info.height/spec.rows)-y,raw=Buffer.alloc(width*height*4)
      for(let py=0;py<height;py++)data.copy(raw,py*width*4,((y+py)*info.width+x)*4,((y+py)*info.width+x+width)*4)
      const {labels,parts}=components(raw,width,height)
      if(!parts[0]||parts[0].area<width*height*.12)throw new Error(`${spec.name}: missing actor ${row},${col}`)
      frames.push(isolate(raw,width,labels,parts[0],row,col,x,y))
    }
  }else{
    // Extended arms cross nominal grid boundaries: extract whole connected figures first.
    const {labels,parts}=components(data,info.width,info.height),count=spec.cols*spec.rows
    const figures=parts.slice(0,count).sort((a,b)=>a.cy-b.cy)
    if(figures.length!==count||figures.some(p=>p.area<info.width*info.height/count*.1))throw new Error(`${spec.name}: expected ${count} complete figures`)
    for(let row=0;row<spec.rows;row++){
      const cells=figures.slice(row*spec.cols,(row+1)*spec.cols).sort((a,b)=>a.cx-b.cx)
      cells.forEach((part,col)=>frames.push(isolate(data,info.width,labels,part,row,col)))
    }
  }
  let heroScale=134/median(frames.map(f=>f.bodyHeight))
  if(spec.hero)for(const f of frames)heroScale=Math.min(heroScale,120/Math.max(f.pivotX,f.width-f.pivotX),192/f.height)
  const orbScales=Array.from({length:spec.rows},(_,row)=>72/Math.max(...frames.filter(f=>f.row===row).map(f=>Math.max(f.width,f.height))))
  const composites=[]
  for(const f of frames){
    const scale=spec.hero?heroScale:orbScales[f.row]
    const width=Math.max(1,Math.round(f.width*scale)),height=Math.max(1,Math.round(f.height*scale))
    const left=Math.round(spec.size/2-(spec.hero?f.pivotX:f.width/2)*scale)
    const top=Math.round(spec.hero?200-f.height*scale:spec.size/2-height/2)
    if(left<4||top<4||left+width>spec.size-4||top+height>spec.size-4)throw new Error(`${spec.name}: frame ${f.row},${f.col} exceeds its cell`)
    const input=await sharp(f.raw,{raw:{width:f.width,height:f.height,channels:4}}).resize(width,height).png().toBuffer()
    composites.push({input,left:f.col*spec.size+left,top:f.row*spec.size+top})
  }
  // Lossless encoding prevents block-shaped color bleed at transparent sprite edges.
  await sharp({create:{width:spec.cols*spec.size,height:spec.rows*spec.size,channels:4,background:'#00000000'}}).composite(composites).webp({lossless:true,effort:6}).toFile(path(`public/assets/${spec.name}.webp`))
  layouts.push({name:spec.name,source:{width:info.width,height:info.height},frameSize:spec.size,columns:spec.cols,rows:spec.rows,frameCount:frames.length,heroScale:spec.hero?heroScale:undefined,frames:frames.map(({raw,...frame})=>frame)})
  console.log(`${spec.name}: ${frames.length} isolated frames, ${spec.cols*spec.size}×${spec.rows*spec.size}`)
}
await fs.writeFile(path('assets/source/animation-layout.json'),JSON.stringify({directions:['e','se','s','sw','w','nw','n','ne'],sheets:layouts},null,2)+'\n')
