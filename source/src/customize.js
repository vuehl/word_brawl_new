// Your changes go here. Shared by the browser and local backend.
// Save, restart the server, then refresh the browser.
import {laboratory, shop, roster, heldItems, biomes} from './catalogs.js';

export const stationeryArtEnabled = true;
if (stationeryArtEnabled) biomes.find(biome => biome.id === 'forest').artTheme = 'stationery';

// Example: change a shop price (uncomment to activate).
// shop.find(item => item.key === 'soda-pop').price = 100;

// Example: change laboratory pricing.
// laboratory.find(upgrade => upgrade.id === 'slot-move').cost = level => 100 * (level + 1);

// Inspect names/IDs in reports/catalogs.json, then modify a table here.
// Shipped defaults are preserved until you add your own changes.

if (typeof document !== 'undefined') {
  const note = document.createElement('div');
  note.textContent = '森林轻量版 · 单机 · 三个伙伴 · 独立存档';
  note.style.cssText = 'position:fixed;bottom:2px;left:5px;z-index:10000;font:11px sans-serif;color:#fff;background:#282137bb;padding:3px 7px;border-radius:5px;pointer-events:none';
  document.body.append(note);
  const style=document.createElement('style');
  style.textContent=`
    .lite-home,.lite-map{display:flex!important;align-items:center;justify-content:flex-start;padding:32px 6vw;overflow:auto}
    .lite-panel{width:min(680px,100%);padding:30px 36px;border:2px solid #ffffff99;border-radius:26px;background:#fffffff2;color:#22352c;box-shadow:0 15px 60px #152b2c55;backdrop-filter:blur(12px)}
    .lite-kicker{margin:16px 0 8px;font-size:13px;font-weight:800;color:#3c7662;letter-spacing:2px}
    .lite-panel h1{margin:0 0 12px;font-size:52px;line-height:1.1;color:#184333}
    .lite-lead{font-size:17px;line-height:1.65;margin:0 0 24px}
    .lite-partners,.lite-bosses{display:flex;gap:12px;margin:18px 0 24px}
    .lite-mon{flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;background:#eaf1e7;border:2px solid #d7e3d2;border-radius:17px;padding:20px 8px;cursor:pointer;color:#22352c;font-size:18px}
    .lite-mon:hover,.lite-mon:focus-visible{border-color:#39a27c;background:#def4e7;transform:translateY(-3px)}
    .lite-mon img{width:72px;height:72px;object-fit:contain;image-rendering:pixelated}
    .lite-actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
    .lite-actions .btn{flex:1;min-width:110px}
    .lite-note,.lite-save{font-size:13px;line-height:1.7;color:#52675d}
    .lite-bosses>div{flex:1;display:flex;align-items:center;flex-direction:column;gap:8px;background:#eaf1e7;border-radius:12px;padding:12px 4px;font-size:13px}
    .lite-bosses img{width:48px;height:48px;object-fit:contain;image-rendering:pixelated}
    .lite-credits{margin-top:18px;font-size:10px;opacity:.7}
    @media(max-width:700px){.lite-home,.lite-map{padding:16px}.lite-panel{padding:22px}.lite-panel h1{font-size:36px}.lite-mon img{width:52px;height:52px}.lite-mon{font-size:15px}}
  `;
  document.head.append(style);
}
