import {planDesktopTerrain} from './stationery-notebooks.js';

export const stationeryHeightScale = 0.3;
const peakStart = 1.8;
const peakSoftness = 1;

export function softenStationeryPeak(height) {
  if (height <= peakStart) return height;
  return peakStart + peakSoftness * Math.log1p((height - peakStart) / peakSoftness);
}

export function scaleStationeryTerrain(terrain) {
  if (terrain.biome.artTheme !== 'stationery' || terrain.arena) return;
  planDesktopTerrain(terrain);
}
