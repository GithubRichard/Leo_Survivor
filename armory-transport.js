/* The armory stays in the surface world; entry is an atomic vehicle trip. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,{dist,pointRect,segmentHits}=S;
  class ArmoryTransportGame extends Base{
    carSize(){return root.ASSAULT_CAR_ART?.footprint||{w:2.2,h:3.8};}
    ensurePerimeter(){
      const a=this.armory;if(!a?.worldIntegrated)return;const initial=a.perimeterVersion!==1,now=this.westHost()?.seconds??this.seconds;
      if(!initial&&(!a.perimeterRelocationPending||now<(this._perimeterRetry||0)))return;
      const fences=a.objects.filter(o=>o.kind==='fence'&&o.id?.startsWith('armory:fence:')),repaired=initial?fences.filter(o=>o.hp<=0):fences;
      if(initial){for(const o of fences){o.indestructible=true;o.maxHP=10;o.hp=10;}a.perimeterVersion=1;this.navigationChanged();this.autosaveRequested=true;}
      // Preserve old occupants when restoring a destroyed boundary segment.
      const pendingBefore=!!a.perimeterRelocationPending;a.perimeterRelocationPending=false;if(!repaired.length)return;const actors=this.westActors();
      for(const actor of actors){if(!repaired.some(o=>segmentHits(actor,actor,o,.25)))continue;const inside=this.inArmory(actor);
        let spot=null;for(let i=1;i<=512;i++){const r=Math.ceil(i/16)*.5,angle=i*Math.PI/8,q={x:actor.x+Math.cos(angle)*r,y:actor.y+Math.sin(angle)*r};
          if(this.inArmory(q)!==inside||!this.westFree(q)||actors.some(o=>o!==actor&&dist(o,q)<.6))continue;spot=q;break;}
        if(spot){Object.assign(actor,spot,{running:false,indoorHome:null});if(actor.path){actor.path=[];actor.repathAt=this.westHost().seconds;}this.autosaveRequested=true;}else a.perimeterRelocationPending=true;
      }
      this._perimeterRetry=now+1;if(pendingBefore!==a.perimeterRelocationPending)this.autosaveRequested=true;
    }
    ensureDepartureSign(){
      const a=this.armory;if(!a?.worldIntegrated||a.departureSign||this.scene!=='surface'||this.seconds<(this._departureRetry||0))return;
      let job=this._departurePlacement;
      if(!job){const sites=[];for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++){const p={x:14+x*28,y:14+y*28,w:3,h:3},d=S.Camp.distanceFromTerritory(p);if(d>=180&&d<=260&&pointRect(p,a.bounds)>=50)sites.push(p);}sites.sort((p,q)=>dist(p,a.entrance)-dist(q,a.entrance)||p.x-q.x||p.y-q.y);job=this._departurePlacement={sites,cursor:0};}
      if(job.route){this.advanceCampRoute(job.route,90);if(!job.route.done)return;if(job.route.path){a.departureSign={...job.candidate,id:'armory:departure-sign',kind:'armory_departure_sign',type:'armory',hp:1,indestructible:true};this._departurePlacement=null;this.autosaveRequested=true;this.announce('原出发路牌已补回，地图可查看；乘车返回会到远处路牌旁。');return;}job.route=null;}
      for(let i=0;i<2&&job.cursor<job.sites.length;i++){const p=job.sites[job.cursor++];if(this.obstacles(p,p,2).length||this.devices.some(o=>o.hp>0&&dist(o,p)<4)||this.drops.some(o=>dist(o,p)<3)||this.camp?.position&&pointRect(p,this.camp.position)<5||this.parking&&dist(p,this.parking.entrance)<10)continue;job.candidate=p;job.route=this.makeCampRoute({x:0,y:5},[p],true);return;}
      if(job.cursor>=job.sites.length){this._departurePlacement=null;this._departureRetry=this.seconds+15;}
    }
    ensureSouthBreach(){
      const a=this.armory;if(!a?.worldIntegrated||a.southBreach)return;
      a.southBreach={version:1,breached:(a.transport?.trips||0)>0};this.autosaveRequested=true;
    }
    southGate(){
      const a=this.armory;if(!a?.worldIntegrated||a.southBreach?.breached)return null;
      return Object.assign(this._southGate||(this._southGate={}),{...a.entrance,id:'armory:south-ram-gate',kind:'south_ram_gate',type:'armory_solid',w:6,h:.3,hp:1,maxHP:1,indestructible:true});
    }
    vehicleBayClear(p,inside){
      const c={...p,...this.carSize()},b=this.armory.bounds,pad=.35;
      const overlap=o=>Math.abs(o.x-c.x)<(c.w+(o.w||.5))/2+pad&&Math.abs(o.y-c.y)<(c.h+(o.h||.5))/2+pad;
      const corners=[-1,1].flatMap(x=>[-1,1].map(y=>({x:c.x+x*(c.w/2+pad),y:c.y+y*(c.h/2+pad)})));
      if(corners.some(q=>(pointRect(q,b)===0)!==inside))return false;
      // A broad query covers the entire footprint, then full rectangle overlap rejects thin walls too.
      const radius=Math.max(c.w,c.h)/2+pad;
      const gate=this.southGate();if(gate&&overlap(gate))return false;
      if(super.obstacles(c,c,radius).some(overlap)||this.devices.some(o=>o.hp>0&&overlap(o)))return false;
      if(this.zombies.some(z=>z.hp>0&&pointRect(z,c)<.7)||this.drops.some(o=>pointRect(o,c)<.4))return false;
      return pointRect(this.player,c)>=.6;
    }
    transportSpot(center,inside){
      for(let i=0;i<145;i++){
        const r=i?Math.ceil(i/12)*.8:0,angle=i*Math.PI/6,p={x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r};
        if(!this.vehicleBayClear(p,inside))continue;
        return p;
      }return null;
    }
    ensureTransport(){
      const a=this.armory;if(!a?.worldIntegrated||!a.departureSign||a.transport?.version>=2||this.scene!=='surface'||this.seconds<(this._transportRetry||0))return;
      this._transportRetry=this.seconds+5;
      const outside=this.transportSpot({x:a.departureSign.x+6,y:a.departureSign.y+5},false),inside=a.transport?.inside||this.transportSpot({x:a.entrance.x+6,y:a.entrance.y-9},true);
      if(!outside||!inside)return;
      if(a.transport){a.transport.outside=outside;a.transport.version=2;a.transport.departureRequested=false;}else{
        const legacyInside=this.inArmory();a.transport={version:2,quarters:0,side:legacyInside?'inside':'outside',outside,inside,returnPaid:legacyInside,departureRequested:false,trips:0};
      }
      this.navigationChanged();this.autosaveRequested=true;
    }
    assaultCar(){const t=this.armory?.transport;if(!t||(t.version||0)<2)return null;const c=this._transportCar||(this._transportCar={});return Object.assign(c,t[t.side],this.carSize(),{id:'armory:assault-car',kind:'assault_car',type:'armory_vehicle',hp:1,maxHP:1,indestructible:true});}
    carAccess(){const c=this.assaultCar();return c?pointRect(this.player,c):Infinity;}
    canUseCar(){const c=this.assaultCar();return this.scene==='surface'&&!this.result&&c&&this.carAccess()<1.8&&this.clearLine(this.player,c,c);}
    find(id){return id==='armory:departure-sign'?this.armory?.departureSign:id==='armory:assault-car'?this.assaultCar():id==='armory:south-ram-gate'?this.southGate():super.find(id);}
    blocksVision(o){return o.type==='armory_vehicle'||o.kind==='south_ram_gate'||super.blocksVision(o);}
    damageBuilding(o,n){if(o.type==='armory_vehicle'||o.kind==='south_ram_gate')return;return super.damageBuilding(o,n);}
    obstacles(a,b=a,padding=.22){
      const out=super.obstacles(a,b,padding);if(!this.armoryWorldActive)return out;const c=this.assaultCar();
      if(padding>0&&(a.x!==b.x||a.y!==b.y)&&this.inArmory(a)===this.inArmory(b)&&(a===this.player||this.zombies.includes(a)||this.visitors.includes(a)||this.camp?.npcs?.includes(a))){
        for(let i=out.length-1;i>=0;i--){const o=out[i];if(o.kind!=='fence'||!o.id?.startsWith('armory:fence:')||!segmentHits(a,a,o,padding))continue;
          const axis=o.w>o.h?'y':'x',before=a[axis]-o[axis],after=b[axis]-o[axis];if(before*after>=0&&Math.abs(after)+1e-10>=Math.abs(before))out.splice(i,1);
        }
      }
      if(c&&segmentHits(a,b,c,padding))out.push(c);
      const gate=this.southGate();if(gate&&segmentHits(a,b,gate,padding)){
        // An old save can stand in the newly installed gate. Allow retreat from it, never crossing through it.
        const retreat=padding>0&&segmentHits(a,a,gate,padding)&&Math.abs(b.y-gate.y)>Math.abs(a.y-gate.y)+1e-8;
        if(!retreat)out.push(gate);
      }
      if(!this.armory.southBreach?.breached&&!this.developer?.enabled&&a===this.player&&padding===.22&&(a.x!==b.x||a.y!==b.y)&&this.inArmory(a)!==this.inArmory(b)){
        out.push({id:'armory:vehicle-access-boundary',type:'vehicle_boundary',indestructible:true,hp:1,x:b.x,y:b.y,w:.1,h:.1});
        if(this.seconds>=(this._transportHintAt||0)){this._transportHintAt=this.seconds+3;this.announce(this.inArmory(a)?'南门尚未撞开，可乘突击车返回，返程已包含在本次油耗中。':'首次须乘突击车撞开南侧大门，撞开后即可步行进出。');}
      }return out;
    }
    canPlace(kind,p){if(!this.armoryWorldActive)return super.canPlace(kind,p);const c=this.assaultCar(),t=this.armory?.transport,gate=this.southGate(),sign=this.armory.departureSign;if(sign&&p&&pointRect(p,sign)<2)return '请保留原出发路牌与乘车通道';if(gate&&p&&pointRect(p,gate)<2)return '请保留突击车撞门通道';if(c&&p&&(pointRect(p,c)<1.2||[t.outside,t.inside].some(q=>dist(q,p)<4)))return '请保留突击车停放和上下车空间';return super.canPlace(kind,p);}
    nearbyInteraction(){let current=super.nearbyInteraction();const c=this.assaultCar(),sign=this.armory?.departureSign;if(this.scene==='surface'&&sign&&dist(sign,this.player)<1.8&&this.clearLine(this.player,sign)&&(!current||dist(sign,this.player)<=current.distance))current={type:'armory',object:sign,distance:dist(sign,this.player)};if(this.canUseCar()&&(!current||this.carAccess()<current.distance))return {type:'armory',object:c,distance:this.carAccess()};return current;}
    carAction(operation){
      if(!this.canUseCar()||this.action||this.playerAttack)return false;const t=this.armory.transport;
      if(operation==='refuel'){const amount=4-t.quarters;if(amount<=0){this.announce('油箱已满：1升。');return false;}if(this.count('fuel_oil')<amount){this.announce(`加满还需要${amount}份汽车燃油（每份0.25升）。`);return false;}return this.beginAction('vehicle_refuel',2,{target:'armory:assault-car',amount});}
      if(operation==='drive'&&t.side==='outside'){if(t.quarters!==4){this.announce('出发需要满油1升，先为突击车加油。');return false;}if(!root.AssaultCarView?.ready()){this.announce('车辆素材正在载入，请稍候。');return false;}return this.beginAction('vehicle_depart',1,{target:'armory:assault-car'});}
      if(operation==='return'&&t.side==='inside'&&t.returnPaid)return this.beginAction('vehicle_return',1,{target:'armory:assault-car'});return false;
    }
    interact(target){if(target?.object?.kind==='assault_car')return this.carAction(this.armory.transport.side==='inside'?'return':'drive');return super.interact(target);}
    updateAction(dt){
      const a=this.action;if(!a||!['vehicle_refuel','vehicle_depart','vehicle_return'].includes(a.type))return super.updateAction(dt);
      if(!this.canUseCar()||dist(this.player,a.start)>.025){this.cancelAction('移动或遮挡中断了车辆操作。');return;}a.elapsed+=dt;if(a.elapsed+1e-8>=a.duration)this._vehicleReady=a;
    }
    vehicleArrival(side,bay=this.armory.transport[side]){
      const c={...bay,...this.carSize()};
      for(let i=0;i<97;i++){const r=2.5+Math.floor(i/16)*.5,a=i*Math.PI/8,q={x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};
        if(this.inArmory(q)!==(side==='inside')||pointRect(q,c)<.5||this.obstacles(q,q,.3).length||this.zombies.some(z=>z.hp>0&&dist(z,q)<1.2))continue;return q;
      }return null;
    }
    finishVehicleAction(a){
      if(this.action!==a||!this.canUseCar()||dist(this.player,a.start)>.025)return;const t=this.armory.transport;this.action=null;
      if(a.type==='vehicle_refuel'){if(a.amount===4-t.quarters&&this.pay({fuel_oil:a.amount})){t.quarters=4;this.autosaveRequested=true;this.announce('已注入汽车燃油，油箱1升；每次往返消耗0.5升。');}return;}
      if(a.type==='vehicle_return'){if(t.side==='inside'&&t.returnPaid)this.completeVehicleTrip('outside');return;}
      if(t.side==='outside'&&t.quarters===4){t.departureRequested=true;this.autosaveRequested=true;}
    }
    completeVehicleTrip(side='inside'){
      const t=this.armory?.transport;if(!t||!this.canUseCar())return false;
      if(side==='inside'&&(t.side!=='outside'||t.quarters!==4||!t.departureRequested))return false;
      if(side==='outside'&&(t.side!=='inside'||!t.returnPaid))return false;
      const bay=this.vehicleBayClear(t[side],side==='inside')?t[side]:this.transportSpot(t[side],side==='inside'),arrival=bay&&this.vehicleArrival(side,bay);if(!arrival){t.departureRequested=false;this.autosaveRequested=true;this.announce('停车或下车位置被占用，本次未扣油，请清理后重试。');return false;}
      this.ensureSouthBreach();const firstBreach=side==='inside'&&!this.armory.southBreach.breached;
      if(side==='inside'){t.quarters-=2;t.returnPaid=true;t.trips++;this.armory.southBreach.breached=true;}else t.returnPaid=false;
      t[side]=bay;t.side=side;t.departureRequested=false;this.cancelAction();this.endStealth();this.cancelBoneCharge();this.stopAutomaticFire();this.playerAttack=null;
      Object.assign(this.player,arrival,{running:false,indoorHome:null});this.armory.playerInside=side==='inside';if(side==='outside')this.resetWorldBoss();
      this._pathJobs=new Map();this._pathQueue=[];this._flowCache=new Map();this.navigationChanged();this.updateIndoorHome();this.autosaveRequested=true;
      this.announce(side==='inside'?(firstBreach?'突击车已撞开南门！此后可步行进出。消耗0.5升，乘车返程无需额外燃油。':'已抵达军备区，消耗0.5升；可步行进出，乘车返程无需额外燃油。'):'已返回原来的远处出发路牌旁，返程未重复扣油。');return true;
    }
    step(dt,input={}){if(this.checkPlayerDeath()||this.result)return;if(this.armory?.transport?.departureRequested)return;this.ensurePerimeter();this.ensureSouthBreach();this.ensureDepartureSign();this.ensureTransport();this._vehicleReady=null;super.step(dt,input);if(!this.result&&this._vehicleReady)this.finishVehicleAction(this._vehicleReady);this._vehicleReady=null;}
    static restore(data){const g=Base.restore(data);Object.setPrototypeOf(g,ArmoryTransportGame.prototype);g.ensurePerimeter();g.ensureSouthBreach();g.ensureDepartureSign();g.ensureTransport();if(g.armory?.transport)g.armory.transport.departureRequested=false;return g;}
  }
  S.Game=ArmoryTransportGame;
})(globalThis);
