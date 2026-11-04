// Shared boundaries for the standalone forest edition.
export const LITE_SPECIES = Object.freeze([1, 4, 7]);
export const LITE_BIOME = 'forest';
export const isLiteSpecies = id => LITE_SPECIES.includes(Number(id));
export const isLiteFamily = id => Number.isInteger(Number(id)) && Number(id) >= 1 && Number(id) <= 9;
export function validLiteRun(run) {
  return !!run && isLiteSpecies(run.species) && run.biome === LITE_BIOME &&
    (!run.mode || run.mode === 'standard' || run.mode === 'classic') &&
    (!run.party || (/^lan-[a-f0-9]{32}$/.test(run.party) &&
      Number.isInteger(run.coopSeed) && run.coopSeed > 0 && run.coopSeed < 2 ** 31)) &&
    Number.isInteger(run.tier ?? 0) && (run.tier ?? 0) >= 0 && (run.tier ?? 0) <= 2;
}
export function constrainLiteProfile(p) {
  p.league = [...LITE_SPECIES];
  p.unlocked = [...LITE_SPECIES];
  p.lastSpecies = isLiteSpecies(p.lastSpecies) ? p.lastSpecies : 4;
  p.lastBiome = LITE_BIOME;
  p.biomes = {forest: p.biomes?.forest ?? 0};
  p.times ??= {};
  for(const [key,value] of Object.entries(p.times)) {
    if(!key.startsWith('forest-')){delete p.times[key];continue;}
    if(typeof value==='number')p.times[key]={time:value,splits:[]};
    else if(value && !Array.isArray(value.splits))value.splits=[];
  }
  p.team = (p.team ?? []).filter(isLiteSpecies);
  for (const key of ['shinies', 'classics', 'forms']) p[key] = (p[key] ?? []).filter(isLiteFamily);
  p.captured = Object.fromEntries(Object.entries(p.captured ?? {}).filter(([id]) => isLiteSpecies(id)));
  return p;
}
