const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
const page=await browser.newPage({viewport,hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/'));await page.waitForFunction(()=>window.GameArt?.ready);assert.deepEqual(await page.evaluate(()=>GameArt.failed),[]);assert.equal(await page.evaluate(()=>TouchControls.enabled),true);
await page.locator('#name-input').fill('mobile test');await page.locator('#start-game').tap();await page.locator('#touch-controls').waitFor({state:'visible'});
await page.locator('[data-key="tab"]').first().tap();await page.locator('.inventory-grid').waitFor();await page.locator('#overlay [data-key="tab"]').tap();
await page.locator('#touch-controls [data-key="escape"]').tap();assert.match(await page.locator('#overlay').innerText(),/继续游戏/);await page.locator('#overlay [data-key="escape"]').tap();
await page.locator('#touch-controls').waitFor({state:'visible'});const stick=await page.locator('#touch-stick').boundingBox();await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2);await page.mouse.down();await page.mouse.move(stick.x+stick.width*.9,stick.y+stick.height/2);assert.ok(await page.evaluate(()=>TouchControls.input.moveX>.5));await page.mouse.up();assert.equal(await page.evaluate(()=>TouchControls.input.moveX),0);assert.deepEqual(errors,[]);console.log('PASS mobile menu, inventory, pause, joystick: '+viewport.width+'x'+viewport.height);await page.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
