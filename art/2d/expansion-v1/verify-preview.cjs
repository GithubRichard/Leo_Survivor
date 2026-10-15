const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const pages = ['../preview.html','../player-run-v1/preview.html','preview.html'];
for (const rel of pages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (block[1].trim()) new vm.Script(block[1], {filename: rel});
  }
}
const context = {window:{}}; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),context);
const catalog = context.window.EXPANSION_CATALOG;
if (catalog.length !== 146 || new Set(catalog.map(x=>x.id)).size !==146) throw Error('Bad catalog');
const animations = JSON.parse(fs.readFileSync(path.join(root,'../player-run-v1/manifest.json'),'utf8'));
if(animations.frameCount!==24||Object.keys(animations.animations).length!==8) throw Error('Bad run manifest');
for(const animation of Object.values(animations.animations)){
 if(animation.frames.length!==3)throw Error('Missing run phase');
 for(const frame of animation.frames)if(!fs.existsSync(path.join(root,'../player-run-v1',frame.file)))throw Error(frame.file);
}
const existing=catalog.filter(x=>fs.existsSync(path.join(root,x.file)));
for(const item of existing){
 const b=fs.readFileSync(path.join(root,item.file));
 if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(item.file+' is not PNG');
}
console.log(JSON.stringify({htmlScripts:'syntax-valid',catalog:catalog.length,runFrames:24,expansionSaved:existing.length,expansionMissing:146-existing.length}));
