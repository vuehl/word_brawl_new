import {strFromU8,zlibSync} from 'fflate';

const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
function chunk(type,data){
  const out=new Uint8Array(12+data.length),view=new DataView(out.buffer);
  view.setUint32(0,data.length);
  for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);
  out.set(data,8);
  let crc=0xffffffff;
  for(let i=4;i<8+data.length;i++)crc=crcTable[(crc^out[i])&255]^(crc>>>8);
  view.setUint32(8+data.length,(crc^0xffffffff)>>>0);return out;
}

// Materialize only a requested sheet, using its original frame coordinates.
export function restoreSprite(bytes){
  const metaLength=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0);
  const {width,height,palette,tiles,draws,count}=JSON.parse(strFromU8(bytes.subarray(4,4+metaLength)));
  const low=bytes.subarray(4+metaLength,4+metaLength+count),high=bytes.subarray(4+metaLength+count);
  const stride=1+width*4,scan=new Uint8Array(stride*height);
  for(const [tile,left,top] of draws){
    const [start,w,h]=tiles[tile];let src=start;
    for(let y=0;y<h;y++){
      let dst=(top+y)*stride+1+left*4;
      for(let x=0;x<w;x++,src++,dst+=4){
        const color=palette[low[src]+(high.length?high[src]*256:0)];
        scan[dst]=color>>>24;scan[dst+1]=color>>>16;scan[dst+2]=color>>>8;scan[dst+3]=color;
      }
    }
  }
  const ihdr=new Uint8Array(13),view=new DataView(ihdr.buffer);
  view.setUint32(0,width);view.setUint32(4,height);ihdr[8]=8;ihdr[9]=6;
  const parts=[Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',ihdr),chunk('IDAT',zlibSync(scan,{level:1})),chunk('IEND',new Uint8Array())];
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;
  for(const p of parts){out.set(p,at);at+=p.length;}return out;
}
