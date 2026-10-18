const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const plan=read('prompts.json'),m=read('manifest.json'),validation=read('validation.json');
assert.equal(m.atlases.length,56);assert.equal(m.frames.length,392);
assert.equal(new Set(m.frames.map(f=>f.id)).size,392);assert.equal(new Set(m.atlases.map(a=>a.file)).size,56);
for(const field of ['missing','invalidAlphaOrEmpty','nativeSourceMismatch','unexpectedContentInEmptyCells','gridGutterWarnings'])assert.deepEqual(validation[field],[],field);
const atlases=new Map(m.atlases.map(a=>[a.id,a]));const clips=[];
for(const w of m.weapons)for(const d of m.directions){
 const group=m.frames.filter(f=>f.weapon===w.id&&f.direction===d.id);assert.equal(group.length,7);
 for(const [action,count] of Object.entries(m.frameCounts)){
  const frames=group.filter(f=>f.action===action).sort((a,b)=>a.frame-b.frame);assert.equal(frames.length,count);
  const sequence=action==='run'?[1,2,3,2]:action==='attack'?[1,2,3]:[1];
  clips.push({id:w.id+'_'+d.id+'_'+action,weapon:w.id,direction:d.id,action,loop:action!=='attack',frames:sequence.map(n=>frames[n-1].id),...(action==='attack'?{returnTo:w.id+'_'+d.id+'_idle',impactOrReleaseFrame:frames[1].id}:{})});
 }
}
for(const f of m.frames){const a=atlases.get(f.atlas);assert(a&&a.sourceVerified);const [x,y,w,h]=f.rect;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=a.size[0]&&y+h<=a.size[1],f.id);}
for(const j of plan.jobs){const record=read('records/'+j.id+'.json');assert.equal(record.prompt,j.prompt,j.id+' actual prompt');assert.deepEqual(record.refs,j.refs,j.id+' references');}
const clipsFile={format:'frame-id-sequences',manifest:'manifest.json',timingNote:'Choose playback speed, world footpoint and damage/cooldown timing in the engine. Frame2 is an artwork cue, not a combat rule.',clips};
fs.writeFileSync(path.join(root,'clips.json'),JSON.stringify(clipsFile,null,2)+'\n');
for(const file of ['catalog.js','alignment.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const html=fs.readFileSync(path.join(root,'preview.html'),'utf8');for(const [i,match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries())if(match[1].trim())new vm.Script(match[1],{filename:'preview-inline-'+i});
const report={atlases:56,frames:392,clips:clips.length,uniqueFrameIds:true,frameRectanglesInBounds:true,recordPromptsMatch:true,previewScriptSyntax:'passed',checkedAt:new Date().toISOString()};
fs.writeFileSync(path.join(root,'metadata-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
