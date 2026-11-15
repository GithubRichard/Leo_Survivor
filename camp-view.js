/* Delivered camp layers share world footprints; NPC scale stays fixed by direction. */
(() => {
  'use strict';const S=Survival,C=CampData,A=GameArt,art=CAMP_ART,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=(asset,state='f0',size=30)=>{const states=art.assets['camp_'+asset]?.states;return A.worldIcon('camp_'+asset,states?.[state]?state:Object.keys(states||{})[0],size);};
  const itemArt=kind=>({fuel_oil:'car_fuel',oil_lantern:'fuel_lantern'}[kind]||kind);
  function itemIcon(kind){const asset=art.reuse[itemArt(kind)];return asset?A.worldIcon(asset,'icon',28):'';}
  const costText=(items,game=null)=>Object.entries(items).map(([k,n])=>`${S.NAMES[k]||k} × ${n}${game?`（持有${game.count(k)}）`:''}`).join('、')||'无';
  const button=(command,title,attrs='',disabled=false)=>`<button data-command="camp-${command}" ${attrs} ${disabled?'disabled':''}>${title}</button>`;
  const buildingCal={
    building_clinic:{floor:[[321,231],[479,350],[217,432],[68,315]],back:{feet:[[73,340],[275,251],[427,393]],tops:[[73,193],[275,126],[427,240]]},front:{feet:[[86,341],[213,432],[465,358]],tops:[[86,158],[213,283],[465,216]]}},
    building_workshop:{floor:[[300,215],[464,337],[250,444],[86,336]],back:{feet:[[63,338],[259,240],[422,357]],tops:[[63,183],[259,88],[422,207]]},front:{feet:[[62,345],[226,280],[422,405]],tops:[[62,177],[226,112],[422,237]]}},
    building_canteen:{floor:[[274,229],[440,338],[252,430],[80,331]],back:{feet:[[40,335],[248,244],[430,365]],tops:[[40,180],[248,85],[430,210]]},front:{feet:[[76,335],[225,425],[440,335]],tops:[[76,165],[225,275],[440,165]]}},
    building_dormitory:{floor:[[329,232],[450,332],[245,420],[87,323]],back:{feet:[[40,328],[310,250],[450,370]],tops:[[40,171],[310,84],[450,205]]},front:{feet:[[88,311],[205,413],[460,328]],tops:[[88,134],[205,254],[460,150]]}},
    building_warehouse:{floor:[[263,215],[477,329],[251,434],[48,320]],back:{feet:[[37,348],[210,271],[440,380]],tops:[[37,166],[210,89],[440,199]]},front:{feet:[[62,342],[326,456],[464,350]],tops:[[62,155],[326,285],[464,167]]}}
  };
  // Frame-local hinge foot, free foot and hinge top. Visible bounds include
  // hardware/glow and cannot register the open and closed leaves consistently.
  const doorCal={
    building_clinic:{door_closed:[[235,386],[373,345],[235,128]],door_open:[[237,344],[273,410],[237,90]]},
    building_workshop:{door_closed:[[219,385],[336,339],[219,127]],door_open:[[212,331],[306,408],[212,75]]},
    building_canteen:{door_closed:[[220,401],[344,348],[220,135]],door_open:[[240,416],[273,336],[240,154]]},
    building_dormitory:{door_closed:[[232,427],[381,376],[232,145]],door_open:[[256,380],[316,442],[256,131]]},
    building_warehouse:{door_closed:[[181,372],[344,419],[181,89]],door_open:[[235,360],[281,433],[235,53]]}
  };
  const corners=(n,v,z=0)=>[v.project(n.x-n.w/2,n.y-n.h/2,z),v.project(n.x+n.w/2,n.y-n.h/2,z),v.project(n.x+n.w/2,n.y+n.h/2,z),v.project(n.x-n.w/2,n.y+n.h/2,z)];
  function layerWalls(n,v,front){
    const cfg=buildingCal[n.asset][front?'front':'back'],floor=corners(n,v),top=corners(n,v,2.1),indices=front?[3,2,1]:[3,0,1];
    for(let i=0;i<2;i++)A.worldFrameSurface(v.ctx,'camp_'+n.asset,front?'front_walls':'back_walls',[cfg.feet[i],cfg.feet[i+1],cfg.tops[i+1],cfg.tops[i]],[floor[indices[i]],floor[indices[i+1]],top[indices[i+1]],top[indices[i]]]);
  }
  function building(n,game,v){
    const {ctx,items}=v,rear=n.x+n.y-(n.w+n.h)/2-.01,front=n.x+n.y+(n.w+n.h)/2+.01,inside=game.player.indoorHome===n.id,near=S.pointRect(game.player,n)<1.4;
    items.push({layer:-2,depth:rear,draw:()=>{if(!A.worldFrameSurface(ctx,'camp_'+n.asset,'floor',buildingCal[n.asset].floor,corners(n,v)))v.plane(n.x,n.y,n.w,n.h,'#77786c');}});
    items.push({depth:rear,draw:()=>layerWalls(n,v,false)});
    items.push({layer:-1,depth:front,draw:()=>{ctx.save();if(inside)ctx.globalAlpha=.22;layerWalls(n,v,true);ctx.restore();}});
    const door=game.camp.objects.find(o=>o.id===`camp:solid:${n.localId}:door`),open=!n.private&&!!door?.open,state=open?'door_open':'door_closed',source=doorCal[n.asset][state];
    const width=door?.h||C.publicDoorWidth,hinge={x:door?.x??n.x+n.w/2,y:(door?.y??n.y)+width/2},end=open?{x:hinge.x-width,y:hinge.y}:{x:hinge.x,y:hinge.y-width};
    items.push({depth:(hinge.x+hinge.y+end.x+end.y)/2+.04,draw:()=>{ctx.save();if(open&&S.pointRect(game.player,n)<1.4)ctx.globalAlpha=.35;A.worldFrameSurface(ctx,'camp_'+n.asset,state,source,[v.project(hinge.x,hinge.y),v.project(end.x,end.y),v.project(hinge.x,hinge.y,1.95)]);ctx.restore();}});
    if(!inside&&!(game.developer?.enabled&&game.developer.hideRoofs))items.push({depth:front+.01,draw:()=>{ctx.save();if(near)ctx.globalAlpha=.3;const m=art.frames[art.assets['camp_'+n.asset].states.roof],b=m.bounds,cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;A.worldFrameSurface(ctx,'camp_'+n.asset,'roof',[[cx,b[1]],[b[2],cy],[cx,b[3]],[b[0],cy]],corners({...n,w:n.w+.2,h:n.h+.2},v,2.2));ctx.restore();}});
  }
  function depth(game,p,value){
    if(game.scene!=='surface'||!game.camp?.position)return value;
    // A whole facade/roof sorts at its nearest corner. Foot-sorted objects in
    // front of that facade must cross the same boundary, even near its left end.
    // Keep a small monotonic offset so two front objects never collapse to a tie.
    const n=game.camp.nodes.filter(n=>n.building&&S.pointRect(p,n)<2.6).sort((a,b)=>S.pointRect(p,a)-S.pointRect(p,b))[0];
    if(!n)return value;
    const x=p.x-n.x,y=p.y-n.y,halfW=n.w/2,halfH=n.h/2,center=n.x+n.y,rear=center-halfW-halfH-.01,front=center+halfW+halfH+.01;
    if(Math.abs(x)<halfW&&Math.abs(y)<halfH)return Math.max(rear+.05,Math.min(value,front-.05));
    if(x>=halfW&&y>=-halfH-.25||y>=halfH&&x>=-halfW-.25)return Math.max(value,front+.06+(value-center)*.01);
    return Math.min(value,rear-.06+(value-center)*.01);
  }
  function items(game,v){
    const c=game.camp;if(game.scene!=='surface'||!c?.position)return;
    const distance=S.pointRect(game.player,c.position);
    if(distance>96)return;A.prepareCamp();if(distance>48)return;
    const inView=(o,margin)=>{const q=v.project(o.x,o.y);return q.x>=-margin&&q.x<=v.width+margin&&q.y>=-margin&&q.y<=v.height+margin;};
    for(const n of c.nodes){if(!inView(n,n.building?230:135))continue;if(n.building){building(n,game,v);continue;}
      const open=n.npc?game.campOpen(n.npc):game.campOpen('board'),states=art.assets['camp_'+n.asset].states,requested=n.localId==='notice'?(open?(game.campTier()>=1?'f1':'f0'):'f2'):n.localId==='sign'?'f0':open?'open':'closed',state=states[requested]?requested:open?'f0':'f1';
      v.items.push({depth:depth(game,n,n.x+n.y),draw:()=>{const q=v.project(n.x,n.y),height=(n.localId==='sign'?48:n.localId==='notice'?52:n.localId==='cart'?70:80)*v.scale/27,near=S.pointRect(game.player,n)<1.6;
        if(near&&n.npc){v.ctx.save();v.ctx.beginPath();v.ctx.rect(q.x-height*2,q.y-height*2,height*4,height*1.6);v.ctx.clip();A.worldSprite(v.ctx,'camp_'+n.asset,state,q.x,q.y,height,{alpha:.28});v.ctx.restore();v.ctx.save();v.ctx.beginPath();v.ctx.rect(q.x-height*2,q.y-height*.4,height*4,height*2);v.ctx.clip();A.worldSprite(v.ctx,'camp_'+n.asset,state,q.x,q.y,height);v.ctx.restore();}
        else A.worldSprite(v.ctx,'camp_'+n.asset,state,q.x,q.y,height);
        if(game.canSee(n)&&S.dist(game.player,n)<16)v.label(n.name,q.x,q.y+16,'#d4c18b',10);
      }});
    }
    for(const n of c.npcs){if(!inView(n,95)||n.npcId==='C06'&&c.visit?.day!==game.day||!game.canSee(n))continue;const home=game.camp.nodes.find(b=>b.building&&S.pointRect(n,b)===0),dir=A.eightDirection(n.facing),moving=n.path.length>0&&n.visualMoveAt>game.seconds-.12,clip=art.clips.clips.find(k=>k.npcId===n.npcId&&k.direction===dir),engaged=game.action?.type==='camp_exchange'&&game.action.target===n.id;
      const frame=clip?.[engaged?'interact':moving?'walk':'idle']?.[moving&&!engaged?Math.floor(n.visualDistance/.28)%4:0],state=frame?.split('__')[1]||dir+'_idle';
      v.items.push({depth:depth(game,n,n.x+n.y+.12),draw:()=>{const q=v.project(n.x,n.y);v.ctx.save();v.ctx.globalAlpha*=game.fogVisibility(n);
        if(engaged&&n.npcId==='C03'&&game.action.offer==='M04'){const elapsed=game.action.elapsed,frame=elapsed<.5?'f0':game.action.duration-elapsed<.5?'f2':'f1';A.worldSprite(v.ctx,'camp_doctor_treatment',frame,q.x,q.y,52*v.scale/27);}
        else A.worldSprite(v.ctx,'camp_npc_'+n.npcId,state,q.x,q.y,50*v.scale/27);if(n.open&&!home)v.label(n.name+' · '+n.role,q.x,q.y-57*v.scale/27,'#ddd0a3',10);v.ctx.restore();
      }});
    }
    for(const [id,asset] of [['clinic','display_iron'],['workshop','display_wood']]){const n=game.campNode(id),p={x:n.x-.6,y:n.y-.3};if(!inView(p,90))continue;v.items.push({depth:depth(game,p,p.x+p.y),draw:()=>{const q=v.project(p.x,p.y);A.worldSprite(v.ctx,'camp_'+asset,game.campOpen('C04')?'f0':'f1',q.x,q.y,35*v.scale/27);}});}
  }
  function overview(game,target){
    const c=game.camp,o=target.object,npc=o.npcId||'board',open=game.campOpen(npc),tier=game.campTier(),next=[20,50,80,100].find(n=>n>c.reputation)||100;
    let html=`<div class="camp-person">${npc==='board'?icon('camp_board_icon'):icon('portrait_'+npc,'default',76)}<div><div class="eyebrow">${icon('camp_business_state',!open?'f2':game.campMinutes()>=1170?'f1':'f0',20)}幸存者营地 · ${open?'营业中':'已打烊'}</div><h2>${esc(o.name||'公告板')}${o.role?' · '+esc(o.role):''}</h2><p>${icon('camp_reputation','f'+tier,23)}声望 ${c.reputation}/100 · 当前${C.tiers[tier]} · 下一档${next}${C.tier(c.reputation)>tier?'（新权限次日05:00生效）':''}</p></div></div>`;
    if(npc==='C00'||npc==='board'){
      html+=`<p>05:00—20:00受理介绍与委托；常驻交易06:00—20:00。每日最多交付2项，今天已完成${c.completed.length}/2。营地不提供免伤、住宿跳夜或免费补给。</p>`;
      if(npc==='C00')html+=`<p>“我是许岚。带上可用的材料，大家会按公告公平交换。别耽误夜里的防守。”</p>`+button('intro',c.introduced?'已完成营地介绍':'了解营地 · 首次声望+5','',!open||c.introduced);
      if(game.armory)html+='<p>军备库位置已公布，按M查看入口；园区与营地库存分别保存。</p>';html+='<h3>今日物资委托</h3><div class="camp-offers">'+c.commissions.map(id=>{const q=C.quests[id],done=c.completed.includes(id);return `<section><strong>${icon('camp_delivery_state',done?'f1':!open||c.completed.length>=2?'f2':'f0',23)}${esc(q.name)} ${done?'· 已完成':''}</strong><p>交付：${esc(costText(q.cost))}<br>获得：${esc(costText(q.gain))} · 声望+3</p>${button('select','查看交付',`data-offer="${id}"`,!open||done||c.completed.length>=2)}</section>`;}).join('')+'</div>';
      const nextVisit=game.day<=16?16:game.day+(3-(game.day-16)%3)%3;html+=`<p>流动商：${c.visit?'今日08:00—18:00，'+c.visit.offers.map(id=>costText(C.offers[id].gain)).join(' / '):`下次第${nextVisit}天08:00—18:00到访`}。</p>`;
      if(tier>=3&&game.weather.nextSchedule){const w=game.weather.nextSchedule[0];html+=`<p>次日首段天气：${S.Weather[w.kind].name}，持续${w.hours}游戏小时。</p>`;}
    }else{
      html+=`<p>${icon('camp_trade_icon',undefined,23)}${npc==='C06'?'08:00—18:00，只提供本次公告的两条报价。':'06:00—20:00营业。'}每次最多5完整批，背包支付，确认后回场景交换；移动或受伤会中断。</p><div class="camp-offers">`;
      for(const [id,d] of Object.entries(C.offers).filter(([,d])=>d.npc===npc)){
        if(npc==='C06'&&!c.visit?.offers.includes(id))continue;const gain=d.service?'现场包扎 · 基础恢复6生命':costText(d.gain),locked=game.day<d.day?`第${d.day}天开放`:tier<d.tier?'声望熟悉后次日开放':'';
        html+=`<section><strong>${d.service?icon('camp_treatment_icon'):Object.keys(d.gain).map(itemIcon).join('')}${esc(gain)}</strong><p>支付：${esc(costText(d.cost))}<br>${locked||`剩余 ${c.stock[id]||0} 批`}</p>${button('select','查看交换',`data-offer="${id}"`,!open||!!locked||!(c.stock[id]>0))}</section>`;
      }html+='</div>';
    }return html;
  }
  function context(game,target){
    if(target?.type!=='camp')return null;let html='';
    if(target.campOffer){const id=target.campOffer,n=target.campBatches||1,d=C.offers[id]||C.quests[id],quote=game.campQuote(id,n,target.object),cost=S.Camp.multiply(d.cost,n),gain=S.Camp.multiply(d.gain,n);
      html=`<div class="eyebrow">确认${C.quests[id]?'委托交付':d.service?'现场包扎':'以物换物'}</div><h2>${esc(C.quests[id]?.name||d.service&&'现场包扎'||costText(d.gain))}</h2><p>本次：${n}完整批</p><div class="camp-total"><p>支付：${esc(costText(cost,game))}</p><p>获得：${d.service?`恢复至多${Number((6*game.traitEffects.healing).toFixed(1))}生命（不超过上限）`:esc(costText(gain))}${C.quests[id]?' · 声望+3':''}</p></div>`;
      if(!C.quests[id]&&!d.service)html+='<div class="camp-batches">'+[1,2,3,4,5].map(v=>button('batch',v+'批',`data-batches="${v}"`,v>(game.camp.stock[id]||0))).join('')+'</div>';
      html+=`<p>${d.service?'现场包扎6秒':'交换2秒'}，期间可按取消；移动、受伤、超距、关店或跨日不成交。</p>${quote.error?`<p class="camp-error">${esc(quote.error)}</p>`:''}<div class="overlay-actions">${button('confirm',d.service?'确认包扎':'确认提交','',!!quote.error)}${button('back','返回报价')}</div>`;
    }else html=overview(game,target);
    return html+'<div class="overlay-actions"><button data-key="escape">返回场景</button></div>';
  }
  function command(game,name,buttonEl,target){
    if(!name.startsWith('camp-'))return {handled:false};const action=name.slice(5);
    if(!target?.object)return {handled:true,ok:false};
    if(action==='select'){target.campOffer=buttonEl.dataset.offer;target.campBatches=1;return {handled:true,ok:true};}
    if(action==='batch'){target.campBatches=Number(buttonEl.dataset.batches);return {handled:true,ok:true};}
    if(action==='back'){delete target.campOffer;delete target.campBatches;return {handled:true,ok:true};}
    const ok=game.beginCampExchange(action==='intro'?'intro':target.campOffer,action==='intro'?1:target.campBatches||1,target.object);return {handled:true,ok,leave:ok};
  }
  function map(game,canvas){
    const c=game.camp;if(!c||game.scene!=='surface')return;const ctx=canvas.getContext('2d'),project=p=>({x:275+(p.x-game.player.x)*.65,y:175+(p.y-game.player.y)*.65});
    if(!c.position){ctx.fillStyle='#e6c477';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('营地选址受阻 / 正在寻找可达空地',12,25);return;}
    const q=project(c.position);ctx.strokeStyle='#a9cfb5';ctx.strokeRect(q.x-c.position.w*.325,q.y-c.position.h*.325,c.position.w*.65,c.position.h*.65);A.worldSprite(ctx,'camp_camp_map_icon',Object.keys(art.assets.camp_camp_map_icon.states)[0],q.x,q.y,22);ctx.fillStyle='#deca8d';ctx.textAlign='left';ctx.font='12px sans-serif';ctx.fillText('幸存者营地',q.x+12,q.y);
    const route=game._campNavigation;
    if(route?.done&&route.path){ctx.strokeStyle='#e6d094';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();route.path.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);ctx.fillText(`到公共入口：实际路线约${Math.ceil(route.length)}米`,12,27);}
    else ctx.fillText(route?.done?'当前路线受阻，请从公共道路绕行':'正在规划到公共入口的步行路线…',12,27);
    ctx.fillText(`完整占地距初始领地边界${c.territoryDistance.toFixed(1)}米 · 两出口全天通行`,12,canvas.height-13);
  }
  function hud(game,mode){const el=document.getElementById('camp-map');el.classList.toggle('hidden',mode!=='play'||game.scene!=='surface'||!game.camp||!!game.result);if(!el.classList.contains('hidden'))el.textContent=game.camp.position?`幸存者营地 · ${game.campOpen('C01')?'营业中':game.campOpen('C00')?'主理人接待':'已打烊'} · M路线`:'营地待选址 · M查看';}
  window.CampView={items,depth,context,command,map,hud};
})();
