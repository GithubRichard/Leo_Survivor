/* 直接使用美术PNG。图片与逻辑共用地面锚点，地砖只投影顶面。 */
(() => {
  const entries={...(window.GAME_ASSETS||{}),...(window.EXPANSION_ASSETS||{})},images={},failed=[],pending={};
  const animation=window.PLAYER_ANIMATION;
  for(const frames of Object.values(animation?.frames||{}))for(const frame of frames)entries[frame.key]=frame;
  let ready=false;
  function load(key){
    if(pending[key])return pending[key];const data=entries[key];if(!data)return Promise.resolve();
    return pending[key]=new Promise(resolve=>{const img=new Image();images[key]=img;img.onload=()=>{
      if(!/^house_|^yard_|^grass$|^road$|_(base|roof)$/.test(key)&&img.width>384){const small=document.createElement('canvas');small.width=384;small.height=Math.round(img.height*384/img.width);small.getContext('2d').drawImage(img,0,0,small.width,small.height);images[key]=small;}
      resolve();};img.onerror=()=>{failed.push(data.src);resolve();};img.src=data.src;});
  }
  const loading=Promise.all(Object.keys(entries).filter(key=>!entries[key].lazy).map(load)).then(()=>{ready=true;});
  function available(key){if(entries[key]&&!pending[key])load(key);const img=images[key];return Boolean(img&&(img instanceof HTMLCanvasElement||img.complete&&img.naturalWidth>0));}
  function sprite(ctx,key,x,y,height,{width,flip=false,anchorY=1}={}){
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
  function affine(source,dest){
    const u={x:source[1].x-source[0].x,y:source[1].y-source[0].y},v={x:source[2].x-source[0].x,y:source[2].y-source[0].y};
    const du={x:dest[1].x-dest[0].x,y:dest[1].y-dest[0].y},dv={x:dest[2].x-dest[0].x,y:dest[2].y-dest[0].y},det=u.x*v.y-u.y*v.x;
    const a=(du.x*v.y-dv.x*u.y)/det,c=(dv.x*u.x-du.x*v.x)/det,b=(du.y*v.y-dv.y*u.y)/det,d=(dv.y*u.x-du.y*v.x)/det;
    return {a,b,c,d,e:dest[0].x-a*source[0].x-c*source[0].y,f:dest[0].y-b*source[0].x-d*source[0].y};
  }
  const map=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
  function fullAffine(ctx,key,source,dest){if(!available(key))return false;const m=affine(source,dest);ctx.save();ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(images[key],0,0);ctx.restore();return true;}
  function surface(ctx,key,source,dest,fill){
    ctx.save();ctx.beginPath();dest.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.restore();
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
  window.GameArt={images,entries,failed,loading,get ready(){return ready;},available,sprite,animatedPlayer,house,houseBack,houseFront,roof,ground,door,direction};
})();
