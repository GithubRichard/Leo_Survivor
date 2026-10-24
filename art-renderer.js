/* 直接使用美术PNG。图片与逻辑共用地面锚点，地砖只投影顶面。 */
(() => {
  const entries={...(window.GAME_ASSETS||{}),...(window.EXPANSION_ASSETS||{})},images={},failed=[],pending={};
  const animation=window.PLAYER_ANIMATION;
  const armed=window.WEAPON_ANIMATION,weaponCache=new Map();
  const parking=window.PARKING_ART,parkingCache=new Map(),parkingThumbs=new Map();let parkingRevision=0;
  Object.assign(entries,armed?.atlases||{});
  Object.assign(entries,parking?.atlases||{});
  for(const [name,meta] of Object.entries(parking?.masks||{}))entries['parking_mask_'+name]=meta;
  for(const frames of Object.values(animation?.frames||{}))for(const frame of frames)entries[frame.key]=frame;
  function keepWeaponAtlas(key){
    weaponCache.delete(key);weaponCache.set(key,true);
    while(weaponCache.size>12){const oldest=weaponCache.keys().next().value;weaponCache.delete(oldest);delete images[oldest];delete pending[oldest];}
  }
  function keepParkingAtlas(key){
    parkingCache.delete(key);parkingCache.set(key,true);
    const bytes=()=>[...parkingCache.keys()].reduce((n,k)=>n+(images[k]?.width||0)*(images[k]?.height||0)*4,0);
    while(parkingCache.size>36||bytes()>64*1024*1024){const oldest=parkingCache.keys().next().value;parkingCache.delete(oldest);delete images[oldest];delete pending[oldest];}
  }
  let ready=false;
  function load(key){
    if(pending[key])return pending[key];const data=entries[key];if(!data)return Promise.resolve();
    return pending[key]=new Promise(resolve=>{const img=new Image();images[key]=img;img.onload=()=>{
      const maxWidth=data.maxWidth||384;
      if(!/^house_|^yard_|^grass$|^road$|_(base|roof)$/.test(key)&&img.width>maxWidth){const small=document.createElement('canvas');small.width=maxWidth;small.height=Math.round(img.height*maxWidth/img.width);small.getContext('2d').drawImage(img,0,0,small.width,small.height);images[key]=small;}
      if(data.weaponAtlas)keepWeaponAtlas(key);
      if(data.parkingAtlas){keepParkingAtlas(key);parkingRevision++;}
      resolve();};img.onerror=()=>{failed.push(data.src);if(data.parkingAtlas)parkingRevision++;resolve();};img.src=data.src;});
  }
  const loading=Promise.all(Object.keys(entries).filter(key=>!entries[key].lazy).map(load)).then(()=>{ready=true;});
  function available(key){if(entries[key]&&!pending[key])load(key);const img=images[key],ready=Boolean(img&&(img instanceof HTMLCanvasElement||img.complete&&img.naturalWidth>0));if(ready&&entries[key]?.weaponAtlas)keepWeaponAtlas(key);if(ready&&entries[key]?.parkingAtlas)keepParkingAtlas(key);return ready;}
  function sprite(ctx,key,x,y,height,{width,flip=false,anchorY=1}={}){
    const alias=parking?.aliases[key];if(alias&&parkingSprite(ctx,...alias,x,y,height,{flip}))return true;
    if(!available(key))return false;
    const [l,t,r,b]=entries[key].crop,sw=r-l,sh=b-t,w=width||height*sw/sh;
    ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);
    const ratio=images[key].width/entries[key].size[0];ctx.drawImage(images[key],l*ratio,t*ratio,sw*ratio,sh*ratio,-w/2,-height*anchorY,w,height);ctx.restore();return true;
  }
  function animatedPlayer(ctx,facing,x,y,phase,height=50){
    if(!animation)return false;
    const sx=facing.x-facing.y,sy=(facing.x+facing.y)*.5;
    const sectors=['east','southeast','south','southwest','west','northwest','north','northeast'];
    const sector=(Math.round(Math.atan2(sy,sx)/(Math.PI/4))+8)%8;
    const dir=animation.frames[sectors[sector]]?sectors[sector]:direction(facing);
    const frames=animation.frames[dir];if(!frames)return false;
    const current=Math.floor(phase)%animation.order.length,next=(current+1)%animation.order.length;
    const frame=frames[animation.order[current]],following=frames[animation.order[next]];
    if(!available(frame.key)||!available(following.key))return false;
    // 最后20%帧时长做短过渡；在独立画布相加，避免人体重叠处变透明。
    const blend=Math.max(0,(phase-Math.floor(phase)-.8)/.2);
    const layer=animatedPlayer.layer||(animatedPlayer.layer=document.createElement('canvas'));
    if(layer.width!==160){layer.width=160;layer.height=100;}
    const c=layer.getContext('2d');c.clearRect(0,0,160,100);c.globalCompositeOperation='lighter';
    for(const [meta,alpha] of [[frame,1-blend],[following,blend]]){
      if(alpha<=0)continue;const ratio=height/meta.bodyHeight;
      c.globalAlpha=alpha;c.drawImage(images[meta.key],80-meta.pivot[0]*ratio,80-meta.pivot[1]*ratio,meta.size[0]*ratio,meta.size[1]*ratio);
    }
    c.globalAlpha=1;c.globalCompositeOperation='source-over';ctx.drawImage(layer,x-80,y-80);return true;
  }
  function eightDirection(facing={x:0,y:1}){const sx=facing.x-facing.y,sy=(facing.x+facing.y)*.5;return ['east','southeast','south','southwest','west','northwest','north','northeast'][(Math.round(Math.atan2(sy,sx)/(Math.PI/4))+8)%8];}
  function parkingFrameId(asset,state){
    const states=parking?.assets[asset]?.states;if(!states)return null;
    return state==null?(states.default||states.idle||states.off||Object.values(states)[0]):states[state]||null;
  }
  function drawParkingFrame(ctx,id,x,y,height,options={}){
    const meta=parking?.frames[id];if(!meta||!available(meta.atlas))return false;
    const img=images[meta.atlas],imageRatio=img.width/entries[meta.atlas].size[0],r=meta.rect,ratio=height/meta.bodyHeight;
    ctx.save();ctx.globalAlpha*=options.alpha??1;
    if(options.anchors&&options.dest){
      const m=affine(options.anchors.map(p=>({x:p[0]*r[2],y:p[1]*r[3]})),options.dest);
      ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(img,r[0]*imageRatio,r[1]*imageRatio,r[2]*imageRatio,r[3]*imageRatio,0,0,r[2],r[3]);ctx.restore();return true;
    }
    ctx.translate(x,y);if(options.flip)ctx.scale(-1,1);
    ctx.drawImage(img,r[0]*imageRatio,r[1]*imageRatio,r[2]*imageRatio,r[3]*imageRatio,-meta.pivot[0]*ratio,-meta.pivot[1]*ratio,r[2]*ratio,r[3]*ratio);ctx.restore();return true;
  }
  function parkingSprite(ctx,asset,state,x,y,height,options={}){return drawParkingFrame(ctx,parkingFrameId(asset,state),x,y,height,options);}
  function parkingSurface(ctx,asset,state,source,dest,fill){
    const meta=parking?.frames[parkingFrameId(asset,state)];if(!meta||!available(meta.atlas))return false;
    const r=meta.rect,ratio=images[meta.atlas].width/entries[meta.atlas].size[0];
    return surface(ctx,meta.atlas,source.map(p=>({x:(r[0]+p[0]*r[2])*ratio,y:(r[1]+p[1]*r[3])*ratio})),dest,fill);
  }
  function parkingClipStates(asset,action){
    return (parking?.clips[asset+'__'+action]?.frames||[]).map(id=>parking.frames[id].state);
  }
  function parkingMask(ctx,name,origin,radius,project,facing={x:1,y:0}){
    const key='parking_mask_'+name;if(!available(key))return false;
    const ratio=images[key].width/1024,n=Math.hypot(facing.x,facing.y)||1,dx=facing.x/n,dy=facing.y/n;
    return fullAffine(ctx,key,[{x:512*ratio,y:512*ratio},{x:992*ratio,y:512*ratio},{x:512*ratio,y:992*ratio}],
      [project(origin.x,origin.y),project(origin.x+dx*radius,origin.y+dy*radius),project(origin.x-dy*radius,origin.y+dx*radius)]);
  }
  function parkingSequence(ctx,asset,elapsed,duration,x,y,height,options={}){
    const states=Object.keys(parking?.assets[asset]?.states||{});if(!states.length)return false;
    const progress=options.loop?((elapsed%duration)+duration)%duration/duration:Math.max(0,Math.min(.9999,elapsed/duration));
    return parkingSprite(ctx,asset,states[Math.floor(progress*states.length)],x,y,height,options);
  }
  function parkingAsset(entity,facing,phase){
    return parking?.characters[entity]?.[phase||'default']?.[eightDirection(facing)]||null;
  }
  function parkingActor(ctx,z,seconds,x,y,height=55){
    if(z.kind==='lurker'&&z.state==='burrowed')return false;
    const facing=z.visualAttack?.until>seconds?z.visualAttack.facing:z.facing||{x:0,y:1};
    let asset=parkingAsset(z.kind,facing,z.kind==='lurker'?z.phase:null);
    if(!asset)asset=parkingAsset(z.kind,facing,z.kind==='lurker'?'normal':null);
    if(!asset)return false;
    let state='idle',blend=0,nextState=null;const attack=z.visualAttack;
    if(z.hp<=0)state='dead';
    else if(z.state==='stunned')state='stunned';
    else if(z.state==='charging')state='roar_charge';
    else if(z.lastRoar!=null&&seconds-z.lastRoar<.25)state='roar_release';
    else if(z.windup)state=z.windup.type==='ranged'?'throw_windup':'melee_windup';
    else if(attack?.until>seconds)state=seconds<attack.releaseUntil?(attack.kind==='throw'?'throw_release':'melee_hit'):(attack.kind==='throw'?'throw_recover':'melee_recover');
    else if(z.visualRetreatUntil>seconds)state='retreat';
    else if(z.visualMoveAt>=seconds-.08){const order=parkingClipStates(asset,'move'),phase=(z.visualDistance||0)/.38;if(order.length){state=order[Math.floor(phase)%order.length];nextState=order[(Math.floor(phase)+1)%order.length];blend=Math.max(0,(phase-Math.floor(phase)-.8)/.2);}}
    const frame=parking?.frames[parkingFrameId(asset,state)],following=parking?.frames[parkingFrameId(asset,nextState)];
    if(blend>0&&frame&&following&&available(frame.atlas)&&available(following.atlas)){
      const layer=parkingActor.layer||(parkingActor.layer=document.createElement('canvas'));if(layer.width!==220){layer.width=220;layer.height=150;}
      const c=layer.getContext('2d');c.clearRect(0,0,220,150);c.globalCompositeOperation='lighter';
      parkingSprite(c,asset,state,110,120,height,{alpha:1-blend});parkingSprite(c,asset,nextState,110,120,height,{alpha:blend});c.globalCompositeOperation='source-over';ctx.drawImage(layer,x-110,y-120);return true;
    }
    return parkingSprite(ctx,asset,state,x,y,height);
  }
  function parkingPlayer(ctx,game,facing,x,y,moving,phase,height=50){
    if(game.playerAttack)return null;
    const find=entity=>parkingAsset(entity,facing);
    const order=['a','mid','b','mid'],frame=order[Math.floor(phase)%4];let asset=null,state=null,includesHand=false,includesHead=false;
    const stealthEnd=game.playerSkillVisual?.until>game.seconds?game.playerSkillVisual:null;
    if(game.skill?.active||stealthEnd){asset=find('player_stealth');state=stealthEnd?.state||(game.seconds-game.skill.startedAt<.25?'activate':moving?'sneak_'+frame:'idle');if(state!=='end')height*=.86;}
    const preparing=game.action?.type==='lamp_throw',lamp=game.lampById(preparing?game.action.lampId:game.heldLightId),released=game.playerLampVisual?.until>game.seconds?game.playerLampVisual:null;
    const lampKind=released?.kind||lamp?.kind,type={torch:'torch',oil_lantern:'lantern',flashlight:'flashlight'}[lampKind];
    if(!asset&&type){
      const lit=released||lamp?.active&&lamp.energy>0;
      const specific=lit&&(find('player_'+type)||find('player_'+(lampKind||''))),combined=find(lit?'player_lights':'player_lights_off');asset=specific||combined;
      if(asset){const prefix=specific?'':type+'_';state=prefix+(released?'throw_release':preparing?'throw_windup':moving?'run_'+frame:'idle');includesHand=true;}
    }
    const head=game.lampById(game.headLightId);
    if(!asset&&!lamp&&game.player.weapon==='fists'&&head){
      const lit=head.active&&head.energy>0;asset=find(lit?'player_headlamp':'player_lights_off');state=(lit?'':'headlamp_')+(moving?'run_'+frame:'idle');includesHead=!!asset;
    }
    if(!asset||!parking.assets[asset].states[state])return null;
    let headMeta=parking.frames[parkingFrameId(asset,state)],nextHead=null,headBlend=0;
    const movingAction=/^(.*(?:run|sneak))_(?:a|mid|b)$/.exec(state),sequence=movingAction&&parkingClipStates(asset,movingAction[1]);
    if(sequence?.length){
      const index=Math.floor(phase)%sequence.length,blend=Math.max(0,(phase-Math.floor(phase)-.8)/.2),id=parkingFrameId(asset,sequence[index]);
      if(!id||!available(parking.frames[id].atlas))return null;
      headMeta=parking.frames[id];nextHead=parking.frames[parkingFrameId(asset,sequence[(index+1)%sequence.length])];headBlend=blend;
      const layer=parkingPlayer.layer||(parkingPlayer.layer=document.createElement('canvas'));if(layer.width!==220){layer.width=220;layer.height=150;}
      const c=layer.getContext('2d');c.clearRect(0,0,220,150);c.globalCompositeOperation='lighter';
      parkingSprite(c,asset,sequence[index],110,120,height,{alpha:1-blend});parkingSprite(c,asset,sequence[(index+1)%sequence.length],110,120,height,{alpha:blend});c.globalCompositeOperation='source-over';ctx.drawImage(layer,x-110,y-120);
    }else if(!parkingSprite(ctx,asset,state,x,y,height))return null;
    const headPoint=m=>({x:(m.head[0]-m.pivot[0])*height/m.bodyHeight,y:(m.head[1]-m.pivot[1])*height/m.bodyHeight}),headOffset=headPoint(headMeta),next=nextHead&&headPoint(nextHead);
    if(next){headOffset.x+=(next.x-headOffset.x)*headBlend;headOffset.y+=(next.y-headOffset.y)*headBlend;}
    const weaponOffset={south:[-13,-19],southeast:[-8,-20],east:[-3,-22],northeast:[9,-22],north:[13,-22],northwest:[10,-20],west:[5,-18],southwest:[-7,-18]}[eightDirection(facing)];
    return {includesHand,includesHead,ownsArms:!!(preparing||released),headOffset,weaponOffset};
  }
  function parkingThumb(kind){
    const alias=parking?.aliases[kind];if(!alias)return null;
    return parkingIcon(...alias,40);
  }
  function parkingIcon(asset,state='default',size=24){
    const id=parkingFrameId(asset,state),m=parking?.frames[id];if(!m)return null;
    const cacheKey=id+':'+size;if(parkingThumbs.has(cacheKey))return parkingThumbs.get(cacheKey);
    const b=m.bounds,r=m.rect,entry=entries[m.atlas],w=b[2]-b[0],h=b[3]-b[1],scale=(size-2)/Math.max(w,h);
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    // CSS crops the chosen frame. No synchronous GPU readback or PNG encoding in a frame.
    const html=`<span class="parking-atlas-icon" style="width:${size}px;height:${size}px"><img src="${escape(entry.src)}" alt="" loading="lazy" decoding="async" style="width:${entry.size[0]*scale}px;height:${entry.size[1]*scale}px;left:${(size-w*scale)/2-(r[0]+b[0])*scale}px;top:${(size-h*scale)/2-(r[1]+b[1])*scale}px"></span>`;
    parkingThumbs.set(cacheKey,html);return html;
  }
  function prepareWeapon(weapon,facing){
    const groups=armed?.clips[weapon];if(!groups)return;
    const heading=armed.directions.indexOf(eightDirection(facing));
    for(const offset of [0,-1,1]){const id=groups[armed.directions[(heading+offset+8)%8]]?.idle[0],key=armed.frames[id]?.atlas;if(key&&!pending[key])load(key);}
  }
  function armedPlayer(ctx,weapon,facing,x,y,action='idle',phase=0,height=50){
    const groups=armed?.clips[weapon];if(!groups)return false;
    const dir=eightDirection(facing),sequence=groups[dir]?.[action]||groups[dir]?.idle;if(!sequence?.length)return false;
    // Warm neighbouring headings only; do not decode all 56 atlases on startup.
    prepareWeapon(weapon,facing);
    const position=action==='attack'?Math.max(0,Math.min(sequence.length-1,phase)):Math.max(0,phase)%sequence.length;
    const index=Math.floor(position),next=(index+1)%sequence.length,frame=armed.frames[sequence[index]],following=armed.frames[sequence[next]];
    if(!frame||!available(frame.atlas))return false;
    const blend=action==='run'&&following&&available(following.atlas)?Math.max(0,(position-index-.8)/.2):0;
    const layer=armedPlayer.layer||(armedPlayer.layer=document.createElement('canvas'));if(layer.width!==160){layer.width=160;layer.height=100;}
    const c=layer.getContext('2d');c.clearRect(0,0,160,100);c.globalCompositeOperation='lighter';
    for(const [meta,alpha] of [[frame,1-blend],[following,blend]]){
      if(!meta||alpha<=0)continue;const ratio=height/meta.bodyHeight,imageRatio=images[meta.atlas].width/entries[meta.atlas].size[0],r=meta.rect;
      c.globalAlpha=alpha;c.drawImage(images[meta.atlas],r[0]*imageRatio,r[1]*imageRatio,r[2]*imageRatio,r[3]*imageRatio,80-meta.pivot[0]*ratio,80-meta.pivot[1]*ratio,r[2]*ratio,r[3]*ratio);
    }
    c.globalAlpha=1;c.globalCompositeOperation='source-over';ctx.drawImage(layer,x-80,y-80);return true;
  }
  function affine(source,dest){
    const u={x:source[1].x-source[0].x,y:source[1].y-source[0].y},v={x:source[2].x-source[0].x,y:source[2].y-source[0].y};
    const du={x:dest[1].x-dest[0].x,y:dest[1].y-dest[0].y},dv={x:dest[2].x-dest[0].x,y:dest[2].y-dest[0].y},det=u.x*v.y-u.y*v.x;
    const a=(du.x*v.y-dv.x*u.y)/det,c=(dv.x*u.x-du.x*v.x)/det,b=(du.y*v.y-dv.y*u.y)/det,d=(dv.y*u.x-du.y*v.x)/det;
    return {a,b,c,d,e:dest[0].x-a*source[0].x-c*source[0].y,f:dest[0].y-b*source[0].x-d*source[0].y};
  }
  const map=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
  function fullAffine(ctx,key,source,dest){if(!available(key))return false;const m=affine(source,dest);ctx.save();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(images[key],0,0);ctx.restore();return true;}
  function surface(ctx,key,source,dest,fill){
    if(fill){ctx.save();ctx.beginPath();dest.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.restore();}
    if(!available(key))return false;
    for(const indices of [[0,1,2],[0,2,3]]){
      const s=indices.map(i=>source[i]),q=indices.map(i=>dest[i]),m=affine(s,q);
      ctx.save();ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
      ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(images[key],0,0);ctx.restore();
    }return true;
  }
  // 每面墙单独投影；竖直方向始终使用世界高度，不剪切整栋房屋。
  function house(ctx,home,project,inside=false,front=false){
    const point=(x,y,z=0)=>project(home.x+x,home.y+y,z);
    const special=home.kind&&home.kind!=='house',key=special?`${home.kind}_base`:'house_base';
    const wall=(source,a,b,alpha=1)=>{
      ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();
      const segments=home.objects.filter(o=>o.type==='wall'&&o.hp>0&&(a[0]===b[0]?Math.abs(o.x-home.x-a[0])<.15&&o.y>=home.y+Math.min(a[1],b[1])-.1&&o.y<=home.y+Math.max(a[1],b[1])+.1:Math.abs(o.y-home.y-a[1])<.15&&o.x>=home.x+Math.min(a[0],b[0])-.1&&o.x<=home.x+Math.max(a[0],b[0])+.1));
      for(const o of segments){const aa=a[0]===b[0]?[a[0],o.y-home.y-o.h/2]:[o.x-home.x-o.w/2,a[1]],bb=a[0]===b[0]?[a[0],o.y-home.y+o.h/2]:[o.x-home.x+o.w/2,a[1]];[point(...aa),point(...bb),point(...bb,2.2),point(...aa,2.2)].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
      ctx.clip();
      if(special){const meta=entries[key],c=meta?.crop||[0,0,1280,1280],w=c[2]-c[0],h=c[3]-c[1],p=(x,y)=>({x:c[0]+w*x,y:c[1]+h*y});source=home.kind==='food_shop'?[p(.2,.72),p(.66,.5),p(.66,.05),p(.2,.3)]:[p(.43,.48),p(.92,.66),p(.92,.32),p(.43,.04)];}
      surface(ctx,key,source,[point(...a),point(...b),point(...b,2.2),point(...a,2.2)],special?'#505154':'#c0bbaa');ctx.restore();
    };
    if(!front){
      wall([{x:350,y:418},{x:553,y:314},{x:553,y:121},{x:350,y:312}],[-5,0],[-5,-6]);
      wall([{x:553,y:314},{x:1115,y:578},{x:1115,y:380},{x:553,y:121}],[-5,-6],[5,-6]);
    }else{
      const alpha=inside?.28:1;
      wall([{x:958,y:945},{x:1325,y:644},{x:1323,y:443},{x:957,y:727}],[5,0],[5,-6],alpha);
      const bottom=t=>({x:212+746*t,y:570+375*t}),top=t=>({x:212+745*t,y:398+329*t});
      for(const [l,r] of [[0,.42],[.58,1]])wall([bottom(0),bottom(.28),top(.28),top(0)],[-5+10*l,0],[-5+10*r,0],alpha);
      // 门降低后补齐门楣，让缺口上缘仍与墙体相连。
      ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();
      [point(-.8,0,2),point(.8,0,2),point(.8,0,2.2),point(-.8,0,2.2)].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();ctx.fillStyle='#b9b5a5';ctx.fill();ctx.restore();
    }
    return available('house_base');
  }
  function roof(ctx,home,project){
    const p=(x,y,z)=>project(home.x+x,home.y+y,z);
    if(home.kind&&home.kind!=='house'){const key=home.kind+'_roof',meta=entries[key];if(meta){const [l,t,r,b]=meta.crop;return surface(ctx,key,[{x:l,y:(t+b)/2},{x:(l+r)/2,y:b},{x:r,y:(t+b)/2},{x:(l+r)/2,y:t}],[p(-5.2,.2,2.2),p(5.2,.2,2.2),p(5.2,-6.2,2.2),p(-5.2,-6.2,2.2)],'#57595b');}}
    // 旧三角屋顶的坡面纹理，屋檐直接落在同一组墙顶坐标上。
    surface(ctx,'house_roof',[{x:520,y:127},{x:1040,y:532},{x:1284,y:617},{x:765,y:212}],
      [p(-5.2,-3,3.6),p(5.2,-3,3.6),p(5.2,-6.2,2.2),p(-5.2,-6.2,2.2)],'#75483c');
    surface(ctx,'house_roof',[{x:254,y:467},{x:793,y:857},{x:1040,y:532},{x:520,y:127}],
      [p(-5.2,.2,2.2),p(5.2,.2,2.2),p(5.2,-3,3.6),p(-5.2,-3,3.6)],'#98604b');
    ctx.beginPath();[p(5.2,.2,2.2),p(5.2,-6.2,2.2),p(5.2,-3,3.6)].forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fillStyle='#c2b9a2';ctx.fill();
    return available('house_roof');
  }
  function ground(ctx,key,x,y,w,h,project,rotate=false){
    const dest=[project(x-w/2,y+h/2),project(x+w/2,y+h/2),project(x+w/2,y-h/2),project(x-w/2,y-h/2)];
    let source=key==='grass'?[{x:324,y:499},{x:767,y:745},{x:1211,y:499},{x:768,y:245}]:[{x:275,y:443},{x:754,y:761},{x:1232,y:478},{x:768,y:196}];
    if(key==='road')source=[{x:540,y:480},{x:600,y:516},{x:660,y:480},{x:600,y:444}];
    if(rotate)source=[source[1],source[2],source[3],source[0]];
    return surface(ctx,key,source,dest,key==='grass'?'#63664c':'#3f433a');
  }
  function door(ctx,o,room,project){
    const key=`${room?'house_door':'yard_gate'}_${o.level?'reinforced_':''}${o.open?'open':'closed'}`;
    if(!available(key))return false;
    // 开关状态使用同一门框三点标定；只改变门扇姿态，不改变尺寸。
    if(room){
      const source=o.level?(o.open?[{x:520,y:875},{x:982,y:1149},{x:520,y:70}]:[{x:388,y:894},{x:848,y:1158},{x:388,y:64}]):o.open?[{x:398,y:897},{x:854,y:1158},{x:398,y:66}]:[{x:390,y:895},{x:850,y:1154},{x:390,y:66}];
      return fullAffine(ctx,key,source,[project(o.x-.82,o.y),project(o.x+.82,o.y),project(o.x-.82,o.y,2.0)]);
    }
    // 两根门柱的脚点与院墙缺口两端重合，门顶沿用院墙高度。
    const source=o.level&&o.open?[{x:604,y:728},{x:1285,y:1003},{x:604,y:11}]:[{x:428,y:708},{x:1125,y:997},{x:428,y:25}];
    return fullAffine(ctx,key,source,
      [project(o.x-1,o.y),project(o.x+1,o.y),project(o.x-1,o.y,1.05)]);
  }
  function direction(facing={x:0,y:1}){const sx=facing.x-facing.y,sy=(facing.x+facing.y)*.5;return Math.abs(sx)>Math.abs(sy)?sx>0?'east':'west':sy<0?'north':'south';}
  // Rear-wall sorting is independent from front-wall fading and door layering.
  const houseBack=(ctx,home,project)=>house(ctx,home,project,false,false);
  const houseFront=(ctx,home,project,inside)=>house(ctx,home,project,inside,true);
  window.GameArt={images,entries,failed,loading,get ready(){return ready;},get parkingRevision(){return parkingRevision;},available,sprite,animatedPlayer,armedPlayer,prepareWeapon,eightDirection,parkingSprite,parkingSurface,parkingMask,parkingSequence,parkingActor,parkingPlayer,parkingThumb,parkingIcon,house,houseBack,houseFront,roof,ground,door,direction};
})();
