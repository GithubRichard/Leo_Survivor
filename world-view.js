/* Weather is decoration plus accurate world-space warnings; UI stays unobscured. */
(() => {
  'use strict';const S=Survival,A=GameArt;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function polygon(ctx,points,project){ctx.beginPath();points.forEach((p,i)=>{const q=project(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();}
  function sector(ctx,game,p,r,f,angle,v){
    const points=angle<360?[p]:[],start=Math.atan2(f.y,f.x)-angle*Math.PI/360;
    for(let i=0;i<=48;i++){const a=start+i/48*angle*Math.PI/180,end={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};let t=1;
      if(game.scene==='parking'){const blockers=game.obstacles(p,end,0);if(blockers.length){let lo=0,hi=1;for(let j=0;j<10;j++){const m=(lo+hi)/2,q={x:p.x+(end.x-p.x)*m,y:p.y+(end.y-p.y)*m};if(blockers.some(o=>S.segmentHits(p,q,o,0)))hi=m;else lo=m;}t=lo;}}
      points.push({x:p.x+(end.x-p.x)*t,y:p.y+(end.y-p.y)*t});
    }polygon(ctx,points,v.project);
  }
  function warning(ctx,game,p,r,v,f={x:0,y:1},angle=360){ctx.save();sector(ctx,game,p,r,f,angle,v);ctx.fillStyle='#d898482b';ctx.strokeStyle='#eed17d';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();}
  function actor(ctx,game,p,type,v){
    // The Boss animation owns its windup; draw the separate projectile on release.
    if(p.boneType==='ordinary'&&p.mode==='throw'&&p.stage==='held')return true;
    const q=v.project(p.x,p.y),size=v.scale/27,dir=A.eightDirection(p.facing||game.player.facing);
    if(p.kind==='skeleton'){
      const a=p.action,t=a?game.seconds-a.started:0;let state='idle';
      if(a){if(a.type==='empty')state='empty_swing';else if(a.type==='melee')state=t<.3?'melee_windup':t<.45?'melee_hit':'melee_recover';else if(a.type==='throw')state=t<.12?'detach':!a.released?'throw_charge':game.seconds-a.releaseAt<.12?'throw_release':'throw_recover';else if(a.type==='sweep')state=t<.12?'sweep_detach':!a.released?'sweep_charge':game.seconds-a.releaseAt<.15?'sweep_hit':'sweep_recover';}
      else if(p.reconnectUntil>game.seconds)state='reconnect';else if(p.hurtUntil>game.seconds)state='hurt';else{const missing=game.zombies.some(z=>z.boneType==='ordinary'&&z.hp>0),moving=p.visualMoveAt>game.seconds-.15;state=(missing?'missing_':'')+(moving?['walk_a','walk_mid','walk_b','walk_mid'][Math.floor((p.visualDistance||0)*3)%4]:'idle');}
      const drawn=A.worldSprite(ctx,'skeleton_'+dir,state,q.x,q.y,64*size);if(!drawn){ctx.strokeStyle='#c5bea3';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x,q.y-40*size);ctx.stroke();ctx.beginPath();ctx.arc(q.x,q.y-47*size,8*size,0,Math.PI*2);ctx.stroke();}
      v.label('骷髅',q.x,q.y-69*size,'#d7c599',11);return true;
    }
    if(p.boneType){
      const ordinary=p.boneType==='ordinary',remnant=p.boneType==='remnant',asset=ordinary?'ordinary_bone':remnant?'resurrection_bone':'player_large_bone';let state='f0';
      if(remnant)state=game.skeleton?.reform>0?'f'+(3+Math.floor((3-game.skeleton.reform)*2)%2):p.hp>14?'f0':p.hp>6?'f1':'f2';
      else if(p.stage==='ground')state=p.hp>2?'f4':p.hp>1?'f5':'f8';else if(p.stage==='return')state='f'+(6+Math.floor(game.seconds*8)%2);else if(p.stage==='flight')state=p.boneType==='player'&&p.hp<10?'f4':'f'+(1+Math.floor(game.seconds*10)%3);
      const elevation=p.stage==='held'?24*size:p.stage==='flight'||p.stage==='return'?12*size:0;
      if(remnant&&game.skeleton?.reform>0)A.worldSprite(ctx,'skeleton_reform_'+dir,['upright_warning','bones_rising','body_forming','standing'][Math.min(3,Math.floor((3-game.skeleton.reform)/.75))],q.x,q.y,64*size);
      else if(!A.worldSprite(ctx,asset,state,q.x,q.y-elevation,(ordinary?25:50)*size)){ctx.strokeStyle='#d1c5a6';ctx.lineWidth=ordinary?4:8;ctx.beginPath();ctx.moveTo(q.x,q.y-elevation);ctx.lineTo(q.x,q.y-elevation-(ordinary?22:46)*size);ctx.stroke();}
      if(remnant)v.label(`复活遗骨 ${Number(p.hp.toFixed(1))}/20 · ${(p.remaining/45).toFixed(1)}游戏小时`,q.x,q.y-56*size,'#e1c783',10);
      else if(p.hp<p.maxHP)v.label(`${p.hp.toFixed(1)}/${p.maxHP}`,q.x,q.y-(ordinary?30:55)*size,'#d5bb84',9);return true;
    }
    const skill=type==='player'&&game.boneSkill;if(!skill||!skill.charging&&!(skill.visualUntil>game.seconds))return false;
    const state=skill.charging?(game.seconds-skill.startedAt<.12?'ready':game.seconds-skill.startedAt<.3?'charge_start':'charge_hold'):skill.visual;
    const frame=state==='release'&&skill.visualUntil-game.seconds<.25?'recover':state;
    if(!A.worldSprite(ctx,'player_bone_throw_'+dir,frame,q.x,q.y,50*size))return false;
    v.label(game.player.name,q.x,q.y-55*size,'#e4d599',12);
    if(skill.charging)v.label(`投掷 ${(5+2.5*Math.min(2,game.seconds-skill.startedAt)).toFixed(1)}米`,q.x,q.y+24,'#e7cd82',11);
    for(const id of [game.heldLightId,game.headLightId]){const l=game.lampById(id);if(l)A.parkingSprite(ctx,l.kind==='oil_lantern'?'fuel_lantern':l.kind,l.active&&l.energy>0?'on':'off',q.x+15,q.y-18,17*size);}return true;
  }
  function items(game,v){
    const {ctx,items,project}=v;
    if(game.scene==='surface'){
      for(const h of game.weather.hazards)items.push({depth:h.x+h.y,draw:()=>{if(h.type==='lightning'){warning(ctx,game,h,1.1,v);const q=project(h.x,h.y);A.worldSprite(ctx,'lightning_warning','f'+Math.floor(game.seconds*6)%3,q.x,q.y,35*v.scale/27,{alpha:.6});}
        else{warning(ctx,game,h,1.2,v);const q=project(h.x,h.y);if(h.warning>0){const end=project(h.x+h.vx*2,h.y+h.vy*2);ctx.save();ctx.strokeStyle='#e5c27f';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.restore();}A.worldSprite(ctx,h.warning>0?'tornado_warning':'tornado_loop','f'+Math.floor(game.seconds*7)%(h.warning>0?3:4),q.x,q.y,(h.warning>0?35:100)*v.scale/27);}}});
      for(const f of game.weather.flash)items.push({depth:f.x+f.y,draw:()=>{const q=project(f.x,f.y);if(f.type==='tornado_end'){A.worldSprite(ctx,'tornado_dissipate','f'+Math.min(2,Math.floor((.45-f.life)*7)),q.x,q.y,100*v.scale/27);return;}const state='f'+Math.min(2,Math.floor((.35-f.life)*9));A.worldSprite(ctx,'lightning_bolt',state,q.x,q.y,115*v.scale/27);A.worldSprite(ctx,'lightning_sparks',state,q.x,q.y,32*v.scale/27);}});
    }
    const boss=game.secondFloor&&game.zombies.find(z=>z.kind==='skeleton'&&z.hp>0);
    if(boss?.action&&!boss.action.released&&game.canSee(boss)){const a=boss.action;if(a.type==='sweep'||a.type==='melee')items.push({depth:boss.x+boss.y-.2,draw:()=>warning(ctx,game,boss,a.type==='sweep'?2.6:1.3,v,a.facing,180)});}
    if(boss?.action?.type==='sweep'&&boss.action.released&&game.canSee(boss)){const a=boss.action;items.push({depth:boss.x+boss.y+.1,draw:()=>{ctx.save();sector(ctx,game,boss,2.6,a.facing,180,v);ctx.clip();const q=project(boss.x,boss.y),angle=Math.atan2((a.facing.x+a.facing.y)*.5,a.facing.x-a.facing.y);A.worldSprite(ctx,'sweep_arc','f'+Math.min(2,Math.floor((game.seconds-a.releaseAt)*8)),q.x,q.y,75*v.scale/27,{rotate:angle});ctx.restore();}});}
    for(const f of game.effects)if(f.kind==='skeleton_fx'&&game.canSee(f))items.push({depth:f.x+f.y,draw:()=>{const q=project(f.x,f.y);if(f.state==='reconnect')A.worldSprite(ctx,'bone_reconnect_fx','f'+Math.min(2,Math.floor((game.seconds-f.startedAt)*7)),q.x,q.y,35);else if(f.state==='death')A.worldSprite(ctx,'skeleton_'+A.eightDirection(f.facing||{x:0,y:1}),game.seconds-f.startedAt<.2?'death_start':'death_end',q.x,q.y,64);else if(f.boneType==='remnant')A.worldSprite(ctx,'resurrection_bone','f5',q.x,q.y,50);else if(f.boneType==='player')A.worldSprite(ctx,'player_large_bone','f'+(6+Math.min(1,Math.floor((game.seconds-f.startedAt)*5))),q.x,q.y,50);else A.worldSprite(ctx,'ordinary_bone','f'+(9+Math.min(2,Math.floor((game.seconds-f.startedAt)*7))),q.x,q.y,25);}});
  }
  function weatherOverlay(game,v){
    if(game.scene!=='surface'||!game.outdoors(game.player))return;const {ctx,width,height,project}=v,kind=game.weatherKind();
    if(!['rain','thunderstorm','fog','overcast'].includes(kind))return;
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);
    for(const h of game.nearbyHomes(game.player,40)){const corners=[project(h.x-5,h.y-6),project(h.x+5,h.y-6),project(h.x+5,h.y),project(h.x-5,h.y)];corners.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();}
    const p=project(game.player.x,game.player.y);ctx.moveTo(p.x+27,p.y-25);ctx.ellipse(p.x,p.y-25,27,43,0,0,Math.PI*2);ctx.clip('evenodd');
    const count=Math.min(48,Math.max(12,Math.floor(width*height/35000)));
    if(kind==='rain'||kind==='thunderstorm'){ctx.strokeStyle='#bac6b94a';ctx.lineWidth=1;for(let i=0;i<count;i++){const x=(i*127.3-game.seconds*70+width*100)%width,y=(i*73.7+game.seconds*430)%height;if(i%6===0)A.worldSprite(ctx,'rain_streaks','f0',x,y,36,{alpha:.15});else{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+17);ctx.stroke();}}const q=project(game.player.x+2,game.player.y+1);A.worldSprite(ctx,'rain_splash','f'+Math.floor(game.seconds*8)%3,q.x,q.y,8,{alpha:.4});}
    else if(kind==='fog'){ctx.fillStyle='#b1b6a50c';ctx.fillRect(0,0,width,height);for(let i=0;i<3;i++)A.worldSprite(ctx,'fog_patch','f0',(i*427+game.seconds*7)%(width+300)-100,height*(.3+i*.22),100,{alpha:.08});}
    else{ctx.fillStyle='#101a1b10';ctx.fillRect(0,0,width,height);}ctx.restore();
  }
  function aim(game,v){if(!game.boneSkill.charging)return;const f=game.player.facing,n=Math.hypot(f.x,f.y)||1,r=5+2.5*Math.min(2,game.seconds-game.boneSkill.startedAt),p={x:game.player.x+f.x/n*r,y:game.player.y+f.y/n*r};warning(v.ctx,game,p,1,v);const a=v.project(game.player.x,game.player.y),b=v.project(p.x,p.y);v.ctx.save();v.ctx.setLineDash([5,5]);v.ctx.strokeStyle='#e0c57a';v.ctx.beginPath();v.ctx.moveTo(a.x,a.y);v.ctx.lineTo(b.x,b.y);v.ctx.stroke();v.ctx.restore();}
  function context(game,target){
    const o=target?.object;if(!o)return null;
    if(target.type==='bone_remnant')return `<h2>复活遗骨</h2><p>${o.hp.toFixed(1)} / 20血 · 距离重组${(o.remaining/45).toFixed(1)}游戏小时。可用武器攻击摧毁，永久阻止骷髅复活；不是可拾取物品。暂停不推进倒计时。</p><button data-key="escape">返回战斗</button>`;
    if(o.kind==='skeleton_chest')return `<h2>骷髅第${o.cycle+1}轮宝箱</h2><p>${o.opened?'剩余物资保留，不会重领。':o.cycle===0?'打开2秒，解锁投掷技能；背包满仍可解锁。':'打开2秒，仅发本轮物资，不重置技能冷却。'}</p>${o.opened?Object.entries(o.loot).filter(([,n])=>n>0).map(([k,n])=>`<button data-command="parking-take" data-kind="${k}">${esc(S.NAMES[k])} × ${n}</button>`).join(''):'<button data-command="parking-interact">开启宝箱</button>'}<button data-key="escape">返回游戏</button>`;
    if(o.kind==='next_floor'||o.kind==='exit'&&game.secondFloor)return `<h2>${o.kind==='exit'?'返回地下首层':'进入地下二层'}</h2><p>交互2秒切换，移动或受伤中断。成功离开二层会将活骷髅恢复26血并清除战斗骨；死亡遗骨、物品和领取记录保留。</p><button data-command="parking-interact" ${o.kind==='next_floor'&&!game.parking.layer.nextUnlocked?'disabled':''}>${o.kind==='exit'?'返回首层':'进入二层'}</button><button data-key="escape">返回游戏</button>`;return null;
  }
  function hud(game,mode){
    const alive=!game.result&&game.player.hp>0,button=document.getElementById('bone-skill'),s=game.boneSkill;button.classList.toggle('hidden',!alive||mode!=='play'||!s.unlocked);
    const text=s.charging?'松开发出 · 取消：Esc':game.seconds<s.cooldown?`投掷 ${Math.ceil(s.cooldown-game.seconds)}秒`:game.player.hp<=1?'投掷需大于1血':'投掷 R · 按住蓄力';if(button._text!==text){button._text=text;button.innerHTML=A.worldIcon('bone_throw_skill','f0')+`<span>${text}</span>`;}
    const status=document.getElementById('weather-status');status.title='室外移动×'+game.weatherType().speed+'，室外作物生长×'+game.weatherType().growth+'；室内与地下免天气影响';const weatherText=game.scene==='parking'?'地面天气暂停':`${S.Weather[game.weatherKind()].name} · 剩余${Math.max(0,Math.ceil((game.weather.schedule[game.weather.index].hours*45-game.weather.elapsed)/.75))}游戏分钟${game.outdoors(game.player)?'':' · 室内豁免'}`;if(status._text!==weatherText){status._text=weatherText;status.innerHTML=(game.scene==='surface'?A.worldIcon('weather_'+game.weatherKind()):'')+esc(weatherText);}
    if(!game.secondFloor)return;document.getElementById('day-label').textContent='地下停车场 · 二层';document.getElementById('objective').innerHTML='<b>骷髅与可摧毁骨头</b><br>离层活Boss重置26血；死亡遗骨保留，72游戏小时后复活。';
    const boss=game.zombies.find(z=>z.kind==='skeleton'&&z.hp>0&&z.noticed),r=game.skeleton?.remnant,bar=document.getElementById('boss-status');
    if(!alive||['menu','result'].includes(mode)||!boss&&!r){bar.classList.add('hidden');return;}bar.classList.remove('hidden');
    const textBar=boss?`骷髅 ${boss.hp.toFixed(1)} / 26 · ${boss.action?{melee:'骨爪',throw:'投骨',sweep:'横扫',empty:'空挥'}[boss.action.type]:'待战'} · 离层恢复26血`:`复活遗骨 ${r.hp.toFixed(1)} / 20 · ${(r.remaining/45).toFixed(1)}游戏小时 · 摧毁可阻止复活`;
    const html=`<div>${textBar}</div><div class="parking-boss-health"><i style="width:${(boss?boss.hp/26:r.hp/20)*100}%"></i></div>`;if(bar._parkingHtml!==html){bar._parkingHtml=html;bar.innerHTML=html;}
  }
  window.WorldView={actor,items,weatherOverlay,aim,context,hud};
})();
