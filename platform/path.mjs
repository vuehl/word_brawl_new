// Canvas 2D on the device accepts paths traced on the context. The desktop
// renderer also uses immutable Path2D shapes for rank shields.
export class CanvasPath {
  constructor(svg) {
    this.ops=[];
    if(typeof svg!=='string')return;
    const tokens=svg.match(/[MLHVCZ]|-?\d*\.?\d+/gi)||[];
    let x=0,y=0,i=0;
    while(i<tokens.length){
      const op=tokens[i++].toUpperCase(),n=()=>+tokens[i++];
      if(op==='M'||op==='L'){x=n();y=n();this[op==='M'?'moveTo':'lineTo'](x,y);}
      else if(op==='H'){x=n();this.lineTo(x,y);}
      else if(op==='V'){y=n();this.lineTo(x,y);}
      else if(op==='C'){const a=n(),b=n(),c=n(),d=n();x=n();y=n();this.bezierCurveTo(a,b,c,d,x,y);}
      else if(op==='Z')this.closePath();
      else throw Error('Unsupported shield path command '+op);
    }
  }
  trace(ctx){ctx.beginPath();for(const [op,args] of this.ops)ctx[op](...args);}
}
for(const op of ['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','closePath']) {
  CanvasPath.prototype[op]=function(...args){this.ops.push([op,args]);};
}
