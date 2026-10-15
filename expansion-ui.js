/* All new actions have clickable E-equivalent controls, including touch. */
(() => {
  const D=ExpansionData,N=Survival.NAMES,A=GameArt;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases={trap:'bear_trap',storage_chest:'storage_chest_closed',drying_rack:'drying_rack_empty',planter:'planter_empty'};
  const image=k=>A.entries[aliases[k]||k]?.src;
  const thumb=k=>image(k)?`<img class="exp-thumb" src="${image(k)}" alt="" loading="lazy">`:'';
  const cost=obj=>Object.entries(obj||{}).map(([k,n])=>`${N[k]}${n}`).join('、')||'无';
  const button=(command,label,data='',disabled=false)=>`<button data-command="${command}" ${data} ${disabled?'disabled':''}>${label}</button>`;
  function inventory(game,buildKind,pane='bag'){
    const tabs=[['bag','背包'],['build','建造'],['craft','制作']].map(([k,n])=>`<button data-pane="${k}" class="${pane===k?'selected':''}">${n}</button>`).join('');
    let content='',extraActions='';
    if(pane==='bag'){
      const selected=game.inventory[game.selectedSlot],weapon=D.weapons[selected?.kind],food=D.foods[selected?.kind];
      const details=weapon?`伤害${weapon.damage}${weapon.pellets?'×4弹丸':''} · 距离${weapon.range}米 · 间隔${weapon.interval}秒 · 每次耗体力${weapon.stamina}${weapon.ammo?' · 使用'+N[weapon.ammo]:''}`:food?`饱食+${food.hunger}${food.heal?' · 恢复'+food.heal+'血':''}${food.stamina?' · 恢复'+food.stamina+'体力':''}${food.buff||food.tea?' · 增益持续360秒':''}`:selected?.kind==='bandage'?'8秒恢复4血；可步行，奔跑、攻击或受伤会中断。':'';
      content=`<p>点物品格选择，点“使用”食用、包扎或装备武器。材料不能直接食用。</p><div class="inventory-grid">${game.inventory.map((s,i)=>`<button data-slot="${i}" class="slot ${i===game.selectedSlot?'selected':''}">${s?thumb(s.kind):''}<div>${s?`${escape(N[s.kind]||s.kind)} × ${s.amount}`:'空'}</div><span>${i+1}</span></button>`).join('')}</div><div class="selection-info">当前：${selected?escape(N[selected.kind]||selected.kind):'空格'}　装备：${escape(N[game.player.weapon]||'徒手')}</div><p class="item-details">${escape(details)}</p>`;
      extraActions=button('use','使用/装备','',!selected)+button('fists','徒手')+button('drop','丢弃一份','',!selected);
    }else {
      const defs=pane==='build'?D.builds:{...D.weapons,...D.crafts};
      content=`<p>${pane==='build'?'选择建筑，返回场景后确认位置。建造3秒，移动或受伤会中断。':'制作3秒。铁斧、弓及高级武器需工作台。急救包按钮直接开始3秒急救；完成时才扣材料。'}</p><div class="recipe-grid">${Object.entries(defs).filter(([k])=>k!=='fists').map(([k,d])=>`<button data-command="${pane==='build'?'choose-build':'craft'}" data-kind="${k}" ${game.day<d.day||k==='backpack_upgrade'&&game.inventory.length>=30?'disabled':''} class="recipe-card ${buildKind===k?'selected':''}">${thumb(k)}<strong>${escape(d.name)}</strong><small>${cost(d.cost)}${d.hp?' · '+d.hp+'血':''}</small><small>${game.day<d.day?`第${d.day}天开放`:d.station?'需要工作台':'已开放'}</small></button>`).join('')}</div>`;
    }
    return `<div class="eyebrow">暂停中 · ${game.inventory.length}格背包</div><h2>物资与准备</h2><div class="exp-tabs">${tabs}</div>${content}<div class="overlay-actions">${extraActions}<button data-key="tab">返回游戏</button></div><div class="keyboard-hint key-hint">WASD选择格子 · E使用 · F部署选中的建筑 · Tab返回</div>`;
  }
  function context(game,target){
    if(!target)return '';const o=target.object;let commands='',description='';
    if(target.type==='visitor'){
      commands=D.trades.map((t,i)=>button('trade',`${cost(t.cost)} → ${cost(t.gain)}（剩${2-o.trades[i]}次）`,`data-index="${i}"`,o.trades[i]>=2)).join('')+button('recruit','收留为后勤助手','',!!game.helper);
      description='每天最多一次来访，20:00离开。助手每天消耗一份指定食物，中午提供2木和1铁，不参加战斗。';
    }else if(target.type==='helper'){
      const h=game.helper;description=h.fedDay===game.day?(h.collected?'今天补给已领取。':h.ready?'中午补给已准备好。':'中午可以领取2木和1铁。'):'今天缺少食物，助手休息。';
      commands=button('helper-collect','领取助手物资','',!h.ready||h.collected)+`<p>次日05:00使用：${N[h.food]}</p>`+Object.entries(D.foods).filter(([k,f])=>k==='canned_food'||f.cost&&f.hunger>=20).map(([k])=>button('helper-food',N[k],`data-kind="${k}"`)).join('');
    }else if(target.type==='container'){
      description='物资已收集完，不能重复搜索。空容器仍占位置，可以拆除腾出空间。移动或受伤会中断拆除。';
      commands=button('dismantle','拆除空容器（3秒）');
    }else {
      description=`血量 ${Number(o.hp.toFixed(1))} / ${o.maxHP}。操作时保持站立，受伤会中断。`;
      if(o.hp<o.maxHP){const k=o.material==='stone'||o.kind==='brick_wall'?'stone':o.kind==='trap'||o.kind==='iron_fence'?'iron':'wood';commands+=button('repair',`维修1秒 · ${N[k]}1恢复${k==='stone'?10:6}血`);}
      if(o.type==='door'&&!o.level||o.kind==='trap'&&!o.level||o.kind==='ballista'&&(o.level||0)<2){const key=o.type==='door'?'door':o.kind==='ballista'&&o.level===1?'repeating':o.kind,u=D.upgrades[key];commands+=button('upgrade',`改造5秒 · ${cost(u.cost)} · ${u.hp}血${o.type==='door'?'':' · 需工作台'}`,'',game.day<u.day);}
      if(o.type==='furniture'||o.type==='device'||o.type==='site'&&o.searched)commands+=button('dismantle','拆除3秒，返还材料');
      if(['grill','stove','drying_rack','water_purifier'].includes(o.kind)){
        if(['grill','stove'].includes(o.kind))commands+=`<p>剩余燃料额度：${o.fuel}</p>`+button('fuel','投入1木，增加3份额度');
        if(o.kind==='water_purifier')commands+=button('produce','4原水 → 4清水 / 20秒','data-kind="clean_water"');
        else for(const [k,f] of Object.entries(D.foods))if(f.cost&&(o.kind===f.station||o.kind==='stove'&&['grill','stove'].includes(f.station)))commands+=button('produce',`${N[k]} · ${cost(f.cost)} · ${f.time}秒`,`data-kind="${k}"`,game.day<f.day);
        if(o.jobs?.length)commands+=`<p>生产：${o.jobs.map(j=>`${N[j.kind]} ${Math.ceil(j.remaining)}秒`).join('、')}</p>`+button('cancel-job','取消第一份，返还食材');
        commands+=`<p>输出：${o.output.filter(Boolean).map(s=>`${N[s.kind]}×${s.amount}`).join('、')||'空'}</p>`+button('take-output','领取成品');
      }
      if(o.kind==='planter'){description+=o.crop?` ${N[o.crop.kind]}已经历${Math.min(2,o.crop.dawns)}/2次天亮。`:' 投入一份土豆或蔬菜，经历两次天亮后收获3份。';commands+=o.crop?button('harvest','收获','',o.crop.dawns<2):button('plant','种土豆','data-kind="potato"')+button('plant','种蔬菜','data-kind="vegetable"');}
      if(o.kind==='storage_chest'){
        commands+=`<p>点击背包物品整格存入，点击箱内物品整格取出。</p><h3>背包</h3><div class="storage-grid">${game.inventory.map((s,i)=>s?button('store',`${thumb(s.kind)}${N[s.kind]}×${s.amount}`,`data-index="${i}"`):'').join('')}</div><h3>储物箱 · 20格</h3><div class="storage-grid">${o.storage.map((s,i)=>s?button('retrieve',`${thumb(s.kind)}${N[s.kind]}×${s.amount}`,`data-index="${i}"`):'').join('')||'空'}</div>`;
      }
    }
    return `<div class="eyebrow">暂停中 · E交互</div><h2>${escape((o.type==='site'?D.siteNames[o.kind]:N[o.kind])||o.name|| (target.type==='container'?'空容器':target.type==='helper'?'后勤助手':target.type==='visitor'?'来访幸存者':o.type==='door'?'门':'墙 / 围栏'))}</h2><p>${escape(description)}</p><div class="context-actions">${commands}</div><div class="overlay-actions"><button data-key="escape">返回游戏</button></div><small class="keyboard-hint">W/S选择，E确认，Esc返回</small>`;
  }
  const api={inventory,context,thumb,cost};window.ExpansionUI=api;
})();
