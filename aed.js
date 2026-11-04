/* A single lethal-damage commit, independent protection and per-container knowledge. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion;
  D.items.emergency_aed=['应急AED急救箱',1];S.NAMES.emergency_aed='应急AED急救箱';
  D.crafts.emergency_aed={name:'应急AED急救箱',day:1,knowledge:'blueprint_emergency_aed',amount:1,cost:{alcohol:2,medkit:1,clean_water:1,bandage:2,herb:1}};
  root.ArmoryData.blueprints.blueprint_emergency_aed='应急AED急救箱蓝图';
  class AEDGame extends Base{
    constructor(options={}){super(options);this.initializeAEDWorld();}
    craft(kind){if(kind==='emergency_aed'&&!this.knowledge.blueprint_emergency_aed){this.announce('尚未学会应急AED急救箱蓝图。');return false;}return super.craft(kind);}
    rescueAED(amount,source){
      const i=this.inventory.findIndex(s=>s?.kind==='emergency_aed'&&s.amount>0);if(i<0)return false;
      this.inventory[i]=null;this.recordResource('spent',{emergency_aed:1});
      this.aedProtectedUntil=this.seconds+1;this.aedSprintPenaltyUntil=this.seconds+3;this.aedPulseAt=this.seconds;
      this.aedRescues=(this.aedRescues||0)+1;this.stats.aedRescues=(this.stats.aedRescues||0)+1;this.stats.lastAED={source,seconds:this.seconds};
      this.autosaveRequested=true;this.announce('AED自动救命：剩余1血，保护1秒；3秒内奔跑体力消耗增加50%。');return true;
    }
    sprintStaminaCost(dt){return super.sprintStaminaCost(dt)*(this.aedSprintPenaltyUntil>this.seconds?1.5:1);}
    use(kind){if(kind==='emergency_aed'){this.announce('放在背包即可自动拦截一次致命伤；每件占一格，用后消失。');return false;}return super.use(kind);}
    aedChance(o){
      if(!o||o.resourceDisabled)return 0;
      if(['boss_chest','skeleton_chest','armory_briefcase'].includes(o.kind)||o.cycleSupply)return .01;
      if(o.kind==='armory_crate')return .0025;if(o.type==='site'&&o.kind==='pharmacy')return .0075;
      if(o.kind==='cargo'&&o.aedCivilian)return .001;return 0;
    }
    initializeAEDContainer(o,opened=!!(o.opened||o.searched)){
      if(!this.knowledge||o.aedRollVersion===1)return;const chance=this.aedChance(o);if(!chance)return;
      o.aedRollVersion=1;o.aedBlueprintChecked=opened;o.aedBlueprintFound=!opened&&!this.knowledge.blueprint_emergency_aed&&this.random()<chance;this.autosaveRequested=true;
    }
    getHome(cx,cy){const h=super.getHome(cx,cy);if(this.knowledge)for(const o of h.sites)this.initializeAEDContainer(o);return h;}
    addParkingCar(layer,...args){const ok=super.addParkingCar(layer,...args);for(const o of layer.points)if(o.kind==='cargo'&&o.aedCivilian===undefined)o.aedCivilian=layer.cars.some(c=>c.id===o.carId&&c.vehicle==='civilian');return ok;}
    configureResourcePoints(points,...args){super.configureResourcePoints(points,...args);for(const o of points)this.initializeAEDContainer(o);}
    initializeAEDWorld(){
      for(const h of this.homes.values())for(const o of h.sites)this.initializeAEDContainer(o);
      for(const f of this.parkingFloors())for(const o of [...f.layer.points,...(f.layer.chest?[f.layer.chest]:[])]){if(o.kind==='cargo')o.aedCivilian=f.layer.cars.some(c=>c.id===o.carId&&c.vehicle==='civilian');this.initializeAEDContainer(o);}
      for(const o of this.armory?.points||[])this.initializeAEDContainer(o,o.kind==='armory_briefcase'?!!this.armory.rewardClaimed:!!o.opened);
    }
    awardAEDBlueprint(o){
      const chance=this.aedChance(o);if(!chance||o.aedBlueprintChecked)return;
      this.initializeAEDContainer(o,false);o.aedBlueprintChecked=true;
      if(o.aedBlueprintFound&&!this.knowledge.blueprint_emergency_aed){this.knowledge.blueprint_emergency_aed=true;this.announce('发现并学会应急AED急救箱蓝图，可在制作栏合成。');}this.autosaveRequested=true;
    }
    updateAction(dt){const a=this.action,o=a?.target?this.find(a.target):null,eligible=o&&!o.opened&&!o.searched&&['search','parking_search','parking_open','skeleton_open'].includes(a?.type);super.updateAction(dt);if(eligible&&(o.opened||o.searched))this.awardAEDBlueprint(o);}
    finishArmoryAction(a){const o=this.find(a.target),closed=o&&!o.opened,unclaimed=o?.kind==='armory_briefcase'&&!this.armory.rewardClaimed;super.finishArmoryAction(a);if(o&&(closed&&o.opened||unclaimed&&this.armory.rewardClaimed))this.awardAEDBlueprint(o);}
    restockPoints(points){super.restockPoints(points);for(const o of points)if(!o.resourceDisabled&&!o.cycleSupply&&o.restockLoot&&['armory_crate','cargo','tank'].includes(o.kind)){delete o.aedRollVersion;delete o.aedBlueprintChecked;delete o.aedBlueprintFound;this.initializeAEDContainer(o);}}
    refillHome(h,record){const pending=[...record.pending];super.refillHome(h,record);for(const id of pending)if(!record.pending.includes(id)){const o=h.sites.find(o=>o.id===id);if(o){delete o.aedRollVersion;delete o.aedBlueprintChecked;delete o.aedBlueprintFound;this.initializeAEDContainer(o);}}}
    damageZombie(z,n,source){const alive=z.hp>0;super.damageZombie(z,n,source);if(alive&&z.hp<=0&&['lurker','skeleton','sweeper'].includes(z.kind))this.initializeAEDWorld();}
    normalizeAEDStacks(){
      const hosts=[this,this.surfaceState,this.armorySurface,...this.parkingFloors().map(f=>f.state)].filter(Boolean),seen=new Set();
      const split=(slots,host,position)=>{if(!slots||seen.has(slots))return;seen.add(slots);for(const item of [...slots])if(item?.kind==='emergency_aed'&&item.amount>1){let left=Math.floor(item.amount)-1;item.amount=1;while(left-->0){const i=slots.indexOf(null);if(i>=0)slots[i]={kind:'emergency_aed',amount:1};else (host.drops||(host.drops=[])).push({kind:'emergency_aed',amount:1,...position});}this.autosaveRequested=true;}};
      split(this.inventory,this,{x:this.player.x,y:this.player.y});
      for(const host of new Set(hosts)){for(const o of host.devices||[])for(const slots of [o.storage,o.output])split(slots,host,{x:o.x,y:o.y});const drops=[];for(const o of host.drops||[])if(o.kind==='emergency_aed'&&o.amount>1){for(let i=0;i<Math.floor(o.amount);i++)drops.push({...o,amount:1});}else drops.push(o);host.drops=drops;}
    }
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);for(const k of ['aedProtectedUntil','aedSprintPenaltyUntil','aedPulseAt'])if(Number.isFinite(this[k]))this[k]+=delta;}
    snapshot(){const d=super.snapshot();d.aedState={protection:Math.max(0,(this.aedProtectedUntil||0)-this.seconds),penalty:Math.max(0,(this.aedSprintPenaltyUntil||0)-this.seconds),pulse:Math.max(0,(this.aedPulseAt??-1)+.32-this.seconds),rescues:this.aedRescues||0};d.aedHomeRolls=[...this.homes.values()].flatMap(h=>h.sites.filter(o=>o.aedRollVersion===1).map(o=>({cx:h.cx,cy:h.cy,id:o.id,found:!!o.aedBlueprintFound,checked:!!o.aedBlueprintChecked})));return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,AEDGame.prototype);const s=d.aedState||{};g.aedProtectedUntil=g.seconds+Math.max(0,Math.min(1,s.protection||0));g.aedSprintPenaltyUntil=g.seconds+Math.max(0,Math.min(3,s.penalty||0));g.aedPulseAt=g.seconds-.32+Math.max(0,Math.min(.32,s.pulse||0));g.aedRescues=s.rescues||0;for(const r of d.aedHomeRolls||[]){const o=g.getHome(r.cx,r.cy).sites.find(o=>o.id===r.id);if(o){o.aedRollVersion=1;o.aedBlueprintChecked=r.checked??true;o.aedBlueprintFound=r.found;}}g.initializeAEDWorld();g.normalizeAEDStacks();return g;}
  }
  S.Game=AEDGame;
})(globalThis);
