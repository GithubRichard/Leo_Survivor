/* Canvas camera sequence, television programme, and shared white subtitles. */
(() => {
  'use strict';const V=Survival.BroadcastVoice,A=GameSound,caption=document.getElementById('story-subtitles');
  const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  function subtitle(text,speaker=''){caption.classList.toggle('hidden',!text);document.getElementById('subtitle-speaker').textContent=speaker;document.getElementById('subtitle-text').textContent=text;}
  function poly(c,points,fill){c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function text(c,s,x,y,size,color='#e7f2f8'){c.fillStyle=color;c.font=`${size}px "Microsoft YaHei",sans-serif`;c.textAlign='center';c.fillText(s,x,y);}
  function screen(c,x,y,w,h,kind,t,speaking=false){
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    c.fillStyle=kind==='static'?'#161d21':'#12394d';c.fillRect(x,y,w,h);
    if(kind==='static'){
      for(let i=0;i<75;i++){const n=(Math.sin(i*127.1+Math.floor(t*18)*43.7)*43758.5453)%1;c.fillStyle=`rgba(210,227,235,${.08+Math.abs(n)*.22})`;c.fillRect(x+(Math.abs(n)*w),y+i*h/75,w*(.1+Math.abs(n)),h/100);}
      c.fillStyle='#cadde2';c.fillRect(x,y+((t*83)%h),w,Math.max(1,h*.014));
    }else{
      const pulse=.5+.5*Math.sin(t*3);c.fillStyle='#195575';c.fillRect(x+w*.4,y,w*.6,h);c.strokeStyle='#6ab2cc55';c.lineWidth=1;
      for(let i=0;i<7;i++){c.beginPath();c.ellipse(x+w*.72,y+h*.43,w*(.13+i*.05),h*(.12+i*.04),-.2,0,Math.PI*2);c.stroke();}
      // A restrained announcer, with mouth motion driven by each spoken line.
      poly(c,[[x+w*.07,y+h*.89],[x+w*.1,y+h*.46],[x+w*.2,y+h*.4],[x+w*.33,y+h*.47],[x+w*.39,y+h*.89]],'#172936');
      c.fillStyle='#b5ac9c';c.beginPath();c.ellipse(x+w*.23,y+h*.3,w*.07,h*.14,0,0,Math.PI*2);c.fill();
      poly(c,[[x+w*.155,y+h*.29],[x+w*.16,y+h*.16],[x+w*.25,y+h*.13],[x+w*.303,y+h*.21]],'#17242b');
      c.fillStyle='#4b4140';c.fillRect(x+w*.208,y+h*.365,w*.04,h*(speaking?.012+.018*Math.abs(Math.sin(t*13)):.01));
      poly(c,[[x+w*.18,y+h*.43],[x+w*.235,y+h*.52],[x+w*.29,y+h*.43],[x+w*.25,y+h*.68],[x+w*.22,y+h*.68]],'#c7c8be');
      c.fillStyle='#593e3a';c.fillRect(x+w*.23,y+h*.53,w*.018,h*.2);
      const px=x+w*.48,py=y+h*.25,pw=w*.45,ph=h*.45;
      c.fillStyle='#102a37';c.fillRect(px,py,pw,ph);c.strokeStyle='#6ba3b5';c.strokeRect(px,py,pw,ph);
      if(kind==='war'){
        poly(c,[[px+pw*.5,py+ph*.08],[px+pw*.88,py+ph*.83],[px+pw*.12,py+ph*.83]],`rgba(226,171,82,${.6+.3*pulse})`);
        text(c,'!',px+pw*.5,py+ph*.69,ph*.55,'#24313a');
      }else if(kind==='famine'){
        for(let i=0;i<7;i++){const bh=ph*(.2+(i*13%7)/13);c.fillStyle=i%2?'#51636a':'#394b53';c.fillRect(px+i*pw/7,py+ph-bh,pw/8,bh);}
        c.strokeStyle='#bf8c75';c.lineWidth=2;c.beginPath();c.moveTo(px+pw*.12,py+ph*.2);c.lineTo(px+pw*.4,py+ph*.4);c.lineTo(px+pw*.6,py+ph*.38);c.lineTo(px+pw*.87,py+ph*.76);c.stroke();
      }else if(kind==='depots'){
        for(let i=0;i<2;i++){const bx=px+pw*(.08+i*.49),by=py+ph*.35;poly(c,[[bx,by],[bx+pw*.2,by-ph*.2],[bx+pw*.4,by],[bx+pw*.4,by+ph*.45],[bx,by+ph*.45]],'#7d969a');c.fillStyle='#233e4b';c.fillRect(bx+pw*.12,by+ph*.12,pw*.16,ph*.33);text(c,i?'军备库':'粮食库',bx+pw*.2,py+ph*.95,Math.max(9,ph*.11));}
      }else if(kind==='camp'){
        for(let i=0;i<3;i++){c.strokeStyle=`rgba(130,216,255,${.3+.5*pulse})`;c.beginPath();c.arc(px+pw*.5,py+ph*.58,ph*(.13+i*.12),Math.PI*1.15,Math.PI*1.85);c.stroke();}
        poly(c,[[px+pw*.43,py+ph*.85],[px+pw*.5,py+ph*.35],[px+pw*.57,py+ph*.85]],'#a9d8e8');
      }else{
        poly(c,[[px+pw*.15,py+ph*.42],[px+pw*.5,py+ph*.08],[px+pw*.85,py+ph*.42],[px+pw*.85,py+ph*.85],[px+pw*.15,py+ph*.85]],'#87a1a7');c.fillStyle='#2a4a5a';c.fillRect(px+pw*.4,py+ph*.5,pw*.2,ph*.35);
      }
      c.fillStyle='#a8d9e2';c.fillRect(x,y+h*.83,w,h*.17);text(c,kind==='camp'?'幸存者紧急广播':'紧急公共广播  /  2026',x+w*.5,y+h*.945,h*.085,'#183341');
      text(c,kind==='war'?'化学污染警报':kind==='famine'?'物资短缺':kind==='depots'?'应急储备设施':kind==='camp'?'前往最近的营地':'请留在家中',x+w*.71,y+h*.18,h*.09);
    }
    c.fillStyle='#0002';for(let iy=y;iy<y+h;iy+=Math.max(2,h/100))c.fillRect(x,iy,w,1);
    c.restore();
  }
  function room(c,kind,t,zoom=1,lift=0,hands=false){
    c.save();c.translate(640,350);c.scale(zoom,zoom);c.translate(-640,-350+lift);
    const wall=c.createLinearGradient(0,0,0,580);wall.addColorStop(0,'#151c20');wall.addColorStop(1,'#343c39');c.fillStyle=wall;c.fillRect(-900,-700,3100,1250);
    poly(c,[[-900,550],[2200,550],[3000,1600],[-1400,1600]],'#2d2823');
    c.strokeStyle='#454038';c.lineWidth=2;for(let i=-8;i<15;i++){c.beginPath();c.moveTo(640+i*120,550);c.lineTo(640+i*280,1300);c.stroke();}
    c.fillStyle='#10191f';c.fillRect(90,155,170,245);c.strokeStyle='#606763';c.lineWidth=9;c.strokeRect(90,155,170,245);c.beginPath();c.moveTo(175,155);c.lineTo(175,400);c.moveTo(90,275);c.lineTo(260,275);c.stroke();
    c.fillStyle='#141a1b';c.fillRect(1040,160,200,395);c.strokeStyle='#51574e';c.strokeRect(1040,160,200,395);c.fillStyle='#9c9677';c.fillRect(1060,365,12,6);
    c.fillStyle='#392f27';c.fillRect(360,470,560,90);c.fillStyle='#151b1d';c.fillRect(381,559,22,35);c.fillRect(877,559,22,35);
    const glow=c.createRadialGradient(640,340,30,640,340,450);glow.addColorStop(0,'#6fbce02e');glow.addColorStop(1,'#6fbce000');c.fillStyle=glow;c.fillRect(190,0,900,780);
    c.fillStyle='#141b1f';c.fillRect(350,120,580,365);c.strokeStyle='#586268';c.lineWidth=5;c.strokeRect(350,120,580,365);
    screen(c,375,145,500,307,kind,t,kind!=='static');c.fillStyle=kind==='static'?'#67848f':'#82ceff';c.beginPath();c.arc(901,454,3,0,Math.PI*2);c.fill();
    c.restore();
    if(hands){const motion=Math.sin(t*2)*3;poly(c,[[0,720],[65,590+motion],[170,570+motion],[230,650],[260,720]],'#776951');poly(c,[[1280,720],[1220,590-motion],[1110,570-motion],[1060,660],[1040,720]],'#776951');poly(c,[[75,596+motion],[125,567+motion],[174,579+motion],[190,606+motion],[158,623+motion]],'#aa9275');poly(c,[[1205,594-motion],[1155,568-motion],[1108,580-motion],[1095,609-motion],[1125,625-motion]],'#aa9275');}
  }
  class OpeningSequence{
    constructor(done){this.done=done;this.index=-1;this.time=0;this.stages=[{kind:'approach',duration:4,text:'2026年 · 家中'},...['war','famine','depots','stay-home'].map(id=>({kind:'broadcast',voice:id,duration:V[id].duration+.8,text:V[id].text,speaker:'电视男声'})),{kind:'signal',duration:1.5,text:'（信号中断）'},{kind:'black',duration:1.2,text:''},{kind:'resolve',voice:'resolve',duration:V.resolve.duration+.7,text:V.resolve.text,speaker:'我'},{kind:'rise',duration:3.2,text:'（从电视机前起身）'},{kind:'handoff',duration:1.1,text:''}];document.getElementById('opening-controls').classList.remove('hidden');this.next();}
    next(){A.stopVoice();this.index++;this.time=0;const s=this.stages[this.index];if(!s){this.finish();return;}subtitle(s.text,s.speaker||'');if(s.voice)A.playVoice(s.voice);if(s.kind==='signal'){A.burst(.8,.1,4800);A.tone(920,.2,.04,'square');}if(s.kind==='rise')A.burst(.4,.06,450);}
    update(dt){const s=this.stages[this.index];if(!s)return;this.time+=dt;if(s.voice)this.time=Math.max(this.time,A.voiceTime(s.voice));A.ambience(0,['black','resolve','handoff'].includes(s.kind)?0:s.kind==='signal'?.055:.009);if(this.time>=s.duration)this.next();}
    finish(){if(this.finished)return;this.finished=true;A.stopVoice();A.ambience(0,0);subtitle('');document.getElementById('opening-controls').classList.add('hidden');this.done();}
    draw(c,width,height){
      const s=this.stages[this.index];if(!s)return;const progress=clamp(this.time/s.duration);c.save();if(s.kind==='handoff')c.globalAlpha=1-ease(progress);c.beginPath();c.rect(0,0,width,height);c.clip();c.fillStyle='#000';c.fillRect(0,0,width,height);
      if(s.kind!=='black'){
        const fit=Math.min(width/1280,height/720);c.save();c.translate((width-1280*fit)/2,(height-720*fit)/2);c.scale(fit,fit);
        if(s.kind==='approach')room(c,'war',this.time,.65+.8*ease(progress));
        else if(s.kind==='broadcast')room(c,s.voice,this.time,1.45);
        else if(s.kind==='signal')room(c,'static',this.time,1.45);
        else if(s.kind==='resolve')room(c,'static',this.time,.96,60,true);
        else if(s.kind==='rise')room(c,'static',this.time,.96-.16*ease(progress),60+100*ease(progress),true);
        else room(c,'static',this.time,.8,160);
        c.restore();
        // Room art may extend beyond its design frame. Apply screen effects in
        // viewport coordinates so their edges stay aligned on every aspect ratio.
        const x=width*.5,y=height*.48,g=c.createRadialGradient(x,y,Math.min(width,height)*.18,x,y,Math.hypot(width,height)*.55);g.addColorStop(0,'#0000');g.addColorStop(1,'#000c');c.fillStyle=g;c.fillRect(0,0,width,height);
        if(s.kind==='signal'){c.fillStyle=`rgba(0,0,0,${ease((progress-.55)/.45)})`;c.fillRect(0,0,width,height);}
        if(s.kind==='resolve'&&progress<.2){c.fillStyle=`rgba(0,0,0,${1-progress/.2})`;c.fillRect(0,0,width,height);}
      }c.restore();
    }
  }
  function tvVisible(game){const tv=game.broadcast?.television;return game.scene==='surface'&&game.player.indoorHome==='0,0'&&tv&&Survival.dist(tv,game.player)<5.5;}
  function updateTV(game,dt,active){
    const visible=tvVisible(game),s=game.tvSession;
    for(const event of game.audioEvents.splice(0)){
      if(event.kind==='container-open')A.openContainer();
      if(event.kind==='television'){A.stopVoice();if(event.channel==='camp')A.playVoice('camp');}
    }
    if(s&&active){s.elapsed+=dt;if(s.kind==='camp')s.elapsed=Math.max(s.elapsed,A.voiceTime('camp'));if(!visible||s.elapsed>=s.duration){game.tvSession=null;A.stopVoice();subtitle('');}}
    if(s&&game.tvSession&&visible&&active)subtitle(s.kind==='camp'?V.camp.text:'什么都没有……',s.kind==='camp'?'电视男声':'我');else subtitle('');
    const kind=game.weatherKind?.(),raining=game.scene==='surface'&&['rain','thunderstorm'].includes(kind);A.ambience(raining?(game.player.indoorHome ? .035 : kind==='thunderstorm' ? .12 : .085):0,visible?(game.tvSession?.kind==='camp' ? .003 : .022):0);
  }
  function items(game,v){
    if(game.scene!=='surface'||game.player.indoorHome!=='0,0')return;const tv=game.broadcast?.television;if(!tv)return;const {ctx:c,project,scale,items,drawRoomObject}=v,q=project(tv.x,tv.y),camp=game.tvSession?.kind==='camp',t=game.seconds;
    if(camp)items.push({depth:-10.99,draw:()=>drawRoomObject(tv,()=>{c.save();const home=[project(-5,-6),project(5,-6),project(5,0),project(-5,0)];c.beginPath();home.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,scale*2.5);g.addColorStop(0,'#5fbdff70');g.addColorStop(1,'#479dff00');c.fillStyle=g;c.fillRect(q.x-scale*3,q.y-scale*3,scale*6,scale*6);c.restore();})});
    items.push({depth:tv.x+tv.y,draw:()=>drawRoomObject(tv,()=>{const k=scale/27;c.save();c.translate(q.x,q.y);c.scale(k,k);c.fillStyle='#1d2426';c.fillRect(-25,-40,50,32);c.strokeStyle='#727b77';c.lineWidth=2;c.strokeRect(-25,-40,50,32);screen(c,-21,-36,39,23,camp?'camp':'static',t,camp);c.fillStyle=camp?'#71cfff':'#9ca5a2';c.fillRect(21,-18,2,2);c.fillStyle='#555347';c.fillRect(-13,-7,3,8);c.fillRect(11,-7,3,8);c.restore();})});
  }
  window.BroadcastView={OpeningSequence,items,updateTV,subtitle,tvVisible};
})();
