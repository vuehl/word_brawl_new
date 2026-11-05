import {paint,compositor} from './paint.mjs';

// The joystick is a small moving layer. Uploading this surface each frame avoids
// rebuilding and uploading the high-DPI HUD for every native touchmove event.
export function touchOverlay(makeCanvas){
  const canvas=makeCanvas(),context=canvas.getContext('2d');
  let draw=null,signature='',bounds=null;
  return (renderer,layout,touch,view,scale,refreshed)=>{
    if(!touch?.shown||!touch.el.isConnected||!layout.box(touch.stick)){
      signature='';bounds=null;return;
    }
    const key=[touch.stick.className,touch.stick.getAttribute('style'),touch.knob.getAttribute('style'),touch.k,scale].join('|');
    const changed=refreshed||key!==signature||!bounds;
    if(changed){
      const boxes=layout.refreshSubtree(touch.stick);
      if(!boxes.length){signature='';bounds=null;return;}
      const x=Math.floor(Math.min(...boxes.map(b=>b.x))-3),y=Math.floor(Math.min(...boxes.map(b=>b.y))-3);
      const w=Math.ceil(Math.max(...boxes.map(b=>b.x+b.w))-x+3),h=Math.ceil(Math.max(...boxes.map(b=>b.y+b.h))-y+3);
      const width=Math.ceil(w*scale),height=Math.ceil(h*scale);
      if(canvas.width!==width)canvas.width=width;
      if(canvas.height!==height)canvas.height=height;
      paint({context,font:layout.font,wrap:layout.wrap},boxes,{width:w,height:h,x:-x,y:-y},scale);
      bounds={x:x+view.x,y:y+view.y,w:width/scale,h:height/scale,screenWidth:view.width,screenHeight:view.height};
      signature=key;
    }
    if(!draw)draw=compositor(renderer.getContext(),canvas);
    draw(renderer,changed,bounds);
  };
}
