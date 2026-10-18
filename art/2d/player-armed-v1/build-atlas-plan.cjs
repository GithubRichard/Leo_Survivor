const fs=require('node:fs'),path=require('node:path');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'individual-reference-plan.json'),'utf8').replace(/^\uFEFF/,''));
const plan=(function makeAtlasPlan(original){
 const jobs=[],frames=[],seq=["idle","run","run","run","attack","attack","attack"],num=[1,1,2,3,1,2,3];
 for(const w of original.weapons)for(const d of original.directions){
  const sourceJobs=original.jobs.filter(j=>j.weapon===w.id&&j.direction===d.id);
  const idle=sourceJobs.find(j=>j.action==="idle"),id="atlas_"+w.id+"_"+d.id,file="atlas/"+w.id+"_"+d.id+".png";
  const cells=seq.map((a,i)=>sourceJobs.find(j=>j.action===a&&j.frame===num[i]));
  const character="short angular charcoal black hair, blank beige face without eyes or facial details, muted dark ochre open jacket with simple lapels over charcoal shirt, dark gray cargo trousers with one thigh pocket, block dark boots. Preserve this exact protagonist, same clothes, limb thickness and proportions";
  const poseText=cells.map((j,i)=>"CELL "+(i+1)+" (row "+(Math.floor(i/3)+1)+", column "+(i%3+1)+"): "+j.phase+". "+j.prompt.substring(j.prompt.indexOf(j.action==="idle"?" STANDING STILL:":j.action==="run"?" RUN frame":" ATTACK frame"))).join("\n");
  const directionText=idle.prompt.match(/ Facing [\s\S]+? Weapon identity:/)?.[0].replace(" Weapon identity:","");
  const weaponText=idle.prompt.match(/ Weapon identity: [\s\S]+? Always visibly grip/)?.[0].replace(" Always visibly grip","");
  const prompt="Use case: stylized-concept. Asset type: ONE production game animation SPRITE ATLAS for ONE protagonist, ONE weapon, ONE viewing direction. A strict 3 COLUMN by 3 ROW grid of exactly equal square cells on a square canvas. Only SEVEN occupied cells: row1 cells1-3, row2 cells4-6, row3 ONLY cell7 at LEFT; bottom-middle and bottom-right cells8-9 completely empty transparent. Read order left-to-right, top-to-bottom. No grid lines, boxes, labels, text, borders, background or shadows. Entire canvas genuinely transparent outside the seven figures. Each occupied cell has exactly ONE full body character and its held weapon, never overlaps another cell. Center each character in its own cell; all seven figures have EXACTLY the same body scale and head size, aligned pelvis and consistent baseline. Generous transparent margin INSIDE each cell, especially for weapon reach. Keep body approximately 58 percent of cell height so spear and swings fit. Minimal basic geometric polygon 2D cutout art, few large flat matte faces; dark charcoal gray and muted dark ochre, no fine texture, no realism, no glow or hazy halos. Fixed elevated 45-degree orthographic game camera. Input image 1 is protagonist identity and camera reference ONLY, ignore its running pose. Input image 2 is the weapon shape ONLY, ignore its large display scale. Character: "+character+"."+directionText+weaponText+". Anatomical handedness stays fixed across all cells, exactly TWO arms and TWO legs per figure. All seven faces/torso/feet and attack actions maintain this SAME viewing direction.\n"+poseText+"\nStrict grid coordinates: each column exactly one third of canvas width; each row exactly one third of canvas height. Occupied cells 1-7 only; 8-9 truly empty. No detached projectiles, targets or extra figures. All motion is shown by actual changed limb positions, not ghosting or motion trails.";
  const atlasFrames=cells.map((j,i)=>({...Object.fromEntries(Object.entries(j).filter(([k])=>!["prompt","refs","deps","file"].includes(k))),file,atlas:id,cell:i+1,col:i%3,row:Math.floor(i/3)}));
  frames.push(...atlasFrames);jobs.push({id,file,weapon:w.id,weaponLabel:w.label,direction:d.id,directionLabel:d.label,grid:[3,3],occupiedCells:7,refs:idle.refs,frames:atlasFrames,prompt});
 }
 return{version:1,format:"transparent-png-atlas-with-frame-rectangles",tool:"built-in image_gen",expectedAtlases:56,expectedFrames:392,weapons:original.weapons,directions:original.directions,frameCounts:original.frameCounts,runSequence:[1,2,3,2],attackSequence:[1,2,3],jobs,frames};
})(original);
// Reapply recorded final edits when rebuilding the plan.
const revisionsPath=path.join(__dirname,'prompt-revisions.json');
if(fs.existsSync(revisionsPath))for(const rev of JSON.parse(fs.readFileSync(revisionsPath,'utf8').replace(/^\uFEFF/,''))){const job=plan.jobs.find(j=>j.id===rev.id);if(job){job.prompt=rev.prompt;job.refs=rev.refs;}}
fs.mkdirSync(path.join(__dirname,'atlas'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'prompts.json'),JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'catalog.js'),'window.ARMED_CATALOG='+JSON.stringify({...plan,jobs:undefined,frames:plan.frames})+';\n');
console.log(JSON.stringify({atlases:plan.jobs.length,frames:plan.frames.length}));
