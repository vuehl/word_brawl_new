// Shared by the device installer and the package verifier.
const packedInputs={world:['model-parts.bin','model-map.json'],text:['language-tables.json']};
function expandResources(group, io) {
  if(group==='world'){
    const parts=io.read('model-parts.bin'),pool=parts instanceof Uint8Array?parts:new Uint8Array(parts);
    const recipes=JSON.parse(io.read('model-map.json','utf8'));
    for(const [file,recipe] of Object.entries(recipes)){
      const output=new Uint8Array(recipe.reduce((size,part)=>size+part[1],0));
      let position=0;
      for(const [offset,length] of recipe){
        output.set(pool.subarray(offset,offset+length),position);position+=length;
      }
      io.write(file,output.buffer);
    }
    return packedInputs.world;
  }
  if(group==='text'){
    const [keys,files]=JSON.parse(io.read('language-tables.json','utf8'));
    for(const [file,[order,values]] of Object.entries(files)){
      const words=Object.create(null);
      order.forEach((id,i)=>{words[keys[id]]=values[i];});
      io.write(file,JSON.stringify(words),'utf8');
    }
    return packedInputs.text;
  }
  return [];
}
module.exports={expandResources,packedInputs};
