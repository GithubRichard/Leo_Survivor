/* One object per lamp: moving, storage and throwing preserve its energy and identity. */
(function(root){
  'use strict';const common=typeof module!=='undefined'&&module.exports;
  const S=common?require('./parking.js'):root.Survival,{dist}=S,P=S.Parking,Base=S.ParkingBase;
  Object.assign(S.Game.prototype,{
    newLamp(s){
      if(!P.lamps[s.kind]||s.lampId)return s;const d=P.lamps[s.kind];
      return Object.assign(s,{lampId:`lamp:${++this.lampSerial}`,energy:s.kind==='torch'?d.duration:0,active:false,lastToggle:-1e9,hp:s.hp??d.hp,warn30:false,warn10:false});
    },
    add(k,n=1){const ok=Base.prototype.add.call(this,k,n);if(ok)for(const s of this.inventory)if(s)this.newLamp(s);return ok;},
    pay(cost={},gain={}){const ok=Base.prototype.pay.call(this,cost,gain);if(ok)for(const s of this.inventory)if(s)this.newLamp(s);return ok;},
    lampById(id){return this.inventory.find(s=>s?.lampId===id)||this.devices.find(d=>d.lampId===id||d.id===id);},
    isCarried(s){return this.inventory.includes(s);},
    equip(kind){
      const hand=this.lampById(this.heldLightId);
      if(hand&&!['fists','wood_club','iron_axe'].includes(kind)){this.announce('单手灯占一只手，请先放下灯，或改用头灯。');return false;}
      return Base.prototype.equip.call(this,kind);
    },
    use(kind){
      const s=this.inventory[this.selectedSlot];if(P.lamps[kind]&&s?.kind===kind){this.newLamp(s);return this.lampAction('equip',s.lampId);}
      return Base.prototype.use.call(this,kind);
    },
    lampAction(op,id){
      const s=this.lampById(id),d=s&&P.lamps[s.kind];if(!d||s.hp<=0)return false;
      const carried=this.isCarried(s);
      if(op==='equip'&&(d.fixed||!carried||d.hand&&!['fists','wood_club','iron_axe'].includes(this.player.weapon))){this.announce('单手灯只能搭配徒手、木棍、铁斧；头灯不占手。');return false;}
      if(['drop','throw'].includes(op)&&(!carried||d.fixed))return false;
      if(op==='throw'&&(!d.throwable||!s.active||s.energy<=0||this.seconds<this.lampThrowAt)){this.announce('只能投掷已点亮的火把或提灯，投掷间隔1秒。');return false;}
      if(op==='toggle'&&(this.seconds-(s.lastToggle??-1e9)<1||!s.active&&s.energy<=0)){this.announce(s.energy<=0?'请先装入一份对应能源。':'开关灯至少间隔1秒。');return false;}
      if(op==='refuel'&&(s.energy>0||!d.fuel||!this.count(d.fuel))){this.announce('当前能源用完后才能装入一份对应能源。');return false;}
      if(!carried&&(dist(s,this.player)>2||!this.clearLine(this.player,s,s)))return false;
      if(op==='pickup'&&(d.fixed||carried))return false;
      return this.beginAction(op==='throw'?'lamp_throw':'lamp',.5,{lampId:s.lampId||s.id,op,target:carried?null:s.id});
    },
    detachLamp(s){
      const i=this.inventory.indexOf(s);if(i>=0)this.inventory[i]=null;this.devices=this.devices.filter(d=>d!==s);
      if(this.heldLightId===s.lampId)this.heldLightId=null;if(this.headLightId===s.lampId)this.headLightId=null;this._lights=null;this.navigationChanged();
    },
    portableSlot(s){return {kind:s.kind,amount:1,lampId:s.lampId,energy:s.energy,active:s.active,lastToggle:s.lastToggle,hp:s.hp,warn30:s.warn30,warn10:s.warn10};},
    groundLamp(s,p){
      const d=P.lamps[s.kind];
      if(s.kind==='torch'&&s.energy<=0)return null;
      const o={...this.portableSlot(s),x:p.x,y:p.y,facing:{...this.player.facing},id:s.lampId,type:'device',w:.3,h:.3,maxHP:d.hp,invested:{},output:[],storage:[],jobs:[],fuel:0,level:0};
      this.devices.push(o);this._lights=null;this.navigationChanged();return o;
    },
    finishLampAction(a){
      const s=this.lampById(a.lampId),d=s&&P.lamps[s.kind];if(!d||s.hp<=0)return;const carried=this.isCarried(s);
      if(a.op==='repair'){if(s.kind!=='torch'&&s.hp<s.maxHP&&this.pay({iron:1}))s.hp=Math.min(s.maxHP,s.hp+6);return;}
      if(a.op==='equip'){
        if(!carried||d.fixed||d.hand&&!['fists','wood_club','iron_axe'].includes(this.player.weapon))return;
        const field=d.hand?'heldLightId':'headLightId',old=this.lampById(this[field]);
        if(old&&old!==s)old.active=false;this[field]=s.lampId;this.announce(`${d.name}已装备，请在背包中点亮。`);
      }else if(a.op==='toggle'){
        if(this.seconds-(s.lastToggle??-1e9)<1||!s.active&&s.energy<=0)return;
        if(carried&&![this.heldLightId,this.headLightId].includes(s.lampId)){this.announce('请先装备这件灯具。');return;}
        s.active=!s.active;s.lastToggle=this.seconds;this._lights=null;
      }else if(a.op==='refuel'){
        if(s.energy>0||!d.fuel||!this.remove(d.fuel,1))return;
        // Inventory transactions replace slot objects. Write to the current identity after paying.
        const current=this.lampById(s.lampId);if(!current)return;current.energy=d.duration;current.warn30=false;current.warn10=false;this._lights=null;this.announce(`${d.name}已装入一份能源。`);
      }else if(a.op==='pickup'){
        if(d.fixed||carried)return;const i=this.inventory.indexOf(null);if(i<0){this.announce('背包已满，灯保留在原地。');return;}
        this.detachLamp(s);this.inventory[i]=this.portableSlot(s);this.inventory[i].active=false;
      }else if(a.op==='drop'||a.op==='throw'){
        if(!carried)return;const f=this.player.facing,n=Math.hypot(f.x,f.y)||1,p={x:this.player.x+f.x/n,y:this.player.y+f.y/n};
        if(a.op==='drop'&&this.obstacles(p,p,.2).length){this.announce('这里放不下灯，物品已保留。');return;}
        if(a.op==='throw'){
          if(!d.throwable||!s.active||s.energy<=0||this.seconds<this.lampThrowAt)return;
          this.playerLampVisual={kind:s.kind,until:this.seconds+.25,facing:{...this.player.facing}};
          this.detachLamp(s);this.lampThrowAt=this.seconds+1;
          this.projectiles.push({kind:'lamp_flight',x:this.player.x,y:this.player.y,z:.9,start:{x:this.player.x,y:this.player.y},end:{x:this.player.x+f.x/n*6,y:this.player.y+f.y/n*6},elapsed:0,duration:.5,lamp:s,owner:'player'});
        }else{this.detachLamp(s);this.groundLamp(s,p);}
      }
    },
    drop(){this.endStealth();const s=this.inventory[this.selectedSlot];if(s&&P.lamps[s.kind]){this.newLamp(s);return this.lampAction('drop',s.lampId);}return Base.prototype.drop.call(this);},
    transfer(o,index,toStorage){
      const from=toStorage?this.inventory:o.storage,to=toStorage?o.storage:this.inventory,s=from[index];
      if(!s?.lampId)return Base.prototype.transfer.call(this,o,index,toStorage);const i=to.indexOf(null);if(i<0)return false;
      if(s.lampId===this.heldLightId)this.heldLightId=null;if(s.lampId===this.headLightId)this.headLightId=null;s.active=false;to[i]=s;from[index]=null;return true;
    },
    lightSources(){
      const out=[];if(this.scene==='parking')out.push({...P.exit,radius:4,emergency:true});
      const facing=this.playerAttack?.facing||(this.playerLampVisual?.until>this.seconds?this.playerLampVisual.facing:null)||this.player.facing;
      for(const s of this.inventory)if(s?.lampId&&s.active&&s.energy>0&&[this.heldLightId,this.headLightId].includes(s.lampId))out.push({...this.player,...P.lamps[s.kind],facing,lamp:s});
      for(const s of this.devices)if(P.lamps[s.kind]&&s.hp>0&&s.active&&s.energy>0)out.push({...s,...P.lamps[s.kind],facing:s.facing||{x:0,y:1},lamp:s});return out;
    },
    litBy(p,l,ignore=null){
      const distance=dist(p,l);if(distance>l.radius+1e-8)return false;
      if(l.angle&&distance>.001){const f=l.facing,n=Math.hypot(f.x,f.y)||1;if(((p.x-l.x)*f.x+(p.y-l.y)*f.y)/distance/n<Math.cos(l.angle*Math.PI/360)-1e-8)return false;}
      // A lamp's own stand is not an opaque wall.
      return !this.obstacles(l,p,0).some(o=>o!==l.lamp&&o!==p&&o!==ignore);
    },
    isLit(p,sources){return (sources||this._lights||this.lightSources()).some(l=>this.litBy(p,l));},
    isDark(p){return !(this.scene!=='parking'&&this.minutes<1320)&&!this.isLit(p);},
    canSee(p){
      if(this.scene!=='parking')return this.minutes<1320||dist(this.player,p)<=P.groundSight;
      return (dist(this.player,p)<=P.baseSight||dist(this.player,p)<=P.lightSight&&this.isLit(p))&&this.clearLine(this.player,p,p);
    },
    canSeeCar(car){
      const clamp=(value,min,max)=>Math.max(min,Math.min(max,value)),left=car.x-car.w/2,right=car.x+car.w/2,top=car.y-car.h/2,bottom=car.y+car.h/2;
      const probes=[{x:clamp(this.player.x,left,right),y:clamp(this.player.y,top,bottom)}];
      for(const x of [left,car.x,right])for(const y of [top,car.y,bottom])probes.push({x,y});
      const lights=this._lights||this.lightSources();
      const centreDistance=dist(this.player,car);if(centreDistance>P.lightSight||centreDistance>P.baseSight&&!lights.some(l=>this.litBy(car,l,car)))return false;
      return probes.some(p=>{const distance=dist(this.player,p);return distance<=P.lightSight&&this.clearLine(this.player,p,car)&&(distance<=P.baseSight||lights.some(l=>this.litBy(p,l,car)));});
    },
    parkingCue(text){this.announce(text);this.audioCueSerial=(this.audioCueSerial||0)+1;},
    lightExtinguished(s){
      if(this.scene!=='parking')return;const light={...s,...P.lamps[s.kind],facing:s.facing||this.player.facing};if(this.isCarried(s))Object.assign(light,{x:this.player.x,y:this.player.y});
      const others=this.lightSources().filter(l=>l.lamp!==s);
      for(const z of this.zombies)if(z.hp>0&&z.kind!=='lurker'&&!['spitter','lamp_smasher'].includes(z.kind)&&this.litBy(z,light)&&!this.isLit(z,others)&&this.seconds>=(z.lightGraceNext||0)){z.lightGraceUntil=this.seconds+.8;z.lightGraceNext=this.seconds+10;}
    },
    updateLamps(dt){
      const flying=this.projectiles.filter(p=>p.kind==='lamp_flight').map(p=>p.lamp),all=[...this.inventory.filter(Boolean),...this.devices,...flying];
      for(const s of all){const d=P.lamps[s.kind];if(!d)continue;this.newLamp(s);
        if(this.isCarried(s)&&![this.heldLightId,this.headLightId].includes(s.lampId))continue;if(!s.active||s.hp<=0||s.energy<=0)continue;
        const before=s.energy;s.energy=Math.max(0,s.energy-dt);
        for(const [threshold,flag] of [[30,'warn30'],[10,'warn10']])if(!s[flag]&&before>threshold&&s.energy<=threshold){s[flag]=true;const p=this.isCarried(s)?this.player:Number.isFinite(s.x)?s:this.projectiles.find(p=>p.lamp===s)||this.player;this.parkingVisual('light_low_warning',p,.8,22);this.parkingCue(`${d.name}剩余${threshold}秒。`);}
        if(!s.energy){s.active=false;this.parkingCue(`${d.name}能源耗尽，光源熄灭！`);this.lightExtinguished(s);
          const p=this.isCarried(s)?this.player:Number.isFinite(s.x)?s:this.projectiles.find(p=>p.lamp===s)||this.player;this.parkingVisual('light_extinguish',p,.4,25);this.parkingVisual('light_empty_warning',p,.8,22);
          if(s.kind==='torch')this.effects.push({kind:'parking_lamp_fx',asset:'torch',state:'extinguishing',x:p.x,y:p.y,until:this.seconds+.4});
          if(s.kind==='torch'){if(this.isCarried(s))this.inventory[this.inventory.indexOf(s)]=null;else s.hp=0;if(this.heldLightId===s.lampId)this.heldLightId=null;}
        }
      }this._lights=this.lightSources();
      if(this.scene==='parking'){const boss=this.zombies.find(z=>z.kind==='lurker'&&z.hp>0&&z.state==='burrowed');if(boss&&this.isLit(boss))this.revealBoss(boss);}
    },
    dismantle(o){if(P.lamps[o?.kind]&&!P.lamps[o.kind].fixed){this.announce('便携灯请选择拿起，保留剩余能源。');return false;}return Base.prototype.dismantle.call(this,o);},
    repair(o){if(P.lamps[o?.kind])return o.kind!=='torch'&&o.hp>0&&o.hp<o.maxHP&&this.beginAction('lamp',1,{op:'repair',lampId:o.lampId||o.id,target:o.id});return Base.prototype.repair.call(this,o);},
    damageBuilding(o,n){
      if(o.indestructible||o.type==='parking'||o.type==='parking_solid')return;
      if(P.lamps[o.kind]&&o.hp>0&&n>=o.hp){
        this.parkingVisual('light_destroyed_warning',o,.8,24);
        if(o.active){o.active=false;this.parkingCue(`${P.lamps[o.kind].name}被毁，光源熄灭！`);this.lightExtinguished(o);}
        if(['torch','oil_lantern'].includes(o.kind))this.effects.push({kind:'parking_lamp_fx',asset:o.kind==='torch'?'torch':'fuel_lantern',state:o.kind==='torch'?'extinguishing':'broken',x:o.x,y:o.y,until:this.seconds+.6});
        else this.effects.push({kind:'parking_lamp_fx',asset:o.kind==='fixed_oil_lamp'?'fixed_fuel_light':o.kind,state:P.lamps[o.kind].fixed?'destroyed':'broken',x:o.x,y:o.y,until:this.seconds+.6});
      }
      Base.prototype.damageBuilding.call(this,o,n);this._lights=null;
    },
    updateProjectiles(dt){
      const lamps=this.projectiles.filter(p=>p.kind==='lamp_flight');this.projectiles=this.projectiles.filter(p=>p.kind!=='lamp_flight');Base.prototype.updateProjectiles.call(this,dt);
      for(const shot of lamps){
        const before={x:shot.x,y:shot.y};shot.elapsed=Math.min(.5,shot.elapsed+dt);const next=this.molotovPoint(shot,shot.elapsed/.5),hit=this.obstacles(before,next,.15).length;
        if(hit||shot.elapsed>=.5)this.groundLamp(shot.lamp,hit?before:next);else{Object.assign(shot,next);this.projectiles.push(shot);}
      }this._lights=this.lightSources();
      if(this.scene==='parking'){const boss=this.zombies.find(z=>z.kind==='lurker'&&z.hp>0&&z.state==='burrowed');if(boss&&this.isLit(boss))this.revealBoss(boss);}
    }
  });
  if(common)module.exports=S;
})(typeof globalThis!=='undefined'?globalThis:this);
