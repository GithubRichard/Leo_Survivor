const assert=require('node:assert/strict');
const {Game,RULES,dist}=require('../simulation.js');
function test(name,fn){fn();console.log('PASS '+name);}
function walk(g,dt,input={}){g.seconds+=dt;g.movePlayer(dt,input);}
test('walk and run preserve horizontal speed and use equal projected speed in all eight directions',()=>{
  for(const [run,speed]of [[false,2],[true,4]])for(const input of [{right:true},{left:true},{up:true},{down:true},{right:true,up:true},{right:true,down:true},{left:true,up:true},{left:true,down:true}]){const g=new Game();g.player.x=12;g.player.y=12;g.obstacles=()=>[];const start={...g.player};walk(g,1,{...input,run});const dx=g.player.x-start.x,dy=g.player.y-start.y;assert.ok(Math.abs(Math.hypot(dx-dy,(dx+dy)*.5)-speed*Math.SQRT2)<1e-9);assert.ok(Math.abs(Math.hypot(g.player.facing.x,g.player.facing.y)-1)<1e-9);}
});
test('stamina waits two seconds, restores one point every two seconds, resets when running',()=>{
  const g=new Game();g.player.x=12;g.player.y=12;walk(g,3,{right:true,run:true});assert.equal(g.player.stamina,7);
  walk(g,1.99);assert.equal(g.player.stamina,7);walk(g,.01);assert.equal(g.player.stamina,8);
  walk(g,1.99);assert.equal(g.player.stamina,8);walk(g,.01);assert.equal(g.player.stamina,9);
  walk(g,.5,{right:true,run:true});assert.equal(g.player.stamina,8.5);walk(g,1.99);assert.equal(g.player.stamina,8.5);walk(g,.01);assert.equal(g.player.stamina,9.5);walk(g,2);assert.equal(g.player.stamina,10);
});
test('all spawned zombies are 80m from the player, outside the home and clear of obstacles',()=>{
  let seed=42;const g=new Game({random:()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}});
  g.spawnWave();assert.equal(g.zombies.length,6);
  for(const z of g.zombies){assert.ok(Math.abs(dist(z,g.player)-80)<1e-8);assert.ok(!(Math.abs(z.x)<=5&&z.y>=-6&&z.y<=4));assert.equal(g.obstacles(z,z,.25).length,0);}
});
test('zombie moves 1.5m per second',()=>{
  const g=new Game();g.player.x=12;g.player.y=12;
  const z={x:20,y:12,hp:3,id:0,path:[{x:12,y:12}],repathAt:Infinity,nextAttack:0};g.zombies=[z];g.updateZombies(1);assert.equal(z.x,18.5);
});
test('hurt feedback lasts exactly one game-simulation second',()=>{
  const g=new Game();g.seconds=5;g.damagePlayer(3);assert.equal(g.player.hp,9);assert.equal(g.player.hurtUntil,6);
});
test('dismantle returns the recipe and cannot refund the same device twice',()=>{
  for(const kind of ['trap','ballista']){const g=new Game();const initial=[g.count('iron'),g.count('wood')];assert.ok(g.place(kind,{x:0,y:2}));const d=g.devices[0];assert.ok(g.interact({type:'device',object:d}));assert.deepEqual([g.count('iron'),g.count('wood')],initial);assert.equal(g.devices.length,0);assert.equal(g.dismantle(d),false);assert.deepEqual([g.count('iron'),g.count('wood')],initial);}
});
test('full backpack leaves the device and inventory intact',()=>{
  const g=new Game();g.place('trap',{x:0,y:2});const d=g.devices[0];g.inventory=Array.from({length:20},()=>({kind:'wood',amount:99}));const before=JSON.stringify(g.inventory);assert.equal(g.dismantle(d),false);assert.equal(g.devices.length,1);assert.equal(JSON.stringify(g.inventory),before);
});
test('devices are discoverable through E interaction',()=>{
  const g=new Game();g.place('trap',{x:0,y:3});assert.equal(g.nearbyInteraction().type,'device');
});
test('outside wall proximity never hides a roof, indoor wall proximity never toggles it',()=>{
  const g=new Game();g.player.x=5.1;g.player.y=-2;g.updateIndoorHome();assert.equal(g.player.indoorHome,null);
  g.player.x=0;g.player.y=-.4;g.updateIndoorHome();assert.equal(g.player.indoorHome,'0,0');
  g.player.x=4.76;g.player.y=-2;g.updateIndoorHome();assert.equal(g.player.indoorHome,'0,0');
  g.player.x=0;g.player.y=.1;g.updateIndoorHome();assert.equal(g.player.indoorHome,'0,0');g.player.y=.3;g.updateIndoorHome();assert.equal(g.player.indoorHome,null);
});
test('wall collision holds even at the increased sprint speed',()=>{
  const g=new Game();g.player.x=4.6;g.player.y=2;for(let i=0;i<30;i++)walk(g,.05,{right:true,down:true,run:true});assert.ok(g.player.x<4.71);
});
test('night wave cadence remains six per minute, dawn removes remaining zombies',()=>{
  const g=new Game({startMinutes:1320});g.advanceClock(0);assert.equal(g.zombies.length,6);g.advanceClock(59);assert.equal(g.zombies.length,6);g.advanceClock(1);assert.equal(g.zombies.length,12);g.advanceClock(255);assert.equal(g.result,'win');assert.equal(g.zombies.length,0);
});
console.log('All gameplay regression checks passed.');
