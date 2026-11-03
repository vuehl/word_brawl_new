// Shared by the device installer and the package verifier.
function expandResources(group, io) {
  if(group==='world'){
    const pool=new Uint8Array(io.read('model-parts.bin'));
    const recipes=JSON.parse(io.read('model-map.json','utf8'));
    for(const [file,recipe] of Object.entries(recipes)){
      const output=new Uint8Array(recipe.reduce((size,part)=>size+part[1],0));
      let position=0;
      for(const [offset,length] of recipe){
        output.set(pool.subarray(offset,offset+length),position);position+=length;
      }
      io.write(file,output.buffer);
    }
    return ['model-parts.bin','model-map.json'];
  }
  if(group==='text'){
    const [keys,files]=JSON.parse(io.read('language-tables.json','utf8'));
    for(const [file,[order,values]] of Object.entries(files)){
      const words=Object.create(null);
      order.forEach((id,i)=>{words[keys[id]]=values[i];});
      io.write(file,JSON.stringify(words),'utf8');
    }
    return ['language-tables.json'];
  }
  return [];
}
module.exports={expandResources};
