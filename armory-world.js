/* The compound occupies reserved surface land and shares the surface simulation. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,{dist,pointRect}=S;
  const overlap=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+(b.w||1))/2+pad&&Math.abs(a.y-b.y)<(a.h+(b.h||1))/2+pad;
  const army=z=>z.kind==='sweeper'||z.persistentId?.startsWith('armory:enemy:');
  const shift=(o,x,y)=>{if(!o)return;o.x+=x;o.y+=y;for(const k of ['home','lastSeen'])if(o[k]){o[k].x+=x;o[k].y+=y;}for(const p of o.path||[]){p.x+=x;p.y+=y;}if(o.action)for(const k of ['target','locked'])if(o.action[k]&&typeof o.action[k]==='object'){o.action[k].x+=x;o.action[k].y+=y;}};
  class ArmoryWorldGame extends Base{
    get armoryWorldActive(){return this.scene!=='parking'&&!!this.armory?.worldIntegrated;}
    inArmory(p=this.player){return !!this.armory?.bounds&&pointRect(p,this.armory.bounds)===0;}
    isNightRaider(z){return !army(z)&&super.isNightRaider(z);}
    withScene(scene,fn){const previous=this.scene;this.scene=scene;try{return fn();}finally{this.scene=previous;}}
    getHome(cx,cy){
      const a=this.armory;if(a?.worldIntegrated&&overlap({x:cx*28,y:cy*28-1,w:12,h:14},a.bounds)){
        const key=cx+','+cy;if(!this.homes.has(key))this.homes.set(key,{cx,cy,x:cx*28,y:cy*28,own:false,kind:'house',expanded:true,armoryReserved:true,objects:[],sites:[],furniture:[],doors:[]});return this.homes.get(key);
      }return super.getHome(cx,cy);
    }
    chooseArmoryLand(){
      const a=this.armory,host=this.scene==='parking'?this.surfaceState:this.scene==='armory'?this.armorySurface:this,known=[...this.homes.values()],candidates=[];
      // Prefer the old entrance vicinity; expand only when known land is occupied.
      const initial={x:a.entrance.x,y:a.entrance.y-75};candidates.push(initial);
      for(const radius of [260,400,560,760,1000,1400,1900,2500])for(let i=0;i<24;i++){const angle=i*Math.PI/12;candidates.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});}
      for(const center of candidates){const x=Math.round((center.x-100-26)/28)*28+26,y=Math.round((center.y-75-4)/28)*28+4,b={x:x+100,y:y+75,w:200,h:150};
        if(known.some(h=>!h.armoryReserved&&overlap(b,{x:h.x,y:h.y-1,w:12,h:14},2)))continue;
        if(overlap(b,{...(host.position||this.player),w:2,h:2},2)||this.camp?.position&&overlap(b,this.camp.position,5)||this.parking&&overlap(b,{...this.parking.entrance,w:16,h:16},5))continue;
        if([...(host.devices||[]),...(host.drops||[])].some(o=>o.hp!==0&&overlap(b,o,2)))continue;
        return {origin:{x,y},bounds:b};
      }return null;
    }
    integrateArmory(){
      const a=this.armory;if(!a||a.worldIntegrated)return;
      const land=this.chooseArmoryLand();if(!land){this._armoryRetry=this.seconds+15;return;}
      if(!a.generated)this.createArmory();
      let host=this.scene==='parking'?this.surfaceState:this,state=a.state;
      const wasInside=this.scene==='armory',localPlayer=wasInside?{x:this.player.x,y:this.player.y}:null;
      if(wasInside){state=this.captureScene();host=this.armorySurface;this.shiftPersonalClock(host.seconds-this.seconds);Object.assign(this,host);this.scene='surface';this.armorySurface=null;host=this;}
      const delta=host.seconds-(state?.seconds||0),{x,y}=land.origin;
      // Every tent layer and doorway retains its original shared HP group.
      for(const b of a.buildings){if(b.kind!=='tent')continue;const oldW=b.w,oldH=b.h;b.w=4;b.h=3;b.visualHeight=1.5;
        for(const o of a.objects)if(o.buildingId===b.id){o.x=b.x+(o.x-b.x)*4/oldW;o.y=b.y+(o.y-b.y)*3/oldH;if(o.w>.2)o.w*=4/oldW;if(o.h>.2)o.h*=3/oldH;}
        for(const p of a.points)if(p.buildingId===b.id){p.x=b.x+(p.x-b.x)*4/oldW;p.y=b.y+(p.y-b.y)*3/oldH;}
      }
      for(const list of [a.objects,a.buildings,a.points,a.residentRoster||[]])for(const o of list)shift(o,x,y);
      a.points=a.points.filter(p=>!['armory_exit','armory_entry'].includes(p.kind));
      const timers=['nextAttack','rootUntil','boostUntil','slowUntil','repathAt','rangedAt','screamAt','rocketAt','sweepAt','engagedAt','adjustUntil','burningUntil','burnNext'];
      const seen=new Set();for(const z of state?.zombies||[]){if(z.boneType)continue;shift(z,x,y);for(const k of timers)if(Number.isFinite(z[k]))z[k]+=delta;
        for(const action of [z.action,z.armoryAction,z.windup])if(action)for(const k of ['started','release','until','recoverUntil'])if(Number.isFinite(action[k]))action[k]+=delta;
        if(z.fireVisual)for(const k of ['at','until'])if(Number.isFinite(z.fireVisual[k]))z.fireVisual[k]+=delta;
        if(z.armoryAction?.facing)z.facing={...z.armoryAction.facing};
        if(!host.zombies.some(o=>o.id===z.id)){host.zombies.push(z);seen.add(z.id);}
      }
      for(const k of ['devices','drops'])for(const o of state?.[k]||[]){shift(o,x,y);for(const field of ['readyAt','flashUntil','lastToggle'])if(Number.isFinite(o[field]))o[field]+=delta;if(o.id&&!String(o.id).startsWith('armory:'))o.id='armory:migrated:'+o.id;host[k].push(o);}host.deviceId=Math.max(host.deviceId||0,state?.deviceId||0);
      a.origin=land.origin;a.bounds=land.bounds;a.worldIntegrated=true;a.version=2;a.state=null;a.playerInside=false;
      a.entrance={x:x+100,y:y+150,id:'armory:entrance',kind:'armory_gate',type:'armory',hp:1};a.gates=[a.entrance,{x,y:y+75,id:'armory:side',kind:'armory_gate',type:'armory',hp:1}];
      a.boss=host.zombies.find(z=>z.kind==='sweeper')||a.boss;if(a.boss&&!seen.has(a.boss.id)&&!a.bossDead)shift(a.boss,x,y);
      if(localPlayer){Object.assign(this.player,{x:localPlayer.x+x,y:localPlayer.y+y});this.playerAttack=null;this.fireHeld=false;this.cancelAction('军备库已并入主世界，未完成操作已取消。');}
      this._armoryIndex=null;this._collisionHomes=null;this.navigationChanged();this.autosaveRequested=true;
      this.announce('军备库已成为主世界区域，可沿道路直接步行进入；时间与天气正常推进。');
    }
    ensureArmory(){super.ensureArmory();if(this.armory&&!this.armory.worldIntegrated)this.integrateArmory();}
    switchArmory(){this.announce('军备库在主世界中，请直接步行进出，不需要切换场景。');}
    nearbyHomes(p,r){if(this.scene==='parking')return super.nearbyHomes(p,r);return this.withScene('surface',()=>super.nearbyHomes(p,r)).filter(h=>!h.armoryReserved);}
    movePlayer(dt,input){if(this.scene==='parking')return super.movePlayer(dt,input);return this.withScene('surface',()=>super.movePlayer(dt,input));}
    updateIndoorHome(){if(this.scene==='parking')return super.updateIndoorHome();const b=this.armory?.worldIntegrated&&this.armory.buildings.find(b=>b.hp>0&&Math.abs(this.player.x-b.x)<b.w/2&&Math.abs(this.player.y-b.y)<b.h/2);if(b){this.player.indoorHome=b.id;return;}if(this.getHome(Math.round(this.player.x/28),Math.round(this.player.y/28)).armoryReserved){this.player.indoorHome=null;return;}super.updateIndoorHome();if(this.player.indoorHome?.startsWith('H')||this.player.indoorHome?.startsWith('T'))this.player.indoorHome=null;}
    outdoors(p){if(this.scene==='parking')return super.outdoors(p);if(this.inArmory(p))return !this.armory.buildings.some(b=>b.hp>0&&Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.y-b.y)<b.h/2);if(this.scene==='surface'&&this.getHome(Math.round(p.x/28),Math.round(p.y/28)).armoryReserved)return true;return super.outdoors(p);}
    updateDoors(){if(this.scene==='parking')return super.updateDoors();this.withScene('surface',()=>super.updateDoors());if(this.armoryWorldActive)this.withScene('armory',()=>super.updateDoors());}
    obstacles(a,b=a,padding=.22){if(!this.armoryWorldActive)return super.obstacles(a,b,padding);const normal=this.withScene('surface',()=>super.obstacles(a,b,padding)),local=this.withScene('armory',()=>super.obstacles(a,b,padding));return [...new Set([...normal,...local])];}
    clearLine(a,b,ignore=null){if(!this.armoryWorldActive)return super.clearLine(a,b,ignore);const old=this._thermalCoverCheck;this._thermalCoverCheck=true;try{return !this.obstacles(a,b,0).some(o=>o!==ignore);}finally{this._thermalCoverCheck=old;}}
    visionObstacles(a,b,ignore=null){if(!this.armoryWorldActive)return super.visionObstacles(a,b,ignore);const old=this._thermalCoverCheck;this._thermalCoverCheck=true;try{return this.obstacles(a,b,0).filter(o=>o!==ignore&&this.blocksVision(o));}finally{this._thermalCoverCheck=old;}}
    canSee(p){if(this.scene==='parking')return super.canSee(p);if(this.weatherKind()==='fog'&&this.outdoors(this.player)){const d=dist(p,this.player);return d<=this.personalSight||d<=this.illuminatedSight&&this.isLit(p);}return true;}
    find(id){if(this.armoryWorldActive){const o=this.armory.points.find(o=>o.id===id)||this.armory.objects.find(o=>o.id===id);if(o)return o;}return super.find(id);}
    nearbyInteraction(){const current=super.nearbyInteraction();if(!this.armoryWorldActive)return current;const choices=this.armory.points.filter(o=>dist(o,this.player)<1.8&&this.clearLine(this.player,o,o)).map(object=>({type:'armory',object,distance:dist(object,this.player)}));if(current&&current.object?.id!=='armory:entrance')choices.push(current);return choices.sort((a,b)=>a.distance-b.distance)[0]||null;}
    interact(target){if(target?.type!=='armory')return super.interact(target);const o=target.object;if(o.kind==='armory_gate')return false;if(!this.armoryWorldActive||this.action||this.result||dist(o,this.player)>=1.8||!this.clearLine(this.player,o,o))return false;if(o.opened&&['armory_crate','armory_lamp'].includes(o.kind)){this.claimArmoryLoot(o);return true;}return this.beginAction('armory_action',o.kind==='armory_crate'?4:2,{target:o.id,operation:o.kind});}
    damageZombie(z,n,source){if(this.armoryWorldActive&&army(z))return this.withScene('armory',()=>super.damageZombie(z,n,source));return super.damageZombie(z,n,source);}
    canPlace(kind,p){if(this.armoryWorldActive&&p&&this.inArmory(p)){const q={x:p.x-this.armory.origin.x,y:p.y-this.armory.origin.y};if(Math.abs(q.x-100)<4||Math.abs(q.y-75)<4||this.armory.gates.some(g=>dist(p,g)<4)||this.armory.points.some(o=>dist(o,p)<1.5))return '请保留军备库道路、门口和物资点';}return super.canPlace(kind,p);}
    requestPath(z,target){if(this.armoryWorldActive&&army(z)&&dist(z,this.player)>45)return false;return super.requestPath(z,target);}
    updateZombies(dt){
      if(!this.armoryWorldActive)return super.updateZombies(dt);
      const residents=this.zombies.filter(army),sleeping=residents.filter(z=>z.kind!=='sweeper'&&dist(z,this.player)>45),roots=sleeping.map(z=>z.rootUntil);
      // Dormant residents must release navigation slots needed by incoming raids.
      const dormant=new Set(residents.filter(z=>dist(z,this.player)>45));
      if(this._pathQueue)this._pathQueue=this._pathQueue.filter(job=>{if(!dormant.has(job.z))return true;this._pathJobs?.delete(job.z);job.z.path=[];job.z.repathAt=this.seconds;return false;});
      this.zombies=[...this.zombies.filter(z=>!army(z)),...residents];
      sleeping.forEach(z=>z.rootUntil=Infinity);
      try{return this.withScene('armory',()=>super.updateZombies(dt));}finally{sleeping.forEach((z,i)=>z.rootUntil=roots[i]);}
    }
    dawn(){const residents=this.armoryWorldActive?this.zombies.filter(z=>army(z)&&z.hp>0):[];super.dawn();for(const z of residents)if(!this.zombies.includes(z))this.zombies.push(z);}
    resetWorldBoss(){const boss=this.zombies.find(z=>z.kind==='sweeper'&&z.hp>0);if(!boss||this.armory.bossDead)return;const home={...boss.home};Object.assign(boss,this.makeSweeper(),home,{home});for(const k of ['burningUntil','burnNext','windup'])delete boss[k];this.projectiles=this.projectiles.filter(p=>p.source!=='sweeper'&&!(p.owner==='player'&&this.inArmory(p)));this.zones=this.zones.filter(p=>p.kind!=='fire_pool'||!this.inArmory(p));this.zombies=this.zombies.filter(z=>z.boneType!=='player'||!this.inArmory(z));this.autosaveRequested=true;}
    step(dt,input={}){super.step(dt,input);if(this.armoryWorldActive){const inside=this.inArmory();if(this.armory.playerInside&&!inside)this.resetWorldBoss();this.armory.playerInside=inside;}}
    snapshot(){const d=super.snapshot();d.armoryWorldVersion=2;return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,ArmoryWorldGame.prototype);if(g.armory&&!g.armory.worldIntegrated)g.integrateArmory();return g;}
  }
  S.Game=ArmoryWorldGame;
})(globalThis);
