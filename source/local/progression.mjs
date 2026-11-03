import {constrainLiteProfile, isLiteSpecies, isLiteFamily} from '../src/lite-rules.js';
import fs from 'node:fs';
import '../src/customize.js';
import * as rules from '../src/progression.js';
import {jr as itemMap, yr as taskById, zr as biomes, Kt as events, Dt as looks} from '../src/config.js';
const pokemon = new Map(JSON.parse(fs.readFileSync(new URL('../public/data/pokemon.json', import.meta.url))).map(p=>[p.id,p]));
export const refreshTasks = rules.refreshTasks;
export function applyAction(p, a) {
  if (!a || typeof a.k !== 'string') return false;
  switch(a.k) {
    case 'lab':
      if (a.lv !== undefined && a.lv !== (p.lab[a.id] ?? 0) + 1) return false;
      return rules.buyLab(p,a.id);
    case 'item': return rules.buyItem(p,a.key);
    case 'archive': return rules.archiveItem(p,a.key,!!a.off,key=>itemMap.has(key));
    case 'quest': return rules.claimQuest(p,a.id);
    case 'task': return rules.claimTask(p,a.period,a.slot,Date.now());
    default: return false;
  }
}
export const rerollTask = rules.rerollTask;
const addUnique=(arr,values)=>{ for(const v of values ?? []) if(!arr.includes(v))arr.push(v); };
// The official settlement service is not published. These are explicit local rules.
// Client-side battle, shop prices, quests and task payouts retain the shipped rules.
export const LOCAL_REWARDS = {killsPerDust: 100, minimumDust: 1, victoryDust: 50};
export function settleRun(p,result) {
  result=structuredClone(result);
  if(result.progress)for(const field of ['league','shinies','classics','forms'])if(Array.isArray(result.progress[field]))result.progress[field]=result.progress[field].filter(field==='forms'?isLiteFamily:isLiteSpecies);
  constrainLiteProfile(p);
  refreshTasks(p,Date.now());
  const before=structuredClone(p.counters);
  const count=(key,value,mode='add')=>{
    if(Number.isFinite(value)&&value>=0) p.counters[key]=mode==='max'?Math.max(p.counters[key]??0,value):(p.counters[key]??0)+value;
  };
  const delta={...(result.progress?.counters??{})};
  for(const key of ['kills','bosses','legendaries','alphas','reactions','damage'])delta[key]??=Number(result[key]??0);
  delta.shinies??=result.progress?.shinies?.length??0;
  for(const [key,value] of Object.entries(delta)){count(key,value);if(!key.startsWith('best_'))count('best_'+key,value,'max');}
  count('runs',1); count('playtime',Number(result.time??0));
  count('maxLevel',Number(result.level??0),'max');count('maxTime',Number(result.time??0),'max');count('maxKills',Number(result.kills??0),'max');
  const standard=!result.mode||['standard','classic'].includes(result.mode);
  if(result.victory&&standard){count('wins',1);count('win_'+result.biome,1);}
  if(!('kills_'+result.biome in delta))count('kills_'+result.biome,result.kills??0);
  count('boss_'+result.biome,result.bosses??0);count('leg_'+result.biome,result.legendaries??0);
  if(result.mode==='endless'){count('endlessTime',result.time??0,'max');count('endlessMewtwo',result.legendaries??0);p.endless[result.biome]=Math.max(p.endless[result.biome]??0,result.time??0);}
  const fusions=result.fusions??[];count('fusions',fusions.length);count('best_fusions',fusions.length,'max');
  for(const fossil of result.shrines?.fossil??[])count('fossil_'+fossil,1);
  if(result.end?.sp===65&&result.end?.how==='died')count('diedAlakazam',1);
  if(result.victory&&standard){
    if((result.build?.peak?.items??Infinity)<=3){count('featMinimal',1);if(result.tier===2)count('featNightMinimal',1);}
    if(result.build?.peak?.vits===0)count('featNoVit',1);
    if((result.end?.hits??Infinity)<=20)count('featLowHits',1);
    if((result.end?.hp??1)<0.1)count('featClutch',1);
    if((result.shrines?.roars??0)>=3)count('featRoars',1);
  }
  for(const look of looks.filter(l=>l.member===result.species)){
    const value=look.rule.v({r:result,d:delta});
    const key='lk:'+look.member+':'+look.n;
    if(look.rule.kind==='bits')p.counters[key]=(p.counters[key]??0)|value;
    else count(key,value,look.rule.kind==='max'?'max':'add');
  }
  for(const field of ['seen','league','shinies','classics','forms'])addUnique(p[field],result.progress?.[field]);
  for(const [key,value]of Object.entries(result.progress?.research??{}))if(Number.isFinite(value)&&value>0)p.research[key]=(p.research[key]??0)+value;
  for(const id of p.league){const family=pokemon.get(id)?.family??id;if(!p.unlocked.includes(family)){p.unlocked.push(family);p.captured[family]=Date.now();if(!('captures' in delta))count('captures',1);}}
  addUnique(p.played,[result.species]);
  p.counters.speciesPlayed=p.played.length;
  const key=result.biome+'-'+(result.tier??0);
  p.kills[key]=Math.max(p.kills[key]??0,result.kills??0);
  if(result.victory&&standard){
    p.biomes[result.biome]=Math.max(p.biomes[result.biome]??0,Math.min(3,(result.tier??0)+1));
    if(!p.times[key]||p.times[key].time>result.time)p.times[key]={time:result.time,splits:(result.splits??[]).filter(Number.isFinite),species:result.species};
  }
  p.counters.mapsWon=biomes.filter(b=>(p.biomes[b.id]??0)>=1).length;
  for(let i=1;i<biomes.length;i++)if((p.biomes[biomes[i-1].id]??-1)>=1&&!(biomes[i].id in p.biomes))p.biomes[biomes[i].id]=0;
  for(const period of ['daily','weekly'])for(let i=0;i<3;i++){
    const task=taskById(p[period].ids[i]);
    if(task){const metric=task.metric;const maximum=['time','level','stage','runKills'].includes(metric);const delta=maximum?Number(result[metric==='runKills'?'kills':metric]??0):(p.counters[metric]??0)-(before[metric]??0);p[period].prog[i]=Math.min(task.goal,maximum?Math.max(p[period].prog[i]??0,delta):(p[period].prog[i]??0)+Math.max(0,delta));}
  }
  for(const ev of events){const state=eventState(p,ev.id);state.pts+=ev.pointsFor(result);for(const [key,value]of Object.entries(ev.countersFor(result))){state.c[key]=key==='floor'?Math.max(state.c[key]??0,value):(state.c[key]??0)+value;}state.best=Math.max(state.best,ev.boardValue(result)??0);}
  const dust=Math.round((Math.max(LOCAL_REWARDS.minimumDust,Math.round((result.kills??0)/LOCAL_REWARDS.killsPerDust))+(result.victory?LOCAL_REWARDS.victoryDust:0))*([1,1.75,2.5][result.tier??0]??1));
  p.stardust+=dust;p.totalStardust+=dust;
  constrainLiteProfile(p);
  return dust;
}
export function eventState(p,id){p.events??={};return p.events[id]??=( {pts:0,got:[],quests:[],c:{},best:0});}
function reward(p,r){p.stardust+=r.dust??0;p.totalStardust+=r.dust??0;addUnique(p.cosmetics,r.cosmetics);for(const item of r.bag??[])p.bag[item]=Math.min(9,(p.bag[item]??0)+1);}
export function claimEvent(p,id,kind,key){const ev=events.find(e=>e.id===id);if(!ev)return false;const state=eventState(p,id);let changed=false;if(kind==='track'){for(let i=0;i<ev.track.length;i++)if((key===-1||i===key)&&state.pts>=ev.track[i].at&&!state.got.includes(i)){reward(p,ev.track[i].reward);state.got.push(i);changed=true;}}else{const quest=ev.quests.find(q=>q.id===key);if(quest&&!state.quests.includes(key)&&(state.c[quest.counter]??0)>=quest.goal){reward(p,quest.reward);state.quests.push(key);changed=true;}}return changed;}
