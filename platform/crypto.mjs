import {sha256} from '@noble/hashes/sha256';
import {scryptAsync} from '@noble/hashes/scrypt';
import {bytesToHex} from '@noble/hashes/utils';
let secret, counter=0;
export async function initCrypto() {
  if (wx.getRandomValues) {
    secret=new Uint8Array((await new Promise((resolve,reject)=>wx.getRandomValues({length:32,success:resolve,fail:reject}))).randomValues);
  } else if (globalThis.crypto?.getRandomValues) {
    secret=globalThis.crypto.getRandomValues(new Uint8Array(32));
  } else {
    // Some mini game engines have neither random API. These identifiers only
    // distinguish guests and runs in this device's offline database.
    secret=Uint8Array.from({length:32},()=>Math.floor(Math.random()*256));
  }
}
export function random(n) {
  if(!secret?.length)throw Error('Random source unavailable');
  const out=new Uint8Array(n), seed=new Uint8Array(secret.length+4);
  seed.set(secret);
  for(let i=0;i<n;i+=32){new DataView(seed.buffer).setUint32(secret.length,++counter);out.set(sha256(seed).subarray(0,Math.min(32,n-i)),i);}
  return out;
}
function randomBytes(n) {
  const bytes=random(n);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return {toString(format){
    if(format==='hex')return bytesToHex(bytes);
    let result='',bits=0,count=0;
    for(const byte of bytes){bits=(bits<<8)|byte;count+=8;while(count>=6){count-=6;result+=alphabet[(bits>>count)&63];}}
    if(count)result+=alphabet[(bits<<(6-count))&63];return result;
  }};
}
export default {
  randomBytes,
  randomInt(a,b){const value=new DataView(random(4).buffer).getUint32(0);return a+Math.floor((value/4294967296)*(b-a));},
  randomUUID(){const b=random(16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=bytesToHex(b);return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');},
  scrypt(password,salt,length,done){scryptAsync(password,salt,{N:16384,r:8,p:1,dkLen:length})
    .then(key=>done(null,{toString:()=>bytesToHex(key)}),done);}
};
