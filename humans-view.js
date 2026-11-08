/* Sprite poses are feedback; none of these draw functions commit attacks or loot. */
(() => {
  'use strict';const A=GameArt,D=HUMAN_ART,S=Survival,H=HumansData;
  function frame(ctx,id,q,height,alpha=1){const m=D.frames[id];if(!m)return false;const split=id.indexOf('__');return A.worldSprite(ctx,'humans_'+id.slice(0,split),id.slice(split+2),q.x,q.y,height,{alpha});}
  const entity=a=>a.kind==='bandit'?({bare:'bandit_bare',iron_axe:'bandit_axe',hand_crossbow:'bandit_crossbow',shotgun:'bandit_shotgun'}[a.weapon]||'bandit_bare'):a.kind;
  function actor(ctx,game,p,type,v){
    const helper=p.recruited&&p.humanAction;if(!p.human||p.kind==='home_helper'&&!helper)return false;
    const name=helper?'home_helper':entity(p),direction=A.eightDirection(p.facing||{x:0,y:1}),action=helper?p.humanAction:p.action,moving=p.visualMoveAt>game.seconds-.15;let pose='idle';
    if(action)pose=!action.released?'windup':game.seconds<action.release+.15?'strike':'recover';
    else if(moving)pose=['walk_a','walk_mid','walk_b'][Math.floor((p.visualDistance||0)/.3)%3];
    else if(p.search)pose=Math.floor(game.seconds*4)%2?'search_a':'search_b';
    else if(p.eating&&p.eatLeft>0)pose=Math.floor(game.seconds*3)%2?'eat_a':'eat_b';
    let id=D.lookup[[name,direction,pose].join('|')]||D.lookup[[name,direction,'idle'].join('|')];
    if(p.hurtUntil>game.seconds)id=D.lookup[[p.kind==='bandit'?'bandit':p.kind,'southwest','hurt'].join('|')]||id;
    if(!id)return false;const q=v.project(p.x,p.y);frame(ctx,id,q,50*v.scale/27);
    if(!helper){v.label(H.names[p.kind]||'人类',q.x,q.y-55*v.scale/27,p.kind==='loyal_follower'?'#d6dbad':p.hostile||p.kind==='bandit'?'#dba57f':'#c9bd9a',10);if(p.hp<p.maxHP){ctx.fillStyle='#24271e';ctx.fillRect(q.x-15,q.y-52*v.scale/27,30,4);ctx.fillStyle='#b65b48';ctx.fillRect(q.x-15,q.y-52*v.scale/27,30*p.hp/p.maxHP,4);}}
    return true;
  }
  function boundaryPoints(b,r=40){const pts=[];for(const [x,y,start] of [[b.x+b.w/2,b.y-b.h/2,-Math.PI/2],[b.x+b.w/2,b.y+b.h/2,0],[b.x-b.w/2,b.y+b.h/2,Math.PI/2],[b.x-b.w/2,b.y-b.h/2,Math.PI]])for(let i=0;i<=12;i++){const a=start+i*Math.PI/24;pts.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});}return pts;}
  function items(game,v){
    if(!game.humanMode||!game.humans)return;const {ctx,project,scale,items}=v;
    for(const a of game.humanActiveActors()){
      const q=project(a.x,a.y);if(q.x< -120||q.y< -160||q.x>innerWidth+120||q.y>innerHeight+160||!game.canSee(a))continue;
      items.push({depth:v.depth?v.depth(a):a.x+a.y+.15,draw:()=>v.drawActor?v.drawActor(a):actor(ctx,game,a,'human',v)});
    }
    for(const c of game.humans.corpses){if(c.scene!==game.humanScene()||c.until<=game.seconds||!game.canSee(c))continue;const id=D.lookup[[c.kind==='bandit'?'bandit':c.kind,'southwest',game.seconds-c.started<.3?'collapse':'fallen'].join('|')],q=project(c.x,c.y);items.push({depth:c.x+c.y,draw:()=>frame(ctx,id,q,50*scale/27,Math.min(1,c.until-game.seconds))});}
    if(game.action?.type==='loyal_summon'){const a=game.action,q=project(game.player.x,game.player.y),state=['start','expand','fade'][Math.min(2,Math.floor(a.elapsed/.2))];items.push({depth:game.player.x+game.player.y-.05,draw:()=>frame(ctx,'follower_summon__'+state,q,30*scale/27,.7)});}
    if(game.scene==='surface'){
      for(const p of game.humans.shots){const q=project(p.x,p.y,.8);items.push({depth:p.x+p.y+.25,draw:()=>A.sprite(ctx,p.kind==='human_bolt'?'bolt':'arrow',q.x,q.y,p.kind==='human_bolt'?15:5)});}
      if(game.humans.raid?.active&&game.camp?.position)items.push({layer:-1,depth:-1e6,draw:()=>{const pts=boundaryPoints(game.camp.position).map(p=>project(p.x,p.y));ctx.save();ctx.strokeStyle='#dcc47a';ctx.globalAlpha=.65;ctx.setLineDash([8,7]);ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.stroke();ctx.restore();}});
    }
  }
  function icon(kind,size=26){return D.assets['humans_'+kind]?A.worldIcon('humans_'+kind,'normal',size):'';}
  function item(ctx,kind,q,height){if(kind==='hunger_totem')return frame(ctx,'hunger_totem__normal',q,height);if(kind==='human_blueprint')return A.worldSprite(ctx,'armory_blueprint_assault_rifle','f0',q.x,q.y,height);return false;}
  function raidText(game){const r=game.humans?.raid;if(!r)return '';if(!r.active)return '强盗正在撤退，复仇保留';const alive=game.humans.actors.filter(a=>a.raidId===r.id&&a.hp>0).length;if(r.phase==='warning')return `袭击预警 ${Math.max(0,Math.ceil(r.readyAt-game.seconds))}秒`;if(r.phase==='between')return `波间等待 ${Math.max(0,Math.ceil(r.readyAt-game.seconds))}秒`;return `营地袭击 第${r.wave+1}/3波 · 存活${alive} · 待生成${r.pending.length}`;}
  function hud(game,mode){
    const el=document.getElementById('human-status'),button=document.getElementById('loyal-skill'),h=game.humans,show=game.humanMode&&h&&!game.result&&mode==='play';el.classList.toggle('hidden',!show);button.classList.toggle('hidden',!show||!h?.unlocked);if(!show)return;
    const parts=[];if(game.hungerTotemActive)parts.push(icon('hunger_status',20)+'饥饿：代谢×1.5 · 移速×1.15 · 料理强化');if(h.revenge)parts.push(icon('revenge_status',20)+`复仇 · 普通强盗击败${h.regularKills}/6`);if(h.heroUntil>game.seconds)parts.push(icon('hero_status',20)+`英雄 ${Math.ceil(h.heroUntil-game.seconds)}秒 · 营地八折`);if(h.banUntil>game.seconds)parts.push(icon('trade_ban_status',20)+`营地禁令 ${Math.ceil(h.banUntil-game.seconds)}秒`);if(h.raid)parts.push(icon('defense_boundary',20)+raidText(game)+(h.raid.active?` · 边界距离${Number(game.guardDistance(game.player).toFixed(1))}/40米`:''));
    const html=parts.map(s=>'<div>'+s+'</div>').join('');if(el.innerHTML!==html)el.innerHTML=html;el.classList.toggle('hidden',!parts.length);
    const f=h.follower,cool=Math.max(0,Math.ceil(h.cooldownUntil-game.seconds)),text=f?.hp>0?(f.pending?'随从待跟随':`随从存活 ${Number(f.hp.toFixed(1))}/3`):cool?'随从冷却 '+cool+'秒':'忠心随从 V';button.disabled=!!f?.hp||cool>0;const next=icon('loyal_follower_skill',23)+'<span>'+text+'</span>';if(button.innerHTML!==next)button.innerHTML=next;
  }
  function map(game,canvas){if(!game.humanMode||game.scene!=='surface'||!game.humans)return;const c=canvas.getContext('2d'),s=.65,p=o=>({x:275+(o.x-game.player.x)*s,y:175+(o.y-game.player.y)*s}),r=game.humans.raid;
    if(r?.active&&game.camp?.position){const b=game.camp.position,q=p(b);c.save();c.strokeStyle='#d2b66f';c.setLineDash([4,4]);c.beginPath();c.roundRect(q.x-(b.w/2+40)*s,q.y-(b.h/2+40)*s,(b.w+80)*s,(b.h+80)*s,40*s);c.stroke();c.restore();}
    for(const a of game.humans.actors)if(a.hp>0&&(a.raidId&&r?.id===a.raidId||game.canSee(a))){const q=p(a);q.x=Math.max(14,Math.min(536,q.x));q.y=Math.max(14,Math.min(336,q.y));if(a.raidId)frame(c,'raid_marker__normal',q,16);else{c.fillStyle=a.kind==='bandit'||a.hostile?'#c76a4f':'#d7c38b';c.fillRect(q.x-2,q.y-2,4,4);}}
  }
  window.HumansView={actor,items,icon,item,hud,map,raidText};
})();
