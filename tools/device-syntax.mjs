import {parse} from '../source/tools/vendor/acorn.mjs';

// Expand the upstream Unicode properties at build time. Keep Unicode matching
// on devices that understand the u flag but cannot parse ES2018 properties.
const rangesByProperty = new Map();
function propertyRanges(name) {
  if (rangesByProperty.has(name)) return rangesByProperty.get(name);
  const property = new RegExp('^\\p{'+name+'}$','u');
  const escapePoint = point => '\\u{'+point.toString(16)+'}';
  const ranges=[];
  let start=-1;
  for (let point=0; point<=0x110000; point++) {
    if (point<0x110000 && property.test(String.fromCodePoint(point))) {
      if (start<0) start=point;
    } else if (start>=0) {
      ranges.push(escapePoint(start)+(point-1>start?'-'+escapePoint(point-1):''));
      start=-1;
    }
  }
  const result=ranges.join('');
  rangesByProperty.set(name,result);
  return result;
}

function expand(pattern) {
  let inClass=false;
  return pattern.replace(/\\p\{([^}]+)\}|\\[\s\S]|\[|\]/g,(token,property)=>{
    if (property) {
      const ranges=propertyRanges(property);
      return inClass?ranges:'['+ranges+']';
    }
    if (token==='[') inClass=true;
    if (token===']') inClass=false;
    return token;
  });
}

export function lowerUnicodeRegexes(code) {
  const edits=[];
  parse(code,{sourceType:'module',ecmaVersion:'latest',onToken(token) {
    if (token.type.label==='regexp' && token.value.pattern.includes('\\p{')) {
      edits.push([token.start,token.end,'/'+expand(token.value.pattern)+'/'+token.value.flags]);
    } else if (token.type.label==='template' && token.value.includes('\\p{')) {
      // The hotkey formatter constructs its regexp from template segments.
      edits.push([token.start,token.end,expand(token.value).replaceAll('\\','\\\\')]);
    }
  }});
  for (const [start,end,text] of edits.reverse()) code=code.slice(0,start)+text+code.slice(end);
  return code;
}
