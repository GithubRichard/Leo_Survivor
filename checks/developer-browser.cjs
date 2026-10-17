const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.GAME_TEST_BROWSER||'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/'));await page.waitForFunction(()=>GameArt.ready);assert.deepEqual(await page.evaluate(()=>GameArt.failed),[]);
    await page.evaluate(()=>{
      const step=Survival.Game.prototype.step;Survival.Game.prototype.step=function(...args){window.qaGame=this;window.qaStepCount=(window.qaStepCount||0)+1;return step.apply(this,args);};
      window.layerTrace=[];const ctx=document.getElementById('world').getContext('2d'),clear=ctx.clearRect;ctx.clearRect=function(...args){window.layerTrace=[];window.qaFrameSteps=window.qaStepCount||0;window.qaStepCount=0;return clear.apply(this,args);};
      for(const [key,label]of [['houseBack','rear'],['houseFront','front'],['roof','roof']]){const fn=GameArt[key];GameArt[key]=function(...args){if(args[1].own)layerTrace.push(label);return fn.apply(this,args);};}
      const sprite=GameArt.sprite;GameArt.sprite=function(...args){if(args[1].startsWith('player_'))layerTrace.push('player');return sprite.apply(this,args);};
    });
    await page.locator('#start-game').click();await page.waitForFunction(()=>!!window.qaGame);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('survivor-save-v1')).developerUsed),false);
    await page.keyboard.press('F2');await page.getByRole('heading',{name:'开发者模式',exact:true}).waitFor();
    const paused=await page.evaluate(()=>qaGame.seconds);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>qaGame.seconds),paused);
    const normalSave=await page.evaluate(()=>localStorage.getItem('survivor-save-v1'));
    await page.locator('[data-dev="toggle"][data-option="invincible"]').click();await page.waitForFunction(()=>qaGame.developer.invincible);
    await page.locator('[data-dev="toggle"][data-option="infiniteStamina"]').click();await page.waitForFunction(()=>qaGame.developer.infiniteStamina);
    await page.locator('#dev-item').selectOption('wood');await page.locator('#dev-amount').fill('20');const before=await page.evaluate(()=>qaGame.count('wood'));await page.locator('[data-dev="give"]').click();await page.waitForFunction(n=>qaGame.count('wood')===n+20,before);
    await page.locator('#dev-day').fill('7');await page.locator('[data-dev="night"]').click();await page.waitForFunction(()=>qaGame.day===7&&qaGame.nextWave===1);assert.equal(await page.evaluate(()=>qaGame.zombies.length+qaGame.pendingSpawn.length),14);
    await page.locator('[data-dev="clear"]').click();await page.waitForFunction(()=>qaGame.zombies.length===0);
    await page.locator('#dev-day').fill('1');await page.locator('[data-dev="day"]').click();await page.waitForFunction(()=>qaGame.day===1&&qaGame.minutes===300);
    await page.locator('[data-dev="save"]').click();await page.waitForFunction(()=>!!localStorage.getItem('survivor-dev-save-v1'));assert.equal(await page.evaluate(()=>localStorage.getItem('survivor-save-v1')),normalSave);
    fs.mkdirSync('dist/developer-qa',{recursive:true});await page.screenshot({path:'dist/developer-qa/panel.png'});
    const shots=[['rear_left','inside'],['rear_right','inside'],['front_left','inside'],['front_right','inside'],['outside_front','front'],['outside_right','front'],['outside_back','back'],['outside_left','back']];
    for(const [position,side]of shots){
      await page.locator(`[data-dev="teleport"][data-position="${position}"]`).click();await page.waitForFunction(()=>document.querySelector('.inline-notice')?.textContent==='开发操作完成。');await page.keyboard.press('F2');await page.waitForTimeout(100);
      const trace=await page.evaluate(()=>layerTrace.slice()),a=trace.indexOf('player'),r=trace.indexOf('rear'),f=trace.indexOf('front');assert.ok(a>=0&&r>=0&&f>=0,JSON.stringify(trace));
      if(side==='inside'){assert.ok(r<a&&a<f,`${position}: ${trace}`);assert.equal(await page.evaluate(()=>qaGame.player.indoorHome),'0,0');}
      if(side==='front')assert.ok(f<a,`${position}: ${trace}`);if(side==='back')assert.ok(a<r,`${position}: ${trace}`);
      await page.screenshot({path:`dist/developer-qa/${position}.png`});await page.keyboard.press('F2');
    }
    await page.locator('[data-dev="teleport"][data-position="yard"]').click();await page.locator('[data-dev="toggle"][data-option="collisions"]').click();await page.locator('#dev-enemy').selectOption('runner');await page.locator('#dev-count').fill('2');await page.locator('[data-dev="spawn"]').click();await page.waitForFunction(()=>qaGame.zombies.filter(z=>z.kind==='runner').length===2);
    await page.locator('[data-dev="clear"]').click();await page.locator('#dev-speed').selectOption('5');await page.locator('[data-dev="speed"]').click();await page.keyboard.press('F2');
    await page.waitForFunction(()=>qaFrameSteps===5);assert.equal(await page.evaluate(()=>qaGame.developer.speed),5);
    await page.keyboard.down('Shift');await page.keyboard.down('s');await page.waitForTimeout(150);await page.keyboard.up('s');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>qaGame.player.stamina),10);
    await page.keyboard.press('F2');await page.locator('[data-dev="save"]').click();await page.reload();await page.waitForFunction(()=>GameArt.ready);await page.evaluate(()=>{const step=Survival.Game.prototype.step;Survival.Game.prototype.step=function(...args){window.qaGame=this;return step.apply(this,args);};});await page.locator('#continue-developer').click();await page.waitForFunction(()=>window.qaGame?.developerUsed);
    assert.equal(await page.evaluate(()=>qaGame.developer.invincible),false);assert.equal(await page.evaluate(()=>qaGame.developer.speed),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('survivor-save-v1')),normalSave);assert.deepEqual(errors,[]);
    console.log('PASS developer UI, paused inputs, separate saves/reload, all eight house positions, spawning, speed and stamina, no browser errors.');
    for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
      const phone=await browser.newPage({viewport,hasTouch:true,isMobile:true}),mobileErrors=[];phone.on('pageerror',e=>mobileErrors.push(e.message));
      await phone.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/'));await phone.waitForFunction(()=>GameArt.ready);await phone.locator('#start-developer').tap();await phone.locator('#developer-badge').waitFor();
      await phone.locator('#touch-controls [data-key="escape"]').tap();await phone.locator('[data-command="developer"]').tap();await phone.getByRole('heading',{name:'开发者模式',exact:true}).waitFor();
      assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('overlay-card').scrollWidth<=document.getElementById('overlay-card').clientWidth+1));
      await phone.locator('[data-dev="toggle"][data-option="invincible"]').tap();await phone.waitForFunction(()=>document.querySelector('[data-option="invincible"]').getAttribute('aria-pressed')==='true');
      await phone.evaluate(()=>document.getElementById('overlay-card').scrollTop=0);await phone.screenshot({path:`dist/developer-qa/mobile-panel-${viewport.width}.png`});await phone.locator('#overlay [data-key="escape"]').tap();await phone.locator('#touch-controls').waitFor();
      assert.deepEqual(mobileErrors,[]);console.log(`PASS touch developer entry, toggles, scrolling and return ${viewport.width}x${viewport.height}`);await phone.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
