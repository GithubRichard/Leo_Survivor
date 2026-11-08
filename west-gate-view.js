/* Native transparent layers mapped onto this engine's fixed isometric camera. */
(() => {
  'use strict';const A=GameArt,ART=WEST_GATE_ART;
  const sprite=(ctx,id,state,q,height)=>A.worldSprite(ctx,'west_'+id,state,q.x,q.y,height);
  const icon=(size=24)=>A.worldIcon('west_armory_west_keycard','item',size);
  function context(game,target){
    const o=target?.object,g=game.armory?.westGate;if(!g||!['west_keycard','west_gate_reader'].includes(o?.kind))return null;
    const key=o.kind==='west_keycard';return `<div class="eyebrow">军备库 · 西部大门</div><h2>${icon()}${key?'西部大门钥匙卡':'西门读卡器'}</h2><p>${key?'拾取2秒，移动或受伤取消；不占背包格，本局永久保留，刷卡不消耗。':g.owned?'已持卡。刷卡1秒，完全打开3秒后自动关闭，通道有生物时延迟关闭；两侧使用同一权限。':'需要击败扫荡者并拾取钥匙卡；南门首次须乘突击车撞开，撞开后可自由步行进出。'}</p><button data-command="armory-interact" ${!key&&!g.owned?'disabled':''}>${key?'拾取钥匙卡':'刷卡开门'}</button><button data-key="escape">返回游戏</button>`;
  }
  function inventoryExtras(game){return game.armory?.westGate?.owned?`<p class="key-items">${icon()}关键物品：西部大门钥匙卡 · 永久持有 · 不占格、不消耗</p>`:'';}
  function surface(game,v){
    const g=game.armory?.westGate;if(game.scene!=='surface'||!g)return;
    const {ctx,project,scale,items}=v,c=game.westCenter(),q=project(c.x,c.y),gateVisible=q.x>=-scale*8&&q.x<=v.width+scale*8&&q.y>=-scale*8&&q.y<=v.height+scale*8;
    // The game's south vector points down-left; affine registration keeps Z vertical.
    if(gateVisible){
    for(const side of ['north','south']){
      const post={x:c.x,y:c.y+(side==='north'?-2.35:2.35)},p=project(post.x,post.y);
      items.push({depth:post.x+post.y+.04,draw:()=>{if(!sprite(ctx,'west_gate_posts',side+'_outside',p,2.3*scale))v.box({...post,w:.5,h:.5},2.3,'#9a854c','#454b43','#54584b');}});
      const {hinge,tip}=game.westLeaf(side),asset='west_gate_leaf_'+side+'_outside',state='angle_'+g.pose*30,meta=ART.frames[ART.assets['west_'+asset].states[state]],h=project(hinge.x,hinge.y),t=project(tip.x,tip.y),top=project(hinge.x,hinge.y,2);
      items.push({depth:(hinge.x+hinge.y+tip.x+tip.y)/2+.03,draw:()=>{
        ctx.save();if(Math.abs(game.player.x-(hinge.x+tip.x)/2)<1.1&&Math.abs(game.player.y-(hinge.y+tip.y)/2)<1.1)ctx.globalAlpha=.5;
        if(!A.worldFrameSurface(ctx,'west_'+asset,state,meta.surfacePoints,[h,t,top])){ctx.fillStyle='#555b50';ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(t.x,t.y);ctx.lineTo(t.x,t.y-2*scale);ctx.lineTo(top.x,top.y);ctx.closePath();ctx.fill();}ctx.restore();
      }});
    }
    for(const reader of game.westReaders()){
      const p=project(reader.x,reader.y,1.2),state=reader.side+'_'+(g.phase!=='closed'?'accepted':g.owned?'ready':'locked');
      items.push({depth:reader.x+reader.y+.08,draw:()=>sprite(ctx,'west_gate_readers',state,p,.4*scale)});
    }
    }
    if(g.card&&!g.owned){const card=g.card,p=project(card.x,card.y);items.push({depth:card.x+card.y+.06,draw:()=>sprite(ctx,'west_keycard_pickup',Survival.dist(card,game.player)<1.8?'highlight':'idle',p,.32*scale)});}
  }
  window.WestGateView={context,inventoryExtras,surface,icon};
})();
