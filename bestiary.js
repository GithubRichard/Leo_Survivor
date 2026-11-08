/* Read-only field guide. Opening it never creates a game or changes a save. */
(() => {
  'use strict';
  const S=window.Survival,D=S.Expansion,P=window.ParkingData,M=window.DifficultyRules,H=window.HumansData;
  const $=id=>document.getElementById(id),dialog=$('bestiary-dialog');
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number(value.toFixed(3)).toString();
  const humanArt=(entity,pose='idle')=>['HUMAN_ART',window.HUMAN_ART.lookup[`${entity}|south|${pose}`]];
  const entries=[
    {kind:'normal',group:'common',description:'最常见的感染者，会追击幸存者并攻击挡路的建筑。数量多时仍需保持距离。'},
    {kind:'runner',group:'common',description:'生命较低，奔跑速度很快，容易追上撤退中的幸存者。'},
    {kind:'brute',group:'common',description:'生命厚、移动慢，对建筑的破坏力很强。攻击前有0.8秒蓄力，可趁机拉开距离。'},
    {kind:'spitter',group:'common',description:'会在近战范围外吐出酸液，利用掩体阻挡弹道比硬扛更安全。'},
    {kind:'demolisher',group:'common',description:'擅长拆除防御设施，会优先寻找6米内可攻击的装置。攻击前蓄力0.6秒。'},
    {kind:'screamer',group:'common',description:'自身伤害较低，但会用尖啸加速附近同伴，放任它靠近尸群会让防线更难守。'},
    {kind:'lamp_smasher',group:'parking',description:'地下的投石怪物，会优先攻击8米内正在工作的照明装置。灯光照到它时会退避。',art:['PARKING_ART','lamp_smasher_south__idle']},
    {kind:'lurker',group:'parking',boss:true,description:'地下一层Boss。藏在地下时免疫燃烧瓶以外的伤害；用有效灯光逼出后才能正常攻击。',art:['PARKING_ART','lurker_normal_south__idle']},
    {kind:'skeleton',group:'parking',boss:true,description:'地下二层Boss。会拆出骨头投掷或横扫，拆骨消耗自身1点生命；摧毁骨头可以打断对应招式。',art:['WORLD_ART','skeleton_south__idle']},
    {kind:'armory_blade_zombie',group:'armory',description:'军备区的持刀感染者。移动快、攻击重，挥刀前有0.5秒前摇。',art:['ARMORY_ART','armory_blade_zombie_south__idle']},
    {kind:'sweeper',group:'armory',boss:true,description:'军备区Boss。使用步枪连射、扫射和火箭弹压制目标；普通伤害每次减免0.5，投掷技能的骨头伤害可穿过这层护甲。',art:['ARMORY_ART','armory_sweeper_south__idle']},
    {kind:'starving_civilian',group:'human',human:true,description:'仅天启出现的中立饥民。会走近搜空容器、携走物品，进食100游戏分钟后再找下一箱；夜间躲进房屋。受玩家阵营伤害后会自卫。',art:humanArt('starving_civilian')},
    {kind:'bandit',group:'human',human:true,description:'仅天启出现的敌对强盗。徒手、铁斧、手弩和散弹枪共用一栏，生命、移速相同，伤害随武器改变；会主动攻击玩家与忠心随从。',art:humanArt('bandit_bare')},
    {kind:'loyal_follower',group:'human',human:true,description:'天启首次守住营地三波袭击后解锁。按V或触屏按钮召唤；会跟随玩家跨场景、攻击可见敌人，保留残余生命。',art:humanArt('loyal_follower')},
    {kind:'home_helper',group:'human',human:true,description:'收留来访幸存者得到的后勤助手。各难度均可提供后勤；天启额外守卫初始领地、驱除进入领地的饥民，不追出界。',art:humanArt('home_helper','windup')}
  ];
  const humanStats={starving_civilian:{name:'饥民',hp:2,damage:1,speed:2,interval:1.5,range:1.1,windup:.3},bandit:{name:'强盗',hp:3,speed:1,interval:2},loyal_follower:{name:'忠心随从',hp:3,damage:2.5,speed:3,interval:2,range:1.3,windup:.4},home_helper:{name:'后勤助手',damage:2,speed:2,interval:2,range:1.3,windup:.4}};
  const definition=kind=>P.enemies[kind]||D.enemies[kind];
  const damage=(amount,kind,id)=>number(M.damage(amount,kind,id));
  const speed=(amount,kind,id)=>number(amount*(M.boss(kind)?M.profile(id).bossSpeed:M.profile(id).speed));
  function portrait(entry){
    let asset,crop;
    if(entry.art){
      const book=window[entry.art[0]],frame=book?.frames[entry.art[1]];
      asset=book?.atlases[frame?.atlas];
      if(frame){const [x,y]=frame.rect,[l,t,r,b]=frame.bounds;crop=[x+l,y+t,x+r,y+b];}
    }else{
      const key=entry.kind==='normal'?'zombie_south':`zombie_${entry.kind}_south`;
      asset=window.EXPANSION_ASSETS?.[key]||window.GAME_ASSETS?.[key];crop=asset?.crop;
    }
    if(!asset||!crop)return '';
    const [l,t,r,b]=crop,scale=Math.min(88/(r-l),104/(b-t));
    return `<span class="bestiary-portrait" aria-hidden="true"><span class="bestiary-crop" style="width:${(r-l)*scale}px;height:${(b-t)*scale}px"><img loading="lazy" decoding="async" alt="" src="${escape(asset.src)}" style="width:${asset.size[0]*scale}px;height:${asset.size[1]*scale}px;left:${-l*scale}px;top:${-t*scale}px"></span></span>`;
  }
  function abilities(entry,id){
    const k=entry.kind,d=definition(k),hit=n=>damage(n,k,id);
    if(k==='lurker')return [
      '近战距离1米，间隔2秒，前摇0.6秒；移动时会碾碎可破坏的建筑与装置。',
      `生命≤8时进入畏缩：速度${speed(3,k,id)}米/秒，近战伤害${hit(2.5)}；每10秒额外召唤2只普通丧尸和1只尖啸者。`,
      `灯光逼出后眩晕2秒，再蓄力1秒怒吼：2米内造成${damage(.5,'lurker_roar',id)}伤害，命中后虚弱5秒，移速与直接伤害各降低0.7；掩体可阻挡。`
    ];
    if(k==='skeleton')return [
      `近战：${hit(3)}伤害，距离1.3米，间隔1.6秒，前摇0.3秒。横扫：${hit(3)}伤害，半径2.6米，前摇1.5秒。`,
      `投骨前摇2秒；飞行命中${damage(3,'skeleton_bone',id)}伤害，落地接触每秒${damage(1,'skeleton_bone',id)}伤害。普通骨头4血，回收成功为Boss回复1血。`,
      `有效灯光会逼退它。离开二层时，存活Boss恢复26血、战斗骨清除。死亡遗骨20血，累计游玩${M.profile(id).reviveDays}个游戏日后复活（暂停不计）；摧毁遗骨可追加${M.profile(id).shatterDays}日，每轮仅一次。`
    ];
    if(k==='sweeper')return [
      `三连射：每发${hit(1.5)}伤害，射程18米，前摇0.5秒。扫射：10发、每发${hit(1.5)}伤害，前摇1秒；同组子弹可连续命中。`,
      `火箭弹：${damage(6,'sweeper_rocket',id)}伤害，爆炸半径0.5米，射程22米，前摇4秒。`,
      '步枪子弹间隔0.12秒；扫射结束后冷却12秒，火箭发射后冷却10秒。离开军备区后，存活Boss恢复满血。'
    ];
    const result=[`近战间隔${number(d.interval)}秒；${k==='armory_blade_zombie'?'挥刀距离1.4米':'攻击距离1米'}。`];
    if(k==='spitter')result.push(`酸液射程7米，前摇1秒、间隔4秒；地表对人${hit(2)}、对建筑${hit(1)}伤害，地下对人${hit(3)}、对建筑${hit(2)}伤害。`);
    if(k==='screamer')result.push('尖啸蓄力1.5秒，间隔20秒；使6米内可受鼓舞的同伴移速提高20%，持续8秒。');
    if(k==='lamp_smasher')result.push(`投石射程8米，前摇1秒、间隔5秒；对人和普通建筑${hit(2)}伤害，对照明装置${hit(4)}伤害。`);
    return result;
  }
  function card(entry,id){
    if(entry.human)return humanCard(entry,id);
    const k=entry.kind,d=definition(k),p=M.profile(id),boss=M.boss(k);
    const stats=[['生命',number(d.hp*(boss?1:p.hp)),''],[k==='sweeper'?'步枪单发伤害':'近战伤害',damage(d.damage,k,id),''],['移动速度',speed(d.speed,k,id),'米/秒'],[k==='sweeper'?'步枪对建筑':'近战对建筑',Number.isFinite(d.building)?damage(d.building,k,id):'直接碾碎','']];
    const tag=entry.boss?'Boss':entry.group==='common'?'常见丧尸':entry.group==='parking'?'地下生物':'军备区生物';
    const location=entry.group==='common'?'地表 / 地下一层':k==='skeleton'?'地下停车场 · 二层':entry.group==='parking'?'地下停车场 · 一层':'军备区';
    const underground=entry.group==='common'?`<p class="bestiary-underground"><b>地下强化</b>　生命不变；近战伤害${damage(d.damage+1,k,id)}，对建筑${damage(d.building+1,k,id)}，速度${speed(Math.min(3.2,d.speed*1.2),k,id)}米/秒。有效灯光会使其退避。</p>`:'';
    return `<article class="bestiary-entry${entry.boss?' bestiary-boss':''}"><header class="bestiary-entry-header">${portrait(entry)}<div><span class="bestiary-tag">${tag}</span><h3>${escape(d.name)}</h3><p class="bestiary-location">${location}</p></div></header><p class="bestiary-description">${escape(entry.description)}</p><dl class="bestiary-stats">${stats.map(([label,value,unit])=>`<div><dt>${label}${entry.group==='common'?' · 地表':''}</dt><dd>${value}${unit?`<small>${unit}</small>`:''}</dd></div>`).join('')}</dl><ul>${abilities(entry,id).map(text=>`<li>${escape(text)}</li>`).join('')}</ul>${underground}</article>`;
  }
  function humanCard(entry,id){
    const k=entry.kind,d=humanStats[k],helper=k==='home_helper';
    const stats=[['生命',helper?'不可受伤':d.hp],['移动速度',d.speed+'米/秒'],['攻击间隔',d.interval+'秒'],[k==='bandit'?'单次伤害':'近战伤害',k==='bandit'?'2—10（见武器）':helper?'2（仅天启守卫）':d.damage]];
    const details=[];
    if(k==='starving_civilian')details.push('每天新增1—4名；20米内寻找容器，走到1米内连续搜索3秒。正在吃的食物60%掉落，真实携带的未学图纸10%掉落，独立2%掉落饥饿图腾。');
    if(k==='bandit')details.push('普通强盗最多存活6名；玩家阵营击败6名普通强盗获得复仇，进入营地触发6 / 10 / 15人的三波袭击。','普通强盗必掉所持武器（徒手除外）；袭击强盗不掉武器。手弩和散弹强盗均有60%概率掉对应弹药。');
    if(k==='loyal_follower')details.push('召唤耗时0.6秒，移动或受伤中断；最多1名，不自愈、不掉物品。死亡后冷却120秒，跨层不刷新血量；潜伏状态的潜伏者无法被它伤害。');
    if(helper)details.push('不占忠心随从名额、不作为敌方攻击目标；天启守卫不要求当天已吃到补给。正常后勤仍需要每日指定食物，中午可领取2木和1铁。');
    if(k!=='bandit')details.push(`近战距离${d.range}米，前摇${d.windup}秒。${helper?'守卫数值仅在天启启用。':'属性为最终值，不再乘丧尸难度倍率。'}`);
    const weapons=k==='bandit'?`<div class="bestiary-weapons"><table><caption>强盗武器 · 全部为天启最终值</caption><thead><tr><th scope="col">武器</th><th scope="col">伤害</th><th scope="col">距离</th><th scope="col">前摇</th></tr></thead><tbody>${Object.entries(H.weapons).map(([weapon,w])=>`<tr><th scope="row">${{bare:'徒手',iron_axe:'铁斧',hand_crossbow:'手弩',shotgun:'散弹枪'}[weapon]}</th><td>${w.pellets?`${w.damage}×${w.pellets}，全中${number(w.damage*w.pellets)}`:w.damage}</td><td>${w.range}米</td><td>${w.windup}秒</td></tr>`).join('')}</tbody></table></div>`:'';
    return `<article class="bestiary-entry"><header class="bestiary-entry-header">${portrait(entry)}<div><span class="bestiary-tag">${helper?'后勤伙伴':'仅天启 · 人类'}</span><h3>${d.name}</h3><p class="bestiary-location">${k==='loyal_follower'?'可随玩家进出地下':'地表'}${id!=='apocalypse'&&!helper?' · 本难度不出现':''}</p></div></header><p class="bestiary-description">${escape(entry.description)}</p><dl class="bestiary-stats">${stats.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${weapons}<ul>${details.map(text=>`<li>${escape(text)}</li>`).join('')}</ul></article>`;
  }
  function render(){
    const id=$('bestiary-difficulty').value,group=$('bestiary-category').value,visible=entries.filter(e=>group==='all'||e.group===group);
    $('bestiary-count').textContent=`${M.profile(id).name}难度 · ${visible.length} / ${entries.length}种`;
    $('bestiary-list').innerHTML=visible.map(entry=>card(entry,id)).join('');
  }
  $('bestiary-difficulty').innerHTML=Object.entries(M.profiles).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('');
  $('open-bestiary').addEventListener('click',()=>{
    if(dialog.open)return;
    $('bestiary-difficulty').value=document.querySelector('#difficulty-options [aria-pressed="true"]')?.dataset.difficulty||'normal';
    $('bestiary-category').value='all';render();dialog.showModal();dialog.scrollTop=0;
  });
  for(const id of ['bestiary-difficulty','bestiary-category'])$(id).addEventListener('change',render);
  dialog.addEventListener('close',()=>{$('bestiary-list').replaceChildren();$('open-bestiary').focus();});
})();
