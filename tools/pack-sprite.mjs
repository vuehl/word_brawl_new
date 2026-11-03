import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Every nonempty animation frame is represented by its tight visible bounds.
// A repeated drawing uses the same palette pixels at its own atlas coordinates.
export async function packSprite(input, meta){
  const {data,info:{width,height}}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const counts=new Map();
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const color=data.readUInt32BE(i);counts.set(color,(counts.get(color)||0)+1);
  }
  const palette=[0,...[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a-b)];
  if(palette.length>65536)throw Error('Unexpected animation palette size');
  const ids=new Map(palette.map((color,i)=>[color,i]));
  const seen=new Map(),tiles=[],draws=[],lo=[],hi=[];let count=0;
  for(const action of Object.values(meta.anims)){
    for(let row=0;row<action.rows;row++)for(let f=0;f<action.n;f++){
      const left=f*action.fw,top=action.y+row*action.fh;
      let x1=action.fw,y1=action.fh,x2=0,y2=0;
      for(let y=0;y<action.fh;y++)for(let x=0;x<action.fw;x++){
        if(data[((top+y)*width+left+x)*4+3]){
          x1=Math.min(x1,x);x2=Math.max(x2,x+1);y1=Math.min(y1,y);y2=Math.max(y2,y+1);
        }
      }
      if(x2<=x1)continue;
      const w=x2-x1,h=y2-y1,low=Buffer.alloc(w*h),high=palette.length>256?Buffer.alloc(w*h):null;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const src=((top+y1+y)*width+left+x1+x)*4,idx=data[src+3]?ids.get(data.readUInt32BE(src)):0;
        low[y*w+x]=idx;if(high)high[y*w+x]=idx>>>8;
      }
      const digest=createHash('sha256').update(low);if(high)digest.update(high);
      const key=w+':'+digest.digest('hex');
      let tile=seen.get(key);
      if(tile===undefined){
        tile=tiles.length;seen.set(key,tile);tiles.push([count,w,h]);count+=low.length;
        lo.push(low);if(high)hi.push(high);
      }
      draws.push([tile,left+x1,top+y1]);
    }
  }
  const json=Buffer.from(JSON.stringify({width,height,palette,tiles,draws,count})),head=Buffer.alloc(4);
  head.writeUInt32BE(json.length);return Buffer.concat([head,json,...lo,...hi]);
}
