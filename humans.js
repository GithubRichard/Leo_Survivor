/* Persistent ground people and personal states deliberately use different clocks. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion,H=root.HumansData,{dist,pointRect}=S,copy=x=>JSON.parse(JSON.stringify(x));
  D.items.hunger_totem=['饥饿图腾',1];Object.assign(S.NAMES,H.names);S.NAMES.hunger_totem='饥饿图腾';S.NAMES.human_blueprint='未学图纸';
  class HumansGame extends Base{
    constructor(options={}){super(options);this.ensureHumans(true);}
    get humanMode(){return this.difficulty==='apocalypse';}
    get hungerTotemActive(){return this.humanMode&&!!this.inventory?.some(s=>s?.kind==='hunger_totem'&&s.amount>0);}
    get hungerMetabolism(){return this.hungerTotemActive?1.5:1;}
    get foodAmplitude(){return this.hungerTotemActive?1.2:1;}
    get foodArmorReduction(){return this.foodAmplitude;}
    get walkSpeed(){return 2*(this.hungerTotemActive?1.15:1);}
    get runSpeed(){return super.runSpeed*(this.hungerTotemActive?1.15:1);}
    get maxHP(){return super.maxHP+(this.hungerTotemActive&&this.mainBuff?.type==='health'?.4:0);}
    get maxStamina(){return super.maxStamina+(this.hungerTotemActive&&this.player.hunger>60?({stamina2:.4,stamina4:.8}[this.mainBuff?.type]||0):0);}
    get staminaRecoveryInterval(){return this.hungerTotemActive&&this.player.hunger>60&&this.mainBuff?.type==='recovery'?1.4*this.traitEffects.recovery:super.staminaRecoveryInterval;}
    meleeDamage(n){return super.meleeDamage(n)+(this.hungerTotemActive&&this.mainBuff?.type==='melee'?.2:0);}
    sprintStaminaCost(dt){return super.sprintStaminaCost(dt)*(this.hungerTotemActive&&this.teaBuff?.until>this.seconds?.76/.8:1);}
    enemyHP(kind,n){return H.names[kind]?n:super.enemyHP(kind,n);}
    enemySpeed(kind,n){return H.names[kind]||kind==='home_helper'?n:super.enemySpeed(kind,n);}
    ensureHumans(fresh=false){
      if(!this.humanMode)return null;if(!this.humans){this.humans={version:1,serial:0,actors:[],corpses:[],shots:[],groups:{},plans:{},regularKills:0,revenge:false,heroUntil:0,banUntil:0,unlocked:false,follower:null,cooldownUntil:0,raid:null,retryOutside:false,food:{}};this.humanPlan(fresh);this.initializeHumanFood();this.autosaveRequested=true;}return this.humans;
    }
    humanPlan(fresh=false){
      const h=this.humans;if(!h||h.plans[this.day])return;for(const k of Object.keys(h.plans))if(Number(k)<this.day-1)delete h.plans[k];const minute=this.scene==='parking'?(this.surfaceState?.minutes??this.minutes):this.minutes;
      const times=[...H.starvingTimes];for(let i=times.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[times[i],times[j]]=[times[j],times[i]];}
      const selected=times.slice(0,1+Math.floor(this.random()*4));h.plans[this.day]={starving:H.starvingTimes.filter(t=>selected.includes(t)).map(t=>({id:`human:${this.day}:s:${t}`,at:t,state:!fresh&&t<=minute?'past':'pending'})),bandits:H.banditTimes.map(t=>({id:`human:${this.day}:b:${t}`,at:t,roll:this.random()<.4,state:!fresh&&t<=minute?'past':'pending'}))};this.autosaveRequested=true;
    }
    humanActiveActors(includeFollower=true){if(!this.humanMode||!this.humans)return [];const list=this.scene==='surface'||this.armoryWorldActive&&this.scene==='armory'?this.humans.actors.filter(a=>a.hp>0&&!a.retreating):[];const f=this.humans.follower;if(includeFollower&&f?.hp>0&&!f.pending&&f.scene===this.humanScene())list.push(f);return list;}
    humanScene(){return this.scene==='parking'?'parking:'+this.parking.floor:'surface';}
    withHumanTargets(fn,{neutral=true,follower=false}={}){
      const added=this.humanActiveActors(follower).filter(a=>!this.zombies.includes(a)&&(neutral||a.hostile||a.kind==='bandit')&&(follower||a.kind!=='loyal_follower'));
      if(!added.length)return fn();const original=this.zombies;this.zombies=[...original,...added];try{return fn();}finally{const originalSet=new Set(original);this.zombies=this.zombies.filter(a=>!a.human||originalSet.has(a));}
    }
    navigationActors(){return [...this.zombies,...this.humanActiveActors(),...(this.humanMode?this.visitors.filter(a=>a.recruited):[])];}
    find(id){if(id==null)return null;return this.humans?.actors.find(a=>a.id===id&&a.hp>0)||((this.humans?.follower?.id===id&&this.humans.follower.hp>0)?this.humans.follower:null)||(this.humanMode&&this.zombies.find(z=>String(z.id)===String(id)&&z.hp>0))||super.find(id);}
    attack(){const ok=this.withHumanTargets(()=>super.attack());if(ok)this._humanPlayerCombatAt=this.seconds;return ok;}
    damagePlayer(...args){const hit=super.damagePlayer(...args);if(hit){this._humanPlayerCombatAt=this.seconds;if(this.action?.type==='loyal_summon')this.cancelAction('受伤中断召唤。');}return hit;}
    updatePlayerAttack(){return this.withHumanTargets(()=>super.updatePlayerAttack());}
    igniteMolotov(p){return this.withHumanTargets(()=>super.igniteMolotov(p),{follower:true});}
    updateDevices(dt){const old=this._humanDeviceDamage;this._humanDeviceDamage=true;try{return this.withHumanTargets(()=>super.updateDevices(dt));}finally{this._humanDeviceDamage=old;}}
    updateZones(dt){return this.withHumanTargets(()=>super.updateZones(dt),{follower:true});}
    advanceWeather(dt){return this.withHumanTargets(()=>super.advanceWeather(dt),{follower:true});}
    updateProjectiles(dt){return this.withHumanTargets(()=>super.updateProjectiles(dt),{follower:true});}
    updateCombatBones(dt){return this.withHumanTargets(()=>super.updateCombatBones(dt),{follower:true});}
    enemyProjectileTargets(){return [...new Set([this.player,...this.zombies.filter(a=>a.hp>0&&(a.human||a.boneType==='player')),...this.humanActiveActors()])];}
    blastTargets(shot,victims){return [...new Set([...victims,...this.humanActiveActors()])];}
    damageZombie(z,n,source,actorId){if(z.human)return this.hurtHuman(z,n,source,actorId);return super.damageZombie(z,n,source);}
    damageBuilding(o,n){if(o.human)return this.hurtHuman(o,n,'zombie',this._humanAttacker?.id);return super.damageBuilding(o,n);}
    humanZombieHit(target,damage,source,z){if(target.human)return this.hurtHuman(target,this.enemyDamage(damage,source),source,z?.id);return false;}
    hurtHuman(a,n,source='unknown',actorId){
      if(!a||a.kind==='home_helper'||a.hp<=0||a.retreating||!(n>0))return false;const playerOwned=this._humanDeviceDamage||['weapon','molotov','device','bone_skill','loyal_follower','player'].includes(source);
      a.hp=Math.max(0,a.hp-n);a.hurtUntil=this.seconds+.18;a.action=null;this.clearHumanSearch(a);a.lastCombat=this.seconds;
      if(a.kind==='starving_civilian'&&playerOwned)a.hostile=true;
      if(!playerOwned&&a.kind!=='loyal_follower'){const z=this.zombies.find(z=>!z.human&&z.hp>0&&(z.id===actorId||!actorId&&z.kind===source));if(z){a.defendId=z.id;a.defendAt=this.seconds;}}
      if(a.hp>1e-8){this.autosaveRequested=true;return true;}a.hp=0;if(a.deathCommitted)return true;a.deathCommitted=true;
      const h=this.humans;if(a.kind==='loyal_follower'){h.cooldownUntil=this.seconds+120;h.follower=null;this.announce('忠心随从阵亡，120秒后可再次召唤。');}
      else{
        if(playerOwned){this.stats.kills[a.kind]=(this.stats.kills[a.kind]||0)+1;this.kills++;}
        if(!a.simulated){this.humanDeathLoot(a);if(a.kind==='bandit'&&!a.raidId&&playerOwned){h.regularKills++;if(h.regularKills>=6&&!h.revenge){h.revenge=true;this.announce('复仇：进入幸存者营地将触发强盗袭击。');}}}
      }
      h.corpses.push({id:a.id,kind:a.kind,x:a.x,y:a.y,scene:this.humanScene(),started:this.seconds,until:this.seconds+5});this.autosaveRequested=true;return true;
    }
    humanDeathLoot(a){
      const drop=(item)=>this.drops.push({...a.home,...{x:a.x,y:a.y},kind:item.kind,amount:item.amount||1,instance:copy(item)});
      if(a.kind==='bandit'){
        if(!a.raidId&&a.weapon!=='bare')drop({kind:a.weapon,amount:1});
        if(['hand_crossbow','shotgun'].includes(a.weapon)&&this.random()<.6)drop({kind:a.weapon==='shotgun'?'shotgun_shell':'bolt',amount:1+Math.floor(this.random()*(a.weapon==='shotgun'?2:4))});
      }else if(a.kind==='starving_civilian'){
        if(a.eating&&a.eatLeft>0&&this.random()<.6)drop(a.eating);
        const blueprints=(a.knowledge||[]).filter(id=>!this.knowledge[id]);if(blueprints.length&&this.random()<.1)this.drops.push({x:a.x,y:a.y,kind:'human_blueprint',amount:1,knowledge:blueprints[Math.floor(this.random()*blueprints.length)]});
        for(const item of a.carry||[])if(item.kind==='hunger_totem')drop(item);
        if(this.random()<.02)drop({kind:'hunger_totem',amount:1});
      }
    }
    interact(target){
      const o=target?.object;if(this.humanMode&&target?.type==='drop'&&this.drops.includes(o)&&dist(o,this.player)<1.8&&this.clearLine(this.player,o)){
        if(o.knowledge){this.knowledge[o.knowledge]=true;this.drops.splice(this.drops.indexOf(o),1);this.announce('拾取并学会：'+(root.ArmoryData.blueprints[o.knowledge]||o.knowledge));this.autosaveRequested=true;return true;}
        if(o.instance){const slots=this.inventory.map(s=>s?copy(s):null),item=copy(o.instance);if(Object.keys(item).some(k=>!['kind','amount'].includes(k))){const i=slots.indexOf(null);if(i<0){this.announce('背包已满。');return false;}slots[i]=item;}else if(!S.transaction(slots,{}, {[item.kind]:item.amount||1})){this.announce('背包已满。');return false;}
          this.inventory=slots;this.drops.splice(this.drops.indexOf(o),1);this.syncHumanFood();this.recordResource('income',{[item.kind]:item.amount||1});this.autosaveRequested=true;return true;}
      }
      const ok=super.interact(target);if(ok)this.syncHumanFood();return ok;
    }
    pay(...args){const ok=super.pay(...args);if(ok)this.syncHumanFood();return ok;}
    remove(...args){const ok=super.remove(...args);if(ok)this.syncHumanFood();return ok;}
    transfer(...args){const out=super.transfer(...args);this.syncHumanFood();return out;}
    drop(){const out=super.drop();this.syncHumanFood();return out;}
    humanDoorActors(){return [...this.humanActiveActors(),...(this.humanMode?this.visitors.filter(v=>v.recruited):[])];}
    updateDoors(){super.updateDoors();}
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);const h=this.humans;if(!h)return;for(const key of ['heroUntil','banUntil','cooldownUntil'])h[key]+=delta;if(Number.isFinite(this._humanPlayerCombatAt))this._humanPlayerCombatAt+=delta;const f=h.follower;if(f){for(const key of ['nextAttack','rootUntil','lastCombat','hurtUntil','idleSince','repathAt'])if(Number.isFinite(f[key]))f[key]+=delta;if(f.action)for(const key of ['release','until'])f.action[key]+=delta;}for(const c of h.corpses)if(c.kind==='loyal_follower'){c.started+=delta;c.until+=delta;}}
    switchScene(){const before=this.humanScene();super.switchScene();if(this.humanScene()!==before){if(this.humans?.raid?.active)this.failHumanRaid('离开营地进入地下');this.transferHumanFollower();}}
    changeFloor(...args){const before=this.humanScene(),out=super.changeFloor(...args);if(this.humanScene()!==before)this.transferHumanFollower();return out;}
    completeVehicleTrip(...args){const ok=super.completeVehicleTrip(...args);if(ok){if(this.humans?.raid?.active&&this.guardDistance(this.player)>40)this.failHumanRaid('乘车离开守卫区');this.transferHumanFollower();}return ok;}
    step(dt,input={}){
      this.ensureHumans();const before=this.seconds,day=this.day,minutes=this.minutes,scene=this.scene;this._humanCampReady=null;this._humanSummonReady=null;if(this.humanMode){this.checkHumanRaidExit();this.startHumanRaidIfNeeded();}super.step(dt,input);const elapsed=this.seconds-before;
      if(!this.humanMode||!(elapsed>0)||this.result||this._sceneJustChanged||this.parkingUnlockPending)return;
      this._humanGameMinutes=scene==='surface'?Math.max(0,(this.day-day)*1440+this.minutes-minutes):0;
      if(this.scene==='surface'){this.expireStarvingCivilians();this.checkHumanRaidExit();this.humanPlan();this.updateHumanPopulation(elapsed);this.updateHumanRaid(elapsed);this.updateHumanActors(elapsed);this.updateHelperGuard(elapsed);this.updateHumanShots(elapsed);}
      this.updateHumanFollower(elapsed);this.finishHumanSummon();if(this.scene==='surface'){this.checkHumanRaidExit();this.settleHumanRaid();this.flushHumanCampExchange();}this.syncHumanFood();this.humans.actors=this.humans.actors.filter(a=>a.hp>0);this.humans.corpses=this.humans.corpses.filter(c=>c.scene!==this.humanScene()||c.until>this.seconds);
    }
    snapshot(){const d=super.snapshot();if(this.humanMode)d.humans=copy(this.humans);return d;}
    static restore(d){
      const g=Base.restore(d);Object.setPrototypeOf(g,HumansGame.prototype);
      if(g.humanMode){
        g.humans=d.humans?copy(d.humans):null;g.ensureHumans(false);
        for(const actor of g.humans.actors)g.initializeStarvingLifetime(actor);
        const follower=g.humans.follower;
        if(follower?.hp>0&&follower.maxHP!==H.loyalFollowerHP){
          const previousMax=follower.maxHP??3;
          follower.hp=Math.min(H.loyalFollowerHP,follower.hp+Math.max(0,H.loyalFollowerHP-previousMax));
          follower.maxHP=H.loyalFollowerHP;g.autosaveRequested=true;
        }
        g.initializeHumanFood();g.syncHumanFood();
      }else g.humans=null;
      return g;
    }
  }
  S.Game=HumansGame;root.HumansGame=HumansGame;
})(globalThis);
