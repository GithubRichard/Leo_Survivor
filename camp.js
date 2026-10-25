/* One persistent surface camp; gameplay clocks, barter and saves remain atomic. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,C=root.CampData,{dist,pointRect,segmentHits}=S,clone=x=>JSON.parse(JSON.stringify(x));
  const overlap=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+(b.w||.5))/2+pad&&Math.abs(a.y-b.y)<(a.h+(b.h||.5))/2+pad;
  const distanceFromTerritory=b=>Math.hypot(Math.max(0,Math.abs(b.x)-(b.w+10)/2),Math.max(0,Math.abs(b.y+1)-(b.h+10)/2));
  const multiply=(cost,n)=>Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*n]));
  function heapPush(a,v){a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
  function heapPop(a){const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let n=i*2+1;if(n+1<a.length&&a[n+1].f<a[n].f)n++;if(a[n].f>=last.f)break;a[i]=a[n];i=n;}a[i]=last;}return first;}
  class CampGame extends Base{
    constructor(options={}){super(options);this.camp=null;}
    campMinutes(){return ((this.scene==='parking'?this.surfaceState?.minutes??this.minutes:this.minutes)%1440+1440)%1440;}
    campOpen(id){const m=this.campMinutes();return !!this.camp?.position&&this.day>=14&&m>=(id==='C00'||id==='board'?300:id==='C06'?480:360)&&m<(id==='C06'?1080:1200)&&(id!=='C06'||this.camp.visit?.day===this.day);}
    campTier(){return C.tier(this.camp?.effectiveReputation||0);}
    campPick(items,count){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(this.campRandom()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,count);}
    campRandom(){const c=this.camp;c.seed=(Math.imul(c.seed,1664525)+1013904223)>>>0;return c.seed/4294967296;}
    unlockCamp(){if(this.day<14||this.camp)return;this.camp={id:'camp:one',version:1,seed:Math.floor(this.random()*4294967296)>>>0,position:null,pending:true,placementCursor:0,reputation:0,effectiveReputation:0,introduced:false,lastRefillDay:0,stock:{},commissions:[],completed:[],visit:null,npcs:[],nodes:[],objects:[],transactionSerial:0,lastCommit:null};this.announce('幸存者营地已开放，正在领地100—170米环带内寻找可达空地。按M查看。');this.autosaveRequested=true;}
    campCandidates(){
      const candidates=[],spacing=S.RULES.lotSpacing;
      for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++){const b={x:14+x*spacing,y:13.6+y*spacing,...C.bounds},d=distanceFromTerritory(b);if(d>=100&&d<=170)candidates.push(b);}
      let seed=this.camp.seed;for(let i=candidates.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}return candidates;
    }
    campSiteFree(b){
      if(overlap(b,{...this.player,w:1,h:1},.1))return false;
      for(const h of this.nearbyHomes(b,22))for(const o of [...h.objects,...h.sites])if(o.hp>0&&overlap(b,o,.04))return false;
      if([...this.devices,...this.drops,...this.zombies].some(o=>(o.hp===undefined||o.hp>0)&&overlap(b,o,.1)))return false;
      const e=this.parking?.entrance;if(e&&overlap(b,e.axis==='x'?{x:e.x-3,y:e.y,w:6.8,h:5.8}:{x:e.x,y:e.y-3,w:5.8,h:6.8},1))return false;
      return !this.parking?.toolbox||!overlap(b,this.parking.toolbox,.6);
    }
    makeCampRoute(start,goals,roadsOnly=false){
      const key=p=>`${p.x},${p.y}`,options=[];
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)options.push({x:Math.round(start.x)+dx,y:Math.round(start.y)+dy});
      const p=options.sort((a,b)=>dist(start,a)-dist(start,b)).find(q=>!this.obstacles(start,q,.25).some(o=>o.type!=='door'&&!(o.type==='camp_solid'&&o.kind==='door')))||{x:start.x,y:start.y};
      const targets=goals.map(g=>({x:Math.round(g.x),y:Math.round(g.y)})),heuristic=n=>Math.min(...targets.map(g=>dist(n,g))),heap=[];
      const bounds={left:Math.min(p.x,...targets.map(g=>g.x))-56,right:Math.max(p.x,...targets.map(g=>g.x))+56,top:Math.min(p.y,...targets.map(g=>g.y))-56,bottom:Math.max(p.y,...targets.map(g=>g.y))+56};
      heapPush(heap,{...p,g:0,f:heuristic(p)});return {start:p,origin:{x:start.x,y:start.y},goals:targets,actualGoals:goals,bounds,heap,cost:new Map([[key(p),0]]),parents:new Map(),nodes:new Map([[key(p),p]]),expanded:0,roadsOnly,done:!Number.isInteger(p.x)||!Number.isInteger(p.y),path:null};
    }
    advanceCampRoute(job,budget=100){
      const key=p=>`${p.x},${p.y}`,end=performance.now()+3;
      while(job.heap.length&&budget-->0&&performance.now()<end){
        const p=heapPop(job.heap),pk=key(p);if(p.g!==job.cost.get(pk))continue;
        if(job.goals.some(g=>dist(p,g)<.1)){const path=[p];let k=pk;while(job.parents.has(k)){k=job.parents.get(k);path.push(job.nodes.get(k));}job.path=path.reverse();job.length=dist(job.origin,job.start)+path.slice(1).reduce((n,q,i)=>n+dist(q,path[i]),0)+dist(p,job.actualGoals[job.goals.findIndex(g=>dist(p,g)<.1)]);job.done=true;return;}
        if(++job.expanded>20000){job.done=true;return;}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(n.x<job.bounds.left||n.x>job.bounds.right||n.y<job.bounds.top||n.y>job.bounds.bottom)continue;
          const road=v=>Math.abs(v-(Math.round((v-14)/28)*28+14))<=2.1,initial=Math.abs(n.x)<=1&&n.y>=4.8&&n.y<=14;
          if(job.roadsOnly&&!initial&&!road(n.x)&&!road(n.y))continue;
          if(this.obstacles(p,n,.25).some(o=>o.type!=='door'&&!(o.type==='camp_solid'&&o.kind==='door')))continue;
          const nk=key(n),g=p.g+1;if(g>=(job.cost.get(nk)??Infinity))continue;job.cost.set(nk,g);job.parents.set(nk,pk);job.nodes.set(nk,n);heapPush(job.heap,{...n,g,f:g+Math.min(...job.goals.map(t=>dist(n,t)))});
        }
      }if(!job.heap.length)job.done=true;
    }
    advanceCampPlacement(){
      const c=this.camp;if(!c?.pending||this.scene!=='surface'||this.seconds<(this._campRetry||0))return;
      const sites=this._campSites||(this._campSites=this.campCandidates());
      if(this._campPlacement){const job=this._campPlacement;this.advanceCampRoute(job.route,100);if(!job.route.done)return;this._campPlacement=null;if(job.route.path&&this.campSiteFree(job.bounds)){this.buildCamp(job.bounds,job.route.path);return;}}
      for(let count=0;count<2&&c.placementCursor<sites.length;count++){
        const bounds=sites[c.placementCursor++];if(!this.campSiteFree(bounds))continue;
        this._campPlacement={bounds,route:this.makeCampRoute({x:0,y:5},[{x:bounds.x,y:bounds.y+bounds.h/2}],true)};return;
      }
      if(c.placementCursor>=sites.length){c.placementCursor=0;this._campRetry=this.seconds+15;if(!c.blockedNotice){c.blockedNotice=true;this.announce('营地选址受阻：请清理领地100—170米范围内的道路或空地，稍后继续寻找。');}}
    }
    buildCamp(position,route){
      const c=this.camp;c.position={...position,axis:'y'};c.pending=false;c.territoryDistance=distanceFromTerritory(position);c.entryRoute=route;c.entries=[{x:position.x,y:position.y-position.h/2},{x:position.x,y:position.y+position.h/2}];
      c.nodes=C.nodes.map(n=>({...n,id:`camp:${n.id}`,localId:n.id,x:n.x+position.x,y:n.y+position.y}));c.objects=[];
      const solid=(id,x,y,w,h,kind='wall')=>c.objects.push({id:`camp:solid:${id}`,type:'camp_solid',kind,x,y,w,h,hp:1,maxHP:1,indestructible:true});
      for(const n of c.nodes){if(n.building){if(n.private)solid(n.localId,n.x,n.y,n.w,n.h);else{solid(n.localId+':back',n.x,n.y-n.h/2,n.w,.12);solid(n.localId+':left',n.x-n.w/2,n.y,.12,n.h);solid(n.localId+':front',n.x,n.y+n.h/2,n.w,.12);for(const s of [-1,1])solid(n.localId+':right:'+s,n.x+n.w/2,n.y+s*(n.h+C.publicDoorWidth)/4,.12,(n.h-C.publicDoorWidth)/2);solid(n.localId+':door',n.x+n.w/2,n.y,.12,C.publicDoorWidth,'door');}}else if(n.localId!=='sign')solid(n.localId,n.x,n.y,n.w,n.h,'counter');}
      c.npcs=Object.entries(C.npcs).map(([npcId,info],i)=>{const spot=c.nodes.find(n=>n.localId===info.spot),p={x:spot.x,y:spot.y+(spot.localId==='notice'?-1:spot.h/2+.65)};return {...p,id:'camp:npc:'+npcId,npcId,hp:1,name:info.name,role:info.role,facing:{x:0,y:1},business:p,path:[],visualDistance:0,open:false};});
      this.refreshCampDay();this.navigationChanged();this.autosaveRequested=true;this.announce(`营地已标记在地图：完整占地距初始领地边界${Math.round(c.territoryDistance)}米，保留两处公共出口。`);
    }
    campNode(id){return this.camp?.nodes.find(n=>n.localId===id);}
    campIndoor(p){return this.scene==='surface'&&this.camp?.nodes.find(n=>n.building&&!n.private&&Math.abs(p.x-n.x)<n.w/2-.12&&Math.abs(p.y-n.y)<n.h/2-.12);}
    outdoors(p){return this.campIndoor(p)?false:super.outdoors(p);}
    updateIndoorHome(){super.updateIndoorHome();const b=this.campIndoor(this.player);if(b)this.player.indoorHome=b.id;}
    obstacles(a,b=a,padding=.22){const out=super.obstacles(a,b,padding);if(this.scene==='surface'&&this.camp?.position)for(const o of this.camp.objects)if(!(o.kind==='door'&&o.open)&&segmentHits(a,b,o,padding))out.push(o);return out;}
    blocksVision(o){return o.type==='camp_solid'?['wall','door'].includes(o.kind):super.blocksVision(o);}
    updateDoors(){super.updateDoors();if(this.scene==='surface'&&this.camp?.position)for(const o of this.camp.objects)if(o.kind==='door'){const open=pointRect(this.player,o)<1.5||this.zombies.some(z=>z.hp>0&&pointRect(z,o)<1.4)||this.camp.npcs.some(n=>pointRect(n,o)<1.2);if(open!==o.open){o.open=open;this.navigationChanged();}}}
    damageBuilding(o,n){if(o?.type!=='camp_solid')return super.damageBuilding(o,n);}
    canPlace(kind,p){if(this.scene==='surface'&&p&&this.camp?.position&&overlap({...p,w:1,h:1},this.camp.position))return '营地摊位和公共通道需保持通行，请在营地外建造';return super.canPlace(kind,p);}
    refreshCampDay(){
      const c=this.camp;if(!c?.position||c.lastRefillDay===this.day)return;
      if(this.action?.type?.startsWith('camp_'))this.cancelAction('已到次日，原营地操作已取消，材料保留。');
      c.lastRefillDay=this.day;c.effectiveReputation=c.reputation;c.stock={};c.completed=[];c.commissions=this.campPick(Object.keys(C.quests).filter(id=>(C.quests[id].day||14)<=this.day),this.campTier()>=1?4:3);
      for(const [id,o] of Object.entries(C.offers))if(o.npc!=='C06'&&this.day>=o.day&&this.campTier()>=o.tier)c.stock[id]=o.limit+(this.campTier()>=2&&['E05','M01'].includes(id)||this.campTier()>=3&&id==='F01'?1:0);
      c.visit=this.day>=16&&(this.day-16)%3===0?{id:`camp:traveler:${this.day}`,day:this.day,offers:this.campPick(['R01','R02','R03','R04'],2)}:null;
      if(c.visit)for(const id of c.visit.offers)c.stock[id]=1;
      c.closingNoticeDay=0;c.openState={};this.autosaveRequested=true;this.announce(`营地第${this.day}天公告已更新：${c.commissions.length}项候选委托，最多交付2项${c.visit?'；流动商今日08:00—18:00到访':''}。`);
    }
    updateCamp(){
      const c=this.camp;if(!c?.position)return;this.refreshCampDay();const m=this.campMinutes();if(m>=1170&&m<1200&&c.closingNoticeDay!==this.day){c.closingNoticeDay=this.day;this.announce('营地将在20:00停止交易和委托交付，请及时完成正在进行的操作。');}
      if(this.campTier()>=3&&this.weather.day===this.day&&!this.weather.nextSchedule){this.weather.nextSchedule=this.weatherSchedule(this.weather.schedule.at(-1).kind,false,this.weather.schedule);this.autosaveRequested=true;}
      c.openState=Object.fromEntries(Object.keys(C.npcs).map(id=>[id,this.campOpen(id)]));
    }
    updateCampNPCs(dt){
      const c=this.camp;if(!c?.position)return;
      for(const n of c.npcs){const open=this.campOpen(n.npcId),home=this.campNode(C.npcs[n.npcId].home),s=n.business;
        if(!n.initialized){n.initialized=true;n.open=open;Object.assign(n,open?s:{x:home.x,y:home.y+.2});n.path=[];continue;}
        if(n.open!==open){n.open=open;const door={x:home.x+home.w/2+.4,y:home.y},side={x:door.x,y:c.position.y-1.4},spot=this.campNode(C.npcs[n.npcId].spot),approach={x:s.x+(s.x<c.position.x?1:-1)*(spot.w/2+.45),y:s.y},junction={x:approach.x,y:c.position.y+.4};
          if(!open)n.path=[approach,junction,{x:side.x,y:c.position.y+.4},side,door,{x:home.x+(Number(n.npcId.slice(1))%3-1)*.4,y:home.y+.2}];
          else n.path=[door,side,{x:side.x,y:c.position.y+.4},junction,approach,s];}
        if(this.action?.type==='camp_exchange'&&this.action.target===n.id){const d=dist(n,this.player);if(d>.01)n.facing={x:(this.player.x-n.x)/d,y:(this.player.y-n.y)/d};continue;}
        if(!n.path.length){if(open){const delta=dist(n,this.player);if(delta<3&&delta>.01)n.facing={x:(this.player.x-n.x)/delta,y:(this.player.y-n.y)/delta};}continue;}
        const to=n.path[0],d=dist(n,to),length=Math.min(d,1.6*dt);if(d>.0001){const facing={x:(to.x-n.x)/d,y:(to.y-n.y)/d};n.x+=facing.x*length;n.y+=facing.y*length;n.facing=facing;n.visualDistance+=length;n.visualMoveAt=this.seconds;}if(d<=length+.01)n.path.shift();
      }
    }
    find(id){return this.camp?.npcs.find(n=>n.id===id)||this.camp?.nodes.find(n=>n.id===id)||super.find(id);}
    campClearLine(target){return !this.obstacles(this.player,target,0).some(o=>o!==target&&o.id!==`camp:solid:${target.localId}`);}
    nearbyInteraction(){
      const current=super.nearbyInteraction();if(this.scene!=='surface'||!this.camp?.position)return current;
      const choices=[...this.camp.npcs.filter(n=>n.open),...this.camp.nodes.filter(n=>['notice','sign'].includes(n.localId))].filter(n=>dist(n,this.player)<1.8&&this.campClearLine(n));
      const n=choices.sort((a,b)=>dist(a,this.player)-dist(b,this.player))[0];return n&&(!current||dist(n,this.player)<current.distance)?{type:'camp',object:n,distance:dist(n,this.player)}:current;
    }
    campQuote(id,batches,target){
      const c=this.camp,o=C.offers[id],q=C.quests[id],intro=id==='intro',npc=target?.npcId||'board';
      if(this.scene!=='surface'||!c?.position||!target||!this.campOpen(npc))return {error:'当前未营业'};
      if(dist(this.player,target)>=1.8||!this.campClearLine(target))return {error:'请在1.8米内无遮挡处操作'};
      if(!Number.isInteger(batches)||batches<1||batches>5)return {error:'每次只能交换1—5完整批'};
      if(intro){if(npc!=='C00'||c.introduced)return {error:'营地介绍已经完成'};return {cost:{},gain:{},slots:this.inventory.map(s=>s?{...s}:null),duration:2,intro:true};}
      if(q){if(!['C00','board'].includes(npc)||batches!==1||!c.commissions.includes(id)||c.completed.includes(id)||c.completed.length>=2)return {error:'此委托不可提交，或今天已完成2项'};}
      else if(!o||o.npc!==npc||this.day<o.day||this.campTier()<o.tier||!(id in c.stock)||(c.stock[id]||0)<batches||o.service&&batches!==1||npc==='C06'&&!c.visit?.offers.includes(id))return {error:'报价条件未满足或剩余批数不足'};
      if(o?.service&&this.player.hp>=this.maxHP)return {error:'生命已满，无需付费包扎'};
      const cost=multiply((q||o).cost,batches),gain=multiply((q||o).gain,batches);
      for(const [kind,n] of Object.entries(cost))if(this.count(kind)<n)return {error:`背包中${S.NAMES[kind]}不足，还需${n-this.count(kind)}份`};
      const slots=this.inventory.map(s=>s?{...s}:null);if(!S.transaction(slots,cost,gain))return {error:'扣除材料后背包仍装不下整笔产物'};
      return {cost,gain,slots,duration:o?.service?6:2,service:!!o?.service,quest:!!q};
    }
    beginCampExchange(id,batches,target){
      this.refreshCampDay();const quote=this.campQuote(id,batches,target);if(quote.error){this.announce(quote.error);return false;}this.endStealth();return this.beginAction('camp_exchange',quote.duration,{target:target.id,offer:id,batches,campDay:this.day,visitId:this.camp.visit?.id||null});
    }
    updateAction(dt){
      const a=this.action;if(a?.type!=='camp_exchange')return super.updateAction(dt);
      const target=this.find(a.target),quote=this.campQuote(a.offer,a.batches,target);
      if(a.campDay!==this.day||dist(a.start,this.player)>.025||quote.error){this.cancelAction(quote.error||'移动或跨日中断了交换，材料保留。');return;}
      a.elapsed+=dt;if(a.elapsed+1e-8>=a.duration)this._campReady=a;
    }
    commitCampExchange(a){
      if(this.action!==a||this.result||this.scene!=='surface')return;
      const c=this.camp,target=this.find(a.target),quote=this.campQuote(a.offer,a.batches,target);
      if(a.campDay!==this.day||quote.error||a.offer.startsWith('R')&&a.visitId!==c.visit?.id){this.cancelAction(quote.error||'日期或来访批次已变化，材料保留。');return;}
      // All fallible checks finish before the single synchronous state commit.
      this.inventory=quote.slots;for(const s of this.inventory)if(s)this.newLamp(s);
      if(quote.service)this.player.hp=Math.min(this.maxHP,this.player.hp+6*this.traitEffects.healing);
      if(quote.intro){c.introduced=true;c.reputation=Math.min(100,c.reputation+5);}else if(quote.quest){c.completed.push(a.offer);c.reputation=Math.min(100,c.reputation+3);}else c.stock[a.offer]-=a.batches;
      this.recordResource('spent',quote.cost);this.recordResource('income',quote.gain);this.action=null;c.transactionSerial++;c.lastCommit={serial:c.transactionSerial,day:this.day,offer:a.offer,batches:a.batches};this.autosaveRequested=true;
      this.announce(quote.intro?'营地介绍完成，声望+5（仅一次）。':quote.quest?'委托完成，声望+3。':quote.service?'现场包扎完成。':`交换完成：${a.batches}批。`);
    }
    interact(target){const ok=super.interact(target);if(ok&&target?.type==='television'&&this.day>=14&&!this.broadcast.campMarked){this.broadcast.campMarked=true;this.announce('幸存者营地已在地图标记；若选址受阻，清理道路后会继续寻找。');this.autosaveRequested=true;}return ok;}
    dawn(){super.dawn();this.unlockCamp();if(this.camp?.position)this.refreshCampDay();}
    requestCampNavigation(){if(this.scene!=='surface'||!this.camp?.position)return;this._campNavigation=this.makeCampRoute(this.player,this.camp.entries);}
    advanceCampNavigation(){if(this._campNavigation&&!this._campNavigation.done&&this.scene==='surface')this.advanceCampRoute(this._campNavigation,90);}
    step(dt,input={}){
      if(this.result||dt<=0||this.parkingUnlockPending)return;this._campReady=null;super.step(dt,input);if(this.result)return;
      if(this.scene==='surface'){this.unlockCamp();this.advanceCampPlacement();this.updateCamp();this.updateCampNPCs(dt);if(this._campReady)this.commitCampExchange(this._campReady);}this._campReady=null;
    }
    snapshot(){const data=super.snapshot();data.camp=clone(this.camp);data.campPendingAction=this.action?.type==='camp_exchange'?{...this.action}:null;return data;}
    static restore(data){const game=Base.restore(data);Object.setPrototypeOf(game,CampGame.prototype);game.camp=data.camp||null;game._campReady=null;game._campPlacement=null;game._campNavigation=null;game.unlockCamp();if(game.scene==='surface'&&game.camp?.position)game.refreshCampDay();if(data.campPendingAction)game.announce('上次尚未完成的营地操作已取消，材料与日限保留。');return game;}
  }
  S.Game=CampGame;S.Camp={distanceFromTerritory,multiply};
})(globalThis);
