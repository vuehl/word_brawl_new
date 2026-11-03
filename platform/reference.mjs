import {unzlibSync,strFromU8} from 'fflate';

export function keyPart(el) {
  if(el.nodeType===3)return '#text';
  return el.id?'#'+el.id:(el.localName+'.'+(el.getAttribute('class')||'').trim().split(/\s+/)[0]);
}
export function keyHash(parent,label,index) {
  let h=parent;
  for(const char of label+':'+index)h=Math.imul(h^char.charCodeAt(0),16777619);
  return h>>>0;
}
export function readUIAssets(files) {
  function read(key) {
    const bytes=wx.getFileSystemManager().readFileSync(files.pathFor(key));
    return JSON.parse(strFromU8(unzlibSync(new Uint8Array(bytes))));
  }
  return {layout:read('engine/layout.bin'),rules:read('engine/styles.bin')};
}
export function readReference(view,data) {
  const distance=v=>Math.abs(Math.log((view.w/view.h)/(v.w/v.h)))+
    .25*Math.abs(Math.log(view.w/v.w));
  const sample=data.views.reduce((a,b)=>distance(a)<distance(b)?a:b);
  return {screens:sample.screens,styles:data.styles,sx:view.w/sample.w,sy:view.h/sample.h};
}
