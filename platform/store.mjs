const filename = () => wx.env.USER_DATA_PATH + '/ziling-save.json';
function exists(fs,path){try{fs.accessSync(path);return true;}catch{return false;}}
export function readStore() {
  const fs=wx.getFileSystemManager(),path=filename();
  let hadFile=false;
  for(const file of [path,path+'.bak']){
    if(!exists(fs,file))continue;
    hadFile=true;
    try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
  }
  if(hadFile)throw Error('本地存档及备份读取失败。');
  return {accounts:{},runs:{},nextRun:1,coopParties:{}};
}
export function writeStore(store) {
  const fs=wx.getFileSystemManager(),path=filename(),temp=path+'.next';
  fs.writeFileSync(temp,JSON.stringify(store),'utf8');
  if(exists(fs,path)){
    let valid=false;try{JSON.parse(fs.readFileSync(path,'utf8'));valid=true;}catch{}
    if(valid)fs.copyFileSync(path,path+'.bak');
  }
  fs.renameSync(temp,path);
}
