/* Raid outcomes, prices and the deferred barter commit share one final validation point. */
(() => {
  const P=HumansGame.prototype,Base=Object.getPrototypeOf(P),S=Survival,H=HumansData,C=CampData,{dist,pointRect}=S;
  Object.assign(P,{
    guardDistance(p){return this.camp?.position?pointRect(p,this.camp.position):Infinity;},
    humanHero(){return this.humanMode&&this.humans?.heroUntil>this.seconds;},
    humanCampCost(cost,id){if(!this.humanHero()||!C.offers[id]||C.quests[id])return cost;return Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,Math.max(1,Math.ceil(n*.8-1e-9))]));},
    campOpen(id){if(this.humanMode&&this.humans?.raid?.active&&id!=='board')return false;return Base.campOpen.call(this,id);},
    campQuote(id,n,target){
      if(this.humanMode&&this.humans?.raid?.active)return {error:'强盗袭击期间暂停交易、医疗和交付'};
      if(this.humanMode&&this.humans?.banUntil>this.seconds)return {error:`营地禁令：剩余${Math.ceil(this.humans.banUntil-this.seconds)}秒，暂不能交易、医疗或交付`};
      const quote=Base.campQuote.call(this,id,n,target);if(!quote.error)quote.humanPriceKey=JSON.stringify([this.humanHero(),quote.cost]);return quote;
    },
    beginCampExchange(...args){const ok=Base.beginCampExchange.apply(this,args);if(ok&&this.humanMode){const a=this.action,q=this.campQuote(a.offer,a.batches,this.find(a.target));a.humanPriceKey=q.humanPriceKey;}return ok;},
    commitCampExchange(a){if(this.humanMode)this._humanCampReady=a;else Base.commitCampExchange.call(this,a);},
    flushHumanCampExchange(){
      const a=this._humanCampReady;this._humanCampReady=null;if(!a||this.action!==a||this.result)return;const q=this.campQuote(a.offer,a.batches,this.find(a.target));if(q.error||q.humanPriceKey!==a.humanPriceKey){this.cancelAction(q.error||'英雄状态或价格已变化，材料保留，请重新确认。');return;}Base.commitCampExchange.call(this,a);
    },
    startHumanRaidIfNeeded(){
      const h=this.humans;if(!h||this.result||this.scene!=='surface'||!this.camp?.position)return;
      if(h.retryOutside&&this.guardDistance(this.player)>0){h.retryOutside=false;this.autosaveRequested=true;}
      if(!h.revenge||h.raid||h.retryOutside||h.banUntil>this.seconds||this.guardDistance(this.player)>0)return;
      const directions=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(this.random()*(i+1));[directions[i],directions[j]]=[directions[j],directions[i]];}
      h.raid={id:'raid:'+ ++h.serial,active:true,phase:'warning',wave:-1,readyAt:this.seconds+10,ids:[],pending:[],directions:directions.slice(0,2+Math.floor(this.random()*2)),spawnCount:0};
      if(this.action?.type==='camp_exchange')this.cancelAction('强盗袭击即将开始，材料已保留。');
      if(this._humanSpawnJob?.kind==='bandit'){this._humanSpawnJob.slot.state='raid-skipped';this._humanSpawnJob=null;}this.announce('营地遭到强盗袭击！10秒后第一波，守卫范围为营地外40米。');this.autosaveRequested=true;
    },
    checkHumanRaidExit(){const r=this.humans?.raid;if(!r?.active||this.result)return;if(this.scene!=='surface'||this.guardDistance(this.player)>40+1e-8)this.failHumanRaid('离开40米守卫范围');},
    failHumanRaid(reason){
      const h=this.humans,r=h?.raid;if(!r?.active||this.result)return;r.active=false;r.phase='retreating';r.failed=true;r.pending=[];r.retreatUntil=(this.scene==='parking'?this.surfaceState.seconds:this.seconds)+10;this._raidSpawnJob=null;
      h.retryOutside=true;h.banUntil=this.seconds+420;this.camp.reputation=Math.max(0,this.camp.reputation-10);if(this.action?.type==='camp_exchange')this.cancelAction('袭击失败，营地交易暂停7分钟，材料保留。');
      for(const a of h.actors)if(a.raidId===r.id&&a.hp>0){a.retreating=true;a.action=null;a.path=[];a.repathAt=0;}
      h.shots=h.shots.filter(s=>s.raidId!==r.id);for(const [id,g] of Object.entries(h.groups))if(g.raidId===r.id)delete h.groups[id];
      this.announce(`${reason}：袭击失败，声望-10，禁止营地交易7分钟；复仇保留。`);this.autosaveRequested=true;
    },
    raidSpawnPoint(r){
      const b=this.camp.position;for(let i=0;i<8;i++){const side=r.directions[(r.spawnCount+i)%r.directions.length],radius=25+this.random()*15,p=side%2?{x:b.x+(side===1?1:-1)*(b.w/2+radius),y:b.y+(this.random()-.5)*b.h}:{x:b.x+(this.random()-.5)*b.w,y:b.y+(side===0?-1:1)*(b.h/2+radius)};
        const d=this.guardDistance(p);if(d<25||d>40||dist(p,this.player)<12||this.inArmory(p)||!this.outdoors(p)||this.obstacles(p,p,.3).length||this.humans.actors.some(a=>a.hp>0&&dist(a,p)<1))continue;return p;
      }return null;
    },
    updateHumanRaid(dt){
      const h=this.humans,r=h.raid;if(!r)return;
      if(!r.active){
        for(const a of h.actors.filter(a=>a.raidId===r.id&&a.retreating)){const b=this.camp.position,n=Math.hypot(a.x-b.x,a.y-b.y)||1,goal={x:b.x+(a.x-b.x)/n*(Math.max(b.w,b.h)+55),y:b.y+(a.y-b.y)/n*(Math.max(b.w,b.h)+55)};this.moveHuman(a,goal,1,dt);}
        h.actors=h.actors.filter(a=>a.raidId!==r.id||!a.retreating||this.seconds<r.retreatUntil&&this.guardDistance(a)<=40);if(!h.actors.some(a=>a.raidId===r.id&&a.retreating)){h.lastRaid={id:r.id,result:'failed'};h.raid=null;this.autosaveRequested=true;}return;
      }
      if((r.phase==='warning'||r.phase==='between')&&this.seconds>=r.readyAt){r.wave++;r.pending=[...H.waves[r.wave]];r.ids=[];r.phase='spawning';r.spawnCount=0;this.autosaveRequested=true;}
      if(r.phase!=='spawning')return;
      if(!r.pending.length){r.phase='fighting';return;}
      if(this._raidSpawnJob){const job=this._raidSpawnJob;this.advanceCampRoute(job.route,48);if(!job.route.done)return;this._raidSpawnJob=null;if(job.route.path&&dist(job.p,this.player)>=12&&!this.obstacles(job.p,job.p,.3).length){const a=this.newHuman('bandit',job.p,r.pending.shift(),r.id);r.ids.push(a.id);r.spawnCount++;this.autosaveRequested=true;}return;}
      if(this.seconds<(this._raidSpawnAt||0))return;const p=this.raidSpawnPoint(r);this._raidSpawnAt=this.seconds+.2;if(p)this._raidSpawnJob={p,route:this.makeCampRoute(p,this.camp.entries,false)};
    },
    settleHumanRaid(){
      const h=this.humans,r=h.raid;if(!r?.active||this.result)return;this.checkHumanRaidExit();if(!r.active||r.phase!=='fighting'||r.pending.length||h.actors.some(a=>a.hp>0&&r.ids.includes(a.id)))return;
      if(r.wave<2){r.phase='between';r.readyAt=this.seconds+8;this.announce(`第${r.wave+1}波已清除，8秒后下一波。`);this.autosaveRequested=true;return;}
      r.active=false;h.lastRaid={id:r.id,result:'success'};h.raid=null;h.revenge=false;h.regularKills=0;h.heroUntil=this.seconds+240;h.unlocked=true;this.camp.reputation=Math.min(100,this.camp.reputation+20);for(const n of this.camp.npcs)n.humanReturnUntil=this.seconds+3;
      this.announce('守卫成功！公共声望+20，英雄240秒，营地实物交易和包扎八折；解锁忠心随从。');this.autosaveRequested=true;
    },
    updateCampNPCs(dt){
      Base.updateCampNPCs.call(this,this.humanMode&&this.humans?.raid?.active?dt*3:dt);if(!this.humanMode||!this.camp?.position)return;
      for(const n of this.camp.npcs){if(!n.humanReturnUntil||!n.open)continue;const left=Math.max(.01,n.humanReturnUntil-this.seconds);let p=n,length=0;for(const q of n.path){length+=dist(p,q);p=q;}let remaining=length*dt/left;
        for(let i=0;i<10&&remaining>0&&n.path.length;i++){const q=n.path[0],d=dist(n,q),step=Math.min(d,remaining);if(d>1e-8){n.facing={x:(q.x-n.x)/d,y:(q.y-n.y)/d};n.x+=n.facing.x*step;n.y+=n.facing.y*step;n.visualDistance+=step;n.visualMoveAt=this.seconds;}remaining-=step;if(d<=step+1e-8)n.path.shift();else break;}if(!n.path.length||left<=.01)n.humanReturnUntil=0;
      }
    }
  });
})();
