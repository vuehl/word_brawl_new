import * as Y from 'typeflex';
import {length,styleEngine} from './styles.mjs';
import {readReference,keyPart,keyHash} from './reference.mjs';
const edges=[Y.EDGE_TOP,Y.EDGE_RIGHT,Y.EDGE_BOTTOM,Y.EDGE_LEFT], names=['top','right','bottom','left'];
const align={'flex-start':Y.ALIGN_FLEX_START,start:Y.ALIGN_FLEX_START,center:Y.ALIGN_CENTER,'flex-end':Y.ALIGN_FLEX_END,end:Y.ALIGN_FLEX_END,stretch:Y.ALIGN_STRETCH,baseline:Y.ALIGN_BASELINE};
const justify={center:Y.JUSTIFY_CENTER,'space-between':Y.JUSTIFY_SPACE_BETWEEN,'space-around':Y.JUSTIFY_SPACE_AROUND,'space-evenly':Y.JUSTIFY_SPACE_EVENLY,'flex-end':Y.JUSTIFY_FLEX_END,end:Y.JUSTIFY_FLEX_END};
const replaced=new Set(['img','svg','canvas','input','select','br']);
function parts(s='0'){return s.match(/(?:[^\s(]+(?:\([^)]*\))?|[^\s]+)/g)||['0'];}
function four(s){const v=parts(s);return [v[0],v[1]??v[0],v[2]??v[0],v[3]??v[1]??v[0]];}
function clamp(n,lo,hi){return Math.min(hi,Math.max(lo,n));}
const scrolls=s=>/auto|scroll/.test(s['overflow-y']??s.overflow??'');
export function createLayout(doc,view,native,fonts,uiAssets) {
  const ctx=native.getContext('2d'),engine=styleEngine(view,uiAssets.rules);
  const ref=readReference(view,uiAssets.layout);
  let boxes=[],seen=new WeakMap(),metrics={},clampedScroll=false;
  const font=s=>(parseInt(s['font-weight'],10)>=600?'bold ':'')+s.font+'px "'+
    (parseInt(s['font-weight'],10)>=600?fonts.bold:fonts.regular)+'", sans-serif';
  function wrap(text,max,s) {
    const lines=[];let line='';
    for(const ch of text.trim()){
      if(ch==='\n'&&s['white-space']?.startsWith('pre')){lines.push(line);line='';continue;}
      if(line&&Number.isFinite(max)&&s['white-space']!=='nowrap'&&ctx.measureText(line+ch).width>max+.5){lines.push(line);line=ch;}
      else line+=ch;
    }
    if(line)lines.push(line);return lines;
  }
  function make(el,parent,grid,id=1) {
    const text=el.nodeType===3,tag=text?'#text':el.localName;
    if(!text&&(el.nodeType!==1||['style','script','head','noscript'].includes(tag)||el.id==='game'))return null;
    if(text&&!el.textContent.trim())return null;
    if(tag==='img'&&!el._src&&el.getAttribute('src'))el.src=el.getAttribute('src');
    const s=engine.style(el,parent?.s);
    if(s.display==='none'||s.visibility==='hidden'||text&&s.font===0)return null;
    const metric=metrics[id],node=Y.Node.create(),item={el,tag,s,node,kids:[],metric},dim=(v,base=view.w)=>length(v,base,view,s.font);
    const set=(key,v,base=view.w)=>{
      if(!v||v==='auto'||v==='none'||v==='fit-content'||v==='max-content')return;
      if(/^-?[\d.]+%$/.test(v)&&node['set'+key+'Percent'])node['set'+key+'Percent'](parseFloat(v));
      else {const n=dim(v,base);if(Number.isFinite(n))node['set'+key](n);}
    };
    set('Width',s.width);set('Height',s.height,view.h);
    if(s.width==='max-content'&&metric?.[6])node.setWidth(metric[6]*ref.sx);
    set('MaxWidth',s['max-width']);set('MaxHeight',s['max-height'],view.h);
    set('MinWidth',s['min-width']);set('MinHeight',s['min-height'],view.h);
    let abs=/absolute|fixed/.test(s.position);
    if(abs)node.setPositionType(Y.POSITION_TYPE_ABSOLUTE);
    const padding=four(s.padding),margin=four(s.margin),inset=four(s.inset||'auto');
    for(let i=0;i<4;i++){
      const edge=edges[i],name=names[i],base=i%2?view.w:view.h;
      const p=s['padding-'+name]??padding[i],m=s['margin-'+name]??margin[i],pos=s[name]??inset[i];
      node.setPadding(edge,Math.max(0,dim(p)||0));
      if(m==='auto')node.setMarginAuto(edge);else node.setMargin(edge,dim(m)||0);
      if(s['border-'+name]||s.border)node.setBorder(edge,parseFloat(s['border-'+name]||s.border)||0);
      if(pos!=='auto'&&(abs||s.position==='relative'||s.position==='sticky')){
        if(pos.endsWith('%'))node.setPositionPercent(edge,parseFloat(pos));
        else if(Number.isFinite(dim(pos,base)))node.setPosition(edge,dim(pos,base));
      }
    }
    if(s.flex&&s.flex!=='none'&&s.flex!=='auto'){const f=s.flex.split(' ');node.setFlexGrow(parseFloat(f[0])||0);node.setFlexShrink(f[1]===undefined?1:parseFloat(f[1])||0);set('FlexBasis',f[2]||'0%');}
    else node.setFlexShrink(s['flex-shrink']===undefined?(s.flex==='none'||parent&&scrolls(parent.s)?0:1):+s['flex-shrink']);
    if(s['flex-grow'])node.setFlexGrow(+s['flex-grow']);set('FlexBasis',s['flex-basis']);
    if(s['align-self'])node.setAlignSelf(align[s['align-self']]??Y.ALIGN_AUTO);
    if(grid&&!abs&&!s.width){
      node.setWidthPercent(100/grid.count-.05);
      if(grid.max>0)node.setMaxWidth(grid.max);
      node.setFlexShrink(1);
    }
    if(s['aspect-ratio']){const [a,b='1']=s['aspect-ratio'].split('/');if(+a>0&&+b>0)node.setAspectRatio(+a/+b);}
    if(text||replaced.has(tag)){
      node.setMeasureFunc((_node,w,wm,h,hm)=>{
        if(text){
          ctx.font=font(s);
          const v=el.textContent.replace(/\s+/g,' '),max=wm===Y.MEASURE_MODE_UNDEFINED?Infinity:w;
          const lines=wrap(v,max,s);
          const lineHeight=s['line-height']?.match(/^[\d.]+$/)?s.font*+s['line-height']:dim(s['line-height'],s.font)||s.font*1.2;
          return {width:Math.min(max,Math.ceil(Math.max(0,...lines.map(l=>ctx.measureText(l).width)))),height:Math.max(1,lines.length)*lineHeight};
        }
        let width=+el.getAttribute('width')||el.naturalWidth||(tag==='input'?100:24);
        let height=+el.getAttribute('height')||el.naturalHeight||(tag==='input'?24:width);
        if(tag==='canvas'){width=el.width;height=el.height;}
        if(wm===Y.MEASURE_MODE_EXACTLY&&width>0)return {width:w,height:hm===Y.MEASURE_MODE_EXACTLY?h:Math.min(height,w*height/width)};
        if(hm===Y.MEASURE_MODE_EXACTLY&&height>0)return {height:h,width:h*width/height};
        return {width,height};
      });
    } else {
      const gridDisplay=s.display.includes('grid'),flex=s.display.includes('flex');
      const inlineText=!flex&&!gridDisplay&&Array.from(el.childNodes).some(c=>c.nodeType===3&&c.textContent.trim());
      const row=gridDisplay||(flex?(s['flex-direction']||'row').startsWith('row'):inlineText);
      node.setFlexDirection(row?Y.FLEX_DIRECTION_ROW:Y.FLEX_DIRECTION_COLUMN);
      node.setAlignItems(align[s['align-items']||s['place-items']]??Y.ALIGN_STRETCH);
      node.setJustifyContent(justify[(s['justify-content']||'').replace('safe ','')]??Y.JUSTIFY_FLEX_START);
      const columns=s['grid-template-columns']||'';
      let count=0;
      if(gridDisplay){const match=/repeat\(\s*(\d+)/.exec(columns);count=match?+match[1]:columns?(columns.match(/(?:minmax|repeat)\([^)]*\)|[^\s]+/g)||[]).length:1;}
      if(gridDisplay&&el.children.length>count||inlineText||s['flex-wrap']==='wrap')node.setFlexWrap(Y.WRAP_WRAP);
      const gap=dim(s.gap||s[row?'column-gap':'row-gap'])||0;
      const gridMax=/minmax\(\s*0\s*,\s*([\d.]+)px\s*\)/.exec(columns);
      const counts={};
      for(const child of el.childNodes){
        if(child.nodeType!==1&&child.nodeType!==3||child.nodeType===3&&!child.textContent.trim())continue;
        const key=keyPart(child),index=counts[key]||0;counts[key]=index+1;
        const item2=make(child,item,count?{count,max:gridMax?+gridMax[1]:0}:null,keyHash(id,key,index));if(!item2)continue;
        if(count>1&&gridMax&&item.kids.length%count!==0)item2.node.setMargin(Y.EDGE_LEFT,gap);
        if(gap&&item.kids.length&&count<=1&&!/absolute|fixed/.test(item2.s.position)){
          const edge=row?Y.EDGE_LEFT:Y.EDGE_TOP;
          if(item2.node.getMargin(edge)?.unit!==Y.UNIT_AUTO)item2.node.setMargin(edge,gap+(item2.node.getMargin(edge)?.value||0));
        }
        node.insertChild(item2.node,item.kids.length);item.kids.push(item2);
      }
    }
    return item;
  }
  function record(item,left,top,parentClip,parentWidth,parentHeight,parentMetric,parentOpacity=1) {
    const {el,s,node,metric:m}=item;
    let x=left+node.getComputedLeft(),y=top+node.getComputedTop();
    let w=node.getComputedWidth(),h=node.getComputedHeight();const tf=s.transform||'';
    const fields=el.nodeType===1?[el.style.left,el.style.top,el.style.transform,el.style.width,el.style.height].map(v=>v||''):null;
    const dynamic=m&&(fields?fields.join('|'):'')!==m[8];
    // Moving an auto-sized element does not change its natural dimensions.
    // Reusing a flex estimate here stretched every child of the fitted HUD.
    if(dynamic&&fields){
      const captured=m[8].split('|');
      if(fields[3]===captured[3]&&m[6]&&(!s.width||s.width==='max-content'||s.width==='auto'))w=m[6]*ref.sx;
      if(fields[4]===captured[4]&&m[7]&&(!s.height||s.height==='auto'))h=m[7]*ref.sy;
    }
    if(/absolute|fixed/.test(s.position)){
      const fixed=s.position==='fixed', pw=fixed?view.w:parentWidth,ph=fixed?view.h:parentHeight;
      const inset=four(s.inset||'auto'),off=(side,i,size)=>length(s[side]??inset[i],size,view,s.font);
      const l=off('left',3,pw),r=off('right',1,pw),t=off('top',0,ph),bt=off('bottom',2,ph);
      const ox=fixed?0:left,oy=fixed?0:top;
      if(Number.isFinite(l))x=ox+l+node.getComputedMargin(Y.EDGE_LEFT);
      else if(Number.isFinite(r))x=ox+pw-r-w-node.getComputedMargin(Y.EDGE_RIGHT);
      if(Number.isFinite(t))y=oy+t+node.getComputedMargin(Y.EDGE_TOP);
      else if(Number.isFinite(bt))y=oy+ph-bt-h-node.getComputedMargin(Y.EDGE_BOTTOM);
    }
    if(s.translate&&s.translate!=='none'){const [tx,ty='0']=s.translate.split(/\s+/);x+=length(tx,w,view)||0;y+=length(ty,h,view)||0;}
    const tr=/translate\(\s*([^, )]+)[, ]+\s*([^ )]+)\)/.exec(tf);
    if(tr){x+=length(tr[1],w,view)||0;y+=length(tr[2],h,view)||0;}
    const one=/translate\(\s*([^, )]+)\s*\)/.exec(tf);
    if(one)x+=length(one[1],w,view)||0;
    for(const [axis,base] of [['X',w],['Y',h]]){
      const v=new RegExp('translate'+axis+'\\(([^)]+)\\)').exec(tf);
      if(v){const delta=length(v[1],base,view)||0;if(axis==='X')x+=delta;else y+=delta;}
    }
    const naturalW=m?.[6]&&(!dynamic||s.width==='max-content')?m[6]*ref.sx:w;
    const naturalH=m?.[7]&&!dynamic?m[7]*ref.sy:h;
    const single=m?.[9]===1,changedText=m?.[5]!=null&&m[5]!==el.textContent.trim();
    const liveLabel=changedText&&single&&el.parentNode.childNodes.length===1;
    if(m&&parentMetric&&!dynamic&&(!changedText||liveLabel)){
      const sx=parentMetric[2]>0?parentWidth/parentMetric[2]:ref.sx,sy=parentMetric[3]>0?parentHeight/parentMetric[3]:ref.sy;
      x=left+(m[0]-parentMetric[0])*sx;y=top+(m[1]-parentMetric[1])*sy;w=m[2]*sx;h=m[3]*sy;
      if(liveLabel){
        const ps=seen.get(el.parentNode).s,padding=four(ps.padding);
        const pl=length(ps['padding-left']??padding[3],parentWidth,view,ps.font)||0;
        const pr=length(ps['padding-right']??padding[1],parentWidth,view,ps.font)||0;
        x=left+pl;w=Math.max(0,parentWidth-pl-pr);
      }
    }else{
      const scale=/scale\(([\d.]+)\)/.exec(tf);
      if(scale){
        const k=+scale[1],origin=s['transform-origin']||'center';
        const ax=/\bleft\b|^0(?:px|%| )/.test(origin)?0:/\bright\b/.test(origin)?1:.5;
        const ay=/\btop\b|(?:^| )0(?:px|%)?$/.test(origin)?0:/\bbottom\b/.test(origin)?1:.5;
        x+=w*(1-k)*ax;y+=h*(1-k)*ay;w*=k;h*=k;
      }
    }
    let style=s;
    if(m){const [size,weight,color,bg,radius,textAlign]=ref.styles[m[4]];
      style={...s,font:parseFloat(size)*Math.min(ref.sx,ref.sy),'font-weight':weight,color,
        'border-radius':radius,'text-align':textAlign};
      if(!s.background&&bg!=='rgba(0, 0, 0, 0)')style['background-color']=bg;
    }
    // Health/experience fills animate by scaling a full-size element.
    const origin=(s['transform-origin']||'50% 50%').split(/\s+/);
    for(const [axis,ox] of [['X',origin[0]],['Y',origin[1]||'50%']]){
      const sc=new RegExp('scale'+axis+'\\(([\\d.]+)\\)').exec(tf);
      if(sc){const extent=axis==='X'?w:h,k=+sc[1],ratio=/left|top/.test(ox)?0:/right|bottom/.test(ox)?1:(parseFloat(ox)||0)/100;
        if(axis==='X'){x+=w*(1-k)*ratio;w=extent*k;}else{y+=h*(1-k)*ratio;h=extent*k;}}
    }
    const alpha=parseFloat(s.opacity);
    const opacity=parentOpacity*(Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha)):1);
    const box={...item,s:style,x,y,w,h,naturalW,naturalH,opacity,clip:parentClip,singleLine:single&&(!changedText||liveLabel)};seen.set(el,box);boxes.push(box);
    let clip=parentClip;
    if(/hidden|scroll|auto|clip/.test([s.overflow,s['overflow-y'],s['overflow-x']].join(' '))){
      clip={x:Math.max(x,clip.x),y:Math.max(y,clip.y),r:Math.min(x+w,clip.r),b:Math.min(y+h,clip.b)};
    }
    const offset=el._scroll||0;
    let bottom=y+h,shift=0;
    if(scrolls(s)&&s['justify-content']==='safe center'&&!m){
      for(const child of item.kids)if(!/absolute|fixed/.test(child.s.position))
        shift=Math.max(shift,node.getComputedPadding(Y.EDGE_TOP)-child.node.getComputedTop());
    }
    item.kids.sort((a,b)=>(parseInt(a.s['z-index'])||0)-(parseInt(b.s['z-index'])||0));
    for(const child of item.kids){
      const end=record(child,x,y-offset+shift,clip,w,h,m,opacity);
      bottom=Math.max(bottom,end+offset);
    }
    el._scrollMax=scrolls(s)?Math.max(0,bottom-y-h):0;
    el._scroll=clamp(offset,0,el._scrollMax);
    if(el._scroll!==offset)clampedScroll=true;
    return clip===parentClip?bottom:y+h;
  }
  function refresh(runState){
    boxes=[];seen=new WeakMap();
    const screens=doc.querySelectorAll('#ui > .screen');
    const screen=screens[screens.length-1];
    const name=screen?Array.from(screen.classList).find(c=>ref.screens[c]):(runState==='paused'?'paused':'play');
    metrics=ref.screens[name]||{};
    // CSS variables on :root are inherited by the body.
    const parent={s:engine.style(doc.documentElement,null)};
    const root=make(doc.body,parent);root.node.setWidth(view.w);root.node.setHeight(view.h);
    root.node.calculateLayout(view.w,view.h,Y.DIRECTION_LTR);
    const clip={x:0,y:0,r:view.w,b:view.h};
    clampedScroll=false;record(root,0,0,clip,view.w,view.h);
    if(clampedScroll){boxes=[];seen=new WeakMap();record(root,0,0,clip,view.w,view.h);}
    root.node.freeRecursive();
    return boxes;
  }
  function hit(x,y){for(let i=boxes.length-1;i>=0;i--){const b=boxes[i],c=b.clip;if(b.tag==='#text'||b.s['pointer-events']==='none'||x<c.x||x>c.r||y<c.y||y>c.b)continue;
    if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return b.el;}return doc.body;}
  return {refresh,hit,box:el=>seen.get(el),font,wrap,context:ctx};
}
