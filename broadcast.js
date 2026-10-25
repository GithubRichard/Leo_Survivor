/* Home television and opening progress; audio devices remain in the browser UI. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,{dist,pointRect}=S;
  const voice={"war":{"file":"en/war.mp3","duration":5.472,"text":"2026年，因为一场化学战争，导致丧尸病毒泄露。","speech":"In 2026, chemical warfare caused the release of a zombie virus."},"famine":{"file":"en/famine.mp3","duration":5.52,"text":"病毒蔓延，接连导致饥荒、人口稀少等问题。","speech":"The outbreak spread, bringing famine and a devastating decline in population."},"depots":{"file":"en/depots.mp3","duration":7.704,"text":"政府为保存剩余人力，修建了粮食库、军备库等建筑。","speech":"To protect the remaining population, the government has built food depots, armories, and other emergency facilities."},"stay-home":{"file":"en/stay-home.mp3","duration":5.616,"text":"请广大居民待在家中，不要出门……","speech":"All residents are urged to remain at home. Do not go outside."},"resolve":{"file":"en/resolve-andrew.mp3","duration":1.968,"text":"呃……我得做点什么。","speech":"Ugh... I have to do something."},"camp":{"file":"en/camp.mp3","duration":4.704,"text":"请存活的人们，前往距离最近的幸存者营地。","speech":"To all survivors: please make your way to the nearest survivor camp."}};
  class BroadcastGame extends Base{
    constructor(options={}){super(options);this.broadcast={version:1,introDone:false,campHeard:false,television:null};this.audioEvents=[];this.ensureTelevision();}
    ensureTelevision(){
      const b=this.broadcast,h=this.getHome(0,0);if(b.television)return;
      const spots=[{x:1.5,y:-5.1},{x:-1.6,y:-5.1},{x:4.25,y:-3},{x:-4.25,y:-3}];
      const tv=spots.find(p=>![...h.objects,...h.sites,...(this.scene==='surface'?this.devices:this.surfaceState?.devices||[])].some(o=>o.hp>0&&pointRect(p,o)<.6))||spots[0];
      // Wall mounted: it cannot become an indestructible enemy/pathfinding target.
      b.television={...tv,id:'home:television',kind:'television',type:'television',w:1.2,h:.4,hp:1};
    }
    prepareOpening(){const t=this.broadcast.television;Object.assign(this.player,{x:t.x,y:t.y+1.25,facing:{x:0,y:-1},running:false});this.updateIndoorHome();this.cancelAction();this.playerAttack=null;}
    nearbyInteraction(){
      const current=super.nearbyInteraction(),t=this.broadcast?.television;
      if(this.scene==='surface'&&t&&this.player.indoorHome==='0,0'&&dist(t,this.player)<1.85&&this.clearVision(this.player,t)&&(!current||dist(t,this.player)<current.distance))return {type:'television',object:t,distance:dist(t,this.player)};
      return current;
    }
    interact(target){
      if(target?.type!=='television')return super.interact(target);
      const t=this.broadcast.television;if(this.scene!=='surface'||this.player.indoorHome!=='0,0'||dist(t,this.player)>=1.85||!this.clearVision(this.player,t)||this.action)return false;
      this.endStealth();const camp=this.day>=14;this.tvSession={kind:camp?'camp':'static',elapsed:0,duration:camp?voice.camp.duration+1.1:3.5};
      if(camp){this.broadcast.campHeard=true;this.autosaveRequested=true;}
      this.audioEvents.push({kind:'television',channel:this.tvSession.kind});return true;
    }
    canPlace(kind,p){const t=this.broadcast?.television;if(this.scene==='surface'&&t&&p&&pointRect(p,t)<.5)return '请保留电视机前的互动位置';return super.canPlace(kind,p);}
    updateAction(dt){
      const a=this.action,o=a?.target?this.find(a.target):null,closed=o&&!o.opened&&!o.searched;
      super.updateAction(dt);
      if(closed&&(o.opened||o.searched)&&['search','parking_search','parking_open','skeleton_open'].includes(a.type))this.audioEvents.push({kind:'container-open'});
    }
    snapshot(){const data=super.snapshot();data.broadcast=this.broadcast;return data;}
    static restore(data){
      const game=Base.restore(data);Object.setPrototypeOf(game,BroadcastGame.prototype);
      game.broadcast={version:1,introDone:true,campHeard:false,television:null,...data.broadcast};game.audioEvents=[];game.tvSession=null;game.ensureTelevision();return game;
    }
  }
  S.Game=BroadcastGame;S.BroadcastVoice=voice;
})(globalThis);
