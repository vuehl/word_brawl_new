export class Params {
  constructor(query='') {
    this.pairs = [];
    for (const pair of String(query).replace(/^\?/,'').split('&').filter(Boolean)) {
      const i=pair.indexOf('=');
      const decode=x=>decodeURIComponent(x.replace(/\+/g,' '));
      this.pairs.push([decode(i<0?pair:pair.slice(0,i)),decode(i<0?'':pair.slice(i+1))]);
    }
  }
  get(key){return this.pairs.find(p=>p[0]===key)?.[1]??null;}
  has(key){return this.pairs.some(p=>p[0]===key);}
  delete(key){this.pairs=this.pairs.filter(p=>p[0]!==key);}
  set(key,value){this.delete(key);this.append(key,value);}
  append(key,value){this.pairs.push([String(key),String(value)]);}
  toString(){return this.pairs.map(p=>p.map(encodeURIComponent).join('=')).join('&');}
  [Symbol.iterator](){return this.pairs[Symbol.iterator]();}
}
export class LocalURL {
  constructor(value, base='https://ziling.local/') {
    let s=String(value);
    const parent=String(base).replace(/[?#].*$/,'');
    if(!/^[a-z]+:/i.test(s)) s=s.startsWith('/') ? parent.match(/^[a-z]+:\/\/[^/]+/i)[0]+s : parent.slice(0,parent.lastIndexOf('/')+1)+s;
    const parts=s.match(/^([a-z]+:)(?:\/\/([^/]*))?([^?#]*)(?:\?([^#]*))?(#.*)?$/i);
    if(!parts)throw new TypeError('Invalid URL: '+s);
    this.protocol=parts[1];this.host=parts[2]||'';this.hostname=this.host.split(':')[0];this.port=this.host.split(':')[1]||'';
    this.origin=this.protocol+'//'+this.host;
    const path=[];for(const part of parts[3].split('/')) {if(part==='..')path.pop();else if(part&&part!=='.')path.push(part);}
    this.pathname='/'+path.join('/');this.searchParams=new Params(parts[4]);this.hash=parts[5]||'';
  }
  get search(){const q=this.searchParams.toString();return q?'?'+q:'';}
  get href(){return this.origin+this.pathname+this.search+this.hash;}
  toString(){return this.href;}
}
