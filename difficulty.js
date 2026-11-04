/* Per-run world policies. Calendar grants are persisted independently of residents. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,M=root.DifficultyRules,{dist,segmentHits}=S,clone=x=>JSON.parse(JSON.stringify(x));
  const cycle=(day,period)=>period?Math.floor(((day||1)-1)/period):0;
  const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
  class DifficultyGame extends Base{
    constructor(options={}){super(options);this.modeWorld();}
    modeWorld(){return this.difficultyWorld||(this.difficultyWorld={version:1,restockCycle:cycle(this.day,this.difficultyRules.restock),repairCycle:cycle(this.day,this.difficultyRules.repair),homes:{}});}
    retained(list,key){const n=Math.floor(list.length*this.difficultyRules.resources);return new Set([...list].sort((a,b)=>hash(key+':'+a.id)-hash(key+':'+b.id)||a.id.localeCompare(b.id)).slice(0,n).map(o=>o.id));}
    initResourceHome(h){
      if(h.armoryReserved||!h.sites||this.difficulty==='normal')return;const world=this.modeWorld(),key=h.cx+','+h.cy;if(world.homes[key])return;
      const optional=[...h.furniture,...h.sites.filter(s=>!s.repeat&&s.kind!=='supply')].filter(o=>!h.own&&!o.loot?.fuse),keep=this.retained(optional,'home:'+key+':'+this.difficulty);
      const templates=[...h.furniture,...h.sites.filter(s=>!s.repeat&&s.kind!=='supply')].map(o=>clone(Object.fromEntries(['id','type','x','y','w','h','maxHP','hp','loot'].filter(k=>o[k]!==undefined).map(k=>[k,o[k]]))));
      const disabled=optional.filter(o=>!keep.has(o.id)).map(o=>o.id);
      for(const o of [...h.furniture,...h.sites])if(disabled.includes(o.id)){o.resourceDisabled=true;if(o.type==='site')o.searched=true;}
      world.homes[key]={templates,disabled,pending:[]};
    }
    getHome(cx,cy){const h=super.getHome(cx,cy);this.initResourceHome(h);return h;}
    configureResourcePoints(points,key,predicate){
      const optional=points.filter(predicate),keep=this.retained(optional,key+':'+this.difficulty);
      for(const o of points){
        if(o.cycleSupply){delete o.restockLoot;o.resourceConfigured=true;if(o.kind==='armory_crate')o.asset=o.asset||'supply_crate_supplies';continue;}
        if(o.resourceConfigured)continue;o.resourceConfigured=true;
        if(['armory_crate','cargo','tank'].includes(o.kind))o.restockLoot=clone(o.loot||{});
        if(optional.includes(o)&&!keep.has(o.id)){o.resourceDisabled=true;o.loot={};o.opened=true;if(o.kind==='armory_crate'){o.blueprintId=null;o.blueprintLearned=false;}}
      }
    }
    createLayer(){super.createLayer();this.configureResourcePoints(this.parking.layer.points,'parking:1',o=>['cargo','tank'].includes(o.kind)&&!o.loot?.fuse);}
    ensureSecondFloorCars(floor){super.ensureSecondFloorCars(floor);if(!floor?.layer?.carLayout?.pending.length&&floor?.layer)this.configureResourcePoints(floor.layer.points,'parking:2',o=>['cargo','tank'].includes(o.kind));}
    createArmory(){super.createArmory();this.configureResourcePoints(this.armory.points,'armory:yard',o=>o.kind==='armory_crate'&&!/^[HT]/.test(o.buildingId||''));}
    restockPoints(points){
      for(const o of points){if(o.cycleSupply||o.resourceDisabled||!o.restockLoot||!['armory_crate','cargo','tank'].includes(o.kind))continue;
        // A protected fuse is a one-time quest supply, never a periodic grant.
        const fuse=o.loot?.fuse||0;o.loot=clone(o.restockLoot);delete o.loot.fuse;if(fuse)o.loot.fuse=fuse;o.opened=false;
        if(o.kind==='armory_crate'&&!o.cycleSupply){delete o.blueprintRollVersion;o.blueprintId=null;o.blueprintLearned=false;}
      }
    }
    parkingFloors(){
      const p=this.parking;if(!p?.layer)return [];const out=[{meta:p,layer:p.layer,state:this.scene==='parking'?this:p.state}];
      for(const [n,f] of Object.entries(p.floors||{}))if(Number(n)!==(p.floor||1))out.push({meta:f,layer:f.layer,state:f.state});return out;
    }
    blockedResource(t){
      const host=this.scene==='parking'?this.surfaceState:this;if(!host)return true;const box={...t,w:t.w||.65,h:t.h||.65};
      return (host.devices||[]).some(o=>o.hp>0&&Math.abs(o.x-box.x)<((o.w||.7)+box.w)/2+.1&&Math.abs(o.y-box.y)<((o.h||.7)+box.h)/2+.1)||[host.position||this.player,...(host.zombies||[]).filter(z=>z.hp>0)].some(o=>segmentHits(o,o,box,.35));
    }
    refillHome(h,record){
      const waiting=[];for(const id of record.pending){const template=record.templates.find(o=>o.id===id),o=[...h.objects,...h.sites].find(o=>o.id===id);if(!template||!o||record.disabled.includes(id))continue;
        if(o.hp<=0&&this.blockedResource(template)){waiting.push(id);continue;}
        o.hp=Number.isFinite(template.maxHP)?template.maxHP:Infinity;if(o.type==='furniture')o.hp=template.maxHP||1;
        if(o.type==='site'){o.searched=false;o.loot=clone(template.loot||{});delete o.loot.fuse;}
      }record.pending=waiting;
    }
    repairExisting(){
      const repair=o=>{if(o.hp>0&&Number.isFinite(o.hp)&&Number.isFinite(o.maxHP)&&!o.indestructible&&!o.boneType&&o.maxHP>o.hp)o.hp=o.maxHP;};
      for(const h of this.homes.values())for(const o of h.objects)if(['wall','door','fence'].includes(o.type))repair(o);
      const hosts=[this,this.surfaceState,this.armorySurface,...this.parkingFloors().map(f=>f.state)];for(const host of new Set(hosts.filter(Boolean)))for(const o of host.devices||[])repair(o);
      for(const o of this.armory?.buildings||[])repair(o);for(const o of this.armory?.objects||[])repair(o);
      for(const o of this.camp?.solids||[])repair(o);
      this._lights=null;this.autosaveRequested=true;
    }
    advanceModeCycles(){
      if(this.scene==='parking')return;const w=this.modeWorld(),p=this.difficultyRules,restock=cycle(this.day,p.restock),repair=cycle(this.day,p.repair);
      if(restock>w.restockCycle){w.restockCycle=restock;for(const h of this.homes.values())this.initResourceHome(h);
        for(const r of Object.values(w.homes))r.pending=r.templates.filter(t=>!r.disabled.includes(t.id)).map(t=>t.id);
        if(this.armory)this.restockPoints(this.armory.points);for(const f of this.parkingFloors())this.restockPoints(f.layer.points);
        this.initializeArmoryBlueprints();this.announce(`每${p.restock}日物资补货：普通资源恢复基础库存，关键奖励和玩家储物保留。`);this.autosaveRequested=true;
      }
      if(repair>w.repairCycle){w.repairCycle=repair;this.repairExisting();this.announce('简单模式3日修复：仍存在的防线和装置已恢复当前等级生命，能源与库存不变。');}
    }
    processResourceRefills(){
      const records=Object.entries(this.modeWorld().homes).filter(([,r])=>r.pending.length);if(!records.length)return;
      this._resourceCursor=(this._resourceCursor||0)%records.length;
      for(let i=0;i<Math.min(4,records.length);i++){const [key,r]=records[(this._resourceCursor+i)%records.length],h=this.homes.get(key);if(h){this.refillHome(h,r);this.autosaveRequested=true;}}
      this._resourceCursor+=4;this._collisionHomes=null;
    }
    rewardCycleBoss(z){
      if(!['hard','apocalypse'].includes(this.difficulty)||!Number.isInteger(z.refreshCycle))return;const key=z.kind+':'+z.refreshCycle,w=this.modeWorld();w.bossRewards=w.bossRewards||[];if(w.bossRewards.includes(key))return;
      const spot={x:z.x,y:z.y};if(this.obstacles(spot,spot,.25).length){const free=this.nearFree(spot);if(free)Object.assign(spot,free);}
      const loot=z.kind==='lurker'?{iron:4,cloth:2,fuel_oil:1}:{iron:6,scrap:4,gunpowder:2};
      if(z.kind==='lurker')this.parking.layer.points.push({...spot,id:'parking:cycle-reward:'+key,type:'parking',kind:'boss_chest',hp:1,opened:false,loot,cycleSupply:true});
      else this.armory.points.push({...spot,id:'armory:cycle-reward:'+key,type:'armory',kind:'armory_crate',asset:'supply_crate_supplies',hp:1,opened:false,loot,cycleSupply:true,resourceConfigured:true,blueprintRollVersion:1,blueprintId:null});
      w.bossRewards.push(key);this.autosaveRequested=true;
    }
    damageZombie(z,n,source){const alive=z.hp>0;super.damageZombie(z,n,source);if(alive&&z.hp<=0&&['lurker','sweeper'].includes(z.kind))this.rewardCycleBoss(z);}
    updateVisit(){if(this.scene!=='parking')super.updateVisit();}
    step(dt,input={}){super.step(dt,input);if(this.result||dt<=0||this.parkingUnlockPending)return;this.advanceModeCycles();if(this.seconds>=(this._resourceRefillAt||0)){this._resourceRefillAt=this.seconds+1;this.processResourceRefills();}}
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);if(Number.isFinite(this._resourceRefillAt))this._resourceRefillAt+=delta;}
    snapshot(){const d=super.snapshot(),w=clone(this.modeWorld());for(const [key,r] of Object.entries(w.homes)){const h=this.homes.get(key);if(h)r.state=[...h.objects,...h.sites].filter(o=>r.templates.some(t=>t.id===o.id)).map(o=>({id:o.id,hp:Number.isFinite(o.hp)?o.hp:null,searched:o.searched,resourceDisabled:!!o.resourceDisabled,loot:o.loot}));}d.difficulty=this.difficulty;d.difficultyVersion=1;d.difficultyWorld=w;return d;}
    static restore(d){
      const g=Base.restore(d);Object.setPrototypeOf(g,DifficultyGame.prototype);g.difficulty=M.id(d.difficulty);g.difficultyWorld=d.difficultyWorld||null;g.modeWorld();
      for(const h of g.homes.values()){g.initResourceHome(h);const record=g.difficultyWorld.homes[h.cx+','+h.cy];for(const saved of record?.state||[]){const o=[...h.objects,...h.sites].find(o=>o.id===saved.id);if(o)Object.assign(o,saved,{hp:saved.hp===null?Infinity:saved.hp});}}
      for(const f of g.parkingFloors())if(!f.layer.carLayout?.pending.length)g.configureResourcePoints(f.layer.points,'parking:'+(f.meta===g.parking?(g.parking.floor||1):2),o=>['cargo','tank'].includes(o.kind)&&!o.loot?.fuse);
      if(g.armory)g.configureResourcePoints(g.armory.points,'armory:yard',o=>o.kind==='armory_crate'&&!o.cycleSupply&&!/^[HT]/.test(o.buildingId||''));
      if(g.scene==='parking')g.visitors=[];return g;
    }
  }
  S.Game=DifficultyGame;
})(globalThis);
