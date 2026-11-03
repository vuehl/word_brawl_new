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
  const style=document.createElement('style');
  style.textContent=`
    .lite-home,.lite-map{display:flex!important;align-items:center;justify-content:flex-start;padding:18px 5vw;overflow-y:auto}
    .lite-panel{flex:none;margin:auto 0;width:min(760px,100%);padding:24px 30px;border:2px solid #ffffff99;border-radius:22px;background:#fffffff5;color:#22352c;box-shadow:0 15px 60px #152b2c55;backdrop-filter:blur(12px)}
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
    .lite-map-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .lite-map-head .lite-kicker{margin:0}
    .lite-map-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .lite-map-foot .btn{flex:none}
    .ls-hero>.ls-profile{display:flex;flex-direction:column;flex:1;min-height:0;overflow-y:auto}
    .ls-main .ls-hero{min-height:0;overflow:hidden}
    .ls-hero>.ls-cta{position:static}
    .modal.level-modal{overflow:hidden}
    .level-options{display:flex;flex-direction:column;align-items:center;gap:8px;flex:0 1 auto;width:100%;min-height:0;overflow-y:auto}
    .level-options>*{flex-shrink:0}
    .level-options>.run-hint{position:static;transform:none;max-width:100%}
    .level-modal>.actions{flex:none}
    @media(max-width:700px){.lite-home,.lite-map{padding:16px}.lite-panel{padding:22px}.lite-panel h1{font-size:36px}.lite-mon img{width:52px;height:52px}.lite-mon{font-size:15px}}
    @media (orientation:landscape) and (max-height:560px){
      .auth-side{right:14px;width:min(420px,53vw)}
      .auth-side .auth-card{gap:5px;padding:9px 14px;max-height:calc(100vh - 16px);transform:none}
      .auth-card>*{transform:none}
      .auth-card .ribbon{margin:-9px -14px 0;padding:5px 12px;font-size:18px}
      .auth-card .auth-tabs .pill{padding:4px 8px}
      .auth-body,.auth-perks{gap:4px}
      .auth-perks div{padding:3px 8px;font-size:13px}
      .auth-perks img{width:22px;height:22px}
      .auth-body .btn.big{font-size:16px;padding:6px 12px;min-height:36px}
      .auth-body .btn-ball{width:24px;height:24px}
      .auth-card .err:empty{display:none}
      .screen.lite-home,.screen.lite-map{padding:8px 14px}
      .lite-panel{padding:10px 16px 12px;border-radius:16px}
      .lite-kicker{margin:0 0 3px;font-size:11px;letter-spacing:1px}
      .lite-panel h1{margin:0 0 4px;font-size:28px}
      .lite-lead{font-size:13px;line-height:1.4;margin:0}
      .lite-partners,.lite-bosses{gap:8px;margin:8px 0}
      .lite-mon,.lite-bosses>div{min-width:0;flex-direction:row;justify-content:center;gap:7px;padding:5px 4px;border-radius:12px}
      .lite-mon{font-size:15px}
      .lite-mon img{width:40px;height:40px}
      .lite-bosses img{width:32px;height:32px}
      .lite-actions{gap:8px;margin:8px 0}
      .lite-actions .btn,.lite-map-foot .btn.big{padding:8px 12px;font-size:16px;min-height:36px}
      .lite-actions .btn{min-width:0}
      .lite-map-head{margin:0 0 5px}
      .lite-map-head .btn{font-size:13px;padding:6px 10px}
      .lite-map .lite-panel>p{margin:4px 0}
      .lite-note,.lite-save{font-size:12px;line-height:1.4;margin:3px 0}
      .lite-credits{margin-top:7px;border-top:1px solid #dee7de;padding-top:4px;opacity:1}
      .lite-credits .mm-legal{font-size:10px;color:#40544a;opacity:1;text-align:left}
      .screen.sp{gap:6px;padding:7px 14px;justify-content:flex-start;overflow-y:auto}
      .sp-head,.sp-row,.sp-foot{flex:none}
      .sp-head h1{display:inline-block;font-size:24px;margin:0 0 2px 6px}
      .sp-head small,.sp-head p{font-size:12px}
      .sp-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:900px}
      .sp-card,.sp-card.on{min-width:0;border:2px solid #c5c2cf;border-radius:14px;transform:none;opacity:1}
      .sp-card.on{border-color:#dc354b;box-shadow:0 0 0 1px #dc354b}
      .sp-show{height:clamp(58px,21vh,100px);min-height:0;border-radius:12px 12px 8px 8px}
      .sp-show .ls-stage{inset:0 49% 8% 0}
      .sp-show .ls-spr{max-height:90%;translate:0}
      .sp-show .ls-plate{left:46%;right:0;top:0;bottom:0;justify-content:center;gap:2px;transform:none;padding:2px 4px;border-left-width:3px}
      .sp-show .ls-plate>*{transform:none}
      .sp-show .ls-plate h1{font-size:17px}
      .sp-show .ls-plate small{font-size:10px;letter-spacing:0}
      .sp-show .ls-plate .chip{padding:1px 5px;font-size:10px;line-height:1.1}
      .sp-info{display:flex;gap:4px;padding:5px 8px 7px}
      .sp-pas{display:block;font-size:12px;line-height:1.35}
      .sp-pas small{margin-right:5px}
      .sp-pas span{display:block}
      .sp-pas b,.sp-move b{font-size:14px}
      .sp-move{padding:3px 6px;gap:6px}
      .sp-move>span{display:flex;align-items:center;gap:5px}
      .sp-move small,.sp-pas small{font-size:10px}
      .sp-foot{gap:0}
      .sp-foot .btn.sp-go{padding:6px 18px;font-size:16px;min-height:36px}
      .sp-go .btn-ball{width:24px;height:24px}
      .sp-foot .keys,.sp-go kbd,.ls-go kbd{display:none}
      .ls-roster .ls-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px 2px}
      .ls-grid .ls-tile{align-items:center;gap:1px;padding:3px 2px;border:2px solid transparent}
      .ls-grid .ls-tile.on{transform:none;border-color:#bc4a32}
      .ls-grid .ls-portrait{width:clamp(28px,12vh,52px);height:clamp(28px,12vh,52px);flex:none}
      .ls-grid .ls-name{width:100%;font-size:12px}
      .ls-hero .ls-cta{padding:5px 8px;gap:6px}
      .ls-cta .btn.ls-go{padding:6px 12px;min-height:36px;font-size:16px}
      .ls-cta .btn-ball{width:24px;height:24px}
      html.touch .hud-top{width:340px;height:42px;grid-template-columns:minmax(0,1fr) 92px 65px;align-items:start;gap:5px;padding:4px 8px}
      html.touch .hud-top .ht-l{display:flex;justify-self:stretch;gap:2px;padding:0}
      html.touch .hud-top .ht-r{display:block;padding:0}
      html.touch .ht-row{position:relative;gap:3px}
      html.touch .hud-top .ht-weather{position:absolute;right:0;top:0;width:18px;height:16px;padding:0;font-size:0}
      html.touch .ht-pips{gap:2px}
      html.touch .ht-pips i{width:7px;height:7px}
      html.touch .ht-biome{font-size:15px}
      html.touch .ht-tier{padding:1px 4px}
      html.touch .ht-c{width:92px;margin:0 0 -68px;gap:3px}
      html.touch .timer{font-size:24px;padding:2px 9px;text-align:center}
      html.touch .timer:before,html.touch .timer:after{display:none}
      html.touch .danger{gap:3px;padding:2px 4px}
      html.touch .danger b{min-width:0}
      html.touch .runclock b{font-size:15px}
      .modal .cards{width:100%;align-items:stretch}
      .modal .cards>.card{flex:0 0 auto;width:min(216px,30vw);min-height:0;height:auto}
      .modal>h1{font-size:22px;padding:3px 16px}
      .modal .card .top{height:46px}
      .modal .card .top img,.modal .card .top .typeicon{width:34px;height:34px}
      .modal .card .bd{flex:1 0 auto;gap:3px;padding:7px 10px}
      .modal .actions .btn{padding:6px 12px;font-size:14px;min-height:32px}
    }
    @media (orientation:landscape) and (max-height:420px){
      html.touch .hud-tr{right:56px;gap:4px}
      html.touch .hud-tr .minimap{width:calc(92px * var(--mm,1));height:calc(92px * var(--mm,1))}
      .tc-pause,.tc-aim{right:8px;width:40px}
      .tc-pause{top:6px;height:40px}
      .tc-aim{top:50px;height:44px;padding-top:2px}
      .tc-aim img{width:24px;height:24px}
      .tc-jump{right:12px;bottom:10px;width:70px;height:70px}
      .tc-dash{right:92px;bottom:10px;width:52px;height:52px}
      .tc-lock{right:90px;bottom:74px;width:42px;height:42px}
      .tc-ultb.ult{right:17px;bottom:92px;width:58px;height:58px}
      .tc-ultb .ult-core img{width:30px;height:30px}
      .tc-act{right:86px;bottom:126px;height:38px}
    }
  `;
  document.head.append(style);
}
