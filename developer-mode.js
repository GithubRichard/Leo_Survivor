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
  function clear(game){if(game.scene==='parking'){const boss=game.zombies.find(z=>['lurker','skeleton'].includes(z.kind)&&z.hp>0);if(boss)game.damageZombie(boss,boss.hp,'molotov');}game.zombies=game.zombies.filter(z=>z.boneType==='remnant');game.pendingSpawn=[];game.playerAttack=null;game.projectiles=[];game.zones=[];game.effects=[];for(const d of game.devices){d.target=null;delete d.targetId;d.entered={};}}
  function resetNight(game){
    clear(game);game.action=null;game.nextWave=0;game.plan=S.nightPlan(game.day,game.difficulty);game.waveDirections=[];game.warnedWaves=[];
    game.stats={planned:0,spawned:0,arrived:0,kills:{},damage:{},lost:0,searches:0,food:[],resourceStart:game.resources()};
  }
  function jump(game,day,night=false){
    if(!Number.isInteger(day)||day<1||day>365)return false;
    if(game.scene==='armory')game.switchArmory();
    if(game.scene==='parking')game.switchScene();
    enable(game);game.day=day;if(game.difficultyWorld){game.difficultyWorld.restockCycle=game.difficultyRules.restock?Math.floor((day-1)/game.difficultyRules.restock):0;game.difficultyWorld.repairCycle=game.difficultyRules.repair?Math.floor((day-1)/game.difficultyRules.repair):0;}game.residentRefreshCycle=Math.floor((day-1)/game.difficultyRules.residents);resetNight(game);game.minutes=night?1320:300;if(game.makeWeather)game.weather=game.makeWeather(false);game.visitors=game.visitors.filter(v=>v.recruited);game.initVisit();
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
    const def=D.enemies[kind];if(kind==='skeleton'||!def||!Number.isInteger(count)||count<1||count>20)return false;
    enable(game);let placed=0;
    for(let n=0;n<count;n++){
      let p=null;
      for(let a=0;a<64;a++){const angle=(a+n*7)*Math.PI/16,r=6+Math.floor(a/32)*2,c={x:game.player.x+Math.cos(angle)*r,y:game.player.y+Math.sin(angle)*r};if(!game.obstacles(c,c,.3).length&&!game.zombies.some(z=>S.dist(z,c)<.6)){p=c;break;}}
      if(!p)break;
      game.zombies.push({...p,kind,hp:game.enemyHP(kind,def.hp),maxHP:game.enemyHP(kind,def.hp),id:game.spawned++,nextAttack:game.seconds+1,path:[],repathAt:0,rootUntil:0,boostUntil:0,screamAt:game.seconds+2,rangedAt:game.seconds+1});game.stats.spawned++;placed++;
    }
    game.announce(`开发测试：已在6—8米外生成${placed}/${count}只${def.name}。`);return placed===count;
  }
  function spawnVisitor(game){
    if(game.scene!=='surface')return '请回到地面后生成来访幸存者。';
    if(game.visitors.some(v=>!v.recruited))return '已有来访幸存者在等候。';
    const spots=[];
    for(const y of [6,7,8])for(const x of [0,-1,1,-2,2,-3,3,-4,4])spots.push({x,y});
    const actors=[game.player,...game.visitors,...game.zombies.filter(z=>z.hp>0),...(game.humanActiveActors?.()||[])];
    const p=spots.find(q=>!game.obstacles(q,q,.3).length&&actors.every(o=>S.dist(o,q)>=.8));
    if(!p)return '院门外没有空位，请清理后再试。';
    enable(game);
    const afterHours=game.minutes>=1200;
    game.spawnVisitor(p,afterHours);
    return `已在初始领地院门外生成来访幸存者，按 E 或点交互交谈。${afterHours?'来访者会等到次日05:00。':''}`;
  }
  const positionNames={rear_left:'屋内后左角',rear_right:'屋内后右角',front_left:'屋内前左角',front_right:'屋内前右角',yard:'院子中央',outside_front:'房屋正前方',outside_back:'房屋后侧',outside_right:'房屋右侧',outside_left:'房屋左侧'};
  const button=(key,text,extra='')=>`<button data-dev="${key}" ${extra}>${text}</button>`;
  function panel(game){
    const s=state(game),options=['wood','iron',...Object.keys(D.items),...Object.keys(D.weapons).filter(k=>k!=='fists')].map(k=>`<option value="${k}">${S.NAMES[k]}</option>`).join('');
    const weatherOptions=Object.entries(S.Weather).filter(([kind])=>game.canSelectWeather(kind)).map(([kind,{name}])=>`<option value="${kind}" ${kind===game.weatherKind()?'selected':''}>${name}</option>`).join('');
    return `<div class="eyebrow">暂停中 · 独立测试存档</div><h2>开发者模式</h2><p>F2打开或关闭面板。启用工具后只写测试存档，正常进度保留。总开关关闭时所有工具无效，本局仍保存为测试存档。</p>
      <div class="dev-toggles">${[['enabled','开发工具'],['invincible','无敌'],['infiniteStamina','无限体力'],['hideRoofs','隐藏所有屋顶'],['collisions','碰撞框与坐标']].map(([k,t])=>button('toggle',`${t}：${s[k]?'开启':'关闭'}`,`data-option="${k}" aria-pressed="${s[k]}"`)).join('')}</div>
      <div class="dev-section"><h3>状态与时间</h3><div class="dev-row">${button('heal','补满血量 / 体力 / 饱食')}${button('clear','清除当前敌人和危险区域')}</div><div class="dev-row"><label>第几天 <input id="dev-day" type="number" min="1" max="365" value="${game.day}"></label>${button('day','切换至该天05:00')}${button('night','切换至该天22:00')}</div><small>切换天数会重置当晚批次，不发放跳过日期的奖励或作物收成。</small><div class="dev-row"><label>游戏速度 <select id="dev-speed">${[1,2,5].map(n=>`<option value="${n}" ${n===s.speed?'selected':''}>${n}倍</option>`).join('')}</select></label>${button('speed','应用速度')}</div></div>
      <div class="dev-section"><h3>物资与敌人</h3><div class="dev-row"><label>物品 <select id="dev-item">${options}</select></label><label>数量 <input id="dev-amount" type="number" min="1" max="999" value="20"></label>${button('give','添加物品')}</div><small>遵守背包格数和堆叠上限；空间不足时整笔取消。</small><div class="dev-row"><label>怪物 <select id="dev-enemy">${Object.entries(D.enemies).filter(([k])=>k!=='skeleton').map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('')}</select></label><label>数量 <input id="dev-count" type="number" min="1" max="20" value="1"></label>${button('spawn','生成怪物')}</div></div>
      <div class="dev-section"><h3>天气</h3><div class="dev-row"><label>地面天气 <select id="dev-weather" ${game.scene==='surface'?'':'disabled'}>${weatherOptions}</select></label>${button('weather','切换天气',game.scene==='surface'?'':'disabled')}</div><small>常规天气沿用当前天气段的剩余时间。沙尘暴仅限困难与天启，切换后会开始失水倒计时。</small></div>
      <div class="dev-section"><h3>来访幸存者</h3><div class="dev-row">${button('spawn-visitor','生成来访幸存者',game.scene==='surface'?'':'disabled')}</div><small>生成在初始领地院门外。</small></div>
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
  /* 天启人类测试工具：生成的单位带 simulated 标记，除非勾选“按正式击杀结算”。 */
  const humanWeapons={bare:'徒手',iron_axe:'铁斧',hand_crossbow:'手弩',shotgun:'散弹枪'};
  function humanSpot(game,n){
    /* 先找和玩家之间没有墙或围栏的空位（强盗要看得见玩家才会进攻），找不到再放宽 */
    for(const needSight of [true,false])for(let a=0;a<120;a++){const angle=(a+n*5)*Math.PI/12,r=3+Math.floor(a/24)*1.2,c={x:game.player.x+Math.cos(angle)*r,y:game.player.y+Math.sin(angle)*r};
      if(game.obstacles(c,c,.3).length||game.zombies.some(z=>S.dist(z,c)<.8)||game.humans.actors.some(h=>h.hp>0&&S.dist(h,c)<.8)||game.inArmory&&game.inArmory(c)!==game.inArmory(game.player))continue;
      if(needSight&&!game.clearVision(c,game.player,game.player))continue;return c;}
    return null;
  }
  function humanSpawn(game,kind,weapon,count,real){
    let placed=0;for(let n=0;n<count;n++){const p=humanSpot(game,n);if(!p)break;const a=game.newHuman(kind,p,kind==='bandit'?weapon:'bare');a.home={x:p.x,y:p.y};a.nextAttack=game.seconds+1.5;if(!real)a.simulated=true;placed++;}
    return placed;
  }
  function campInsidePoint(game){
    const b=game.camp.position;for(let i=0;i<400;i++){const t=i/400,c={x:b.x+(((i*37)%41)/40-.5)*(b.w-2),y:b.y+(((i*53)%43)/42-.5)*(b.h-2)};if(!game.obstacles(c,c,.3).length&&game.guardDistance(c)<=0)return c;}
    return null;
  }
  function human(game,action){
    if(!game.humanMode||!game.humans){game.announce('人类单位只在天启难度出现，请用天启难度开局。');return false;}
    if(game.scene==='parking'&&!['human-revenge','human-unlock','human-hero'].includes(action)){game.announce('请先回到地面再使用人类测试工具。');return false;}
    enable(game);const h=game.humans,real=!!document.getElementById('dev-human-real')?.checked;
    if(action==='human-bandit'){const weapon=document.getElementById('dev-human-weapon')?.value||'bare',count=Number(document.getElementById('dev-human-count')?.value);if(!humanWeapons[weapon]||!Number.isInteger(count)||count<1||count>6)return false;const n=humanSpawn(game,'bandit',weapon,count,real);game.announce(`开发测试：已在附近生成${n}/${count}名${humanWeapons[weapon]}强盗${real?'（按正式击杀结算）':''}。`);return n===count;}
    if(action==='human-starving'){const count=Number(document.getElementById('dev-human-count')?.value);if(!Number.isInteger(count)||count<1||count>6)return false;const n=humanSpawn(game,'starving_civilian','bare',count,real);game.announce(`开发测试：已在附近生成${n}/${count}名饥民，它们会去搜附近的箱子。`);return n===count;}
    if(action==='human-revenge'){h.regularKills=Math.max(h.regularKills,6);h.revenge=true;h.retryOutside=false;h.banUntil=0;game.announce('开发测试：已获得“复仇”，进入幸存者营地即触发袭击。');return true;}
    if(action==='human-raid'){
      if(h.raid){game.announce('袭击已在进行或撤退中。');return false;}
      if(!game.camp?.position){game.announce('营地还没有落地：先点“第14天营地 / 定位入口”，等地图出现营地标记后再试。');return false;}
      h.regularKills=Math.max(h.regularKills,6);h.revenge=true;h.retryOutside=false;h.banUntil=0;
      const p=campInsidePoint(game);if(!p)return false;game.cancelAction();Object.assign(game.player,p);game.updateIndoorHome();game.startHumanRaidIfNeeded();
      game.announce('开发测试：已传送进营地并触发袭击，10秒后第一波。');return !!h.raid;
    }
    if(action==='human-wave'){const r=h.raid;if(!r?.active)return false;r.pending=[];if(r.phase==='warning'||r.phase==='between')r.readyAt=game.seconds;for(const a of h.actors)if(a.raidId===r.id&&a.hp>0)game.hurtHuman(a,a.hp,'player');game.announce('开发测试：已清除当前波次的袭击强盗。');return true;}
    if(action==='human-unlock'){h.unlocked=true;h.cooldownUntil=0;game.announce('开发测试：已解锁忠心随从，按 V 召唤。');return true;}
    if(action==='human-hero'){h.heroUntil=game.seconds+240;game.announce('开发测试：获得“英雄”240秒，营地交易八折。');return true;}
    if(action==='human-clear'){h.actors=h.actors.filter(a=>a.raidId&&h.raid);h.shots=h.shots.filter(s=>s.raidId&&h.raid);for(const [k,g] of Object.entries(h.groups))if(!g.raidId)delete h.groups[k];h.claims={};game.announce('开发测试：已清除地面上的饥民和普通强盗（进行中的袭击保留）。');return true;}
    return false;
  }
  function humanPanel(game){
    if(!game.humanMode||!game.humans)return '<div class="dev-section"><h3>天启人类</h3><small>饥民、强盗和营地袭击只在天启难度出现。</small></div>';
    const h=game.humans,f=a=>a.hp>0;const st=h.actors.filter(a=>f(a)&&a.kind==='starving_civilian').length,bd=h.actors.filter(a=>f(a)&&a.kind==='bandit'&&!a.raidId).length;
    return `<div class="dev-section"><h3>天启人类</h3><small>当前地面：饥民${st}名 · 普通强盗${bd}/6名 · 普通强盗击败${h.regularKills}/6${h.revenge?' · 已带复仇':''}${h.raid?` · 袭击${h.raid.active?`第${h.raid.wave+1}/3波`:'撤退中'}`:''}</small>
      <div class="dev-row"><label>强盗武器 <select id="dev-human-weapon">${Object.entries(humanWeapons).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>数量 <input id="dev-human-count" type="number" min="1" max="6" value="1"></label>${button('human-bandit','生成强盗')}${button('human-starving','生成饥民')}</div>
      <div class="dev-row"><label><input id="dev-human-real" type="checkbox"> 按正式击杀结算（计入复仇、掉落武器与图腾）</label></div>
      <div class="dev-row">${button('human-revenge','直接获得复仇')}${button('human-raid','进营地触发袭击')}${button('human-wave','清除当前袭击波次')}</div>
      <div class="dev-row">${button('human-unlock','解锁忠心随从')}${button('human-hero','获得英雄240秒')}${button('human-clear','清除地面饥民和强盗')}</div>
      <small>默认生成的单位带测试标记，击杀不计复仇、不掉落。饥饿图腾可在上方“添加物品”里直接领取。</small></div>`;
  }
  const api={state,enable,toggle,clear,jump,teleport,give,spawn,spawnVisitor,panel,draw,human,humanPanel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeveloperMode=api;
})(typeof globalThis!=='undefined'?globalThis:this);
