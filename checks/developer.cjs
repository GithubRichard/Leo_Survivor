const assert=require('node:assert/strict');
const S=require('../expansion.js'),Dev=require('../developer-mode.js'),Layers=require('../scene-layers.js');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('Normal games retain damage and stamina costs; debug switches can be disabled',()=>{
  const g=new S.Game();g.damagePlayer(3);assert.equal(g.player.hp,9);g.spendStamina(2);assert.equal(g.player.stamina,8);
  Dev.toggle(g,'invincible');assert.equal(g.damagePlayer(3),false);assert.equal(g.damagePlayer(1,'acid_pool',true),false);assert.equal(g.player.hp,9);
  Dev.toggle(g,'infiniteStamina');assert.equal(g.spendStamina(999),true);assert.equal(g.player.stamina,g.maxStamina);
  Dev.toggle(g,'enabled');g.seconds=2;g.damagePlayer(3);assert.equal(g.player.hp,6);assert.equal(g.spendStamina(999),false);assert.equal(g.developerUsed,true);
});
test('Test-save marker survives loading but invulnerability and speed do not',()=>{
  const g=new S.Game();Dev.toggle(g,'invincible');Dev.state(g).speed=5;const data=g.snapshot();assert.equal(data.developerUsed,true);assert.equal(data.developer,undefined);
  const restored=S.Game.restore(data);assert.equal(restored.developerUsed,true);assert.equal(Dev.state(restored).enabled,false);assert.equal(Dev.state(restored).invincible,false);assert.equal(Dev.state(restored).speed,1);
});
test('Item grants validate inputs and keep a full inventory atomic',()=>{
  const g=new S.Game(),n=g.count('wood');assert.ok(Dev.give(g,'wood',20));assert.equal(g.count('wood'),n+20);
  for(const [kind,amount]of [['wood',0],['wood',1.5],['wood',1000],['ballista',1],['invalid',1]])assert.equal(Dev.give(g,kind,amount),false);
  g.inventory=Array.from({length:20},()=>({kind:'wood',amount:99}));const before=JSON.stringify(g.inventory);assert.equal(Dev.give(g,'iron',1),false);assert.equal(JSON.stringify(g.inventory),before);
});
test('Jumping to day 7 night resets batches without claiming rewards',()=>{
  const g=new S.Game();g.pendingSpawn.push({kind:'runner'});g.warnedWaves=[true,true];g.nextWave=5;g.zones=[{kind:'acid_pool'}];g.action={type:'craft'};
  assert.ok(Dev.jump(g,7,true));assert.equal(g.minutes,1320);assert.equal(g.day,7);assert.equal(g.plan.N,84);assert.equal(g.nextWave,1);assert.equal(g.zombies.length+g.pendingSpawn.length,14);assert.equal(g.zones.length,0);assert.equal(g.count('parts'),0);assert.equal(g.action,null);
  assert.ok(Dev.jump(g,14));assert.equal(g.nextWave,0);assert.equal(g.zombies.length,0);assert.equal(g.minutes,300);assert.equal(g.plan.N,126);assert.equal(g.count('parts'),0);
  for(const n of [0,1.5,366,NaN])assert.equal(Dev.jump(g,n),false);
});
test('All monster kinds spawn on valid points and clear without granting kills',()=>{
  const g=new S.Game();for(const kind of Object.keys(S.Expansion.enemies)){assert.ok(Dev.spawn(g,kind,1));const z=g.zombies.at(-1);assert.equal(z.kind,kind);assert.equal(z.hp,S.Expansion.enemies[kind].hp);assert.ok(S.dist(z,g.player)>=5.99);assert.equal(g.obstacles(z,z,.3).length,0);}
  assert.equal(new Set(g.zombies.map(z=>z.id)).size,6);const kills=g.kills;Dev.clear(g);assert.equal(g.zombies.length,0);assert.equal(g.kills,kills);
});
test('Teleport checks collisions and refreshes indoor state',()=>{
  const g=new S.Game();assert.ok(Dev.teleport(g,'rear_left'));assert.equal(g.player.indoorHome,'0,0');assert.ok(Dev.teleport(g,'outside_front'));assert.equal(g.player.indoorHome,null);
  const p={x:g.player.x,y:g.player.y};g.devices.push({x:-4.5,y:-5.5,w:1,h:1,hp:10,kind:'workbench'});assert.equal(Dev.teleport(g,'rear_left'),false);assert.deepEqual({x:g.player.x,y:g.player.y},p);
});
test('Both rear corners and the entire room stay between rear and front faces',()=>{
  for(const h of [{x:0,y:0},{x:-28,y:28},{x:56,y:-28}])for(let x=-4.7;x<=4.7;x+=.47)for(let y=-5.7;y<=-.3;y+=.27){const depth=Layers.actor({x:h.x+x,y:h.y+y},[h]);assert.ok(depth>Layers.rear(h));assert.ok(depth<Layers.front(h));}
});
test('Exterior front and right stay visible, rear and left stay behind the shell',()=>{
  const h={x:0,y:0};for(const p of [{x:-4.7,y:.4},{x:4.7,y:.4},{x:5.5,y:-5.5}])assert.ok(Layers.actor(p,[h])>Layers.front(h));
  for(const p of [{x:0,y:-6.6},{x:-5.5,y:-3}])assert.ok(Layers.actor(p,[h])<Layers.rear(h));
});
test('Expanded keyboard and analog movement have uniform screen speed and unit facing',()=>{
  const measure=(input,run=false)=>{const g=new S.Game();g.obstacles=()=>[];g.player.x=12;g.player.y=12;g.seconds=1;g.movePlayer(1,{...input,run});const dx=g.player.x-12,dy=g.player.y-12;assert.ok(Math.abs(Math.hypot(g.player.facing.x,g.player.facing.y)-1)<1e-9);return Math.hypot(dx-dy,(dx+dy)*.5);};
  const inputs=[{up:true},{down:true},{left:true},{right:true},{up:true,left:true},{up:true,right:true},{down:true,left:true},{down:true,right:true}];
  for(const input of inputs){assert.ok(Math.abs(measure(input)-2*Math.SQRT2)<1e-9);assert.ok(Math.abs(measure(input,true)-4*Math.SQRT2)<1e-9);}
  for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI*3/4])assert.ok(Math.abs(measure({moveX:.5*Math.cos(angle),moveY:.5*Math.sin(angle)})-Math.SQRT2)<1e-9);
});
console.log(`${passed}/${passed} developer, movement and layer checks passed.`);
