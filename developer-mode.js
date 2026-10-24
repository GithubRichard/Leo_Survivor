/* Debug switches are session-only; only the test-save marker is persisted. */
(function(root){
  'use strict';
  const S=typeof module!=='undefined'&&module.exports?require('./expansion.js'):root.Survival,D=S.Expansion;
  const defaults=()=>({enabled:false,invincible:false,infiniteStamina:false,hideRoofs:false,collisions:false,speed:1});
  function state(game){return game.developer||(game.developer=defaults());}
  function enable(game){state(game).enabled=true;game.developerUsed=true;}
  function toggle(game,key){
    const s=state(game);if(!['enabled','invincible','infiniteStamina','hideRoofs','collisions'].includes(key))return false;
    if(key==='enabled'){if(s.enabled)s.enabled=false;else enable(game);}
    else {enable(game);s[key]=!s[key];if(key==='infiniteStamina'&&s[key])game.player.stamina=game.maxStamina;}
    return true;
  }
  function clear(game){if(game.scene==='parking'){const boss=game.zombies.find(z=>z.kind==='lurker'&&z.hp>0);if(boss)game.damageZombie(boss,boss.hp,'molotov');}game.zombies=[];game.pendingSpawn=[];game.playerAttack=null;game.projectiles=[];game.zones=[];game.effects=[];for(const d of game.devices){d.target=null;delete d.targetId;d.entered={};}}
  function resetNight(game){
    clear(game);game.action=null;game.nextWave=0;game.plan=S.nightPlan(game.day);game.waveDirections=[];game.warnedWaves=[];
    game.stats={planned:0,spawned:0,arrived:0,kills:{},damage:{},lost:0,searches:0,food:[],resourceStart:game.resources()};
  }
  function jump(game,day,night=false){
    if(!Number.isInteger(day)||day<1||day>365)return false;
    if(game.scene==='parking')game.switchScene();
    enable(game);game.day=day;resetNight(game);game.minutes=night?1320:300;game.visitors=game.visitors.filter(v=>v.recruited);game.initVisit();
    if(night)game.advanceClock(0);game.announce(`开发测试：第${day}天${night?'22:00':'05:00'}，已重置当晚批次，不结算跳过日期的奖励。`);return true;
  }
  const positions={rear_left:{x:-4.5,y:-5.5},rear_right:{x:4.5,y:-5.5},front_left:{x:-4.5,y:-.5},front_right:{x:4.5,y:-.5},yard:{x:0,y:2},outside_front:{x:-4,y:.6},outside_back:{x:0,y:-6.7},outside_right:{x:5.7,y:-3},outside_left:{x:-5.7,y:-3}};
  function teleport(game,key){
    if(game.scene==='parking'){game.announce('地下请使用停车场专用传送入口。');return false;}
    const p=positions[key];if(!p)return false;if(game.obstacles(p,p,.24).length)return false;
    enable(game);game.cancelAction();game.player.x=p.x;game.player.y=p.y;game.player.indoorHome=null;game.player.running=false;game.updateIndoorHome();game.updateDoors();return true;
  }
  function give(game,kind,amount){
    if(!['wood','iron',...Object.keys(D.items),...Object.keys(D.weapons).filter(k=>k!=='fists')].includes(kind)||!Number.isInteger(amount)||amount<1||amount>999)return false;
    enable(game);return game.pay({}, {[kind]:amount});
  }
  function spawn(game,kind,count){
    const def=D.enemies[kind];if(!def||!Number.isInteger(count)||count<1||count>20)return false;
    enable(game);let placed=0;
    for(let n=0;n<count;n++){
      let p=null;
      for(let a=0;a<64;a++){const angle=(a+n*7)*Math.PI/16,r=6+Math.floor(a/32)*2,c={x:game.player.x+Math.cos(angle)*r,y:game.player.y+Math.sin(angle)*r};if(!game.obstacles(c,c,.3).length&&!game.zombies.some(z=>S.dist(z,c)<.6)){p=c;break;}}
      if(!p)break;
      game.zombies.push({...p,kind,hp:def.hp,maxHP:def.hp,id:game.spawned++,nextAttack:game.seconds+1,path:[],repathAt:0,rootUntil:0,boostUntil:0,screamAt:game.seconds+2,rangedAt:game.seconds+1});game.stats.spawned++;placed++;
    }
    game.announce(`开发测试：已在6—8米外生成${placed}/${count}只${def.name}。`);return placed===count;
  }
  const positionNames={rear_left:'屋内后左角',rear_right:'屋内后右角',front_left:'屋内前左角',front_right:'屋内前右角',yard:'院子中央',outside_front:'房屋正前方',outside_back:'房屋后侧',outside_right:'房屋右侧',outside_left:'房屋左侧'};
  const button=(key,text,extra='')=>`<button data-dev="${key}" ${extra}>${text}</button>`;
  function panel(game){
    const s=state(game),options=['wood','iron',...Object.keys(D.items),...Object.keys(D.weapons).filter(k=>k!=='fists')].map(k=>`<option value="${k}">${S.NAMES[k]}</option>`).join('');
    return `<div class="eyebrow">暂停中 · 独立测试存档</div><h2>开发者模式</h2><p>F2打开或关闭面板。启用工具后只写测试存档，正常进度保留。总开关关闭时所有工具无效，本局仍保存为测试存档。</p>
      <div class="dev-toggles">${[['enabled','开发工具'],['invincible','无敌'],['infiniteStamina','无限体力'],['hideRoofs','隐藏所有屋顶'],['collisions','碰撞框与坐标']].map(([k,t])=>button('toggle',`${t}：${s[k]?'开启':'关闭'}`,`data-option="${k}" aria-pressed="${s[k]}"`)).join('')}</div>
      <div class="dev-section"><h3>状态与时间</h3><div class="dev-row">${button('heal','补满血量 / 体力 / 饱食')}${button('clear','清除当前敌人和危险区域')}</div><div class="dev-row"><label>第几天 <input id="dev-day" type="number" min="1" max="365" value="${game.day}"></label>${button('day','切换至该天05:00')}${button('night','切换至该天22:00')}</div><small>切换天数会重置当晚批次，不发放跳过日期的奖励或作物收成。</small><div class="dev-row"><label>游戏速度 <select id="dev-speed">${[1,2,5].map(n=>`<option value="${n}" ${n===s.speed?'selected':''}>${n}倍</option>`).join('')}</select></label>${button('speed','应用速度')}</div></div>
      <div class="dev-section"><h3>物资与敌人</h3><div class="dev-row"><label>物品 <select id="dev-item">${options}</select></label><label>数量 <input id="dev-amount" type="number" min="1" max="999" value="20"></label>${button('give','添加物品')}</div><small>遵守背包格数和堆叠上限；空间不足时整笔取消。</small><div class="dev-row"><label>怪物 <select id="dev-enemy">${Object.entries(D.enemies).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('')}</select></label><label>数量 <input id="dev-count" type="number" min="1" max="20" value="1"></label>${button('spawn','生成怪物')}</div></div>
      <div class="dev-section"><h3>图层检查传送</h3><div class="dev-toggles">${Object.entries(positionNames).map(([k,t])=>button('teleport',t,`data-position="${k}"`)).join('')}</div><small>目标被家具或建筑占用时拒绝传送，避免卡进墙。</small></div>
      <div class="overlay-actions">${button('save','保存测试进度')}<button data-key="escape" class="primary">返回游戏</button></div>`;
  }
  function draw(ctx,game,project,homes){
    const s=state(game);if(!s.enabled||!s.collisions)return;
    ctx.save();ctx.lineWidth=1;
    for(const o of [...homes.flatMap(h=>h.objects),...game.devices]){
      if(o.hp<=0)continue;ctx.strokeStyle=o.type==='wall'?'#75dfff':o.type==='door'?'#f7c45d':'#a3de82';ctx.beginPath();
      const w=o.w||.7,h=o.h||.7;[[o.x-w/2,o.y-h/2],[o.x+w/2,o.y-h/2],[o.x+w/2,o.y+h/2],[o.x-w/2,o.y+h/2]].forEach(([x,y],i)=>{const p=project(x,y);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    }
    const p=project(game.player.x,game.player.y);ctx.strokeStyle='#ffe47e';ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke();ctx.fillStyle='#fff3b6';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(`x ${game.player.x.toFixed(2)} · y ${game.player.y.toFixed(2)} · ${game.player.indoorHome?'室内':'室外'}`,p.x,p.y+25);ctx.restore();
  }
  const api={state,enable,toggle,clear,jump,teleport,give,spawn,panel,draw};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeveloperMode=api;
})(typeof globalThis!=='undefined'?globalThis:this);
