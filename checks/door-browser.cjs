const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,channel:process.env.GAME_TEST_BROWSER||'msedge'});try{
  const page=await b.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/'));await page.waitForFunction(()=>GameArt.ready);
  await page.evaluate(()=>{const fn=Survival.Game.prototype.step;Survival.Game.prototype.step=function(...a){window.qaGame=this;return fn.apply(this,a);};for(const prefix of ['house_door','yard_gate'])for(const level of ['', 'reinforced_'])for(const state of ['closed','open'])GameArt.available(`${prefix}_${level}${state}`);});
  await page.waitForFunction(()=>['house_door','yard_gate'].every(prefix=>['','reinforced_'].every(level=>['closed','open'].every(state=>GameArt.available(`${prefix}_${level}${state}`)))));
  const geometries=await page.evaluate(()=>{
    const project=(x,y,z=0)=>({x:700+(x-y)*27,y:500+(x+y)*13.5-z*27}),results=[];
    for(const room of [true,false])for(const level of [0,1])for(const open of [false,true]){
      let matrix=null,draws=0;const ctx={save(){},restore(){},transform(...a){matrix=a;},drawImage(){draws++;}};
      const o={x:.3,y:.4,level,open};const ok=GameArt.door(ctx,o,room,project);
      const source=room?(level?(open?[[520,875],[982,1149],[520,70]]:[[388,894],[848,1158],[388,64]]):(open?[[398,897],[854,1158],[398,66]]:[[390,895],[850,1154],[390,66]])):(level&&open?[[604,728],[1285,1003],[604,11]]:[[428,708],[1125,997],[428,25]]);
      const half=room?.82:1,height=room?2:1.05,expected=[project(o.x-half,o.y),project(o.x+half,o.y),project(o.x-half,o.y,height)];
      const mapped=source.map(([x,y])=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]}));
      results.push({room,level,open,ok,draws,error:Math.max(...mapped.map((p,i)=>Math.hypot(p.x-expected[i].x,p.y-expected[i].y)))});
    }return results;
  });
  for(const g of geometries){assert.ok(g.ok&&g.draws===1&&g.error<1e-8,JSON.stringify(g));}
  await page.locator('#start-developer').click();await page.waitForFunction(()=>!!window.qaGame);await page.evaluate(()=>{qaGame.updateDoors=()=>{};qaGame.player.x=0;qaGame.player.y=2.5;qaGame.player.indoorHome=null;});
  fs.mkdirSync('dist/developer-qa',{recursive:true});
  for(const level of [0,1])for(const open of [false,true]){
    await page.evaluate(({level,open})=>{for(const door of qaGame.getHome(0,0).doors){door.level=level;door.open=open;door.maxHP=door.hp=level?18:6;}},{level,open});await page.waitForTimeout(100);
    await page.screenshot({path:`dist/developer-qa/doors-${level?'reinforced':'normal'}-${open?'open':'closed'}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS all 8 normal/upgraded room/gate states share world frame endpoints and height; screenshots captured; no browser errors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
