import {strFromU8} from 'fflate';

export function* resourceEntries(data) {
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
  if(bytes.length<4)throw Error('Incomplete resource package header');
  const headerSize=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true);
  let offset=4+headerSize;
  if(offset>bytes.length)throw Error('Incomplete resource package manifest');
  const files=JSON.parse(strFromU8(bytes.subarray(4,offset)));
  for(const [name,length] of files){
    if(!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(name)||!Number.isSafeInteger(length)||length<0||length>bytes.length-offset){
      throw Error('Invalid resource entry '+name);
    }
    yield [name,bytes.subarray(offset,offset+length)];
    offset+=length;
  }
  if(offset!==bytes.length)throw Error('Unexpected trailing resource data');
}

export function unpackStream(data, write) {
  for(const [name,bytes] of resourceEntries(data))write(name,bytes);
}
