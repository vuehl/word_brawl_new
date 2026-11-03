const inherited = ['color','font-size','font-weight','line-height','text-align','white-space','pointer-events','visibility'];
const defaults = {color:'#2a2440','font-size':'16px','font-weight':'400','line-height':'1.2','pointer-events':'auto',visibility:'visible'};
const inline = new Set('span b small strong i em kbd label a img canvas svg input button select'.split(' '));
export function length(value,base,view,font=16) {
  if(value===undefined||value===null||value===''||value==='auto'||value==='none')return NaN;
  let s=String(value).trim();
  if(/^(min|max|clamp)\(/.test(s)){
    const vals=s.slice(s.indexOf('(')+1,-1).split(',').map(v=>length(v,base,view,font));
    if(s.startsWith('clamp'))return Math.min(vals[2],Math.max(vals[0],vals[1]));
    return s.startsWith('min')?Math.min(...vals):Math.max(...vals);
  }
  if(s.startsWith('calc(')||/\s[+\-*/]\s/.test(s)){
    const terms=(s.startsWith('calc(')?s.slice(5,-1):s).trim().split(/\s+([+\-*/])\s+/);
    let n=length(terms[0],base,view,font);
    for(let i=1;i<terms.length;i+=2){const m=length(terms[i+1],base,view,font);n=terms[i]==='+'?n+m:terms[i]==='-'?n-m:terms[i]==='*'?n*m:n/m;}
    return n;
  }
  const n=parseFloat(s);if(!Number.isFinite(n))return NaN;
  if(s.endsWith('%'))return n*base/100;
  if(s.endsWith('vmin'))return n*Math.min(view.w,view.h)/100;
  if(s.endsWith('vmax'))return n*Math.max(view.w,view.h)/100;
  if(s.endsWith('vw'))return n*view.w/100;
  if(/(?:dvh|svh|vh)$/.test(s))return n*view.h/100;
  if(s.endsWith('rem'))return n*16;
  if(s.endsWith('em'))return n*font;
  return n;
}
function mediaMatches(query,view) {
  if(!query)return true;
  return query.split(/,\s*/).some(part=>{
    if(part.includes('orientation:portrait')||part.includes('orientation: portrait'))return view.h>view.w;
    if(/hover:\s*hover|pointer:\s*fine|prefers-reduced-motion:\s*reduce/.test(part))return false;
    for(const match of part.matchAll(/(min|max)-(width|height)\s*:\s*([\d.]+)px/g)){
      const dim=match[2]==='height'?view.h:view.w;
      if(match[1]==='min'?dim<+match[3]:dim>+match[3])return false;
    }
    return true;
  });
}
function resolveVars(value,vars,view) {
  if(typeof value!=='string'||!value.includes('('))return value;
  let s=value;
  for(let i=0;i<8&&s.includes('var(');i++){
    const next=s.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,(_,key,fallback)=>vars[key]??fallback??'');
    if(next===s)break;s=next;
  }
  return s.replace(/env\(safe-area-inset-(\w+)(?:,[^)]*)?\)/g,(_,side)=>(view.insets?.[side]||0)+'px');
}
export function styleEngine(view,rules) {
  const groups=new Map(),cache=new WeakMap(),bad=new Set();
  const indexed=rules.filter(r=>mediaMatches(r[3],view));
  for(const r of indexed){if(!groups.has(r[2]))groups.set(r[2],[]);groups.get(r[2]).push(r);}
  let generation=0;
  function style(el,parent) {
    const isText=el.nodeType===3;
    const tag=isText?'#text':el.localName;
    const id=isText?'':el.id;
    const classes=isText?'':el.getAttribute('class')||'';
    const css=isText?'':el.getAttribute('style')||'';
    const signature=[parent?.serial||0,id,classes,css,el.hidden,el.disabled,el.checked,el.type,el.parentNode?.childNodes.length].join('|');
    const previous=cache.get(el);
    if(previous?.signature===signature)return previous;
    const s={...defaults};
    if(parent)for(const k of inherited)s[k]=parent[k];
    let vars=Object.create(parent?.vars||null);
    s.display=isText?'inline':inline.has(tag)?'inline-flex':'block';
    if(tag==='p')s.margin='8px 0';
    if(tag==='button')s['text-align']='center';
    if(tag==='b'||tag==='strong'||/^h[1-6]$/.test(tag))s['font-weight']='700';
    if(tag==='small')s['font-size']='.83em';
    if(!isText) {
      const hits=new Set(),keys=['*',tag,...classes.split(/\s+/).filter(Boolean).map(c=>'.'+c)];
      if(id)keys.push('#'+id);
      for(const key of keys)for(const r of groups.get(key)||[]){
        if(bad.has(r[0]))continue;
        try{if(el.matches(r[0]))hits.add(r);}catch{bad.add(r[0]);}
      }
      const apply=(k,v,important)=>{
        if(important.has(k)&&!v.endsWith('!important'))return;
        if(v.endsWith('!important')){important.add(k);v=v.slice(0,-10).trim();}
        if(k.startsWith('--'))vars[k]=v;else s[k]=v;
      };
      const important=new Set();
      for(const r of Array.from(hits).sort((a,b)=>a[4]-b[4]||a[5]-b[5])){
        for(const [k,v] of r[1])apply(k,v,important);
      }
      for(const decl of css.split(';')){
        const at=decl.indexOf(':');if(at>0)apply(decl.slice(0,at).trim(),decl.slice(at+1).trim(),important);
      }
    }
    for(const k of Object.keys(s))s[k]=resolveVars(s[k],vars,view);
    s.font=length(s['font-size'],parent?.font||16,view,parent?.font||16)||16;
    s['font-size']=s.font+'px';
    if(!isText&&(el.hasAttribute('hidden')||el.hidden===true))s.display='none';
    s.vars=vars;s.signature=signature;s.serial=++generation;
    cache.set(el,s);return s;
  }
  return {style};
}
