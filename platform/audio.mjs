// WeChat decodeAudioData uses success/error callbacks and may return undefined.
// The game expects the browser Promise API. Keep the native receiver and never
// mutate native methods, which can be read-only on a phone.
export function wechatAudioContext(wx,{decodeTimeoutMs=15000}={}) {
  const native=wx.createWebAudioContext(),methods=new Map();
  const decodeAudioData=(data,onSuccess,onError)=>new Promise((resolve,reject)=>{
    let done=false;
    const finish=(ok,value)=>{
      if(done)return;
      done=true;clearTimeout(timer);
      try {
        if(ok){onSuccess?.(value);resolve(value);}
        else {
          const error=value instanceof Error?value:Error(String(value?.errMsg||value?.message||value||'音频解码失败'));
          onError?.(error);reject(error);
        }
      }catch(error){reject(error);}
    };
    const timer=setTimeout(()=>finish(false,Error('音频解码超时')),decodeTimeoutMs);
    try {
      const result=native.decodeAudioData(data,value=>finish(true,value),error=>finish(false,error));
      // Newer runtimes can also return a Promise. Consume its rejection even
      // when a callback already settled the operation.
      if(result&&typeof result.then==='function')result.then(value=>finish(true,value),error=>finish(false,error));
      else if(result&&typeof result.getChannelData==='function')finish(true,result);
    }catch(error){finish(false,error);}
  });
  return new Proxy(Object.create(native),{
    get(_target,key){
      if(key==='decodeAudioData')return decodeAudioData;
      const value=Reflect.get(native,key,native);
      if(typeof value!=='function')return value;
      if(!methods.has(key))methods.set(key,value.bind(native));
      return methods.get(key);
    },
    set(_target,key,value){return Reflect.set(native,key,value,native);},
  });
}
