/* Sound events follow successful game actions; no footsteps or saved audio queue. */
(function(root){
  const S=root.Survival,Base=S.Game;
  class FeedbackGame extends Base{
    sound(kind,p=this.player){if(S.dist(p,this.player)>22)return;const q=this.soundEvents||(this.soundEvents=[]);if(q.length<32)q.push({kind,volume:Math.max(.15,1-S.dist(p,this.player)/25)});}
    pay(cost={},gain={}){const ok=super.pay(cost,gain);if(ok&&this._soundAction){const kind={craft:'craft',build:'build',repair:'repair',upgrade:'build',search:'pickup'}[this._soundAction];if(kind)this.sound(kind);}return ok;}
    updateAction(dt){const before=this._soundAction,a=this.action,o=a?.type==='dismantle'?this.find(a.target):null,alive=o?.hp>0;this._soundAction=a?.type;try{const result=super.updateAction(dt);if(alive&&o.hp<=0)this.sound('dismantle',o);return result;}finally{this._soundAction=before;}}
    healPlayer(n){const hp=this.player.hp;super.healPlayer(n);if(this.player.hp>hp)this.sound('heal');}
    damagePlayer(...args){const hit=super.damagePlayer(...args);if(hit)this.sound('hurt');return hit;}
    rescueAED(...args){const ok=super.rescueAED(...args);if(ok)this.sound('aed');return ok;}
    damageZombie(z,n,source){const hp=z.hp;super.damageZombie(z,n,source);if(z.hp<hp&&source==='weapon')this.sound('impact',z);}
    emitThermal(actor,weapon,...args){const shot=super.emitThermal(actor,weapon,...args);this.sound(weapon==='rocket_launcher'?'rocket':'gun',actor);return shot;}
    thermalImpact(shot,...args){super.thermalImpact(shot,...args);if(shot.weapon==='rocket_launcher')this.sound('explosion',shot);}
    updatePlayerAttack(){const a=this.playerAttack,was=a?.released;super.updatePlayerAttack();if(a&&!a.thermal&&!was&&a.released)this.sound(a.kind==='ranged'?'bow':a.kind==='throw'?'throw':'swing');}
    igniteMolotov(shot){super.igniteMolotov(shot);this.sound('ignite',shot);}
    interact(target){const ok=super.interact(target);if(ok&&target?.type==='drop')this.sound('pickup');return ok;}
    updateDoors(){const doors=this.scene==='parking'?[]:[...this.homes.values()].flatMap(h=>h.doors).filter(o=>S.dist(o,this.player)<5),states=doors.map(o=>o.open);super.updateDoors();doors.forEach((o,i)=>{if(o.open!==states[i])this.sound('door',o);});}
    static restore(data){const game=Base.restore(data);Object.setPrototypeOf(game,FeedbackGame.prototype);game.soundEvents=[];return game;}
  }
  S.Game=FeedbackGame;
})(globalThis);
