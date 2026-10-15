const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../expansion.js');
const D = require('../expansion-data.js');
const {Game} = S;
const save = game => JSON.parse(JSON.stringify(game.snapshot()));
const reload = game => Game.restore(save(game));
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
function discardWood(game) {
  game.selectedSlot = game.inventory.findIndex(s => s?.kind === 'wood');
  assert.equal(game.drop(), true);
}

check('manual drops retain item, amount and world position after a JSON save', () => {
  const game = new Game(); game.player.x = 12.25; game.player.y = -11.5;
  discardWood(game);
  const restored = reload(game);
  assert.deepEqual(restored.drops, [{kind:'wood', amount:1, x:12.25, y:-11.5}]);
  assert.equal(restored.count('wood'), 12);
});

check('snapshot and restore do not share mutable drop objects', () => {
  const game = new Game(); discardWood(game);
  const data = game.snapshot();
  assert.deepEqual(data.drops, game.drops);
  game.drops[0].amount = 4;
  assert.equal(data.drops[0].amount, 1);
  const restored = Game.restore(data); restored.drops[0].amount = 8;
  assert.equal(data.drops[0].amount, 1);
});

check('legacy version 1 save without drops restores an empty usable list', () => {
  const data = save(new Game()); delete data.drops;
  const restored = Game.restore(data);
  assert.deepEqual(restored.drops, []);
  discardWood(restored); assert.equal(restored.drops.length, 1);
});

check('null drop list falls back to an empty list', () => {
  const data = save(new Game()); data.drops = null;
  const restored = Game.restore(data);
  assert.deepEqual(restored.drops, []);
  discardWood(restored); assert.equal(restored.drops.length, 1);
});

check('destroyed building refunds and stored contents survive a save', () => {
  const game = new Game();
  const device = {id:'device:0',type:'device',kind:'storage_chest',x:0,y:2,hp:18,maxHP:18,material:'wood',invested:{wood:5,iron:2},storage:[{kind:'cloth',amount:3}],output:[],jobs:[]};
  game.devices.push(device); game.damageBuilding(device,18);
  assert.deepEqual(game.drops.map(({kind,amount}) => ({kind,amount})), [{kind:'wood',amount:2},{kind:'iron',amount:1},{kind:'cloth',amount:3}]);
  const restored = reload(game);
  assert.deepEqual(restored.drops, game.drops);
  const twice = reload(restored); assert.deepEqual(twice.drops, game.drops);
  assert.equal(twice.devices[0].hp, 0);
});

check('loot released from an unsearched destroyed container survives a save', () => {
  const game = new Game(), site = game.getHome(0,0).sites.find(s => s.kind === 'supply');
  game.damageBuilding(site,site.hp);
  assert.equal(game.drops.length, 3);
  const restored = reload(game);
  assert.deepEqual(restored.drops, game.drops);
  assert.equal(restored.find(site.id).hp, 0);
});

for (const [day, reward] of [[7,{parts:2,cloth:2}],[14,{parts:3,canned_food:2}]]) {
  check('night ' + day + ' rewards survive the dawn autosave and are awarded once', () => {
    const game = new Game(); game.day = day; game.minutes = 1740; game.dawn();
    assert.equal(game.autosaveRequested, true);
    const expected = Object.entries(reward).map(([kind,amount]) => ({kind,amount,x:0,y:2}));
    const restored = reload(game);
    assert.equal(restored.day, day+1); assert.deepEqual(restored.drops, expected);
    restored.minutes = 1740; restored.dawn();
    assert.deepEqual(reload(restored).drops, expected);
  });
}

check('restored drops can be picked up once and stay removed on the next save', () => {
  const game = new Game(); discardWood(game);
  const restored = reload(game), drop = restored.drops[0];
  assert.equal(restored.interact({type:'drop',object:drop}), true);
  assert.equal(restored.count('wood'),13);
  assert.equal(restored.interact({type:'drop',object:drop}), false);
  assert.deepEqual(reload(restored).drops, []);
});

check('full backpack leaves restored drops on the ground', () => {
  const game = new Game(); discardWood(game);
  const restored = reload(game);
  restored.inventory = Array.from({length:20}, () => ({kind:'iron',amount:99}));
  assert.equal(restored.interact({type:'drop',object:restored.drops[0]}), false);
  assert.deepEqual(reload(restored).drops, game.drops);
});

check('all searched containers retain their identity after saving', () => {
  const game = new Game();
  for (const [cx,cy] of [[0,0],[1,0],[-1,0],[0,-1],[0,2]]) {
    for (const site of game.getHome(cx,cy).sites.filter(s => s.blocking)) site.searched = true;
  }
  const restored = reload(game);
  for (const home of [...restored.homes.values()]) for (const site of home.sites.filter(s => s.blocking)) {
    restored.player.x = site.x; restored.player.y = site.y;
    const target = restored.nearbyInteraction();
    assert.equal(target?.object.id,site.id);
    assert.equal(target.type,'container'); assert.equal(site.type,'site');
    assert.equal(restored.interact({type:'site',object:site}),false);
  }
});

check('empty container menu names every container and offers dismantling only', () => {
  const context = {ExpansionData:D,Survival:S,GameArt:{entries:{}},window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../expansion-ui.js'),'utf8'),context);
  const game = new Game();
  for (const [cx,cy] of [[0,0],[1,0],[-1,0],[0,-1],[0,2]]) for (const site of game.getHome(cx,cy).sites.filter(s => s.blocking)) {
    site.searched = true;
    const html = context.window.ExpansionUI.context(game,{type:'container',object:site});
    assert.ok(html.includes('<h2>'+D.siteNames[site.kind]+'</h2>'));
    assert.ok(html.includes('data-command="dismantle"'));
    assert.ok(!html.includes('墙 / 围栏'));
    assert.ok(!html.includes('data-command="repair"'));
    assert.ok(!html.includes('data-command="upgrade"'));
  }
});

check('searched water points remain repeatable after a save', () => {
  const game = new Game(), water = game.getHome(0,0).sites.find(s => s.kind === 'water_point');
  water.searched = true;
  const restored = reload(game), target = restored.find(water.id);
  restored.player.x = target.x; restored.player.y = target.y;
  assert.equal(restored.nearbyInteraction()?.type,'site');
  assert.equal(restored.interact({type:'site',object:target}),true);
  restored.updateAction(target.time);
  assert.equal(restored.count('raw_water'),4);
  assert.equal(restored.interact({type:'site',object:target}),true);
  restored.updateAction(target.time);
  assert.equal(restored.count('raw_water'),8);
});

check('dismantled empty containers stay removed without duplicating loot', () => {
  const game = new Game(), site = game.getHome(0,0).sites.find(s => s.kind === 'misc');
  site.searched = true; game.player.x = site.x; game.player.y = site.y;
  const before = game.resources();
  assert.equal(game.dismantle(site),true); game.updateAction(3);
  assert.equal(site.hp,0); assert.deepEqual(game.resources(),before);
  assert.equal(reload(game).find(site.id).hp,0);
  assert.equal(game.dismantle(site),false);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
