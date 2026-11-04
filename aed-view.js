/* Delivered RGBA rescue pulse uses a common pixel scale and per-frame centers. */
(() => {
  const A=GameArt;
  function items(game,v){const t=game.seconds-(game.aedPulseAt??-1);if(t<0||t>=.32)return;v.items.push({depth:game.player.x+game.player.y-.01,draw:()=>{const state=t<.08?'start':t<.19?'expand':'fade',data=window.AED_ART,m=data.frames[data.assets.aed_aed_rescue_pulse.states[state]],q=v.project(game.player.x,game.player.y);A.worldSprite(v.ctx,'aed_aed_rescue_pulse',state,q.x,q.y,m.bodyHeight*.19*v.scale/27);}});}
  function hud(game,mode){const el=document.getElementById('aed-status'),p=Math.max(0,(game.aedProtectedUntil||0)-game.seconds),s=Math.max(0,(game.aedSprintPenaltyUntil||0)-game.seconds);el.classList.toggle('hidden',!!game.result||mode==='menu'||!p&&!s);el.innerHTML=(p?A.worldIcon('aed_aed_protection','active',24)+` AED保护 ${p.toFixed(1)}秒　`:'')+(s?A.worldIcon('aed_aed_sprint_penalty','active',24)+` 奔跑体力×1.5 ${s.toFixed(1)}秒`:'');}
  window.AEDView={items,hud};
})();
