const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=__dirname,read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const plan=read(path.join(root,'prompts.json'));
for(const type of ['brute','spitter','demolisher','screamer'])for(const job of read(path.join(root,'prompts-enemy-'+type+'.json'))){
 if(job.id==='zombie_brute_south')delete job.refs;
 const i=plan.jobs.findIndex(a=>a.id===job.id);if(i<0)throw Error('Unknown '+job.id);plan.jobs[i]=job;
}
const ledger=[];
const oldLog=path.join(root,'generation-log.jsonl');
if(fs.existsSync(oldLog))for(const line of fs.readFileSync(oldLog,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(a=>a.trim()))ledger.push(JSON.parse(line.replace(/^\uFEFF/,'')));
for(const f of fs.readdirSync(root).filter(f=>/^generation-records-\d+\.json$/.test(f)).sort())ledger.push(...read(path.join(root,f)));
for(const f of ['revision-hurt-border.json','revision-pharmacy.json'])if(fs.existsSync(path.join(root,f))){
 const revision=read(path.join(root,f));ledger.push(revision);
 const j=plan.jobs.find(a=>a.id===revision.id);j.prompt=revision.prompt;j.finalRevisionSource=revision.source;
}
const unique=[...new Map(ledger.map(r=>[r.id+'|'+r.source,r])).values()];
fs.writeFileSync(oldLog,unique.map(r=>JSON.stringify(r)).join('\n')+'\n');
fs.writeFileSync(path.join(root,'prompts.json'),JSON.stringify(plan,null,2)+'\n');
const nativeRoot='C:/Users/79264/.codex/generated_images/01a12907-9d78-7eb1-893c-1aaa8372cd15';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const wantedSizes=new Set(plan.jobs.filter(j=>fs.existsSync(path.join(root,j.file))).map(j=>fs.statSync(path.join(root,j.file)).size));
const origins=new Map();
for(const file of fs.readdirSync(nativeRoot).filter(p=>p.endsWith('.png'))){
 const source=path.join(nativeRoot,file);if(!wantedSizes.has(fs.statSync(source).size))continue;
 const key=hash(source);if(!origins.has(key))origins.set(key,source);
}
const records=plan.jobs.map(j=>{
 const output=path.join(root,j.file);if(!fs.existsSync(output))return{id:j.id,status:'missing'};
 const sha256=hash(output),source=origins.get(sha256)||null;
 return{id:j.id,file:j.file,sha256,source,status:source?'source-verified':'source-not-found'};
});
fs.writeFileSync(path.join(root,'provenance.json'),JSON.stringify({checkedAt:new Date().toISOString(),method:'Unchanged native PNG bytes verified by SHA-256. prompts.json is the final design plan; generation-log.jsonl contains recorded calls, including superseded revisions.',records},null,2)+'\n');
for(const file of ['preview.html','model-review.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1],{filename:file});
}
console.log(JSON.stringify({planned:plan.jobs.length,sourceVerified:records.filter(a=>a.status==='source-verified').length,missing:records.filter(a=>a.status==='missing').map(a=>a.id),sourceNotFound:records.filter(a=>a.status==='source-not-found').map(a=>a.id),recordedCalls:unique.length,previewScripts:'syntax-valid'}));
if(records.some(a=>a.status!=='source-verified'))process.exitCode=1;
