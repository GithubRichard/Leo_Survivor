/* A unique run key and a real two-leaf gate in the shared surface world. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,{dist,segmentHits}=S;
  const CARD='armory:west_keycard',READER='armory:west_reader:',SPAN=.36;
  class WestGateGame extends Base{
    westHost(){return this.scene==='parking'?this.surfaceState:this;}
    westCenter(){const a=this.armory;return a?.worldIntegrated?{x:a.origin.x,y:a.origin.y+75}:null;}
    westReaders(){const c=this.westCenter();if(!c)return [];const key=c.x+','+c.y;if(this._westReadersKey!==key){this._westReadersKey=key;this._westReaders=['outside','inside'].map((side,i)=>({id:READER+side,kind:'west_gate_reader',type:'armory',side,x:c.x+(i?.55:-.55),y:c.y+1.65,hp:1,indestructible:true}));}return this._westReaders;}
    ensureWestGate(){
      const a=this.armory,c=this.westCenter();if(!c)return;
      const fresh=!a.westGate;
      if(fresh)a.westGate={version:1,owned:false,dropSpawned:false,card:null,phase:'closed',pose:0,remaining:0,animation:0};
      const g=a.westGate;if(g.closePolicy!==2){g.remaining=Math.max(0,Math.min(3,g.remaining||0));g.closePolicy=2;this.autosaveRequested=true;}if(!g.owned&&g.phase!=='closed'){g.phase='closed';g.pose=0;g.remaining=0;}
      this.installWestGateSolids();
      if(fresh){this.migrateWestOccupants();this.autosaveRequested=true;}
      if(!g.owned&&!g.dropSpawned&&(a.bossDead||a.rewardClaimed||a.points.some(o=>o.kind==='armory_briefcase')||a.deadIds.includes('armory:sweeper'))){
        const origin=a.points.find(o=>o.kind==='armory_briefcase')||a.boss?.home||{x:a.origin.x+150,y:a.origin.y+67};this.dropWestKeycard(origin);
      }
    }
    integrateArmory(){super.integrateArmory();this.ensureWestGate();}
    westLeaf(side,pose=this.armory.westGate.pose){const c=this.westCenter(),angle=pose*Math.PI/6,sign=side==='north'?1:-1,hinge={x:c.x,y:c.y-sign*2};return {hinge,tip:{x:hinge.x+2*Math.sin(angle),y:hinge.y+sign*2*Math.cos(angle)}};}
    installWestGateSolids(){
      const a=this.armory,c=this.westCenter(),pose=a.westGate.pose,key=c.x+','+c.y+':'+pose;
      if(this._westSolidsKey===key)return;
      const solids=[],add=(id,x,y,w,h)=>solids.push({id:'armory:west-solid:'+id,type:'armory_solid',kind:'west_gate',westGateSolid:true,x,y,w,h,hp:1,maxHP:1,indestructible:true});
      for(const side of ['north','south']){const {hinge,tip}=this.westLeaf(side);add('post:'+side,c.x,c.y+(side==='north'?-2.35:2.35),.5,.5);for(let i=0;i<8;i++)add(side+':'+i,hinge.x+(tip.x-hinge.x)*(i+.5)/8,hinge.y+(tip.y-hinge.y)*(i+.5)/8,Math.abs(tip.x-hinge.x)/8+.14,Math.abs(tip.y-hinge.y)/8+.14);}
      a.objects=a.objects.filter(o=>!o.westGateSolid);a.objects.push(...solids);this._westSolidsKey=key;this._armoryIndex=null;this.navigationChanged();
    }
    blocksVision(o){return o.westGateSolid||super.blocksVision(o);}
    damageBuilding(o,n){if(o.westGateSolid||o.id===CARD)return;return super.damageBuilding(o,n);}
    westActors(){const host=this.westHost();if(!host)return [];const player=this.scene==='parking'?host.position:this.player;return [player,...host.zombies.filter(z=>z.hp>0&&!z.boneType),...host.visitors,...(this.camp?.npcs||[])].filter(Boolean);}
    westOccupied(){const c=this.westCenter();return this.westActors().some(o=>Math.abs(o.x-(c.x+1))<1.65+(o.radius||.24)&&Math.abs(o.y-c.y)<2.35+(o.radius||.24));}
    westFree(p,padding=.3){
      if(this.scene!=='parking')return this.withScene('surface',()=>!this.obstacles(p,p,padding).length);
      const host=this.westHost();if(!host)return false;
      const devices=this.devices,deviceCache=this._collisionDevices,homeCache=this._collisionHomes;
      // Query the frozen surface, restoring the live underground collision caches even on error.
      this.devices=host.devices;this._collisionDevices=null;this._collisionHomes=new WeakMap();
      try{return this.withScene('surface',()=>!this.obstacles(p,p,padding).length);}
      finally{this.devices=devices;this._collisionDevices=deviceCache;this._collisionHomes=homeCache;}
    }
    migrateWestOccupants(){
      const c=this.westCenter(),solids=this.armory.objects.filter(o=>o.westGateSolid);
      for(const actor of this.westActors()){
        if(!solids.some(o=>segmentHits(actor,actor,o,.25)))continue;
        const side=actor.x<c.x?-1:1;let spot=null;
        for(let n=0;n<257;n++){const r=n?Math.ceil(n/16)*.5:0,angle=n*Math.PI/8,q={x:c.x+side*.8+Math.cos(angle)*r,y:actor.y+Math.sin(angle)*r};if((q.x-c.x)*side<.55||!this.westFree(q)||this.westActors().some(o=>o!==actor&&dist(o,q)<.6))continue;spot=q;break;}
        if(spot){Object.assign(actor,spot);if(actor===this.player){actor.running=false;actor.indoorHome=null;}this.autosaveRequested=true;}
      }
    }
    dropWestKeycard(origin){
      const g=this.armory?.westGate;if(!g||g.owned||g.dropSpawned)return;
      g.dropSpawned=true;g.dropPending=true;g.dropOrigin={x:origin.x,y:origin.y};this.placeWestKeycard();this.autosaveRequested=true;
    }
    placeWestKeycard(){
      const g=this.armory?.westGate;if(!g?.dropPending||g.owned)return;
      for(let n=0;n<513;n++){const r=n?Math.ceil(n/24)*.5:0,angle=n*Math.PI/12,p={x:g.dropOrigin.x+Math.cos(angle)*r,y:g.dropOrigin.y+Math.sin(angle)*r};
        if(!this.westFree(p,.45)||this.armory.objects.some(o=>o.hp>0&&segmentHits(p,p,o,.45))||this.armory.points.some(o=>dist(o,p)<.7))continue;
        g.card={id:CARD,itemId:'armory_west_keycard',kind:'west_keycard',type:'armory',hp:1,indestructible:true,...p};g.dropPending=false;this.autosaveRequested=true;return;
      }
    }
    damageZombie(z,n,source){const alive=z.kind==='sweeper'&&z.hp>0;super.damageZombie(z,n,source);if(alive&&z.hp<=0){this.ensureWestGate();this.dropWestKeycard(z);}}
    find(id){const g=this.armory?.westGate;if(g){if(id===CARD)return !g.owned?g.card:null;const reader=this.westReaders().find(o=>o.id===id);if(reader)return reader;}return super.find(id);}
    westAccessible(o){return this.scene==='surface'&&this.find(o.id)===o&&dist(this.player,o)<1.8&&this.clearLine(this.player,o,o);}
    nearbyInteraction(){
      const current=super.nearbyInteraction(),g=this.armory?.westGate;if(this.scene!=='surface'||!g)return current;
      const points=[...this.westReaders(),...(!g.owned&&g.card?[g.card]:[])],choices=points.filter(o=>this.westAccessible(o)).map(object=>({type:'armory',object,distance:dist(this.player,object)}));
      if(current)choices.push(current);return choices.sort((a,b)=>a.distance-b.distance)[0]||null;
    }
    interact(target){
      const o=target?.object;if(!['west_keycard','west_gate_reader'].includes(o?.kind))return super.interact(target);
      if(this.result||this.action||!this.westAccessible(o))return false;
      if(o.kind==='west_gate_reader'&&!this.armory.westGate.owned){this.announce('需要西部大门钥匙卡：击败扫荡者后拾取，南侧主入口仍可撤退。');return false;}
      return this.beginAction('west_gate',o.kind==='west_keycard'?2:1,{target:o.id,operation:o.kind});
    }
    actionDuration(type,duration,data){return type==='west_gate'?duration:super.actionDuration(type,duration,data);}
    updateAction(dt){
      const a=this.action;if(a?.type!=='west_gate')return super.updateAction(dt);
      const o=this.find(a.target);if(!o||!this.westAccessible(o)||dist(this.player,a.start)>.025){this.cancelAction('移动或遮挡中断了西门操作。');return;}
      a.elapsed+=dt;if(a.elapsed+1e-8>=a.duration)this._westReady=a;
    }
    finishWestAction(a){
      const o=this.find(a.target);if(this.action!==a||this.result||!o||!this.westAccessible(o)||dist(this.player,a.start)>.025)return;
      const g=this.armory.westGate;this.action=null;
      if(a.operation==='west_keycard'){if(g.owned||g.card!==o)return;g.owned=true;g.card=null;g.dropPending=false;this.announce('获得西部大门钥匙卡：本局永久保留，不占背包，刷卡不消耗。');}
      else if(g.owned){g.phase=g.pose===3?'open':'opening';g.animation=g.pose/3*SPAN;g.remaining=3;g.lastTick=this.seconds;this.announce('西门刷卡通过，完全打开后3秒自动关闭；门口有生物时延迟关闭。');}
      this.autosaveRequested=true;
    }
    updateDoors(){super.updateDoors();if(this.scene==='surface'&&this.armory?.westGate)this.updateWestDoor();}
    updateWestDoor(){
      const g=this.armory.westGate,dt=Math.max(0,this.seconds-(g.lastTick??this.seconds)),before=g.pose;g.lastTick=this.seconds;
      if(g.phase==='open'){g.remaining=Math.max(0,g.remaining-dt);if(g.remaining===0&&!this.westOccupied()){g.phase='closing';g.animation=0;}}
      else if(g.phase==='opening'){g.animation=Math.min(SPAN,g.animation+dt);g.pose=Math.min(3,Math.floor((g.animation+1e-8)/SPAN*3));if(g.pose===3){g.phase='open';g.animation=0;}}
      else if(g.phase==='closing'){
        if(this.westOccupied()){g.phase='open';g.pose=3;g.remaining=0;g.animation=0;}
        else{g.animation=Math.min(SPAN,g.animation+dt);g.pose=Math.max(0,3-Math.floor((g.animation+1e-8)/SPAN*3));if(g.pose===0){g.phase='closed';g.animation=0;}}
      }
      if(g.pose!==before){this.installWestGateSolids();this.autosaveRequested=true;}
    }
    canPlace(kind,p){const c=this.westCenter(),card=this.armory?.westGate?.card;if(p&&c&&(Math.abs(p.x-(c.x+1))<2&&Math.abs(p.y-c.y)<3||card&&dist(card,p)<1))return '请保留西门开合通道和钥匙卡拾取位置';return super.canPlace(kind,p);}
    switchScene(){if(this.action?.type==='west_gate')this.cancelAction('切换场景取消了西门操作。');return super.switchScene();}
    step(dt,input={}){this._westReady=null;this.ensureWestGate();super.step(dt,input);if(!this.result&&this._westReady)this.finishWestAction(this._westReady);this._westReady=null;
      const g=this.armory?.westGate;if(this.scene==='surface'&&g?.dropPending&&this.seconds>=(this._westDropAt||0)){this._westDropAt=this.seconds+1;this.placeWestKeycard();}}
    snapshot(){const d=super.snapshot();if(d.armory?.westGate)delete d.armory.westGate.lastTick;d.westGatePendingAction=this.action?.type==='west_gate';return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,WestGateGame.prototype);g.ensureWestGate();if(g.armory?.westGate)g.armory.westGate.lastTick=g.westHost().seconds;if(d.westGatePendingAction)g.announce('上次未完成的拾卡或刷卡已取消，钥匙卡与门状态保留。');return g;}
  }
  S.Game=WestGateGame;
})(globalThis);
