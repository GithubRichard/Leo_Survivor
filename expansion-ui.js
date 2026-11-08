/* All new actions have clickable E-equivalent controls, including touch. */
(() => {
  const D=ExpansionData,N=Survival.NAMES,A=GameArt;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases={trap:'bear_trap',storage_chest:'storage_chest_closed',drying_rack:'drying_rack_empty',planter:'planter_empty'};
  const thumb=k=>`<div class="item-thumb item-icon-box">${A.itemIcon(k,aliases[k]||k)}</div>`;
  const cost=obj=>Object.entries(obj||{}).map(([k,n])=>`${N[k]}${n}`).join('、')||'无';
  const num=n=>Number(n.toFixed(2));
  function foodDetails(game,kind){
    const f=D.foods[kind],healing=game.traitEffects.healing,amplitude=game.foodAmplitude||1,duration=num(360*amplitude),parts=[f.hunger?`饱食+${f.hunger}（最高100）`:'不增加饱食'];
    if(f.heal)parts.push(`立即恢复${num(f.heal*healing)}点血`);
    if(f.stamina)parts.push(`立即恢复${f.stamina}点体力（饱食度须大于0）`);
    const buffs={
      stamina2:`体力上限+${num(2*amplitude)}（饱食度大于60时生效）`,
      stamina4:`体力上限+${num(4*amplitude)}（饱食度大于60时生效）`,
      health:`血量上限+${num(2*amplitude)}（不会因此立即回血）`,
      melee:`每次近战伤害+${num(amplitude)}`,
      recovery:`每恢复1点体力的间隔由${num(2*game.traitEffects.recovery)}秒缩短至${num((2-.5*amplitude)*game.traitEffects.recovery)}秒（饱食度大于60时生效）`,
      armor:`单次伤害达到1点时减少${num(amplitude)}点伤害，减伤后最低仍受1点`
    };
    if(f.buff)parts.push(`${buffs[f.buff]}，持续${duration}秒；料理增益只保留一种，新增益替换旧增益`);
    if(f.regen)parts.push(`每${num(30*amplitude)}秒恢复${num(healing*amplitude)}点血，共${f.regen}次（${num(f.regen*30*amplitude)}秒内最多恢复${num(f.regen*healing*amplitude)}点）；再次获得持续回血效果会重置，不累加`);
    if(f.tea)parts.push(`奔跑体力消耗减少${num(20*amplitude)}%，持续${duration}秒；可与料理增益同时生效，重复饮用刷新时间、不叠加倍率`);
    if(amplitude>1&&(f.buff||f.regen||f.tea))parts.push('以上已计入背包中饥饿图腾的强化；移出图腾后按剩余基础进度恢复普通幅度和计时速度');
    if(f.heal||f.regen||f.stamina)parts.push('回血及体力恢复不超过各自当前上限');
    parts.push(`食用耗时1.5秒；${f.water?'饮水独立冷却30秒':'与其他食物共用20秒冷却'}`);
    return parts.join('；')+'。';
  }
  const combatDetails=s=>s?`${s.damage}伤害 / ${s.interval}秒${s.radius?' · 半径'+Number(s.radius.toFixed(2))+'米':''}`:'';
  const button=(command,label,data='',disabled=false)=>`<button data-command="${command}" ${data} ${disabled?'disabled':''}>${label}</button>`;
  function inventory(game,buildKind,pane='bag'){
    const tabs=[['bag','背包'],['build','建造'],['craft','制作'],['character','角色']].map(([k,n])=>`<button data-pane="${k}" class="${pane===k?'selected':''}">${n}</button>`).join('');
    let content='',extraActions='';
    if(pane==='character')content=CharacterUI.details(game);
    else if(pane==='bag'){
      const selected=game.inventory[game.selectedSlot],weapon=D.weapons[selected?.kind],food=D.foods[selected?.kind];
      A.prepareWeapon(selected?.kind,game.player.facing);
      const details=weapon?`伤害${num(game.directDamage(weapon.ammo?weapon.damage:game.meleeDamage(weapon.damage)))}${weapon.pellets?'×4弹丸':''} · 距离${weapon.range}米 · 间隔${num(weapon.interval*game.rangedAttackScale(selected.kind))}秒 · 每次耗体力${weapon.stamina}${weapon.ammo?' · 使用'+N[weapon.ammo]:''}`:food?foodDetails(game,selected.kind):['raw_meat','grain'].includes(selected?.kind)?'烹饪原料，不能直接食用；请先加工成料理。':selected?.kind==='emergency_aed'?'背包持有自动救命一次：致命伤后剩1血、保护1秒，同时3秒奔跑体力消耗×1.5；每件占一格，用后消失。':selected?.kind==='bandage'?`8秒内恢复${num(4*game.traitEffects.healing)}点血，每2秒恢复${num(game.traitEffects.healing)}点。治疗时可以步行。一旦奔跑、攻击或受伤，剩余治疗立即停止，绷带不返还。`:selected?.kind==='molotov'?'装备后手持，显示抛物线与4米落点；调整朝向，按E或触屏交互确认投出。红色表示当前不能投掷，落地后燃烧。':selected?.kind==='medkit'?`制作后存入背包。点使用开始3秒急救，完成后消耗1个急救包并恢复${num(8*game.traitEffects.healing)}血，受伤会中断。`:'';
      content=`<p>点物品格选择，点“使用”食用、包扎或装备武器。材料不能直接食用。</p><div class="inventory-grid">${game.inventory.map((s,i)=>`<button data-slot="${i}" class="slot ${i===game.selectedSlot?'selected':''}">${s?thumb(s.kind):''}<div>${s?`${escape(N[s.kind]||s.kind)} × ${s.amount}`:'空'}</div><span>${i+1}</span></button>`).join('')}</div><div class="selection-info">当前：${selected?escape(N[selected.kind]||selected.kind):'空格'}　装备：${escape(N[game.player.weapon]||'徒手')}</div><p class="item-details">${escape(details)}</p>`;
      content+=window.WestGateView?.inventoryExtras(game)||'';if(game.knowledge?.blueprint_emergency_aed)content+=`<p>${A.worldIcon('aed_blueprint_emergency_aed','knowledge',28)} 已学会AED蓝图 · 可在制作栏合成</p>`;
      extraActions=button('use',selected?.kind==='molotov'?'手持燃烧瓶':selected?.kind==='medkit'?'使用急救包':'使用/装备','',!selected)+button('fists','徒手')+button('drop','丢弃一份','',!selected);
      if(food?.stamina&&food.hunger===0&&game.player.hunger<=0)content+='<p>饱食度为0时不能恢复体力，请先吃食物；饮水和药草茶不会恢复当前体力。</p>';
    }else {
      const defs=pane==='build'?D.builds:{...D.weapons,...D.crafts};
      content=`<p>${pane==='build'?'选择建筑，返回场景后确认位置。可在领地外建造，请靠近空位放置，避开门口、墙壁和其他物体。建造'+num(game.actionDuration('build',3))+'秒，移动或受伤会中断。':'制作3秒，成品放入背包。铁斧、弓及高级武器需工作台。急救包需从背包主动使用；燃烧瓶需先手持，再按交互投掷。'}</p><div class="recipe-grid">${Object.entries(defs).filter(([k])=>k!=='fists').map(([k,d])=>`<button data-command="${pane==='build'?'choose-build':'craft'}" data-kind="${k}" ${game.day<d.day||d.knowledge&&!game.knowledge?.[d.knowledge]||k==='backpack_upgrade'&&game.inventory.length>=30?'disabled':''} class="recipe-card ${buildKind===k?'selected':''}">${thumb(k)}<strong>${escape(d.name)}</strong><small>${cost(d.cost)}${d.hp?' · '+d.hp+'血':''}</small><small>${d.knowledge&&!game.knowledge?.[d.knowledge]?(k==='emergency_aed'?'需搜索合格容器学习':'需搜索军备箱学习')+(window.ArmoryData?.blueprints[d.knowledge]||'对应蓝图 / 配方'):game.day<d.day?`第${d.day}天开放`:d.station?'需要工作台':'已开放'}</small></button>`).join('')}</div>`;
    }
    return `<div class="eyebrow">暂停中 · ${game.inventory.length}格背包</div><h2>物资与准备</h2><div class="exp-tabs">${tabs}</div>${content}${pane==='bag'?window.ParkingView?.inventoryExtras(game)||'':''}<div class="overlay-actions">${extraActions}<button data-key="tab">返回游戏</button></div><div class="keyboard-hint key-hint">WASD选择格子 · E使用 · F部署选中的建筑 · Tab返回</div>`;
  }
  function context(game,target){
    const armory=window.ArmoryView?.context(game,target);if(armory)return armory;
    const camp=window.CampView?.context(game,target);if(camp)return camp;
    const world=target&&window.WorldView?.context(game,target);if(world)return world;
    const parking=target&&window.ParkingView?.context(game,target);if(parking)return parking;
    if(!target)return '';const o=target.object;let commands='',description='';
    if(target.type==='visitor'){
      commands=D.trades.map((t,i)=>button('trade',`${cost(t.cost)} → ${cost(t.gain)}（剩${2-o.trades[i]}次）`,`data-index="${i}"`,o.trades[i]>=2)).join('')+button('recruit','收留为后勤助手','',!!game.helper);
      description='每天最多一次来访，20:00离开。助手每天消耗一份指定食物，中午提供2木和1铁，不参加战斗。';
    }else if(target.type==='helper'){
      const h=game.helper;description=h.fedDay===game.day?(h.collected?'今天补给已领取。':h.ready?'中午补给已准备好。':'中午可以领取2木和1铁。'):'今天缺少食物，助手休息。';
      commands=button('helper-collect','领取助手物资','',!h.ready||h.collected)+`<p>次日05:00使用：${N[h.food]}</p>`+Object.entries(D.foods).filter(([k,f])=>k==='canned_food'||f.cost&&f.hunger>=20).map(([k])=>button('helper-food',N[k],`data-kind="${k}"`)).join('');
    }else if(target.type==='container'){
      description='物资已收集完，不能重复搜索。空容器仍占位置，可以拆除腾出空间。移动或受伤会中断拆除。';
      commands=button('dismantle',`拆除空容器（${num(game.actionDuration('dismantle',3))}秒）`);
    }else {
      description=`血量 ${Number(o.hp.toFixed(1))} / ${o.maxHP}。操作时保持站立，受伤会中断。`;
      const combat=D.combatStats(o.kind,o.level);if(combat)description=`${combat.name}：${combatDetails(combat)}。${description}`;
      if(o.hp<o.maxHP){const k=o.material==='stone'||o.kind==='brick_wall'?'stone':o.kind==='trap'||o.kind==='iron_fence'?'iron':'wood';commands+=button('repair',`维修${num(game.actionDuration('repair',1))}秒 · ${N[k]}1恢复${k==='stone'?10:6}血`);}
      if(o.type==='door'&&!o.level||o.kind==='trap'&&!o.level||o.kind==='ballista'&&(o.level||0)<2){
        const key=o.type==='door'?'door':o.kind==='ballista'&&o.level===1?'repeating':o.kind,u=D.upgrades[key],next=D.combatStats(o.kind,u.level);
        const benefit=next?`${next.name} · 伤害${combat.damage}→${next.damage} · ${o.kind==='trap'?'冷却':'攻击间隔'}${combat.interval}→${next.interval}秒${next.radius?' · 半径'+Number(combat.radius.toFixed(2))+'→'+next.radius+'米':''} · `:'';
        commands+=button('upgrade',`${benefit}改造${num(game.actionDuration('upgrade',5))}秒 · ${cost(u.cost)} · ${u.hp}血 · 第${u.day}天${o.type==='door'?'':' · 需工作台'}`,'',game.day<u.day);
      }
      if(o.type==='furniture'||o.type==='device'||o.type==='site'&&o.searched)commands+=button('dismantle',`拆除${num(game.actionDuration('dismantle',3))}秒，${o.resourceDisabled?'无可回收材料':'返还材料'}`);
      if(['grill','stove','drying_rack','water_purifier'].includes(o.kind)){
        if(['grill','stove'].includes(o.kind))commands+=`<p>剩余燃料额度：${o.fuel}</p>`+button('fuel','投入1木，增加3份额度');
        if(o.kind==='water_purifier')commands+=button('produce','4原水 → 4清水 / 20秒','data-kind="clean_water"');
        else for(const [k,f] of Object.entries(D.foods))if(f.cost&&(o.kind===f.station||o.kind==='stove'&&['grill','stove'].includes(f.station)))commands+=button('produce',`${N[k]} · ${cost(f.cost)} · ${f.time}秒`,`data-kind="${k}"`,game.day<f.day);
        if(o.jobs?.length)commands+=`<p>生产：${o.jobs.map(j=>`${N[j.kind]} ${Math.ceil(j.remaining)}秒`).join('、')}</p>`+button('cancel-job','取消第一份，返还食材');
        commands+=`<p>输出：${o.output.filter(Boolean).map(s=>`${N[s.kind]}×${s.amount}`).join('、')||'空'}</p>`+button('take-output','领取成品');
      }
      if(o.kind==='planter'){description+=o.crop?` ${N[o.crop.kind]}已经历${Number(Math.min(48,o.crop.growth??(o.crop.dawns||0)*24).toFixed(1))}/48标准游戏小时生长。`:' 投入一份土豆或蔬菜，积满48标准游戏小时生长后收获3份。';commands+=o.crop?button('harvest','收获','',(o.crop.growth??(o.crop.dawns||0)*24)<48):button('plant','种土豆','data-kind="potato"')+button('plant','种蔬菜','data-kind="vegetable"');}
      if(o.kind==='storage_chest'){
        commands+=`<p>点击背包物品整格存入，点击箱内物品整格取出。</p><h3>背包</h3><div class="storage-grid">${game.inventory.map((s,i)=>s?button('store',`${thumb(s.kind)}${N[s.kind]}×${s.amount}`,`data-index="${i}"`):'').join('')}</div><h3>储物箱 · 20格</h3><div class="storage-grid">${o.storage.map((s,i)=>s?button('retrieve',`${thumb(s.kind)}${N[s.kind]}×${s.amount}`,`data-index="${i}"`):'').join('')||'空'}</div>`;
      }
    }
    return `<div class="eyebrow">暂停中 · E交互</div><h2>${escape((o.type==='site'?D.siteNames[o.kind]:N[o.kind])||o.name|| (target.type==='container'?'空容器':target.type==='helper'?'后勤助手':target.type==='visitor'?'来访幸存者':o.type==='door'?'门':'墙 / 围栏'))}</h2><p>${escape(description)}</p><div class="context-actions">${commands}</div><div class="overlay-actions"><button data-key="escape">返回游戏</button></div><small class="keyboard-hint">W/S选择，E确认，Esc返回</small>`;
  }
  const api={inventory,context,thumb:k=>A.itemIcon(k,aliases[k]||k,{width:24,height:22}),cost};window.ExpansionUI=api;
})();
